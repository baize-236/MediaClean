import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {filterFor,mediaKind,normalizeOptions,pixelRegion,probe,processMedia,safeName} from '../src/processor.js';
const exec=promisify(execFile);

test('高斯模糊强度、羽化和选区外像素',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'mediaclean-blur-')),input=join(dir,'in.png');
 await exec('ffmpeg',['-y','-f','lavfi','-i','testsrc=size=128x128','-frames:v','1',input]);
 const pixels=async file=>(await exec('ffmpeg',['-v','error','-i',file,'-f','rawvideo','-pix_fmt','rgb24','-frames:v','1','pipe:1'],{encoding:'buffer'})).stdout;
 const original=await pixels(input),results=[];
 for(const [i,settings] of [{blurStrength:10,blurFeather:0},{blurStrength:95,blurFeather:0},{blurStrength:95,blurFeather:30}].entries()){
  const output=join(dir,i+'.png');await processMedia({input,output,kind:'image',options:{mode:'blur',quality:'balanced',region:{x:.25,y:.25,w:.5,h:.5},...settings}});
  const data=await pixels(output);assert.equal(data.length,original.length);results.push(data);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++)if(x<32||x>=96||y<32||y>=96){const p=(y*128+x)*3;assert.ok(data.subarray(p,p+3).equals(original.subarray(p,p+3)),'选区外不应变化');}
 }
 assert.ok(!results[0].equals(results[1]),'强度应改变输出');
 let hard=0,soft=0;for(let y=32;y<96;y++)for(let k=0;k<3;k++){const p=(y*128+32)*3+k;hard+=Math.abs(results[1][p]-original[p]);soft+=Math.abs(results[2][p]-original[p]);}
 assert.ok(hard>0&&soft<hard,'羽化应减少边缘突变');
 const edge=join(dir,'edge.png');await processMedia({input,output:edge,kind:'image',options:{mode:'blur',quality:'balanced',region:{x:0,y:0,w:.02,h:.02}}});assert.equal((await probe(edge)).width,128);
});

test('校验文件、区域和安全文件名',()=>{
 assert.equal(mediaKind('a.JPG'),'image');assert.equal(mediaKind('a.mp4'),'video');assert.equal(mediaKind('a.exe'),'');
 assert.equal(normalizeOptions({mode:'lama',region:{x:0,y:0,w:.1,h:.1}}).mode,'lama');
 assert.equal(normalizeOptions({mode:'video-repair',referenceTime:2,region:{x:0,y:0,w:.1,h:.1}}).referenceTime,2);
 assert.throws(()=>normalizeOptions({mode:'video-repair',referenceTime:-1,region:{x:0,y:0,w:.1,h:.1}}),/参考时间/);
 const precise={mode:'lama',region:{x:.1,y:.1,w:.5,h:.5},strokes:[{type:'paint',size:.03,points:[[.2,.2],[.4,.4]]},{type:'erase',size:.01,points:[[.3,.3]]}]};
 assert.equal(normalizeOptions(precise).strokes[1].type,'erase');
 assert.throws(()=>normalizeOptions({...precise,mode:'repair'}),/仅支持 AI/);
 assert.throws(()=>normalizeOptions({...precise,strokes:[{type:'paint',size:.03,points:[[2,.1]]}]}),/坐标/);
 assert.throws(()=>normalizeOptions({...precise,strokes:[{type:'paint',size:.03,points:Array(1501).fill([.2,.2])}]}),/复杂/);
 assert.equal(safeName('../坏:名字?.mp4'),'_坏_名字_.mp4');
 assert.throws(()=>normalizeOptions({region:{x:.9,y:.1,w:.2,h:.2}}),/超出/);
 assert.deepEqual(pixelRegion({x:.5,y:.5,w:.25,h:.25},320,240),{x:160,y:120,w:80,h:60});
 assert.match(filterFor('repair',{x:1,y:2,w:3,h:4}),/delogo/);assert.match(filterFor('blur',{x:1,y:2,w:3,h:4}),/gblur/);
 assert.throws(()=>normalizeOptions({region:{x:0,y:0,w:.5,h:.5},blurStrength:101}),/模糊参数/);
});

test('真实 FFmpeg 处理图片与视频',async()=>{
 await assert.rejects(processMedia({kind:'video',options:{mode:'lama'}}),/仅支持图片/);
 const dir=await mkdtemp(join(tmpdir(),'mediaclean-')),image=join(dir,'input.png'),video=join(dir,'input.mp4');
 await exec('ffmpeg',['-y','-f','lavfi','-i','color=c=blue:s=320x240:d=1','-vf','drawbox=x=220:y=170:w=70:h=35:color=white:t=fill','-frames:v','1',image]);
 await exec('ffmpeg',['-y','-f','lavfi','-i','testsrc=size=320x240:rate=15:duration=1','-pix_fmt','yuv420p',video]);
 const options={mode:'repair',quality:'balanced',region:{x:.68,y:.68,w:.24,h:.18}},imageOut=join(dir,'image-out.png');
 await processMedia({input:image,output:imageOut,kind:'image',options});assert.ok((await stat(imageOut)).size>100);
 for(const [i,region] of [
 {x:0.8799202681094342,y:0.9473123147242221,w:0.12007973189056576,h:0.05268768527577794},
 {x:0,y:0,w:.2,h:.2},{x:.8,y:0,w:.2,h:.2},{x:0,y:.8,w:.2,h:.2}
 ].entries()){
 const output=join(dir,'edge-'+i+'.png');
 await processMedia({input:image,output,kind:'image',options:{...options,region}});
 const dimensions=await probe(output);assert.equal(dimensions.width,320);assert.equal(dimensions.height,240);
 }
 const videoOut=join(dir,'video-out.mp4');await processMedia({input:video,output:videoOut,kind:'video',options:{...options,mode:'blur'}});
 const info=await probe(videoOut);assert.equal(info.width,320);assert.equal(info.height,240);assert.ok((await stat(videoOut)).size>1000);
});
