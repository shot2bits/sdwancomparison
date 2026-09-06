import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const root=process.env.TEST_ORIGIN||'https://netify.co.uk';
const b=await chromium.launch();
try{for(const width of [1440,390]){
 const p=await b.newPage({viewport:{width,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 if(root.includes('.vercel.app')) await p.route('**/sase-sd-wan-rfp-builder/**',r=>r.continue({url:root+'/sase/home/'+new URL(r.request().url()).search}));
 await p.goto(root+'/sase/shortlist/',{waitUntil:'domcontentloaded'});
 await p.getByLabel('Provider 1',{exact:true}).selectOption('cato-networks');await p.getByLabel('Provider 2',{exact:true}).selectOption('fortinet');
 await p.getByLabel('Your requirement (optional)').fill('Five UK manufacturing sites need resilient connectivity and controlled remote maintenance.');
 await p.getByLabel('Ask about the comparison').fill('Compare failover evidence');
 await p.getByRole('button',{name:'Find providers for my project',exact:true}).first().click();
 await p.waitForURL(/(?:home|sase-sd-wan-rfp-builder)\//);
 const saved=await p.evaluate(()=>JSON.parse(sessionStorage.getItem('netify_comparison_project_draft_v1')));
 assert.deepEqual(saved.raw_input.compared_vendor_slugs,['cato-networks','fortinet']);assert.equal(saved.raw_input.comparison_question,'Compare failover evidence');assert(saved.requirement_text.startsWith('Five UK'));assert.deepEqual(saved.buyer_input.pinned_vendors,[]);
 await p.getByRole('heading',{name:'Publish a short project brief'}).waitFor();
 assert.equal(errors.length,0,errors.join('\n'));await p.close();console.log(`PASS ${width}: live comparison and project handoff retain requirement, chosen providers and question without publishing`);
}
const p=await b.newPage();await p.goto(root+'/sase/best/sd-wan-sase-providers-for-large-global-enterprises/');
const a=p.getByRole('link',{name:'Open these requirements in the buying workspace'});const url=new URL(await a.getAttribute('href'));assert.equal(url.pathname,'/sase-sd-wan-rfp-builder/');assert(url.searchParams.get('q').length>10);assert(await p.getByText('Short or Detailed RFP',{exact:false}).count());console.log('PASS server-rendered sector continuation links to canonical workspace with context');
}finally{await b.close();}
