import {createRequire} from 'node:module';
const {readFile}=await import('node:fs/promises');
const require=createRequire(process.cwd()+'/package.json');const {chromium}=require('playwright-core');
const origin=process.env.CONTEXT_PREVIEW_ORIGIN??'http://127.0.0.1:3017';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('This test can only run against a local preview.');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(origin+'/locations/?qa=priced-scope-12nov',{waitUntil:'domcontentloaded'});
 await page.locator('#ns-pricing-workspace').waitFor({timeout:60000});
 await page.locator('[data-ls-goal="pricing"]').click();
 const form=page.locator('#ls-quick-form');await form.waitFor();await form.locator('[data-ls-sector="manufacturing"]').click();await form.locator('input[name="product"][value="sdwan"]').check();await form.locator('input[name="sites"]').fill('12');await form.locator('input[name="users"]').fill('500');await form.locator('input[name="region"][value="uk_ireland"]').check();await form.locator('button[type="submit"]').click();
 const pricing=page.locator('#ns-pricing-workspace');await pricing.scrollIntoViewIfNeeded();await pricing.locator('select[name="termMonths"]').selectOption('36');await pricing.locator('input[name="bandwidthMbps"]').fill('100');await pricing.locator('input[name="includeConnectivity"]').check();await pricing.locator('#np-terms button').click();await pricing.getByText('Scope version 1',{exact:true}).waitFor();
 const scope=await pricing.locator('.np-scope-summary').innerText();if(!scope.includes('12 sites'))throw Error('Site scope mismatch');
 await pricing.locator('details').filter({has:page.locator('#np-supplier')}).locator('summary').first().click();
 const supplier=pricing.locator('#np-supplier');await supplier.locator('[name="supplierId"]').selectOption('netify');await supplier.locator('[name="name"]').fill('Synthetic pricing reviewer');await supplier.locator('[name="email"]').fill('supplier-fixture@example.test');await supplier.locator('[name="authority"]').fill('TEST ONLY authority fixture');await supplier.locator('[name="hours"]').fill('48');await supplier.locator('[name="attest"]').check();await supplier.locator('button').click();await pricing.getByText('Test settings saved on this device. No supplier contacted.').waitFor();
 await pricing.locator('details').filter({has:page.locator('#np-recipients')}).locator('summary').first().click();await pricing.locator('#np-recipients input[value="netify"]').check();await pricing.locator('[data-price="request"]').click();await pricing.getByText('Scope 1 · not sent',{exact:true}).waitFor();
 if(!(await pricing.innerText()).includes('Who was asked: nobody'))throw Error('Request delivery overstated');
 if(await page.locator('#ns-living-rfp').count()!==1)throw Error('Living RFP missing');
 await pricing.locator('#np-quote-section summary').first().click();
 const [download]=await Promise.all([page.waitForEvent('download'),pricing.locator('[data-price="template"]').click()]);
 const quotation=JSON.parse(await readFile(await download.path(),'utf8'));
 quotation.supplierId='netify';quotation.reference='SYNTHETIC QA ONLY';quotation.taxBasis='excluding_tax';
 quotation.lines[0]={...quotation.lines[0],status:'firm',currency:'GBP',amountMinor:12345,charge:'recurring',periodMonths:1,source:{source:'Synthetic fixture only, not a supplier quotation',sourceRef:'TEST ONLY',issuedAt:new Date().toISOString(),validUntil:new Date(Date.now()+86400000).toISOString()}};
 await pricing.locator('#np-quotation').setInputFiles({name:'synthetic-quotation.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(quotation))});
 await pricing.getByText('SYNTHETIC QA ONLY · TEST',{exact:true}).waitFor();
 if(!(await pricing.innerText()).includes('GBP 123.45'))throw Error('Exact structured unit amount missing');
 if(!(await pricing.innerText()).includes('No complete estate total is shown'))throw Error('Missing lines were totalled as complete');
 const sites=page.getByRole('spinbutton',{name:'Document sites',exact:true});await sites.scrollIntoViewIfNeeded();await sites.fill('14');await sites.press('Tab');
 await pricing.getByText('Scope version 2',{exact:true}).waitFor();
 if(!(await pricing.locator('.np-scope-summary').innerText()).includes('14 sites'))throw Error('RFP edit did not update priced scope');
 if(!(await pricing.innerText()).includes('Quotation belongs to a different scope version'))throw Error('Old quotation was not flagged');

 if(!await page.evaluate(()=>Object.keys(localStorage).some(k=>k.includes('context')||k.includes('workspace'))))throw Error('Project was not saved alongside pricing');
 await pricing.screenshot({path:'/private/tmp/netify-priced-scope-local.png'});
 await page.setViewportSize({width:390,height:844});await pricing.scrollIntoViewIfNeeded();if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Page overflow at mobile width');
 if(errors.length)throw Error('Browser errors: '+errors.join('; '));console.log('PASS browser: business brief -> shared estate -> priced scope -> local supplier settings -> named test request preview -> exact synthetic quotation import. Incomplete total withheld. Editing Living RFP to 14 sites updates scope and flags old quotation. No dispatch; desktop/mobile no page overflow.');
}finally{await browser.close();}
