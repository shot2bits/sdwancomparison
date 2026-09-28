// @ts-expect-error Node 24 provides registerHooks; project types target Node 20.
import { registerHooks } from "node:module";
registerHooks({resolve(s:string,c:object,n:(s:string,c:object)=>{url:string}){return s==="server-only"?{url:"data:text/javascript,export {};",shortCircuit:true}:n(s,c);}});
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import PublicationPreview from '../src/components/procurement/PublicationPreview';
import PrivateDraftDownload from '../src/components/procurement/PrivateDraftDownload';
import { aggregateFunnel } from '../src/lib/marketplace-funnel-report';
import { withFakeKv } from './fake-kv-harness';

const empty=renderToStaticMarkup(<PublicationPreview fields={{}} onReview={()=>{}}/>);
assert.ok(!empty.includes('Your project is ready for review'));
const fields={scope:'sase',sector:'professional_services',sites:'5',regions:['uk_ireland'],timescale:'Within three months',outcome:'Replace VPN with managed SD-WAN and SASE across five offices.',company:'PRIVATE COMPANY'};
const preview=renderToStaticMarkup(<PublicationPreview fields={fields} onReview={()=>{}}/>);
assert.ok(preview.includes('Your project is ready for review'));
assert.ok(preview.includes('You can add more RFP detail later'));
assert.ok(!preview.includes(fields.company));
assert.ok(!renderToStaticMarkup(<PublicationPreview fields={{...fields,scope:''}} onReview={()=>{}}/>).includes('Your project is ready for review'));
const noAction=renderToStaticMarkup(<PublicationPreview fields={fields}/>);
assert.ok(!noAction.includes('<button'), 'inline notice preview has no duplicate review action');
assert.ok(!renderToStaticMarkup(<PublicationPreview fields={{regions:['uk_ireland']}} onReview={()=>{}}/>).includes('<button'), 'default region alone is not a started project');
assert.ok(!noAction.includes(fields.company), 'live preview never prints the private company field');
const download=renderToStaticMarkup(<PrivateDraftDownload title="draft" markdown="draft" enabled={true}/>);
assert.match(download, /^<details[^>]*><summary>Save for internal review/);
assert.doesNotMatch(download, /<details[^>]*\sopen(?:=|\s|>)/);
assert.ok(download.includes('Download private Word draft'));

await withFakeKv(async()=>{
 const store=await import('../src/lib/rfp-store');
 const {ProjectDetailsSchema}=await import('../src/lib/rfp-types');
 const {recordPublicationVerification}=await import('../src/lib/publication-verification-events');
 const {POST:verify}=await import('../src/app/api/auth/verify/route');
 const id='rfp_journey_fixture';const email='fixture@business.example';
 const project=await store.saveProject(ProjectDetailsSchema.parse({id,created:Date.now(),updated:Date.now(),buyer:{organisation:'PRIVATE COMPANY'},share_token:'fixture-share',manage_token:'fixture-private',consent:{version:'fixture',agreed_at:Date.now(),flow:'marketplace_project'}}));
 await recordPublicationVerification(id,email,'verification_requested');
 await recordPublicationVerification(id,email,'verification_requested');
 await recordPublicationVerification(id,email,'verification_completed');
 let events=await store.kvRaw(['LRANGE','marketplace:funnel:events',0,-1]) as string[];
 assert.equal(events.filter(e=>JSON.parse(e).event==='verification_requested').length,1,'request deduplication');
 assert.equal(events.filter(e=>JSON.parse(e).event==='verification_completed').length,0,'no verified stage without ownership');
 const token=await store.createMagicToken({role:'buyer',email,vendor_slug:null,rfp_id:id});
 await store.markSignupSeen(email,'buyer');
 const response=await verify(new Request('https://example.test/sase/api/auth/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})}));
 assert.equal(response.status,200);
 const saved=await store.getProject(id);assert.equal(saved?.owner_email,email);assert.notEqual(saved?.status,'published');assert.equal(saved?.marketplace_state?.market_unlock_status??'locked','locked');
 events=await store.kvRaw(['LRANGE','marketplace:funnel:events',0,-1]) as string[];
 assert.equal(events.filter(e=>JSON.parse(e).event==='verification_completed').length,1,'actual verification handler records successful mailbox verification');
 assert.equal(events.filter(e=>JSON.parse(e).event==='publication_completed').length,0,'verification is not publication');
 const before=events.length;
 await recordPublicationVerification(id,'someoneelse@business.example','verification_completed');
 assert.equal((await store.kvRaw(['LRANGE','marketplace:funnel:events',0,-1]) as string[]).length,before,'wrong owner cannot add a stage');
 assert.ok(!events.join('').includes(email)&&!events.join('').includes('PRIVATE COMPANY'),'no identity in funnel events');
 const replay=await verify(new Request('https://example.test/sase/api/auth/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token})}));assert.equal(replay.status,401);
 const report=aggregateFunnel(events.map(e=>({...JSON.parse(e),environment:'production'})));
 assert.equal(report.counts.verification_requested,1);assert.equal(report.counts.verification_completed,1);assert.equal(report.counts.publication_completed,0);
 assert.equal(aggregateFunnel(events.map(e=>({...JSON.parse(e),environment:'production',classification:'test'}))).counts.verification_completed,0);
 const original=global.fetch;try{global.fetch=async()=>{throw Error('simulated reporting outage')};await recordPublicationVerification(id,email,'verification_completed');}finally{global.fetch=original;}
});
console.log('PASS: notice readiness, public/private split, collapsed downloads, real verification route, single-use token, ownership, event deduplication, test exclusion and telemetry failure isolation');
