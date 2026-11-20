import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(process.cwd()+'/package.json'),{chromium}=require('playwright-core');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.addInitScript(()=>{const read=Storage.prototype.getItem;Storage.prototype.getItem=function(key){if(key.startsWith('netify-location-estate'))throw new DOMException('Storage denied by browser','SecurityError');return read.call(this,key);};});
 await page.goto('http://127.0.0.1:3018/locations/?qa=blocked-storage-audit');await page.locator('#location-studio').waitFor({timeout:30000});await page.locator('#ns-pricing-workspace').waitFor({timeout:10000});await page.getByRole('group',{name:'Workspace mode',exact:true}).waitFor();assert.equal(await page.locator('#ns-living-rfp').count(),1);assert.equal(await page.locator('#ls-sector [data-ls-sector]').count(),10);assert.deepEqual(errors,[]);assert.match(await page.locator('#location-studio').innerText(),/storage|in memory/i);console.log('PASS browser storage-read failure does not abort the map, mode switch, RFP or pricing; honest in-memory warning and no unhandled errors.');
}finally{await browser.close();}
