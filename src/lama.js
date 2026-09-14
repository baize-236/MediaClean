import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {access} from 'node:fs/promises';
import {python} from './runtime.js';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function inpaint({input,output,region,strokes,onProgress}){
 try{await access(python);await access(join(root,'models','big-lama.pt'));}catch{throw Error('LaMa 尚未安装完整，请先安装本地模型环境');}
 onProgress?.(10);
 return new Promise((resolve,reject)=>{
  const child=spawn(python,[join(root,'scripts','lama_inpaint.py')],{windowsHide:true,env:{...process.env,PYTHONUTF8:'1'}});
  let outputText='',errorText='',timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;child.kill();},180000);
  child.stdout.on('data',d=>outputText=(outputText+d).slice(-10000));child.stderr.on('data',d=>errorText=(errorText+d).slice(-3000));
  child.on('error',e=>{clearTimeout(timer);reject(Error('无法启动 LaMa：'+e.message));});
  child.stdin.on('error',()=>{});
  child.on('close',code=>{clearTimeout(timer);if(timedOut)return reject(Error('LaMa 处理超过 3 分钟，请缩小选区后重试'));
   if(code!==0)return reject(Error('LaMa 修复失败：'+errorText.trim().slice(-600)));
   try{const result=JSON.parse(outputText.trim());onProgress?.(95);resolve(result);}catch{reject(Error('LaMa 未返回有效结果'));}
  });
  child.stdin.end(JSON.stringify({input,output,region,strokes}));
 });
}
