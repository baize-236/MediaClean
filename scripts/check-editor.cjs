const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3220');
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');for(let y=0;y<512;y++){x.fillStyle=`rgb(${80+y/4},120,160)`;x.fillRect(0,y,512,1);}x.fillStyle='white';x.font='30px sans-serif';x.fillText('TEST',125,155);x.fillText('TEST',360,380);return c.toDataURL().split(',')[1];});
  const file={name:'editor-test.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')};
  await page.locator('#file-input').setInputFiles([file,{...file,name:'second.png'}]);
  await page.waitForFunction(()=>document.querySelector('#image-preview').naturalWidth===512);
  async function stroke(tool,points){await page.locator(`[data-tool="${tool}"]`).click();await page.locator('#selection').scrollIntoViewIfNeeded();const b=await page.locator('#selection').boundingBox();await page.mouse.move(b.x+points[0][0]*b.width,b.y+points[0][1]*b.height);await page.mouse.down();for(const p of points.slice(1))await page.mouse.move(b.x+p[0]*b.width,b.y+p[1]*b.height,{steps:10});await page.mouse.up();}
  await stroke('rect',[[.2,.2],[.6,.6]]);
  await page.locator('#brush-size').fill('12');
  await stroke('erase',[[.4,.4],[.4,.4]]);
  await stroke('paint',[[.73,.72],[.88,.72]]);
  await page.locator('#undo-selection').click();
  await stroke('paint',[[.73,.72],[.88,.72]]);
  await page.locator('[data-index="1"]').click();assert.equal(await page.locator('#preview-current').isDisabled(),true);
  await page.locator('[data-index="0"]').click();assert.equal(await page.locator('#preview-current').isEnabled(),true);
  await page.locator('#editor-zoom').selectOption('2');
  const image=await page.locator('#image-preview').boundingBox(),canvas=await page.locator('#selection').boundingBox();
  for(const k of ['x','y','width','height'])assert.ok(Math.abs(image[k]-canvas[k])<1,'zoom alignment '+k);
  await page.locator('#editor-zoom').selectOption('1');
  let options;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/tasks'))options=JSON.parse(decodeURIComponent(r.headers()['x-clean-options']));});
  await page.locator('#preview-current').click();
  await page.locator('.comparison[open]').waitFor({timeout:180000});
  await page.waitForFunction(()=>[...document.querySelectorAll('.comparison img')].length===2&&[...document.querySelectorAll('.comparison img')].every(i=>i.naturalWidth===512));
  assert.deepEqual(options.strokes.map(s=>s.type),['rect','erase','paint']);
  assert.equal(await page.locator('#file-count').textContent(),'2');
  await page.locator('#compare-zoom').selectOption('4');
  const scroll=await page.locator('.compare-viewport').first().evaluate(e=>{e.scrollTo(100,150);return {w:e.scrollWidth,c:e.clientWidth};});assert.ok(scroll.w>scroll.c);
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.compare-viewport').nth(1).evaluate(e=>e.scrollTop),150);
  const src=await page.locator('.comparison img').last().getAttribute('src'),id=src.split('/')[3];
  const dir=path.join(__dirname,'../data/editor-test');await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,'before.png'),file.buffer);
  await fs.writeFile(path.join(dir,'after.png'),Buffer.from(await (await fetch('http://127.0.0.1:3220'+src)).arrayBuffer()));
  await fs.writeFile(path.join(dir,'options.json'),JSON.stringify(options));
  await page.locator('[data-close]').click();assert.equal(await page.locator('#preview-current').isEnabled(),true);
  await page.screenshot({path:path.join(dir,'editor.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result:'PASS',task:id,checks:['brush/eraser/undo','per-file selection','zoom alignment','real LaMa preview','automatic comparison','synchronized zoom','retained editing state'],errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
