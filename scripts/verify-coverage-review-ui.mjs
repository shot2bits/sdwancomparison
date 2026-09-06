import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const root=process.env.TEST_ORIGIN||'http://localhost:3107';
const browser=await chromium.launch();
try {
 const p=await browser.newPage();p.setDefaultTimeout(30000);
 await p.goto(root+'/sase/home/?journey=validate_rfp');
 await p.getByPlaceholder('Paste an existing or AI-generated RFP here, or attach Word, PDF, text or a spreadsheet').fill('We are a healthcare organisation with 15 UK sites and 30 remote users. We need managed SASE within six months.');
 await p.getByRole('button',{name:'Start',exact:true}).click();
 await p.locator('.lpos-validation-report').waitFor({state:'attached'});
 await p.getByRole('button',{name:'Supplier pack',exact:true}).click();
 const report=p.getByRole('region',{name:'RFP validation report'});
 await report.getByText('Review your RFP coverage',{exact:true}).waitFor().catch(async e=>{console.log(await p.locator('body').innerText());throw e;});
 assert.match(await report.innerText(),/not a technical approval/);
 assert.doesNotMatch(await report.innerText(),/Procurement-ready|\/100/);
 await report.locator('details > summary').click();
 assert((await report.locator('details p').count())>4);
 assert.equal(await report.locator('.lpos-validation-sections button').count(),8);
 console.log('PASS actual checker response: honest coverage label, all findings expandable, eight sections, no readiness score headline');
} finally {await browser.close();}
