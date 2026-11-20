import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(process.cwd()+'/package.json'),{chromium}=require('playwright-core');
const origin='http://127.0.0.1:3018';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(origin+'/locations/?workspace=partner&qa=preservation-check',{waitUntil:'domcontentloaded'});await page.locator('#location-studio').waitFor({timeout:60000});await page.locator('#partner-workspace h2').first().waitFor({timeout:60000});
 const ids=['netify-space','ns-living-rfp','ns-scene','ns-canvas','ns-nodes','ns-room-open','ns-buying-open','ns-outreach-preview','ns-pricing-workspace','ls-map','ls-diagram','ls-table','ls-site-list'];
 const retained={};for(const id of ids){retained[id]=await page.locator('#'+id).count();assert.equal(retained[id],1,'Missing or duplicated section: '+id);}
 assert.equal(await page.locator('.ls-legacy').count(),1);
 const buttons=page.locator('#ls-sector [data-ls-sector]');assert.equal(await buttons.count(),10);assert.equal(await page.locator('select#ls-sector,select[name="sector"]').count(),0);const retail=buttons.filter({hasText:'Retail'}),retailId=await retail.getAttribute('data-ls-sector');await retail.click();assert.equal(await page.locator('#ls-sector [data-ls-sector="'+retailId+'"]').getAttribute('aria-pressed'),'true');
 await page.locator('[data-ls-goal="pricing"]').click();const quick=page.locator('#ls-quick-form');assert.equal(await quick.locator('[data-ls-sector]').count(),10);await quick.locator('input[name="sites"]').fill('7');const health=quick.locator('[data-ls-sector]').filter({hasText:'Healthcare'}),healthId=await health.getAttribute('data-ls-sector');await health.click();assert.equal(await quick.locator('input[name="sites"]').inputValue(),'7');assert.equal(await quick.locator('input[name="sector"]').inputValue(),healthId);assert.equal(await page.locator('#ls-sector [data-ls-sector="'+healthId+'"]').getAttribute('aria-pressed'),'true');
 await page.locator('#ns-living-rfp [data-sector="'+healthId+'"]').first().waitFor({state:'attached'});
 const r=await page.request.get(origin+'/api/context-preview/library');assert.equal(r.status(),200);const library=await r.json();assert.equal(library.provider_records.length,30);const rows=library.provider_records.reduce((n,r)=>n+Object.values(r).filter(Array.isArray).reduce((a,b)=>a+b.length,0),0);assert.equal(rows,7764);assert.equal(Object.keys(library.buyer_checklists).length,30);assert(library.governed_questions.length>0);assert(library.extended_sase_questions);
 const source=await readFile('preview/context-space/location-workspace.js','utf8');assert(source.includes('.setView([49,-37],3.5)'));
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 assert.deepEqual(errors,[]);
 const report={checkedAt:new Date().toISOString(),environment:'local',retained,sectorButtons:10,providerRecords:30,originalResearchRows:rows,buyerChecklistRecords:30,governedQuestions:library.governed_questions.length,mapStart:{latitude:49,longitude:-37,zoom:3.5},consoleErrors:errors,qualification:'Existing original sections remain inside the collapsed ls-legacy container. Presence is not a complete historical diff; this preview was not tracked in HEAD. No live write, publication or supplier send performed.'};await writeFile('preview/context-space/preservation-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
