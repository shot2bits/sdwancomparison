import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const origin=process.env.TEST_ORIGIN||'https://netify.co.uk';
const canonical='https://netify.co.uk';
const paths=['/sase/circuit-pricing/','/sase/shortlist/','/sase/cost-estimator/','/sase/connector/'];
const browser=await chromium.launch();
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const path of paths){
   const r=await page.goto(origin+path,{waitUntil:'domcontentloaded'});assert.equal(r.status(),200,path);
   await page.waitForTimeout(700);
   assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),canonical+path,path);
   assert(!(await page.title()).includes('| Netify | Netify'));
   assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)),`overflow ${width} ${path}`);
  }
  assert.equal(errors.length,0,errors.join('\n'));await page.close();
  console.log(`PASS ${origin}: ${width}px public discovery pages, canonicals, no overflow/runtime errors`);
 }
 const sitemap=await fetch(origin+'/sase/sitemap.xml').then(r=>r.text());assert(sitemap.includes('<loc>https://netify.co.uk/sase/circuit-pricing/</loc>'));
 assert(!sitemap.includes('cite.bib/'));
 const text=await fetch(origin+'/sase/shortlist/').then(r=>r.text());assert(!text.includes('raise it to a full RFP'));
 const cost=await fetch(origin+'/sase/cost-estimator/').then(r=>r.text());assert(!cost.includes('It cannot invite'));assert(cost.includes('A full RFP is optional'));
 console.log('PASS sitemap and publication messaging');
}finally{await browser.close();}
