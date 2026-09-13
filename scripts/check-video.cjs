const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {spawn,execFileSync}=require('node:child_process');
const path=require('node:path');
const os=require('node:os');
(async()=>{
 const root=path.resolve(__dirname,'..'),dir=await fs.mkdtemp(path.join(os.tmpdir(),'mediaclean-video-api-'));
 const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'3231',MEDIA_CLEAN_DATA_DIR:dir},windowsHide:true,stdio:'ignore'});
 let browser;
 try{
  const base='http://127.0.0.1:3231';for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.locator('.mode').filter({has:page.locator('[value="video-repair"]')}).click();
  await page.locator('#file-input').setInputFiles(path.join(root,'data/video-test/moving.mp4'));
  await page.waitForFunction(()=>document.querySelector('#video-preview').videoWidth===320);
  await page.locator('#selection').scrollIntoViewIfNeeded();const box=await page.locator('#selection').boundingBox();
  await page.mouse.move(box.x+box.width*25/320,box.y+box.height*40/240);await page.mouse.down();await page.mouse.move(box.x+box.width*101/320,box.y+box.height*66/240);await page.mouse.up();
  await page.locator('#preview-current').click();
  await page.locator('.tracking-stage').waitFor({timeout:60000});
  assert.equal(await page.locator('[data-repair-preview]').isDisabled(),true);
  const tasks=(await (await fetch(base+'/api/tasks')).json()).tasks,trackingTask=tasks.find(t=>t.tracking);assert.ok(trackingTask);
  const tracking=(await (await fetch(base+'/api/tracking/'+trackingTask.id)).json()).tracking;
  const expected=JSON.parse(await fs.readFile(path.join(root,'data/video-test/expected.json')));
  assert.equal(tracking.frames.length,24);
  for(let i=0;i<24;i++){const actual=tracking.frames[i].region;if(!expected[i])assert.equal(actual,null,'disappearance '+i);else{assert.ok(actual,'matched '+i);assert.ok(Math.abs(actual.x-expected[i].x)*320<5,'x '+i);assert.ok(Math.abs(actual.y-expected[i].y)*240<5,'y '+i);}}
  await page.locator('[data-next-uncertain]').click();await page.waitForTimeout(250);assert.equal(await page.locator('.tracking-box').isVisible(),false);
  await page.locator('[data-confirm-track]').check();await page.locator('[data-repair-preview]').click();
  await page.locator('.comparison[open] .comparison-grid').waitFor({timeout:180000});
  await page.waitForFunction(()=>[...document.querySelectorAll('.comparison-grid video')].length===2&&[...document.querySelectorAll('.comparison-grid video')].every(v=>v.videoWidth===320));
  const done=(await (await fetch(base+'/api/tasks')).json()).tasks.find(t=>t.purpose==='video-repair');assert.equal(done.status,'done',done.error);assert.equal(done.skippedFrames,3);
  const output=path.join(root,'data/video-test/repaired.mp4');await fs.writeFile(output,Buffer.from(await (await fetch(base+done.download)).arrayBuffer()));
  const metadata=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',output],{encoding:'utf8'}));
  assert.ok(metadata.streams.some(s=>s.codec_type==='audio'),'audio retained');assert.ok(Math.abs(+metadata.format.duration-3)<.15,'duration preserved');
  await page.screenshot({path:path.join(root,'data/video-test/comparison.png')});
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(root,'data/video-test/tracking.json'),JSON.stringify(tracking,null,2));
  console.log(JSON.stringify({result:'PASS',matched:tracking.matched,uncertain:tracking.uncertain,checks:['movement','jump','disappearance','review gate','real LaMa video repair','audio','duration','before/after UI'],dataDir:dir}));
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
