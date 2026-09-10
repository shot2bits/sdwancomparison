import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const root=process.env.TEST_ORIGIN||'http://localhost:3107';
const path='/sase/examples/sase-rfp/';
const dataResponse=await fetch(root+path+'data.json/');
assert.equal(dataResponse.status,200);
const data=await dataResponse.json();
assert(data.synthetic);
for(const depth of ['short','detailed']){
 const response=await fetch(root+path+'document.txt/?depth='+depth);
 assert.equal(response.status,200);
 assert.equal(await response.text(),data.documents[depth].text);
 assert(response.headers.get('content-disposition').includes(depth));
 assert.equal(data.documents[depth].assessment.sector.detected,'manufacturing');
}
assert.equal((await fetch(root+path+'document.txt/?depth=invalid')).status,400);
const raw=await(await fetch(root+path)).text();
assert(raw.includes('SASE-ZTNA-001'));
assert(raw.includes('BUYER-OT-001'));
assert(raw.includes('https://netify.co.uk/sase/examples/sase-rfp/'));
const browser=await chromium.launch();
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}});page.setDefaultTimeout(20000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 assert.equal((await page.goto(root+path)).status(),200);
 await page.getByRole('heading',{name:'A SASE RFP, from first brief to supplier questions.'}).waitFor();
 assert.equal(await page.locator('main').count(),1);
 assert(await page.locator('#short').getByText(data.bespokeQuestion.question,{exact:true}).isVisible());
 await page.locator('#detailed > summary').click();
 assert(await page.locator('#detailed').getByText(data.bespokeQuestion.question,{exact:true}).isVisible());
 assert.equal(await page.locator('#detailed').getByText('Question bank reference:',{exact:false}).count(),43);
 assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)));
 for(const label of ['Build your SASE RFP','Check your existing RFP']){
  const anchor=page.getByRole('link',{name:label,exact:true}).first();
  assert((await anchor.getAttribute('href')).includes(label.startsWith('Build')?'journey=build_rfp':'journey=validate_rfp'));
 }
 await page.screenshot({path:`/tmp/sase-demo-${width}.png`,fullPage:true});
 assert.equal(errors.length,0,errors.join('\n'));
 await page.close(); console.log(`PASS ${width}px: full HTML, both depths, all bank questions, bespoke question, links, no overflow or runtime errors`);
}}finally{await browser.close();}
const b2=await chromium.launch();try { const p=await b2.newPage();p.setDefaultTimeout(20000);const workspace=root.includes('netify.co.uk')?'/sase-sd-wan-rfp-builder/':'/sase/home/';await p.goto(root+workspace+'?journey=validate_rfp');await p.getByPlaceholder('Paste an existing or AI-generated RFP here, or attach Word, PDF, text or a spreadsheet').waitFor();await p.getByRole('region',{name:'Choose your project format'}).waitFor();console.log('PASS check-existing deep link opens checker within current workspace layout');}finally{await b2.close();}
console.log('PASS JSON/download parity, invalid depth rejected, labelled fictional evidence');
