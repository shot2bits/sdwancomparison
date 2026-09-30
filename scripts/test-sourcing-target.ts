// @ts-expect-error Node 24 provides registerHooks.
import {registerHooks} from 'node:module';
registerHooks({resolve(s:string,c:object,n:(s:string,c:object)=>{url:string}){return s==='server-only'?{url:'data:text/javascript,export {};',shortCircuit:true}:n(s,c);}});
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sourcingUndertaking,sourcingServiceSchema,SOURCING_TARGET} from '../src/lib/sourcing-contract';
const {sourcingToolDefinitions}=await import('../src/lib/mcp-sourcing-tools');
const fallback='Agree a response target before outreach. If a supplier declines, we report it and agree what happens next.';
assert.deepEqual(SOURCING_TARGET,{proposals:null,working_days:null});
for(const target of [{proposals:null,working_days:null},{proposals:3,working_days:5}]){
 const step3=sourcingUndertaking(target);
 const service=sourcingServiceSchema('https://example.org/shortlist',target);
 const tool=sourcingToolDefinitions(target).find(t=>t.name==='request_comparable_proposals')!;
 assert.equal(step3,target.proposals===null?fallback:'3 written proposals within 5 working days. If a supplier declines, we report it and agree what happens next.');assert(service.description.includes(step3));assert(tool.description.includes(step3));
 // Exercise the real llms route against the same configurable contract.
 const original={...SOURCING_TARGET};Object.assign(SOURCING_TARGET,target);
 const llms=await import('../src/app/llms.txt/route');assert((await (await llms.GET()).text()).includes(step3));Object.assign(SOURCING_TARGET,original);
 console.log(`PASS sourcing target ${target.proposals===null?'unset':'set'}: page step 3, Service JSON-LD, llms and MCP agree`);
}
assert.equal(sourcingUndertaking({proposals:3,working_days:null}),fallback);assert.equal(sourcingUndertaking({proposals:0,working_days:5}),fallback);
const page=fs.readFileSync('src/app/(marketing)/shortlist/page.tsx','utf8');assert(page.includes('{sourcingUndertaking()}'));assert(page.includes('sourcingServiceSchema(`${SITE_URL}/shortlist/`)'));
assert(fs.readFileSync('src/lib/sourcing-notifications.ts','utf8').includes('${sourcingUndertaking()}'));
console.log('PASS partial or invalid targets stay unpromised; buyer acknowledgement uses the same contract');
