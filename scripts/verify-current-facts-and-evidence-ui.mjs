import {chromium} from 'playwright';
import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));const base=process.env.VERIFY_BASE_URL || 'http://127.0.0.1:3180/sase';
const data=await (await page.request.get(base+'/shortlist/data.json')).json();writeFileSync('../facts-validation/shortlist-after-preview.json',JSON.stringify(data,null,2));
for(const view of ['sase-vendors','sd-wan-vendors','managed-sd-wan']){
 await page.goto(base+'/shortlist/'+view+'/',{waitUntil:'networkidle'});
 const list=page.locator('ol[aria-describedby="evidence-order"]');const rows=await list.locator('li').allTextContents();const providers=data.market_views[view].providers;
 assert.equal(rows.length,providers.length);providers.forEach((p,i)=>{assert.ok(rows[i].includes(`${i+1}. ${p.name}`));assert.ok(rows[i].includes(`${p.proven_evidence_count} proven capability items`));assert.ok(rows[i].includes(p.last_verified));});
 assert.match(await page.locator('#evidence-order').innerText(),/not recommendations/);
 assert.deepEqual(await page.locator('table').first().locator('th').allTextContents(),['Provider','Type','Products','Best suited to','Main strength','Confirm through RFP','Reviewed']);assert.equal(await page.locator('table caption').count(),1);
 const html=await page.content();assert.ok(!/default_shortlist|top_providers_at_balanced_setting|weighted capability score of \d/.test(html));
 if(view==='sase-vendors')await page.screenshot({path:'../facts-validation/ordered-view.png',fullPage:true});
}
await page.setViewportSize({width:390,height:844});await page.goto(base+'/shortlist/sase-vendors/',{waitUntil:'networkidle'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
await page.goto(base+'/home/?journey=find_providers&project=rfp_canonical_find_providers#project_session=isolated-find_providers',{waitUntil:'networkidle'});
await page.waitForTimeout(1500);const body=await page.locator('body').innerText();writeFileSync('../facts-validation/workspace-text.txt',body);assert.ok(!body.includes('Private draft · not published'));assert.ok(body.includes('Published project'));assert.ok(!body.includes('Next year'));assert.ok(body.includes('Within two months'));assert.match(body,/2 users/);await page.screenshot({path:'../facts-validation/workspace-preview.png',fullPage:true});
assert.deepEqual(errors,[]);writeFileSync('../facts-validation/new-view-checks.json',JSON.stringify({views:3,ordered_numbered:true,table_columns_preserved:true,mobile:true,resume_current_facts:true,errors},null,2));await browser.close();console.log('PASS three numbered evidence views, stable JSON/HTML order, tables/mobile and canonical workspace resume');
