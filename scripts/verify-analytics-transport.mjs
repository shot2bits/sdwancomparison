import {chromium} from 'playwright';import assert from 'node:assert/strict';
const root=process.env.TEST_ORIGIN||'https://netify.co.uk';const b=await chromium.launch();
try{const p=await b.newPage();const captured=[];
await p.route('**/*',route=>{const req=route.request(),u=new URL(req.url());if(u.hostname.includes('google-analytics.com')||u.pathname.includes('/insights/view')||u.pathname.includes('/insights/event')||u.pathname.endsWith('/collect')){captured.push({url:req.url(),body:req.postData()});return route.fulfill({status:204});}return route.continue();});
await p.addInitScript(()=>localStorage.setItem('netify_consent',JSON.stringify({categories:{analytics:true}})));
await p.goto(root+'/sase/pricing/');await p.waitForFunction(()=>!!window.google_tag_manager);await p.waitForTimeout(2500);
assert(captured.some(r=>r.url.includes('google-analytics.com')),'Real Google script exercised, all outgoing collection intercepted');
await p.evaluate(()=>history.pushState({},'',location.pathname+'?q=NETIFY_TEST_PRIVATE_REQUIREMENT&token=NETIFY_TEST_PRIVATE_TOKEN'));
await p.waitForTimeout(2000);assert(await p.evaluate(()=>window['ga-disable-G-XNL6HY3BQX']));
await p.evaluate(()=>history.replaceState({},'',location.pathname));assert(await p.evaluate(()=>window['ga-disable-G-XNL6HY3BQX']),'No queued private events can flush after query removal');
assert(!JSON.stringify(captured).includes('NETIFY_TEST_PRIVATE'));
console.log('PASS real Google loader: clean public page tracked, sensitive history change opts out before automatic events, no private text in intercepted collection. Nothing delivered to analytics.');
}finally{await b.close();}
