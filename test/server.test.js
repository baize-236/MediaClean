import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'node:net';
const exec=promisify(execFile);
async function port(){return new Promise((resolve,reject)=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(e=>e?reject(e):resolve(p));});});}
async function wait(url){for(let i=0;i<50;i++){try{const r=await fetch(url);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('服务未启动');}

test('上传、排队、真实处理及下载',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'mediaclean-api-')),input=join(dir,'sample.png'),listen=await port();
 await exec('ffmpeg',['-y','-f','lavfi','-i','color=c=green:s=240x180:d=1','-frames:v','1',input]);
 const child=spawn(process.execPath,['server.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(listen),MEDIA_CLEAN_DATA_DIR:join(dir,'data')},stdio:'ignore',windowsHide:true});t.after(()=>child.kill());
 const base='http://127.0.0.1:'+listen;await wait(base+'/api/tasks');
 const options=encodeURIComponent(JSON.stringify({mode:'repair',quality:'balanced',region:{x:.5,y:.5,w:.2,h:.2}}));
 const response=await fetch(base+'/api/tasks',{method:'POST',headers:{'X-File-Name':encodeURIComponent('测试图片.png'),'X-Clean-Options':options},body:await readFile(input)});assert.equal(response.status,202);const id=(await response.json()).task.id;
 let task;for(let i=0;i<80;i++){task=(await (await fetch(base+'/api/tasks')).json()).tasks.find(t=>t.id===id);if(['done','failed'].includes(task.status))break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(task.status,'done',task.error);const download=await fetch(base+task.download);assert.equal(download.status,200);assert.match(download.headers.get('content-type'),/image\/png/);assert.ok((await download.arrayBuffer()).byteLength>100);
 const before=await fetch(base+'/api/preview/'+id+'/before');assert.equal(before.status,200);assert.deepEqual(Buffer.from(await before.arrayBuffer()),await readFile(input));
 const after=await fetch(base+'/api/preview/'+id+'/after');assert.equal(after.status,200);assert.match(after.headers.get('content-type'),/image\/png/);
 const partial=await fetch(base+'/api/preview/'+id+'/after',{headers:{Range:'bytes=0-9'}});assert.equal(partial.status,206);assert.equal((await partial.arrayBuffer()).byteLength,10);
 assert.equal((await fetch(base+'/api/tasks/'+id,{method:'DELETE'})).status,200);
 assert.equal((await fetch(base+'/api/preview/'+id+'/before')).status,404);
});
