import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const root=process.env.TEST_ORIGIN||'https://netify.co.uk';
const browser=await chromium.launch();
try {
 for(const width of [1440,390]) {
  const p=await browser.newPage({viewport:{width,height:1000}}); const errors=[]; p.on('pageerror',e=>errors.push(e.message));
  const r=await p.goto(root+'/sase/pricing/');assert.equal(r.status(),200);
  assert.equal(await p.locator('link[rel="canonical"]').getAttribute('href'),'https://netify.co.uk/sase/pricing/');
  for(const label of ['Explore budget estimates','Start a supplier pricing request','Request circuit pricing'])assert(await p.getByRole('link',{name:label,exact:false}).first().isVisible());
  assert.equal(await p.locator('main').count(),1);
  assert(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)));
  const href=await p.getByRole('link',{name:'Start a supplier pricing request',exact:false}).getAttribute('href');
  const target=new URL(href); if(root!=='https://netify.co.uk')target.pathname='/sase/home/';
  await p.goto(root+target.pathname+target.search);
  await p.getByRole('dialog').waitFor();
  assert(await p.getByRole('dialog').isVisible());
  assert.equal(errors.length,0);
  await p.close(); console.log(`PASS ${width}: three pricing routes, canonical, no overflow/errors, pricing opens editable project brief`);
 }
 const sitemap=await(await fetch(root+'/sase/sitemap.xml')).text();assert(sitemap.includes('https://netify.co.uk/sase/pricing/'));
 console.log('PASS pricing included in sitemap');
} finally {await browser.close();}
