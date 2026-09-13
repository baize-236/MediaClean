import http from 'node:http';
import {createReadStream,createWriteStream} from 'node:fs';
import {mkdir,readFile,writeFile,rename,stat,unlink,copyFile} from 'node:fs/promises';
import {join,extname,resolve,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {mediaKind,normalizeOptions,processMedia,safeName} from './src/processor.js';
import {videoProcess} from './src/video.js';

const root=fileURLToPath(new URL('.',import.meta.url));
const publicDir=join(root,'public'),dataDir=process.env.MEDIA_CLEAN_DATA_DIR||join(root,'data'),uploadDir=join(dataDir,'uploads'),outputDir=join(dataDir,'outputs'),dbFile=join(dataDir,'tasks.json');
await Promise.all([mkdir(uploadDir,{recursive:true}),mkdir(outputDir,{recursive:true})]);
let tasks=[];try{tasks=JSON.parse(await readFile(dbFile,'utf8'));if(!Array.isArray(tasks))tasks=[];}catch{}
for(const task of tasks)if(['uploading','queued','processing'].includes(task.status)){task.status='failed';task.error='程序上次退出时任务尚未完成，请重新提交';}
let saveQueue=Promise.resolve();
function save(){const snapshot=JSON.stringify(tasks.slice(0,200),null,2);saveQueue=saveQueue.catch(()=>{}).then(async()=>{const temp=dbFile+'.tmp';await writeFile(temp,snapshot);await rename(temp,dbFile);});return saveQueue;}
await save();

let queue=Promise.resolve();
function publicTask(t){return {id:t.id,name:t.name,kind:t.kind,purpose:t.purpose||'repair',status:t.status,progress:t.progress,error:t.error||'',createdAt:t.createdAt,completedAt:t.completedAt||'',download:t.status==='done'&&t.purpose!=='tracking'?'/api/download/'+t.id:'',tracking:t.status==='done'&&t.purpose==='tracking',skippedFrames:t.metrics?.skippedFrames||0};}
function within(base,target){const full=resolve(target),parent=resolve(base);return full.startsWith(parent+sep);}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
function fail(message,status=400){const e=Error(message);e.status=status;throw e;}
function header(req,name,max=1000){const value=req.headers[name];if(typeof value!=='string'||value.length>max)fail('请求参数无效');return value;}

async function receive(req,file,maxBytes=2*1024*1024*1024){
 const announced=Number(req.headers['content-length']||0);if(announced>maxBytes)fail('文件不能超过 2GB',413);
 let size=0;const limiter=new Transform({transform(chunk,_encoding,callback){size+=chunk.length;if(size>maxBytes)return callback(Error('文件不能超过 2GB'));callback(null,chunk);}});
 await pipeline(req,limiter,createWriteStream(file,{flags:'wx'}));if(!size)fail('文件为空');return size;
}

function enqueue(task){
 queue=queue.catch(()=>{}).then(async()=>{
  task.status='processing';task.progress=1;await save();
  try{
   const onProgress=p=>{task.progress=p;};
   if(task.purpose==='tracking')task.metrics=await videoProcess({action:'track',input:task.input,options:task.options},onProgress);
   else if(task.purpose==='video-repair')task.metrics=await videoProcess({action:'repair',input:task.input,output:task.output,options:task.options,tracking:task.trackingData,preview:task.preview},onProgress);
   else task.metrics=await processMedia({input:task.input,output:task.output,kind:task.kind,options:task.options,onProgress});
   delete task.trackingData;task.status='done';task.progress=100;task.completedAt=new Date().toISOString();
  }
  catch(error){task.status='failed';task.error=error.message.slice(0,500);await unlink(task.output).catch(()=>{});}
  if(task.status!=='done')await unlink(task.input).catch(()=>{});await save();
 });
}

const server=http.createServer({maxHeaderSize:256*1024},async(req,res)=>{
 try{
  if(!/^127\.0\.0\.1:\d+$/.test(req.headers.host||''))fail('仅允许本机访问',403);
  const url=new URL(req.url,'http://127.0.0.1'),path=url.pathname;
  if(req.method==='GET'&&path==='/api/tasks')return json(res,200,{tasks:tasks.map(publicTask)});
  if(path.startsWith('/api/tracking/')){
   const id=path.slice('/api/tracking/'.length),source=tasks.find(t=>t.id===id&&t.purpose==='tracking'&&t.status==='done');
   if(!source)fail('轨迹不存在',404);
   if(req.method==='GET')return json(res,200,{tracking:source.metrics});
   if(req.method==='POST'){
    if(req.headers.origin&&req.headers.origin!=='http://'+req.headers.host)fail('请求来源无效',403);
    let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>2048)fail('请求过大',413);body+=chunk;}
    let value;try{value=JSON.parse(body);}catch{fail('请求参数无效');}
    if(value.confirmed!==true||typeof value.preview!=='boolean')fail('请先查看轨迹并确认修复');
    if(!source.metrics.matched)fail('没有可信的水印位置，请重新框选');
    const taskId=randomUUID(),input=join(uploadDir,taskId+extname(source.input)),output=join(outputDir,taskId+'.mp4');
    await copyFile(source.input,input);
    const task={id:taskId,name:(value.preview?'预览前3秒 · ':'视频修复 · ')+source.name,kind:'video',purpose:'video-repair',preview:value.preview,status:'queued',progress:0,error:'',createdAt:new Date().toISOString(),input,output,options:source.options,trackingData:source.metrics};
    tasks.unshift(task);await save();enqueue(task);return json(res,202,{task:publicTask(task)});
   }
   fail('接口不存在',404);
  }
  if(req.method==='POST'&&path==='/api/tasks'){
   if(req.headers.origin&&req.headers.origin!=='http://'+req.headers.host)fail('请求来源无效',403);
   let name;try{name=safeName(decodeURIComponent(header(req,'x-file-name',500)));}catch{fail('文件名无效');}
   const kind=mediaKind(name);if(!kind)fail('仅支持 JPG、PNG、WebP、BMP、MP4、MOV、MKV、AVI、WebM 和 M4V');
   let options;try{options=normalizeOptions(JSON.parse(decodeURIComponent(header(req,'x-clean-options',240000))));}catch(e){fail(e.message||'处理设置无效');}
   if(options.mode==='lama'&&kind!=='image')fail('LaMa 当前仅支持图片，请为视频选择快速填补或区域模糊');
   if(options.mode==='video-repair'&&kind!=='video')fail('视频修复仅支持视频');
   const id=randomUUID(),input=join(uploadDir,id+extname(name).toLowerCase()),output=join(outputDir,id+(kind==='image'?'.png':'.mp4'));
   const task={id,name,kind,purpose:options.mode==='video-repair'?'tracking':'repair',status:'uploading',progress:0,error:'',createdAt:new Date().toISOString(),input,output,options};tasks.unshift(task);await save();
   try{task.size=await receive(req,input);task.status='queued';await save();enqueue(task);return json(res,202,{task:publicTask(task)});}catch(e){tasks=tasks.filter(t=>t.id!==id);await unlink(input).catch(()=>{});await save();throw e;}
  }
  if(req.method==='DELETE'&&path.startsWith('/api/tasks/')){
   const id=path.slice('/api/tasks/'.length),task=tasks.find(t=>t.id===id);if(!task)fail('任务不存在',404);if(['uploading','queued','processing'].includes(task.status))fail('任务正在处理，暂时不能删除',409);
   if(task.output&&within(outputDir,task.output))await unlink(task.output).catch(()=>{});
   if(task.input&&within(uploadDir,task.input))await unlink(task.input).catch(()=>{});
   tasks=tasks.filter(t=>t.id!==id);await save();return json(res,200,{ok:true});
  }
  if(req.method==='GET'&&path.startsWith('/api/preview/')){
   const [,id,side]=path.slice('/api/preview'.length).split('/');
   const task=tasks.find(t=>t.id===id&&t.status==='done');if(!task||!['before','after'].includes(side))fail('预览不存在',404);
   if(side==='after'&&task.purpose==='tracking')fail('请先确认轨迹并修复',404);
   const file=side==='before'?task.input:task.output;if(!within(side==='before'?uploadDir:outputDir,file))fail('预览不存在',404);
   let info;try{info=await stat(file);}catch{fail('原素材已清理，请重新添加素材处理后对比',404);}
   const types={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.bmp':'image/bmp','.mp4':'video/mp4','.mov':'video/quicktime','.webm':'video/webm'};
   const headers={'Content-Type':types[extname(file).toLowerCase()]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-store'};
   if(req.headers.range){
    const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!match)fail('无效范围',416);
    const start=Number(match[1]),end=Math.min(match[2]?Number(match[2]):info.size-1,info.size-1);if(start>end||start>=info.size)fail('无效范围',416);
    res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${info.size}`});return createReadStream(file,{start,end}).pipe(res);
   }
   res.writeHead(200,{...headers,'Content-Length':info.size});return createReadStream(file).pipe(res);
  }
  if(req.method==='GET'&&path.startsWith('/api/download/')){
   const id=path.slice('/api/download/'.length),task=tasks.find(t=>t.id===id&&t.status==='done'&&t.purpose!=='tracking');if(!task||!within(outputDir,task.output))fail('结果不存在',404);
   const info=await stat(task.output),download=safeName(task.name.replace(/\.[^.]+$/,'')+'-已处理'+(task.kind==='image'?'.png':'.mp4'));
   res.writeHead(200,{'Content-Type':task.kind==='image'?'image/png':'video/mp4','Content-Length':info.size,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(download)}`,'X-Content-Type-Options':'nosniff'});return createReadStream(task.output).pipe(res);
  }
  if(req.method!=='GET')fail('接口不存在',404);
  const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/style-v2.css':'style-v2.css','/compare.css':'compare.css'},file=files[path];if(!file)fail('页面不存在',404);
  const content=await readFile(join(publicDir,file));res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(content);
 }catch(error){if(!res.headersSent)json(res,error.status||500,{error:error.message||'操作失败'});else res.destroy();}
});
server.listen(Number(process.env.PORT||3220),'127.0.0.1',()=>console.log('MediaClean 已启动：http://127.0.0.1:'+(process.env.PORT||3220)));
