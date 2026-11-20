// @ts-expect-error Node 24 supplies registerHooks.
import {registerHooks} from 'node:module';
registerHooks({resolve(s:string,c:object,n:(s:string,c:object)=>{url:string}){return s==='server-only'?{url:'data:text/javascript,export {};',shortCircuit:true}:n(s,c);}});
import assert from 'node:assert/strict';
import {withFakeKv} from './fake-kv-harness';
import {OpportunitySchema} from '../src/lib/opportunity-types';
await withFakeKv(async()=>{
 const kv=await import('../src/lib/rfp-store');
 const fixture=(id:string,title:string)=>OpportunitySchema.parse({id,created:1,updated:1,title,scope:['sase'],buyer_token:'secret',status:'open',visibility:'public',summary:'Historic test fixture'});
 for(const [id,title] of [['opp_msndrw2vk9vzva','TEST HARRY 10826'],['opp_msn15a6fl8ezdv','TEST HARRY 10082026']] as const){
  await kv.saveOpportunity(fixture(id,title));
 }
 await kv.saveOpportunity(fixture('opp_keep_public_ok','A real requirement'));
 const before=await kv.getOpportunity('opp_msndrw2vk9vzva');
 assert.equal(before!.visibility,'public');assert.equal(before!.status,'open');
 const listed=await kv.listPublicOpportunities();
 assert.equal(listed.length,1,listed.map(o=>o.id).join(','));
 assert.equal(listed[0].id,'opp_keep_public_ok');
 assert.ok(!listed.some(o=>o.title.includes('TEST HARRY')));
 const first=await kv.getOpportunity('opp_msndrw2vk9vzva');
 const second=await kv.getOpportunity('opp_msn15a6fl8ezdv');
 for(const o of [first,second]){
  assert.ok(o,'record still exists');
  assert.equal(o!.status,'closed');
  assert.equal(o!.visibility,'unlisted');
  assert.ok(o!.closed_at);
 }
 const archived=await kv.listArchivedPublicOpportunities(100);
 assert.ok(!archived.some(o=>kv.HISTORIC_TEST_NOTICE_IDS.includes(o.id as typeof kv.HISTORIC_TEST_NOTICE_IDS[number])));
 const again=await kv.unlistHistoricTestNotices();
 assert.deepEqual(again,[],'idempotent: no second write when already unlisted');
 console.log('historic test notices withdrawn, records kept, public board count excludes them');
});
