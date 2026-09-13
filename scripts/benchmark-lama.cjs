const {readFile,writeFile,mkdir}=require('node:fs/promises');
const {spawn}=require('node:child_process');
const path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const tasks=JSON.parse(await readFile(path.join(root,'data/tasks.json'),'utf8'));
 const task=tasks.find(t=>t.kind==='image'&&t.status==='done');
 const reportDir=path.join(root,'data','lama-benchmark');await mkdir(reportDir,{recursive:true});
 const out=path.join(reportDir,'lama-result.png');
 const child=spawn(path.join(root,'.venv/Scripts/python.exe'),[path.join(root,'scripts/lama_inpaint.py')],{windowsHide:true,env:{...process.env,PYTHONUTF8:'1'}});
 let stdout='',stderr='';child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);
 child.stdin.end(JSON.stringify({input:task.input,output:out,region:task.options.region}));
 await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',c=>c===0?resolve():reject(Error(stderr)));});
 const report={...JSON.parse(stdout),input:task.input,output:out,region:task.options.region};
 await writeFile(path.join(reportDir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
