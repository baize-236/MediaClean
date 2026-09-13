const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3220');
  assert.equal(await page.locator('#blur-settings').isVisible(),false);
  await page.locator('.mode').filter({has:page.locator('[value="blur"]')}).click();
  assert.equal(await page.locator('#blur-settings').isVisible(),true);
  await page.locator('#blur-strength').fill('80');await page.locator('#blur-feather').fill('25');
  assert.equal(await page.locator('#blur-strength-value').textContent(),'80');
  await page.locator('#file-input').setInputFiles(require('node:path').resolve(__dirname, '../data/editor-test/before.png'));
  await page.waitForFunction(()=>document.querySelector('#image-preview').naturalWidth>0);
  await page.locator('#selection').scrollIntoViewIfNeeded();const b=await page.locator('#selection').boundingBox();
  await page.mouse.move(b.x+b.width*.2,b.y+b.height*.2);await page.mouse.down();await page.mouse.move(b.x+b.width*.6,b.y+b.height*.6);await page.mouse.up();
  const request=page.waitForRequest(r=>r.method()==='POST'&&r.url().endsWith('/api/tasks'));
  await page.locator('#preview-current').click();const options=JSON.parse(decodeURIComponent((await request).headers()['x-clean-options']));assert.equal(options.blurStrength,80);assert.equal(options.blurFeather,25);
  await page.locator('.comparison[open]').waitFor({timeout:30000});
  await page.waitForFunction(()=>[...document.querySelectorAll('.comparison img')].length===2&&[...document.querySelectorAll('.comparison img')].every(i=>i.naturalWidth===512));
  const src=await page.locator('.comparison img').last().getAttribute('src');
  await page.locator('[data-close]').click();
  assert.equal(await page.locator('#blur-strength').inputValue(),'80');assert.deepEqual(errors,[]);
  await fetch('http://127.0.0.1:3220/api/tasks/'+src.split('/')[3],{method:'DELETE'});
  console.log('PASS: controls, submitted settings, actual blur preview, comparison, retained values, no browser errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
