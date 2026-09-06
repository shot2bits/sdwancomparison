import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const root=process.env.TEST_ORIGIN||'http://localhost:3107';
const browser=await chromium.launch();
try {
 for(const width of [1440,390]) {
  const page=await browser.newPage({viewport:{width,height:1000}});page.setDefaultTimeout(20000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const path of ['/sase/home/','/sase/examples/sase-rfp/','/sase/circuit-pricing/']) {
   await page.goto(root+path,{waitUntil:'domcontentloaded'});
   if(path==='/sase/home/') await page.getByRole('region',{name:'Choose your project format'}).waitFor();
   else await page.locator('h1').first().waitFor();
   const version=page.locator('[data-release-version]:visible');await version.waitFor();
   assert.match(await version.innerText(),/^Version \d{10}$/);
   assert((await version.boundingBox()).y<1000);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:`/tmp/release-${path.split('/').filter(Boolean).at(-1)}-${width}.png`});
   console.log('PASS visible top version, no horizontal overflow',width,path,await version.innerText());
  }
  assert.deepEqual(errors,[]);await page.close();
 }
} finally {await browser.close();}
