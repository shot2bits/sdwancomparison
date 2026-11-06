import assert from 'node:assert/strict';
// @ts-expect-error Node 24 runtime API; repository definitions target Node 20.
import { registerHooks } from 'node:module';

registerHooks({resolve(s:string,c:object,n:(s:string,c:object)=>{url:string}){return s==='server-only'?{url:'data:text/javascript,export {};',shortCircuit:true}:n(s,c);}});
import {withFakeKv,makeRequest} from './fake-kv-harness';

// An audit fixture against the production commit. No production credentials,
// no network pass-through, no messages, and no live records.
process.env.VERCEL_ENV='production';
process.env.CRON_SECRET='isolated-audit-secret';
delete process.env.RESEND_API_KEY;
delete process.env.NETIFY_TEST_REDIS_PORT;
const findings: unknown[]=[];
await withFakeKv(async fixture=>{
 const store=await import('../src/lib/rfp-store');
 const {startMarketplaceProject,prepareMarketplacePublication}=await import('../src/lib/marketplace-project-session');
 const {rfpBuilderEntrance}=await import('../src/lib/project-entrance');
 const {POST:recover}=await import('../src/app/api/marketplace/projects/[projectId]/recover/route');
 const policy=await import('../src/lib/publication-policy');
 const {GET:read}=await import('../src/app/api/marketplace/projects/[projectId]/route');
 const {POST:publish}=await import('../src/app/api/marketplace/projects/[projectId]/publish/route');
 const {sessionCookieHeader}=await import('../src/lib/auth');
 const {POST:verify}=await import('../src/app/api/auth/verify/route');
 const {ProjectDetailsSchema}=await import('../src/lib/rfp-types');
 const buyer={organisation:'Audit Fixture Ltd',sector:'professional_services',site_count:5,regions:['uk_ireland'],operating_model:'managed',product_scope:'sdwan_only',notes:'Replace the ageing WAN across five offices with resilient managed connectivity.'};
 const entrance=rfpBuilderEntrance({rawInput:{buyer,requirement_text:buyer.notes,solution_scope:'sdwan',outcome:buyer.notes,timescale:'Within six months'}});
 const draft=await startMarketplaceProject({entrance_context:entrance,mode:'quick_list'});
 const ctx={params:Promise.resolve({projectId:draft.project_reference})};
 let response=await read(makeRequest('GET','https://example.test',{headers:{authorization:`Bearer ${draft.project_session_token}`}}),ctx);
 assert.equal(response.status,200);
 const prepared=await prepareMarketplacePublication(draft.project_reference,draft.project_session_token,{base_revision:0,consent_version:policy.MARKETPLACE_PUBLICATION_CONSENT_VERSION,consent_text:policy.MARKETPLACE_PUBLICATION_CONSENT_TEXT});
 const email='owner@fixture.example';
 const {POST:requestSignIn}=await import('../src/app/api/auth/request/route');
 const {issueAuthChallenge}=await import('../src/lib/auth-challenge');
 const challenge=issueAuthChallenge();
 const fakeFetch=global.fetch;
 let mailCaptured=0;
 process.env.RESEND_API_KEY='synthetic-audit-never-sent';
 global.fetch=(async(input,init)=>{
  if(String(input)==='https://api.resend.com/emails'){mailCaptured++;return Response.json({id:'audit-captured-mail'});}
  return fakeFetch(input,init);
 }) as typeof fetch;
 const clock=Date.now;
 try{
  Date.now=()=>clock()+800;
  response=await requestSignIn(makeRequest('POST','https://example.test/sase/api/auth/request/',{body:{email,role:'buyer',return_to:`/sase-sd-wan-rfp-builder/?journey=quick_list&project=${draft.project_reference}`,bot_proof:{challenge,website:''}}}));
  assert.equal(response.status,200);
  assert.equal((await response.json()).emailed,true);
  assert.equal(mailCaptured,1);
 }finally{Date.now=clock;global.fetch=fakeFetch;delete process.env.RESEND_API_KEY;}
 const tokenKey=fixture.fixtureCommands().find(c=>String(c[1]).startsWith('auth:magic:'))!;
 assert.ok(tokenKey);
 await store.markSignupSeen(email,'buyer');
 response=await verify(makeRequest('POST','https://example.test',{body:{token:String(tokenKey[1]).slice('auth:magic:'.length)}}));
 assert.equal(response.status,200);
 assert.equal((await store.getProject(draft.project_reference))?.owner_email,email);
 const cookie=response.headers.get('set-cookie')!;
 response=await read(makeRequest('GET','https://example.test',{cookie,headers:{authorization:`Bearer ${draft.project_session_token}`}}),ctx);
 assert.equal(response.status,200);
 findings.push({verified_working:'Create draft -> prepare consent -> request email -> verify email -> claim ownership -> read with original browser credential',mail:'captured in memory',actual_status:response.status});
 response=await read(makeRequest('GET','https://example.test',{cookie}),ctx);
 assert.equal(response.status,404);
 findings.push({issue:'Verified owner cannot restore marketplace draft without browser-specific token',actual_status:response.status,expected_owner_recovery:true});
 response=await publish(makeRequest('POST','https://example.test',{cookie,body:{base_revision:prepared.revision,consent_version:policy.MARKETPLACE_PUBLICATION_CONSENT_VERSION,consent_text:policy.MARKETPLACE_PUBLICATION_CONSENT_TEXT}}),ctx);
 assert.equal(response.status,404);
 findings.push({issue:'Verified owner cannot publish from a second browser without marketplace token',actual_status:response.status});
 const originalNow=Date.now;
 try{
  Date.now=()=>originalNow()+8*60*60*1000+1000;
  response=await read(makeRequest('GET','https://example.test',{cookie,headers:{authorization:`Bearer ${draft.project_session_token}`}}),ctx);
  assert.equal(response.status,404);
  const stillThere=await store.getProject(draft.project_reference);
  assert.ok(stillThere);
  const recovered=await recover(makeRequest('POST','https://example.test',{cookie}),ctx);
  assert.equal(recovered.status,200);
  const recoveredBody=await recovered.json();
  const readable=await read(makeRequest('GET','https://example.test',{cookie,headers:{authorization:`Bearer ${recoveredBody.project_session_token}`}}),ctx);
  assert.equal(readable.status,200);
  const wrong=await store.createSession({email:'other@fixture.example',role:'buyer',vendor_slug:null});
  assert.equal((await recover(makeRequest('POST','https://example.test',{cookie:sessionCookieHeader(wrong.token)}),ctx)).status,404);
  assert.equal((await recover(makeRequest('POST','https://example.test'),ctx)).status,401);
  findings.push({issue:'Draft session expires after eight hours; saved project still exists but owner read returns 404',actual_status:response.status,project_still_stored:!!stillThere});
 }finally{Date.now=originalNow;}
 const legacy=await store.saveProject(ProjectDetailsSchema.parse({id:'rfp_auditlegacy',created:Date.now(),updated:Date.now(),buyer:{},share_token:'synthetic-share',manage_token:'synthetic-manage',pending_submit:{list_on_board:true,requested_at:Date.now()},consent:{version:'legacy',agreed_at:Date.now(),flow:'wizard'}}));
 // Prevent a signup notification: the fixture already has its signup record.
 await store.markSignupSeen(email,'buyer');
 const magic=await store.createMagicToken({email,role:'buyer',vendor_slug:null,rfp_id:legacy.id});
 response=await verify(makeRequest('POST','https://example.test',{body:{token:magic}}));
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.ok,true);
 assert.equal(body.publish_outcome.state,'saved_unpublished');
 assert.ok(body.publish_outcome.message);
 assert.ok(body.publish_outcome.return_url);
 assert.equal((await store.getProject(legacy.id))?.status,'draft');
 findings.push({issue:'Legacy email-confirmation submit suppresses ordinary publication refusal',verification_status:response.status,publish_outcome_present:false,project_status:'draft'});
});
console.log('PASS buyer completion: create, consent, captured verification, claim, owner recovery after expiry, second-device access, wrong-owner and anonymous denial, explicit failed publication outcome. No external mail.');
