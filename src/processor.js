import {spawn} from 'node:child_process';
import {extname} from 'node:path';
import {inpaint} from './lama.js';

export const IMAGE_EXTENSIONS=new Set(['.jpg','.jpeg','.png','.webp','.bmp']);
export const VIDEO_EXTENSIONS=new Set(['.mp4','.mov','.mkv','.avi','.webm','.m4v']);

export function mediaKind(filename){
 const ext=extname(filename).toLowerCase();
 if(IMAGE_EXTENSIONS.has(ext))return 'image';
 if(VIDEO_EXTENSIONS.has(ext))return 'video';
 return '';
}

export function safeName(name){
 const base=String(name||'media').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/^\.+|\.+$/g,'').trim();
 return (base||'media').slice(0,160);
}

export function normalizeOptions(value){
 const mode=['lama','blur','repair','video-repair'].includes(value?.mode)?value.mode:'repair';
 const quality=['small','balanced','high'].includes(value?.quality)?value.quality:'balanced';
 const r=value?.region||{},region={x:Number(r.x),y:Number(r.y),w:Number(r.w),h:Number(r.h)};
 if(Object.values(region).some(n=>!Number.isFinite(n)))throw Error('水印区域无效');
 if(region.x<0||region.y<0||region.w<=0||region.h<=0||region.x+region.w>1.001||region.y+region.h>1.001)throw Error('水印区域超出画面');
 if(region.w<0.005||region.h<0.005)throw Error('水印区域太小');
 let strokes;
 if(value.strokes!==undefined){
  if(mode!=='lama')throw Error('精细选区仅支持 AI 修复，请切回 AI 修复或重新框选');
  if(!Array.isArray(value.strokes)||!value.strokes.length||value.strokes.length>100)throw Error('选区笔画数量无效');
  let count=0;
  strokes=value.strokes.map(s=>{
   if(!['rect','paint','erase'].includes(s.type)||!Array.isArray(s.points)||!s.points.length)throw Error('笔画无效');
   count+=s.points.length;if(count>1500)throw Error('选区过于复杂，请分次处理');
   const points=s.points.map(p=>{if(!Array.isArray(p)||p.length!==2||p.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>1))throw Error('笔画坐标无效');return p;});
   if(s.type==='rect'&&points.length!==2)throw Error('矩形无效');
   if(s.type!=='rect'&&(!Number.isFinite(s.size)||s.size<.001||s.size>.3))throw Error('画笔大小无效');
   return {type:s.type,points,...(s.type==='rect'?{}:{size:s.size})};
  });
 }
 const blurStrength=Number(value.blurStrength??55),blurFeather=Number(value.blurFeather??15);
 if(!Number.isFinite(blurStrength)||blurStrength<1||blurStrength>100||!Number.isFinite(blurFeather)||blurFeather<0||blurFeather>40)throw Error('模糊参数无效');
 const referenceTime=Number(value.referenceTime??0);
 if(!Number.isFinite(referenceTime)||referenceTime<0||referenceTime>30)throw Error('参考时间无效');
 return {mode,quality,region,blurStrength,blurFeather,referenceTime,...(strokes?{strokes}:{})};
}

export function pixelRegion(region,width,height){
 let x=Math.floor(region.x*width),y=Math.floor(region.y*height);
 let w=Math.ceil(region.w*width),h=Math.ceil(region.h*height);
 x=Math.max(0,Math.min(x,width-2));y=Math.max(0,Math.min(y,height-2));
 w=Math.max(2,Math.min(w,width-x));h=Math.max(2,Math.min(h,height-y));
 if(x+w>width)w=width-x;if(y+h>height)h=height-y;
 return {x,y,w,h};
}

