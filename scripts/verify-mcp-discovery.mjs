import assert from 'node:assert/strict';
const root=process.env.TEST_ORIGIN||'https://netify.co.uk';
let id=0;
async function rpc(method,params={}) {const r=await fetch(root+'/sase/api/mcp/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params})});assert.equal(r.status,200);assert(!r.redirected);const d=await r.json();assert(!d.error,JSON.stringify(d.error));return d.result;}
async function call(name,args){const r=await rpc('tools/call',{name,arguments:args});return {r,data:r.structuredContent||JSON.parse(r.content[0].text)};}
const init=await rpc('initialize',{protocolVersion:'2025-06-18',clientInfo:{name:'Netify read-only verification',version:'1'},capabilities:{}});
assert(init.instructions.includes('https://netify.co.uk/sase/pricing/'));
assert(init.instructions.includes('https://netify.co.uk/sase-sd-wan-rfp-builder/'));
const catalogue=await rpc('tools/list');assert.equal(catalogue.tools.length,46);assert.equal(new Set(catalogue.tools.map(t=>t.name)).size,46);
const comparison=await call('compare_vendors',{slugs:['cato-networks','fortinet'],question:'Compare manufacturing failover evidence'});
assert(!comparison.r.isError);assert.deepEqual(comparison.data.slugs,['cato-networks','fortinet']);assert.equal(comparison.data._meta.canonicalUrl,'https://netify.co.uk/sase/shortlist/');assert.equal(new URL(comparison.data.resume_url).searchParams.get('question'),'Compare manufacturing failover evidence');
const cost=await call('netify_estimate_sase_tco',{users:1000,sites:20,regions:['uk-europe'],securityDepth:'full-sase',deliveryModel:'managed',termYears:3});assert(!cost.r.isError);assert.match(JSON.stringify(cost.data),/provisional|calibration/i);
const invalid=await call('netify_validate_circuit_request',{request:{}});assert.equal(invalid.data.valid,false);assert(invalid.data.issues.length>0);
const request={company:'Synthetic verification',sector:'Manufacturing',timescale:'Six months',scope:'Underlay only',lines:[{id:'00000000-0000-4000-8000-000000000001',name:'UK remote users',country:'United Kingdom',address:'',kind:'4G / 5G SIM only',remote:true,quantity:5,bandwidth:'5G',data:'Unlimited requested',resilience:'Single connection',operation:'Not applicable',router:'No router',contact_name:'',contact_email:'',contact_phone:'',protect:false,devices:0,term:'12 months'}]};
const valid=await call('netify_validate_circuit_request',{request});assert.equal(valid.data.valid,true,JSON.stringify(valid.data));assert.equal(valid.data.workspace_url,'https://netify.co.uk/sase/circuit-pricing/');assert(!valid.data.request_id);
const denied=await call('netify_read_circuit_responses',{request_id:'00000000-0000-4000-8000-000000000000',access_token:'x'.repeat(48)});assert(denied.r.isError);assert(!denied.data.quotes);
const example=await rpc('resources/read',{uri:'https://netify.co.uk/sase/examples/manufacturing-rfp/data.json'});const data=JSON.parse(example.contents[0].text);assert(data.synthetic);assert.equal(data.example.walkthrough.steps.length,5);
const doc=await(await fetch(root+'/sase/capabilities.json')).json();assert.equal(doc.pricing_routes.length,3);assert.equal(doc.public_evidence.manufacturing_data,'https://netify.co.uk/sase/examples/manufacturing-rfp/data.json');
const page=await(await fetch(root+'/sase/connector/')).text();for(const route of doc.pricing_routes)assert(page.includes(route.title));
console.log('PASS initialize, 46 tools, named comparison + handoff, provisional cost, circuit validation, private denial, example resource, HTML/JSON route parity. No project writes or messages.');
