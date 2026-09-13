const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3220');
  assert.equal(await page.locator('[name=mode]:disabled').count(),4);
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=800;return c.toDataURL().split(',')[1];});
  await page.locator('#file-input').setInputFiles({name:'图片测试.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  assert.equal(await page.locator('[value=lama]').isChecked(),true);
  assert.equal(await page.locator('[value=video-repair]').isDisabled(),true);
  await page.locator('.mode').filter({has:page.locator('[value=video-repair]')}).click({force:true});
  assert.equal(await page.locator('[value=lama]').isChecked(),true);
  assert.equal(await page.locator('#quality').isVisible(),false);
  assert.equal(await page.locator('#start').isVisible(),false);
  await page.locator('.mode').filter({has:page.locator('[value=blur]')}).click();
  assert.equal(await page.locator('#blur-settings').isVisible(),true);
  assert.equal(await page.locator('[data-tool=paint]').isDisabled(),true);
  await page.locator('#file-input').setInputFiles(require('node:path').resolve(__dirname, '../data/video-test/moving.mp4'));
  await page.locator('[data-index="1"]').click();
  assert.equal(await page.locator('[value=video-repair]').isChecked(),true);
  assert.equal(await page.locator('[value=lama]').isDisabled(),true);
  assert.equal(await page.locator('#video-repair-settings').isVisible(),true);
  assert.equal(await page.locator('#quality').isVisible(),true);
  assert.equal(await page.locator('#start').isDisabled(),true);
  await page.locator('[data-index="0"]').click();
  assert.equal(await page.locator('[value=blur]').isChecked(),true);
  assert.equal(await page.locator('#video-timeline').isVisible(),false);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#clear-files').click();
  assert.equal(await page.locator('[name=mode]:disabled').count(),4);
  assert.equal(await page.locator('#video-timeline').isVisible(),false);
  assert.deepEqual(errors,[]);console.log('PASS: empty, image/video disabled modes, disabled click, conditional settings, remembered modes, mixed batch, mobile, clear');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