function run(command,args,onProgress){
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{windowsHide:true});let error='';
  child.stderr.on('data',chunk=>{error=(error+chunk).slice(-12000);const m=/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g;let hit;while((hit=m.exec(chunk.toString())))onProgress?.(+hit[1]*3600+ +hit[2]*60+ +hit[3]);});
  child.on('error',e=>reject(Error(command+' 启动失败：'+e.message)));
  child.on('close',code=>code===0?resolve():reject(Error('媒体处理失败：'+(error.trim().split(/\r?\n/).slice(-3).join(' ')||'FFmpeg 返回 '+code))));
 });
}

export async function probe(file){
 return new Promise((resolve,reject)=>{
  const child=spawn('ffprobe',['-v','error','-print_format','json','-show_streams','-show_format',file],{windowsHide:true});let out='',err='';
  child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);
  child.on('error',e=>reject(Error('ffprobe 启动失败：'+e.message)));
  child.on('close',code=>{if(code!==0)return reject(Error('无法读取媒体：'+err.trim()));try{const data=JSON.parse(out),video=data.streams.find(s=>s.codec_type==='video');if(!video?.width||!video?.height)throw Error();resolve({width:video.width,height:video.height,duration:Number(data.format?.duration||video.duration||0)});}catch{reject(Error('无法识别图片或视频尺寸'));}});
 });
}

export function filterFor(mode,{x,y,w,h},options={}){
 if(mode==='blur'){
  const strength=options.blurStrength??55,feather=options.blurFeather??15;
  const sigma=Math.max(.5,Math.min(80,Math.min(w,h)*(.015+strength/500)));
  const edge=Math.min(w,h)*feather/100;
  const t=`clip(min(min(X,W-1-X),min(Y,H-1-Y))/${Math.max(.001,edge)},0,1)`;
  const alpha=edge>0?`255*(${t})*(${t})*(3-2*(${t}))`:'255';
  return `[0:v]format=rgba,split=2[base][part];[part]crop=${w}:${h}:${x}:${y}:exact=1,gblur=sigma=${sigma}:steps=3,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*(${alpha})/255'[blur];[base][blur]overlay=${x}:${y}:format=auto[outv]`;
 }
 // Supply reference pixels outside the frame so edge selections remain valid.
 // Crop back afterwards to preserve the original dimensions and selection.
 return `pad=iw+8:ih+8:4:4,fillborders=left=4:right=4:top=4:bottom=4:mode=smear,delogo=x=${x+4}:y=${y+4}:w=${w}:h=${h}:show=0,crop=iw-8:ih-8:4:4`;
}

export async function processMedia({input,output,kind,options,onProgress}){
 if(options.mode==='video-repair')throw Error('视频 AI 修复需要先分析并确认水印轨迹');
 if(options.mode==='lama'){
  if(kind!=='image')throw Error('LaMa 当前仅支持图片，请为视频选择快速填补或区域模糊');
  return inpaint({input,output,region:options.region,strokes:options.strokes,onProgress});
 }
 const info=await probe(input),region=pixelRegion(options.region,info.width,info.height),filter=filterFor(options.mode,region,options);
 const crf={small:'28',balanced:'22',high:'18'}[options.quality];
 const args=options.mode==='blur'
  ? kind==='image'
   ? ['-y','-i',input,'-filter_complex',filter,'-map','[outv]','-frames:v','1',output]
   : ['-y','-i',input,'-filter_complex',filter,'-map','[outv]','-map','0:a?','-c:v','libx264','-preset','medium','-crf',crf,'-c:a','aac','-b:a','192k','-movflags','+faststart',output]
  : kind==='image'
   ? ['-y','-i',input,'-vf',filter,'-frames:v','1',output]
   : ['-y','-i',input,'-vf',filter,'-map','0:v:0','-map','0:a?','-c:v','libx264','-preset','medium','-crf',crf,'-c:a','aac','-b:a','192k','-movflags','+faststart',output];
 await run('ffmpeg',args,seconds=>onProgress?.(info.duration?Math.min(95,Math.round(seconds/info.duration*100)):50));
 return info;
}
