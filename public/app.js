const $=s=>document.querySelector(s),supported=/\.(jpe?g|png|webp|bmp|mp4|mov|mkv|avi|webm|m4v)$/i;
let files=[],selected=-1,region=null,objectUrl='',drawing=null,tasks=[];
let strokes=[],history=[],tool='rect',zoom=1,uploading=false,previewId='';
let drawingReference=0;
const selections=new WeakMap(),stage=$('#preview-stage');
const referenceTimes=new WeakMap();
const modeChoices={image:'lama',video:'video-repair'};
let currentKind='';
function syncControls(){
 const file=files[selected],kind=file?(isVideo(file)?'video':'image'):'';
 if(kind&&kind!==currentKind)$(`[name="mode"][value="${modeChoices[kind]}"]`).checked=true;
 currentKind=kind;
 const mode=$('[name="mode"]:checked').value;
 document.querySelectorAll('[name="mode"]').forEach(input=>{
  const incompatible=(kind==='image'&&input.value==='video-repair')||(kind==='video'&&input.value==='lama');
  input.disabled=!kind||incompatible||uploading;
  const label=input.closest('.mode');label.classList.toggle('disabled',input.disabled);label.classList.toggle('active',!input.disabled&&input.checked);
  label.title=!kind?'请先添加素材':incompatible?(input.value==='lama'?'仅支持图片':'仅支持视频'):'';
  label.setAttribute('aria-disabled',String(input.disabled));
 });
 $('#material-context').textContent=kind?`当前：${kind==='image'?'图片':'视频'} · ${file.name}`:'添加素材后，自动显示可用的处理方式';
 $('#blur-settings').hidden=!kind||mode!=='blur';
 $('#video-repair-settings').hidden=kind!=='video'||mode!=='video-repair';
 $('#quality').closest('.field').hidden=kind!=='video';
 $('#video-timeline').hidden=kind!=='video';els.toggle.hidden=kind!=='video';
 const precise=kind==='image'&&mode==='lama';
 for(const name of ['paint','erase']){const button=$(`[data-tool="${name}"]`);button.disabled=!precise;button.title=precise?'':'仅图片 AI 修复可用';}
 $('#brush-size').closest('label').hidden=!precise;
 if(!precise&&['paint','erase'].includes(tool))$('[data-tool="rect"]').click();
 $('.editor-help').textContent=!kind?'先添加素材，再选择需要处理的区域。':precise?'支持多处框选、画笔和橡皮擦；放大后可拖动画面。':mode==='video-repair'?'暂停到水印清晰的一帧，框选一次，再分析移动轨迹。':'使用单个矩形覆盖水印；框选时在四周留一点边缘。';
 $('#preview-current').textContent=!kind?'添加素材后开始处理':mode==='video-repair'&&kind==='video'?'分析当前视频水印轨迹':kind==='image'?'开始处理图片':'开始处理视频';
 for(const name of ['rect','pan'])$(`[data-tool="${name}"]`).disabled=!kind;
 $('#reset-region').disabled=!kind||!strokes.length;
 $('#editor-zoom').disabled=!kind;
 els.start.textContent=mode==='video-repair'?`分析全部 ${files.length} 个视频`:`处理全部 ${files.length} 个素材`;
 els.start.hidden=files.length<2;$('.batch-setting').hidden=files.length<2;
 const mixed=files.some(isVideo)&&files.some(f=>!isVideo(f));
 const incompatibleBatch=mixed&&['lama','video-repair'].includes(mode);
 if(incompatibleBatch){els.start.disabled=true;els.start.title='图片和视频混合时，请分别预览处理，或使用通用处理方式';}
 else els.start.title='';
 if(incompatibleBatch)els.hint.textContent='当前列表含图片和视频；可逐个预览处理，批量处理请选通用方式。';
 if(kind&&region&&mode!=='lama'&&(strokes.length!==1||strokes[0].type!=='rect')){
  $('#preview-current').disabled=true;els.start.disabled=true;
  els.hint.textContent='当前方式只支持单个矩形，请重新框选；原选区仍可撤销恢复。';
 }
}
function remember(){if(files[selected])selections.set(files[selected],{strokes:structuredClone(strokes),history:structuredClone(history),region:region&&{...region}});}
function restore(){const s=selections.get(files[selected]);strokes=structuredClone(s?.strokes||[]);history=structuredClone(s?.history||[]);region=s?.region?{...s.region}:null;zoom=1;$('#editor-zoom').value='1';stage.scrollTo(0,0);updateStart();}
const els={input:$('#file-input'),drop:$('#drop-zone'),list:$('#file-list'),count:$('#file-count'),empty:$('#preview-empty'),shell:$('#media-shell'),img:$('#image-preview'),video:$('#video-preview'),canvas:$('#selection'),start:$('#start'),hint:$('#setup-hint'),region:$('#region-info'),toggle:$('#toggle-video'),tasks:$('#task-list')};
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2400);}
function bytes(n){if(n<1024*1024)return (n/1024).toFixed(0)+' KB';return (n/1024/1024).toFixed(1)+' MB';}
function isVideo(file){return /\.(mp4|mov|mkv|avi|webm|m4v)$/i.test(file.name);}
function addFiles(list){const incoming=[...list].filter(f=>supported.test(f.name));if(!incoming.length)return toast('请选择支持的图片或视频');files.push(...incoming);if(selected<0)selectFile(0);renderFiles();updateStart();}
function renderFiles(){els.count.textContent=files.length;els.list.innerHTML=files.length?files.map((f,i)=>`<div class="file-item ${i===selected?'selected':''}" data-index="${i}"><span class="file-icon">${isVideo(f)?'视频':'图片'}</span><div><div class="file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div><div class="file-size">${bytes(f.size)}</div></div><button class="remove" data-remove="${i}" title="移除">×</button></div>`).join(''):'<div class="empty-small">还没有添加素材</div>';}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function selectFile(index){if(!files[index])return;remember();selected=index;restore();if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(files[index]);els.empty.hidden=true;els.shell.hidden=false;els.video.pause();const video=isVideo(files[index]);els.img.style.display=video?'none':'block';els.video.style.display=video?'block':'none';els.toggle.hidden=!video;if(video){els.video.src=objectUrl;els.video.load();}else els.img.src=objectUrl;renderFiles();setTimeout(resizeCanvas,30);}
function clearFiles(){files=[];selected=-1;region=null;strokes=[];history=[];els.video.pause();if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl='';els.img.removeAttribute('src');els.video.removeAttribute('src');els.shell.hidden=true;els.empty.hidden=false;renderFiles();draw();updateStart();}
function resizeCanvas(){const media=els.img.style.display!=='none'?els.img:els.video,nw=media.naturalWidth||media.videoWidth,nh=media.naturalHeight||media.videoHeight;if(!nw||!nh)return;const scale=Math.min((stage.clientWidth-16)/nw,(stage.clientHeight-16)/nh)*zoom,w=nw*scale,h=nh*scale;els.shell.style.width=w+'px';els.shell.style.height=h+'px';els.shell.style.marginTop=Math.max(0,(stage.clientHeight-h)/2)+'px';const ratio=devicePixelRatio||1;els.canvas.width=Math.round(w*ratio);els.canvas.height=Math.round(h*ratio);draw();}
function point(event){const b=els.canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(event.clientX-b.left)/b.width)),y:Math.max(0,Math.min(1,(event.clientY-b.top)/b.height))};}
function paintMask(ctx,w,h){ctx.clearRect(0,0,w,h);for(const s of strokes){ctx.globalCompositeOperation=s.type==='erase'?'destination-out':'source-over';ctx.fillStyle='#9f8cff';ctx.strokeStyle='#9f8cff';const pts=s.points.map(p=>[p[0]*w,p[1]*h]);if(s.type==='rect'){ctx.fillRect(Math.min(pts[0][0],pts[1][0]),Math.min(pts[0][1],pts[1][1]),Math.abs(pts[0][0]-pts[1][0]),Math.abs(pts[0][1]-pts[1][1]));}else{ctx.lineWidth=s.size*Math.min(w,h);ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(...pts[0]);for(const p of pts.slice(1))ctx.lineTo(...p);ctx.stroke();for(const p of pts){ctx.beginPath();ctx.arc(...p,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();}}}ctx.globalCompositeOperation='source-over';}
function draw(){paintMask(els.canvas.getContext('2d'),els.canvas.width,els.canvas.height);els.canvas.style.opacity='.5';}
function commit(){const mask=document.createElement('canvas');mask.width=256;mask.height=Math.max(32,Math.round(256*(els.canvas.height||256)/(els.canvas.width||256)));paintMask(mask.getContext('2d'),mask.width,mask.height);const data=mask.getContext('2d').getImageData(0,0,mask.width,mask.height).data;let left=mask.width,top=mask.height,right=-1,bottom=-1;for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++)if(data[(y*mask.width+x)*4+3]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}region=right<0?null:{x:left/mask.width,y:top/mask.height,w:(right-left+1)/mask.width,h:(bottom-top+1)/mask.height};remember();draw();updateStart();}
function updateStart(){els.start.disabled=uploading||!files.length||!region;$('#preview-current').disabled=uploading||!region||!files.length;$('#undo-selection').disabled=!history.length;els.hint.textContent=!files.length?'请先添加素材':!region?'请框选或涂抹水印区域':'处理完成后可查看对比、下载结果；也可调整选区重新处理';els.region.textContent=region?`已选 ${strokes.filter(s=>s.type!=='erase').length} 处 · 只处理紫色覆盖区域`:'尚未选择水印区域';syncControls();}
els.canvas.addEventListener('pointerdown',()=>{if(files[selected]&&isVideo(files[selected])&&tool==='rect'){els.video.pause();drawingReference=els.video.currentTime;}},true);
els.canvas.addEventListener('pointerdown',e=>{if(e.button!==0||!files.length)return;els.canvas.setPointerCapture(e.pointerId);if(tool==='pan'){drawing={pan:true,x:e.clientX,y:e.clientY,left:stage.scrollLeft,top:stage.scrollTop};return;}const mode=$('[name="mode"]:checked').value;if(mode!=='lama'&&tool!=='rect')return toast('画笔与橡皮擦需要选择 AI 修复');if(strokes.length>=100)return toast('选区较多，请先处理或撤销部分笔画');history.push(structuredClone(strokes));if(history.length>30)history.shift();if(mode!=='lama')strokes=[];const p=point(e),s={type:tool,points:[[p.x,p.y]],size:+$('#brush-size').value/100};if(tool==='rect')s.points.push([p.x,p.y]);strokes.push(s);drawing={stroke:s};draw();});
els.canvas.addEventListener('pointermove',e=>{if(!drawing)return;if(drawing.pan){stage.scrollLeft=drawing.left+drawing.x-e.clientX;stage.scrollTop=drawing.top+drawing.y-e.clientY;return;}const p=point(e),s=drawing.stroke;if(s.type==='rect')s.points[1]=[p.x,p.y];else{const last=s.points.at(-1);if(Math.hypot(p.x-last[0],p.y-last[1])>.003)s.points.push([+p.x.toFixed(4),+p.y.toFixed(4)]);}draw();});
function finishDrawing(e){if(!drawing)return;const wasPan=drawing.pan;drawing=null;if(els.canvas.hasPointerCapture(e.pointerId))els.canvas.releasePointerCapture(e.pointerId);if(wasPan)return;const last=strokes.at(-1);if(last?.type==='rect'&&(Math.abs(last.points[1][0]-last.points[0][0])<.005||Math.abs(last.points[1][1]-last.points[0][1])<.005))strokes=history.pop()||[];else if(last?.type==='rect'&&files[selected]&&isVideo(files[selected]))referenceTimes.set(files[selected],drawingReference);if(strokes.reduce((n,s)=>n+s.points.length,0)>1500){strokes=history.pop()||[];toast('笔画过于复杂，请先处理当前选区后继续');}commit();}
els.canvas.addEventListener('pointerup',finishDrawing);els.canvas.addEventListener('pointercancel',finishDrawing);
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{tool=b.dataset.tool;document.querySelectorAll('[data-tool]').forEach(x=>x.classList.toggle('active',x===b));els.canvas.style.cursor=tool==='pan'?'grab':'crosshair';});
$('#undo-selection').onclick=()=>{if(history.length){strokes=history.pop();commit();}};
$('#editor-zoom').onchange=e=>{zoom=+e.target.value;resizeCanvas();};
els.input.addEventListener('change',e=>{addFiles(e.target.files);e.target.value='';});
for(const event of ['dragenter','dragover'])els.drop.addEventListener(event,e=>{e.preventDefault();els.drop.classList.add('drag');});
for(const event of ['dragleave','drop'])els.drop.addEventListener(event,e=>{e.preventDefault();els.drop.classList.remove('drag');if(event==='drop')addFiles(e.dataTransfer.files);});
// Handle local file drops outside the upload box without navigating away.
document.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
document.addEventListener('drop',e=>{if(!e.dataTransfer.files.length)return;e.preventDefault();if(!els.drop.contains(e.target))addFiles(e.dataTransfer.files);});
document.addEventListener('paste',e=>{
 if(e.target.closest('input:not([type="range"]),textarea,[contenteditable="true"]'))return;
 const pasted=[...(e.clipboardData?.items||[])].filter(item=>item.kind==='file').map(item=>item.getAsFile()).filter(Boolean);
 if(!pasted.length)return;
 e.preventDefault();
 const named=pasted.map((f,i)=>{if(supported.test(f.name))return f;const extension={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/bmp':'bmp','video/mp4':'mp4','video/webm':'webm'}[f.type];return extension?new File([f],`粘贴素材-${Date.now()}-${i+1}.${extension}`,{type:f.type}):f;});
 addFiles(named);
});
els.list.addEventListener('click',e=>{const remove=e.target.closest('[data-remove]');if(remove){remember();const i=+remove.dataset.remove;files.splice(i,1);if(!files.length)return clearFiles();const next=Math.min(i,files.length-1);selected=-1;selectFile(next);return;}const row=e.target.closest('[data-index]');if(row)selectFile(+row.dataset.index);});
$('#clear-files').onclick=clearFiles;$('#reset-region').onclick=()=>{history.push(structuredClone(strokes));strokes=[];commit();};els.toggle.onclick=()=>els.video.paused?els.video.play():els.video.pause();
document.querySelectorAll('.mode').forEach(label=>label.onclick=e=>{if(label.querySelector('input').disabled)e.preventDefault();});
document.querySelectorAll('[name="mode"]').forEach(input=>input.addEventListener('change',()=>{if(currentKind)modeChoices[currentKind]=input.value;updateStart();}));
els.video.addEventListener('loadedmetadata',()=>{$('#video-seek').max=els.video.duration;syncControls();});
els.img.addEventListener('load',syncControls);
els.video.addEventListener('timeupdate',()=>{$('#video-seek').value=els.video.currentTime;$('#video-time').textContent=els.video.currentTime.toFixed(2)+' 秒';});
$('#video-seek').oninput=e=>{els.video.pause();els.video.currentTime=+e.target.value;};
$('#blur-strength').oninput=e=>$('#blur-strength-value').textContent=e.target.value;
$('#blur-feather').oninput=e=>$('#blur-feather-value').textContent=e.target.value+'%';
new ResizeObserver(resizeCanvas).observe(stage);els.img.onload=resizeCanvas;els.video.onloadedmetadata=resizeCanvas;

async function submit(currentOnly=false){
 if(!files.length||!region)return;const mode=document.querySelector('[name="mode"]:checked').value,quality=$('#quality').value,blurStrength=+$('#blur-strength').value,blurFeather=+$('#blur-feather').value;
 if(uploading)return;remember();const batch=currentOnly?[files[selected]]:[...files],shared=$('#apply-all').checked||currentOnly;
 if(mode==='lama'&&batch.some(isVideo)){toast('LaMa 仅支持图片，请移除视频或选择快速填补 / 区域模糊');return;}
 if(mode==='video-repair'&&batch.some(f=>!isVideo(f)))return toast('视频 AI 修复仅支持视频，请单独选择视频');
 const configs=batch.map(f=>structuredClone(shared?{region,strokes}:selections.get(f)));
 if(configs.some(s=>!s?.region)){toast('部分素材没有选区，请逐张选择，或勾选应用当前选区到全部素材');return;}
 if(mode!=='lama'&&configs.some(s=>s.strokes.length!==1||s.strokes[0].type!=='rect'))return toast('快速填补和模糊仅支持单个矩形，请重新框选或使用 AI 修复');
 uploading=true;updateStart();let accepted=0;
 for(let i=0;i<batch.length;i++){
  els.hint.textContent=`正在上传 ${i+1}/${batch.length}：${batch[i].name}`;
  try{const config=configs[i];const response=await fetch('/api/tasks',{method:'POST',headers:{'X-File-Name':encodeURIComponent(batch[i].name),'X-Clean-Options':encodeURIComponent(JSON.stringify({mode,quality,blurStrength,blurFeather,referenceTime:referenceTimes.get(batch[i])||0,region:config.region,...(mode==='lama'?{strokes:config.strokes}:{})}))},body:batch[i]});const data=await response.json();if(!response.ok)throw Error(data.error);accepted++;if(currentOnly)previewId=data.task.id;}
  catch(error){toast(batch[i].name+'：'+error.message);}
 }
 toast(currentOnly&&accepted?(mode==='video-repair'?'正在分析水印轨迹，完成后自动打开检查窗口':'正在处理，完成后自动打开对比，可下载结果'):`已提交 ${accepted} 个任务`);uploading=false;updateStart();await loadTasks();
}
els.start.onclick=()=>submit(false);$('#preview-current').onclick=()=>submit(true);
async function loadTasks(){try{const response=await fetch('/api/tasks'),data=await response.json();if(!response.ok)throw Error(data.error);tasks=data.tasks;renderTasks();if(previewId){const t=tasks.find(t=>t.id===previewId);if(t?.status==='done'){previewId='';if(t.tracking)showTracking(t.id);else showCompare(t.id);}else if(t?.status==='failed'){previewId='';toast('处理失败：'+t.error+'。选区已保留，可调整后重试');}}}catch(error){toast(error.message);}}
function renderTasks(){
 $('#total-done').textContent=tasks.filter(t=>t.status==='done'&&t.purpose!=='tracking').length;
 const labels={uploading:'上传中',queued:'等待处理',processing:'处理中',done:'处理完成',failed:'处理失败'};
 els.tasks.innerHTML=tasks.length?tasks.map(t=>`<div class="task"><div class="task-kind ${t.kind}">${t.kind==='video'?'视频':'图片'}</div><div><div class="task-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</div><div class="task-meta">${new Date(t.createdAt).toLocaleString('zh-CN')}<span class="status ${t.status}">${labels[t.status]||t.status}</span>${t.error?`<span class="task-error">${escapeHtml(t.error)}</span>`:''}</div></div><div class="task-progress"><div class="progress-label"><span>${labels[t.status]||t.status}</span><b>${t.progress||0}%</b></div><div class="progress"><i style="width:${t.progress||0}%"></i></div></div><div class="task-actions">${t.download?`<a class="download" href="${t.download}">下载结果</a>`:''}${['done','failed'].includes(t.status)?`<button class="delete-task" data-delete="${t.id}" title="删除任务">×</button>`:''}</div></div>`).join(''):'<div class="empty-tasks"><div>✓</div><b>任务列表还是空的</b><span>完成上面的设置并开始处理，结果会保存在这里</span></div>';
}
els.tasks.onclick=async e=>{const compare=e.target.closest('[data-compare]');if(compare){showCompare(compare.dataset.compare);return;}const button=e.target.closest('[data-delete]');if(!button)return;button.disabled=true;try{const r=await fetch('/api/tasks/'+button.dataset.delete,{method:'DELETE'}),d=await r.json();if(!r.ok)throw Error(d.error);await loadTasks();}catch(error){toast(error.message);button.disabled=false;}};
const comparison=document.createElement('dialog');comparison.className='comparison';document.body.append(comparison);
let comparisonLocalUrl='';
comparison.addEventListener('close',()=>{if(comparison.open)return;comparison.querySelectorAll('video').forEach(v=>v.pause());comparison.replaceChildren();if(comparisonLocalUrl)URL.revokeObjectURL(comparisonLocalUrl);comparisonLocalUrl='';});
function showCompare(id){
 const task=tasks.find(t=>t.id===id);if(!task)return;
 if(comparison.open)comparison.close();
 comparison.innerHTML=`<div class="comparison-heading"><h2>处理前后对比</h2><button class="secondary" data-close>关闭并继续调整</button></div><p>${escapeHtml(task.name)}</p><div class="compare-tools"><label>细节缩放 <select id="compare-zoom"><option value="1">适应画面</option><option value="2">200%</option><option value="4">400%</option></select></label><span>左右画面同步滚动，可放大检查修复边缘</span></div><div class="comparison-grid"></div><p class="hint">原素材与结果保留在本机，删除任务时一起清理。当前页面的素材及选区可继续调整。</p>`;
 comparison.querySelector('[data-close]').onclick=()=>comparison.close();
 for(const [side,label] of [['before','处理前'],['after','处理后']]){
  const pane=document.createElement('section'),title=document.createElement('h3'),media=document.createElement(task.kind==='video'?'video':'img');title.textContent=label;media.src='/api/preview/'+id+'/'+side;
  if(task.kind==='video'){media.controls=true;media.preload='metadata';}else media.alt=label;
  media.onerror=()=>{
   const message=document.createElement('div'),description=document.createElement('p');description.textContent=side==='before'?'原素材不可用。选择本机原文件即可对比，无需重新处理。':'结果暂时无法预览，请下载查看。';message.append(description);
   if(side==='before'){
    const input=document.createElement('input'),button=document.createElement('button');input.type='file';input.accept=task.kind==='video'?'video/*':'image/*';input.hidden=true;button.className='secondary';button.textContent='选择原图 / 原视频';button.onclick=()=>input.click();
    input.onchange=()=>{const file=input.files[0];if(!file)return;if(comparisonLocalUrl)URL.revokeObjectURL(comparisonLocalUrl);comparisonLocalUrl=URL.createObjectURL(file);media.src=comparisonLocalUrl;message.replaceWith(media);};message.append(button,input);
   }
   media.replaceWith(message);
  };
  const viewport=document.createElement('div');viewport.className='compare-viewport';viewport.append(media);pane.append(title,viewport);comparison.querySelector('.comparison-grid').append(pane);
 }
 comparison.showModal();
 if(task.kind==='video'){
  if(task.skippedFrames){const note=document.createElement('p');note.textContent=`有 ${task.skippedFrames} 帧因定位不确定而未修复，可能残留水印。`;comparison.querySelector('.comparison-grid').before(note);}
  const videos=[...comparison.querySelectorAll('video')];videos.forEach(v=>v.muted=true);
  const controls=document.createElement('div');controls.className='compare-tools';controls.innerHTML='<button class="secondary">同步播放 / 暂停</button><span>以处理后视频为准同步播放</span>';
  controls.querySelector('button').onclick=()=>{if(videos[1].paused){videos[0].currentTime=videos[1].currentTime;videos.forEach(v=>v.play().catch(()=>{}));}else videos.forEach(v=>v.pause());};
  videos[1].addEventListener('seeking',()=>{videos[0].currentTime=videos[1].currentTime;});videos[1].addEventListener('ended',()=>videos[0].pause());
  comparison.querySelector('.comparison-grid').before(controls);
 }
 const viewports=[...comparison.querySelectorAll('.compare-viewport')];
 function fitComparison(){const scale=+comparison.querySelector('#compare-zoom').value;for(const viewport of viewports){const media=viewport.querySelector('img,video');if(!media)continue;const nw=media.naturalWidth||media.videoWidth,nh=media.naturalHeight||media.videoHeight;if(!nw||!nh)continue;const fit=Math.min(viewport.clientWidth/nw,viewport.clientHeight/nh);media.style.width=nw*fit*scale+'px';media.style.height=nh*fit*scale+'px';media.style.margin='0 auto';}}
 for(const viewport of viewports){const media=viewport.querySelector('img,video');media.addEventListener('load',fitComparison);media.addEventListener('loadedmetadata',fitComparison);viewport.addEventListener('scroll',()=>{for(const other of viewports)if(other!==viewport&&(Math.abs(other.scrollLeft-viewport.scrollLeft)>1||Math.abs(other.scrollTop-viewport.scrollTop)>1))other.scrollTo(viewport.scrollLeft,viewport.scrollTop);});}
 comparison.querySelector('#compare-zoom').onchange=fitComparison;fitComparison();
}
new MutationObserver(()=>{els.tasks.querySelectorAll('.task-actions').forEach((actions,index)=>{const task=tasks[index];if(task?.tracking&&!actions.querySelector('[data-track]')){const button=document.createElement('button');button.className='secondary';button.textContent='查看轨迹 / 修复';button.dataset.track=task.id;button.onclick=()=>showTracking(task.id);actions.prepend(button);}const link=actions.querySelector('.download');if(!link||actions.querySelector('[data-compare]'))return;const button=document.createElement('button');button.className='secondary';button.textContent='查看对比';button.dataset.compare=link.getAttribute('href').split('/').pop();actions.prepend(button);});}).observe(els.tasks,{childList:true});
new MutationObserver(()=>{[...els.tasks.querySelectorAll('.task')].forEach((row,index)=>{if(tasks[index]?.purpose!=='tracking')return;const text=tasks[index].status==='done'?'轨迹待检查':tasks[index].status==='processing'?'定位分析中':null;if(text){row.querySelector('.status').textContent=text;row.querySelector('.progress-label span').textContent=text;}});}).observe(els.tasks,{childList:true});
const trackingDialog=document.createElement('dialog');trackingDialog.className='comparison';document.body.append(trackingDialog);
trackingDialog.addEventListener('close',()=>{trackingDialog.querySelector('video')?.pause();if(!trackingDialog.open)trackingDialog.replaceChildren();});
async function showTracking(id){
 try{
  const response=await fetch('/api/tracking/'+id),data=await response.json();if(!response.ok)throw Error(data.error);const info=data.tracking;
  if(trackingDialog.open)return;
  trackingDialog.innerHTML=`<div class="comparison-heading"><h2>检查水印移动轨迹</h2><button class="secondary" data-close-track>关闭</button></div><p class="tracking-status">共 ${info.frames.length} 帧，定位 ${info.matched} 帧，${info.uncertain} 帧不确定。绿色框是将要修复的位置；未定位的帧保持原画面，可能残留水印。</p><div class="tracking-stage"><video playsinline muted src="/api/preview/${id}/before"></video><div class="tracking-box" hidden></div></div><div class="tracking-tools"><button class="secondary" data-play-track>播放 / 暂停</button><input type="range" min="0" max="${info.frames.length-1}" value="0" step="1" aria-label="轨迹时间轴"><output></output><button class="secondary" data-next-uncertain>下一处不确定</button></div><p class="hint">跟踪依据你框选的图案；相似文字、透明度或大小变化可能导致误判。轨迹不对时关闭窗口，在清晰帧重新框选分析。</p><label><input type="checkbox" data-confirm-track>我已检查轨迹，按绿色框修复，跳过未定位的帧</label><div class="compare-tools"><button class="secondary" data-repair-preview disabled>先修复前 3 秒</button><button class="secondary" data-repair-full disabled>修复完整视频</button><span data-track-message></span></div>`;
  const video=trackingDialog.querySelector('video'),box=trackingDialog.querySelector('.tracking-box'),slider=trackingDialog.querySelector('input[type=range]'),output=trackingDialog.querySelector('output');
  if(info.resized)trackingDialog.querySelector('.tracking-status').append(` 原视频 ${info.sourceWidth}×${info.sourceHeight}，修复结果自动适配为 ${info.width}×${info.height}，完整保留画面、不裁切。`);
  function drawTrack(){const index=Math.min(info.frames.length-1,Math.floor(video.currentTime*info.fps+.01)),item=info.frames[index];slider.value=index;output.textContent=`${video.currentTime.toFixed(2)} 秒 · ${item.region?'已定位':'未定位，跳过'} · 匹配分数 ${item.confidence}`;box.hidden=!item.region;if(item.region){const r=item.region;box.style.cssText=`left:${r.x*100}%;top:${r.y*100}%;width:${r.w*100}%;height:${r.h*100}%`;}}
  video.addEventListener('timeupdate',drawTrack);video.addEventListener('loadedmetadata',drawTrack);video.addEventListener('seeked',drawTrack);
  if(video.requestVideoFrameCallback){const update=()=>{if(!trackingDialog.open)return;drawTrack();video.requestVideoFrameCallback(update);};video.requestVideoFrameCallback(update);}
  slider.oninput=()=>{video.pause();video.currentTime=+slider.value/info.fps;};
  trackingDialog.querySelector('[data-play-track]').onclick=()=>video.paused?video.play().catch(e=>toast(e.message)):video.pause();
  trackingDialog.querySelector('[data-close-track]').onclick=()=>trackingDialog.close();
  trackingDialog.querySelector('[data-next-uncertain]').onclick=()=>{let i=info.frames.findIndex((f,i)=>i>+slider.value&&!f.region);if(i<0)i=info.frames.findIndex(f=>!f.region);if(i>=0){video.pause();video.currentTime=i/info.fps;}else toast('没有未定位的帧，仍请检查绿色框是否准确');};
  const buttons=[...trackingDialog.querySelectorAll('[data-repair-preview],[data-repair-full]')];
  trackingDialog.querySelector('[data-confirm-track]').onchange=e=>buttons.forEach(b=>b.disabled=!e.target.checked||!info.matched);
  buttons.forEach(b=>b.onclick=async()=>{buttons.forEach(b=>b.disabled=true);const message=trackingDialog.querySelector('[data-track-message]');message.textContent='正在提交…';try{const response=await fetch('/api/tracking/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmed:true,preview:b.hasAttribute('data-repair-preview')})}),data=await response.json();if(!response.ok)throw Error(data.error);previewId=data.task.id;trackingDialog.close();toast('已开始视频修复，完成后自动打开对比');await loadTasks();}catch(e){message.textContent=e.message;buttons.forEach(b=>b.disabled=false);}});
  trackingDialog.showModal();
 }catch(error){toast(error.message);}
}
$('#refresh').onclick=loadTasks;setInterval(()=>{if(tasks.some(t=>['uploading','queued','processing'].includes(t.status)))loadTasks();},1500);loadTasks();updateStart();
