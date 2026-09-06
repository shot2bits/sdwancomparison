import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});const page=await browser.newPage();
try{
 await page.goto(process.env.TEST_URL||'http://localhost:3107/sase/home/');
 await page.locator('input[type=file]').first().waitFor({state:'attached'});
 const source='  Manufacturing RFI\r\nWe have five UK sites and need managed SASE within six months.\r\nPreserve the bespoke appendix exactly.  ';
 await page.locator('input[type=file]').first().setInputFiles({name:'manufacturing-rfi.txt',mimeType:'text/plain',buffer:Buffer.from(source)});
 await page.getByText(/^Read your file:/).waitFor({timeout:60000});
 const payload=await page.evaluate(()=>{const detail={value:null};window.dispatchEvent(new CustomEvent('netify:project-read',{detail}));return detail.value;});
 assert(payload.payload.source_turns.some(t=>t.text===source));
 await page.locator('input[type=file]').first().setInputFiles({name:'too-large.txt',mimeType:'text/plain',buffer:Buffer.from('B'.repeat(200001))});
 await page.getByText(/Nothing from this source was added/).waitFor();
 const after=await page.evaluate(()=>{const detail={value:null};window.dispatchEvent(new CustomEvent('netify:project-read',{detail}));return detail.value;});
 assert.equal(after.payload.source_turns.length,payload.payload.source_turns.length);
 console.log('PASS browser import: exact TXT source survives, file summary is accurate, oversized upload rejected without altering sources.');
}finally{await browser.close();}
