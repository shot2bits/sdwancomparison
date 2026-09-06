import {chromium} from 'playwright';import assert from 'node:assert/strict';
const root=process.env.TEST_ORIGIN||'https://netify.co.uk';const browser=await chromium.launch();
try{
 for(const consent of [false,true]){
  const p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/*google-analytics.com/**',r=>r.fulfill({body:''}));
  await p.route('**/*googletagmanager.com/**',r=>r.fulfill({contentType:'application/javascript',body:''}));
  await p.route('**/_vercel/insights/**',r=>r.fulfill({contentType:'application/javascript',body:''}));
  await p.addInitScript(consent=>{localStorage.setItem('netify_consent',JSON.stringify({categories:{analytics:consent}}));window.__ga=[];window.__va=[];window.gtag=(...args)=>window.__ga.push(args);window.va=(...args)=>{if(args[0]==='beforeSend')window.__beforeSend=args[1];else window.__va.push(args);};},consent);
  await p.goto(root+'/sase/circuit-pricing/?q=PRIVATE_REQUIREMENT&token=PRIVATE_TOKEN');
  await p.waitForFunction(()=>sessionStorage.getItem('netify_first_touch'));
  const result=await p.evaluate(()=>({touch:sessionStorage.getItem('netify_first_touch'),ga:window.__ga,va:window.__va,filtered:window.__beforeSend?.({type:'pageview',url:'https://netify.co.uk/sase/rfp-builder/PRIVATE_ID/?q=PRIVATE_REQUIREMENT#PRIVATE_TOKEN'})}));
  assert(!JSON.stringify(result).includes('PRIVATE_'));assert.equal(JSON.parse(result.touch).landing,'/sase/circuit-pricing/');
  if(consent){assert(result.ga.some(e=>e[0]==='event'&&e[1]==='buying_entry'));assert.equal(result.filtered.url,'https://netify.co.uk/sase/rfp-builder/');}
  else{assert.equal(result.ga.length,0);assert.equal(result.va.length,0);assert.equal(await p.locator('script[data-netify-ga],script[data-netify-va]').count(),0);}
  assert.equal(errors.length,0);await p.close();console.log(`PASS consent=${consent}: attribution strips query/token, analytics payloads contain no private requirement or identifier`);
 }
 const response=await fetch(root+'/sase/api/admin/buying-funnel/');assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'private, no-store');
 const fixture={generated_at:Date.now(),period_start:Date.now()-28*864e5,period_days:28,oldest_available:null,retained_event_limit:10000,retention_limit_reached:false,interpretation:'Unique projects, not a cohort conversion rate.',counts:Object.fromEntries(['project_started','requirements_updated','match_previewed','publication_prepared','identity_verified','publication_completed','publication_incomplete','supplier_interest','supplier_response'].map(k=>[k,0])),rows:[]};
 for(const width of [1440,390]){const p=await browser.newPage({viewport:{width,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/api/admin/buying-funnel/**',r=>r.fulfill({json:fixture}));await p.goto(root+'/sase/admin/buying-funnel/');await p.getByRole('heading',{name:'By recorded starting route'}).waitFor();assert(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)));assert.equal(errors.length,0);assert((await p.locator('meta[name="robots"]').getAttribute('content')).includes('noindex'));await p.close();console.log(`PASS ${width}: admin report layout, no overflow/errors; display fixture only`);}
 console.log('PASS live anonymous API denial; no events, buyer records or notifications written by test');
}finally{await browser.close();}
