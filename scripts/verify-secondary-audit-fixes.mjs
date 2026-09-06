import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://localhost:3107';
const b=await chromium.launch({headless:true});
try {
 const c=await b.newContext();let privateCalls=0;
 await c.route('**/sase/api/auth/session',r=>r.fulfill({json:{authenticated:false}}));
 await c.route('**/sase/api/rfp/mine',r=>{privateCalls++;return r.fulfill({json:{rfps:[]}})});
 const p=await c.newPage();await p.goto(base+'/sase/account/',{waitUntil:'networkidle'});
 assert.equal(await p.getByText('Your account is ready. Here is what it does.',{exact:true}).count(),0);assert.equal(privateCalls,0);
 console.log('PASS signed-out account does not show ready or request private records');
 await c.route('**/sase/api/auth/session',r=>r.fulfill({json:{authenticated:true}}));
 await c.route('**/sase/api/opportunity/mine',r=>r.fulfill({json:{opportunities:[]}}));
 await p.reload({waitUntil:'networkidle'});await p.getByText('Your account is ready. Here is what it does.',{exact:true}).waitFor();assert(!(await p.locator('body').innerText()).includes('pays out instantly'));console.log('PASS authenticated empty-account launchpad');
 await c.route('**/sase/api/rfp/mine',r=>r.fulfill({status:503,json:{error:'Unavailable'}}));await p.reload({waitUntil:'networkidle'});await p.getByRole('alert').filter({hasText:'could not be loaded'}).waitFor();assert.equal(await p.getByText('Your account is ready. Here is what it does.',{exact:true}).count(),0);console.log('PASS failed load is not an empty account');
 await p.goto(base+'/sase/cost-estimator/',{waitUntil:'networkidle'});assert.equal(await p.locator('main').count(),1);
 await p.getByRole('spinbutton',{name:/^Licensed users/}).fill('30');await p.getByRole('button',{name:'Estimate cost bands'}).click();await p.getByRole('alert').filter({hasText:'at least 50 licensed users'}).waitFor();console.log('PASS under50 clearerror and singlemain');
 await p.getByRole('spinbutton',{name:/^Licensed users/}).fill('50');await p.getByRole('button',{name:'Estimate cost bands'}).click();await p.getByText('Three year TCO band',{exact:true}).waitFor();await p.getByLabel('Sites',{exact:true}).fill('15');assert.equal(await p.getByText('Three year TCO band',{exact:true}).count(),0);console.log('PASS input edit removes stale estimate and continuation');
 let release;
 const responseReady=new Promise(resolve=>{release=resolve});
 await c.route('**/sase/api/cost/estimate',async r=>{await responseReady;await r.fulfill({json:{monthlyBandGBP:[100,200],threeYearTcoBandGBP:[3600,7200],byDriver:{},notes:[],disclaimer:'Test fixture',methodologyVersion:'test'}})});
 await p.getByRole('button',{name:'Estimate cost bands'}).click();
 await p.getByLabel('Sites',{exact:true}).fill('25');
 release();
 await p.getByRole('button',{name:'Estimate cost bands'}).waitFor();
 assert.equal(await p.getByText('Three year TCO band',{exact:true}).count(),0);
 console.log('PASS late estimate response cannot restore stale result (synthetic API response)');
 await c.close();
} finally {await b.close()}
