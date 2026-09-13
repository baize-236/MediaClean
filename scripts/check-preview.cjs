const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 const page=await browser.newPage();
 for(const width of [1440,390]){
 await page.setViewportSize({width,height:950});
 for(const [w,h] of [[600,1200],[1800,400],[800,800]]){
 await page.goto('http://127.0.0.1:3220/');
 const png=await page.evaluate(({w,h})=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#62b9af';x.fillRect(0,0,w,h);return c.toDataURL().split(',')[1];},{w,h});
 await page.locator('#file-input').setInputFiles({name:'preview.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await page.waitForFunction(()=>document.querySelector('#image-preview').naturalWidth>0);
 await page.waitForTimeout(100);
 assert.equal(await page.locator('#preview-empty').isVisible(),false);
 const stage=await page.locator('#preview-stage').boundingBox(),img=await page.locator('#image-preview').boundingBox(),canvas=await page.locator('#selection').boundingBox();
 assert.ok(img.x>=stage.x-1&&img.y>=stage.y-1&&img.x+img.width<=stage.x+stage.width+1&&img.y+img.height<=stage.y+stage.height+1,'whole image inside preview');
 assert.ok(Math.abs(img.width/img.height-w/h)<.01,'aspect ratio preserved');
 for(const key of ['x','y','width','height'])assert.ok(Math.abs(img[key]-canvas[key])<1,'selection aligned: '+key);
 await page.locator('#selection').scrollIntoViewIfNeeded();
 const box=await page.locator('#selection').boundingBox();
 await page.mouse.move(box.x+box.width*.1,box.y+box.height*.1);await page.mouse.down();await page.mouse.move(box.x+box.width*.4,box.y+box.height*.4);await page.mouse.up();
 assert.equal(await page.locator('#start').isEnabled(),true);
 await page.locator('#clear-files').click();assert.equal(await page.locator('#preview-empty').isVisible(),true);assert.equal(await page.locator('#media-shell').isVisible(),false);
 }
 }
 console.log('PASS: desktop/mobile portrait, landscape, square; full image, aspect ratio, selection alignment, clear state');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
