import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export function videoProcess(request,onProgress){
 return new Promise((resolve,reject)=>{
  const child=spawn(root+'.venv/Scripts/python.exe',[root+'scripts/video_repair.py'],{windowsHide:true,env:{...process.env,PYTHONUTF8:'1'}});
  let buffer='',errors='',result,finished=false;
  const timer=setTimeout(()=>{if(!finished){child.kill();reject(Error('视频处理超时，请缩短视频后重试'));}},60*60*1000);
  child.stdout.on('data',data=>{buffer+=data;let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);try{const item=JSON.parse(line);if(item.progress!==undefined)onProgress?.(item.progress);if(item.result)result=item.result;}catch{}}});
  child.stderr.on('data',data=>errors=(errors+data).slice(-3000));child.stdin.on('error',()=>{});
  child.on('error',error=>{finished=true;clearTimeout(timer);reject(error);});
  child.on('close',code=>{finished=true;clearTimeout(timer);if(code!==0||!result)reject(Error(errors.trim()||'视频处理未完成'));else resolve(result);});
  child.stdin.end(JSON.stringify(request));
 });
}
