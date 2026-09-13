const {chromium}=require('playwright');
const fs=require('node:fs/promises');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');const report=JSON.parse(await fs.readFile(path.join(root,'data/lama-benchmark/report.json'),'utf8'));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3220');assert.equal(await page.locator('[value="lama"]').isChecked(),true);
 await page.locator('#file-input').setInputFiles(report.input);
 await page.waitForFunction(()=>document.querySelector('#image-preview').naturalWidth>0);
 await page.locator('#selection').scrollIntoViewIfNeeded();const box=await page.locator('#selection').boundingBox(),r=report.region;
 await page.mouse.move(box.x+box.width*r.x,box.y+box.height*r.y);await page.mouse.down();await page.mouse.move(box.x+box.width*(r.x+r.w)-.1,box.y+box.height*(r.y+r.h)-.1);await page.mouse.up();
 const request=page.waitForResponse(res=>res.url().endsWith('/api/tasks')&&res.request().method()==='POST');await page.locator('#start').click();const response=await request;assert.equal(response.status(),202);const task=(await (await fetch('http://127.0.0.1:3220/api/tasks')).json()).tasks[0];
 await page.locator('[data-compare="'+task.id+'"]').waitFor({timeout:180000});await page.locator('[data-compare="'+task.id+'"]').click();
 await page.waitForFunction(()=>{const images=[...document.querySelectorAll('.comparison img')];return images.length===2&&images.every(i=>i.complete&&i.naturalWidth===1024);});
 await page.screenshot({path:path.join(root,'data/lama-benchmark/ui-comparison.png'),fullPage:true});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'PASS',taskId:task.id,realLamaTask:true,beforeAfterImages:true,browserErrors:errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
