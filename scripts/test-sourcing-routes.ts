// @ts-expect-error Node 24 provides registerHooks.
import { registerHooks } from 'node:module';
registerHooks({resolve(s:string,c:object,n:(s:string,c:object)=>{url:string}){return s==='server-only'?{url:'data:text/javascript,export {};',shortCircuit:true}:n(s,c);}});
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {withFakeKv,makeRequest,FAKE_KV_URL} from './fake-kv-harness';
// Hermetic: no network passes through; production behaviour is exercised only
// against the in-memory KV and captured mail. Never import stores before this.
await withFakeKv(async store=>{
 process.env.VERCEL_ENV='production';process.env.RESEND_API_KEY='synthetic-mail-key';
 delete process.env.PROVIDER_MATCH_DATA_URL;delete process.env.PROVIDER_MATCH_SERVICE_TOKEN;
 let onMail: ((mail:{to:string;text:string})=>Promise<void>) | null=null;
 let failQueueOnce=false; let rejectMail=false; let throwMail=false;
 const fakeFetch=global.fetch;const mails:{to:string;text:string}[]=[];
 global.fetch=async(input,init)=>{
  const url=typeof input==='string'?input:input instanceof URL?input.toString():input.url;
  if(url==='https://api.resend.com/emails'){
    if(throwMail)throw new Error('Synthetic mail transport interruption');
    if(rejectMail)return Response.json({error:'rejected'},{status:503});
    const mail=JSON.parse(String(init?.body));mails.push(mail);if(onMail)await onMail(mail);return Response.json({id:'captured-mail'});
  }
  if(failQueueOnce && url===FAKE_KV_URL){const command=JSON.parse(String(init?.body));if((command[0]==='ZADD' && command[1]==='sourcing:desk-review') || (command[0]==='EVAL' && String(command[1]).includes('sourcing-confirm-commit'))){failQueueOnce=false;throw new Error('Synthetic queue interruption');}}
  assert.equal(url,FAKE_KV_URL,'No network may escape this fixture');return fakeFetch(input,init);
 };
 const requestRoute=await import('../src/app/api/sourcing/request/route');
 const confirmRoute=await import('../src/app/api/sourcing/confirm/route');
 const body={brief:{sites:10,remote_users:50,region:'uk_ireland',sector:'manufacturing',need:'sdwan',when:'Within 3 months',requirement:'PRIVATE ORIGINAL',supplier_brief:'Anonymous ten-site requirement'},recipients:[{slug:'cisco',actions:['demo']},{slug:'aryaka',actions:['proposals']}],email:'fixture@example.org',consent:true,anonymous:true,idempotency_key:randomUUID()};
 const post=()=>requestRoute.POST(makeRequest('POST','https://preview.example/sase/api/sourcing/request/',{body}));
 const first=await post();assert.equal(first.status,200);const receipt=await first.json();assert.equal(mails.length,1);assert(!mails[0].text.includes('PRIVATE ORIGINAL'));
 const repeat=await post();assert.equal(repeat.status,200);assert.equal((await repeat.json()).request_id,receipt.request_id);assert.equal(mails.length,1);
 const match=mails[0].text.match(/#request=([^&\s]+)&token=([^\s]+)/);assert(match);const token=match[2];
 const read=await confirmRoute.POST(makeRequest('POST','https://preview.example/sase/api/sourcing/confirm/',{body:{id:receipt.request_id,token,confirm:false}}));assert.equal(read.status,200);assert.match(read.headers.get('cache-control')??'',/no-store/);assert.equal((await read.json()).status,'pending_confirmation');
 const before=store.peekJson<{project_id:string}>(`sourcing:request:${receipt.request_id}`)!;assert.equal(store.peekJson(`rfp:${before.project_id}`),null,'Opening email must not create a project');
 const confirm=()=>confirmRoute.POST(makeRequest('POST','https://preview.example/sase/api/sourcing/confirm/',{body:{id:receipt.request_id,token,confirm:true}}));
 failQueueOnce=true;assert.equal((await confirm()).status,403);assert.equal(store.peekJson<{status:string}>(`sourcing:request:${receipt.request_id}`)?.status,'pending_confirmation','Failed atomic commit must not report confirmed');
 const accepted=await confirm();assert.equal(accepted.status,200);const acceptedData=await accepted.json();assert.equal(acceptedData.status,'desk_review');assert(acceptedData.project_url.includes(before.project_id));
 const scopedCookie=accepted.headers.get('set-cookie')!;assert.match(scopedCookie,/HttpOnly/);assert.match(scopedCookie,/Secure/);assert.match(scopedCookie,/SameSite=Lax/);
 const {sourcingAccess}=await import('../src/lib/sourcing-access');const scopedRequest=makeRequest('GET','https://preview.example/sase/api/rfp/'+before.project_id,{cookie:scopedCookie.split(';')[0]});assert(await sourcingAccess(scopedRequest,before.project_id));assert.equal(await sourcingAccess(scopedRequest,'rfp_otherproject'),null);
 const rfpRoute=await import('../src/app/api/rfp/[id]/route');const ownerRead=await rfpRoute.GET(scopedRequest,{params:Promise.resolve({id:before.project_id})});assert.equal(ownerRead.status,200);const ownerProject=await ownerRead.json();assert.equal(ownerProject.id,before.project_id);assert.equal(ownerProject.buyer.site_count,10);assert.equal(ownerProject.buyer.product_scope,"sdwan_only");assert(!ownerProject.buyer.notes.includes("PRIVATE ORIGINAL"));
 const connectivity=await import('../src/app/api/sourcing/projects/[id]/connectivity/route');
 const ctx={params:Promise.resolve({id:before.project_id})};
 const circuitSchema=await import('../src/lib/circuit-schema');
 const circuitInput={company:'Synthetic buyer',sector:'Manufacturing',timescale:'Within three months',scope:'With SD-WAN / SASE',lines:[{...circuitSchema.newCircuitLine(),name:'Factory',address:'10 Example Road, Norwich NR1 1AA',bandwidth:'100 Mbps'}]};
 const privatePost=(payload:unknown)=>connectivity.POST(makeRequest('POST',`https://preview.example/sase/api/sourcing/projects/${before.project_id}/connectivity/`,{body:payload,cookie:scopedCookie.split(';')[0]}),ctx);
 assert.equal((await connectivity.GET(makeRequest('GET','https://preview.example/'),ctx)).status,401);
 const savedCircuit=await privatePost({id:before.project_id,action:'save',revision:0,input:circuitInput});assert.equal(savedCircuit.status,200);const savedConnectivity=(await savedCircuit.json()).request;assert.equal(savedConnectivity.id,before.project_id);assert.equal(savedConnectivity.opportunity_id,null);
 assert.equal((await privatePost({id:before.project_id,action:'request_review',revision:1,consent:'no'})).status,422);
 const consentText=(await import('../src/lib/sourcing-contract')).PRIVATE_CIRCUIT_CONSENT;
 const requestedCircuit=await privatePost({id:before.project_id,action:'request_review',revision:1,consent:consentText});assert.equal(requestedCircuit.status,200);const circuit=(await requestedCircuit.json()).request;assert.equal(circuit.status,'sourcing');assert.equal(circuit.opportunity_id,null);assert.equal(mails.length,1);
 assert.equal((await privatePost({id:before.project_id,action:'save',revision:2,input:circuitInput})).status,409);
 const reopen={id:before.project_id,action:'reopen',revision:2,consent:'Reopen this scope for amendment; previous quotes are archived and do not apply to the new draft.'};
 assert.equal((await privatePost({...reopen,consent:'no'})).status,422);
 const reopened=await privatePost(reopen);assert.equal(reopened.status,200);const amended=(await reopened.json()).request;assert.equal(amended.status,'draft');assert.equal(amended.revision,3);assert.deepEqual(amended.quotes,[]);assert.equal(amended.consent,undefined);
 assert.equal(store.peekJson<{status:string}>(`circuits:archive:${before.project_id}:2`)?.status,'sourcing');
 assert.equal((await privatePost(reopen)).status,200,'Amendment retry is idempotent');
 const archiveRead=await connectivity.GET(makeRequest('GET','https://preview.example/?archive=2',{cookie:scopedCookie.split(';')[0]}),ctx);assert.equal(archiveRead.status,200);assert.equal((await archiveRead.json()).archived,true);
 assert.equal((await connectivity.GET(makeRequest('GET','https://preview.example/?archive=2'),ctx)).status,401);
 assert.equal((await privatePost({...reopen,revision:0})).status,409);
 console.log('PASS shared-project connectivity: scoped access, same ID, existing store, revision checks, private review consent, no board or mail');
 const saved=store.peekJson<{id:string;manage_token:string;invited_vendors:unknown[]}>(`rfp:${before.project_id}`)!;assert(saved);assert.match(saved.id,/^rfp_[a-z0-9]+$/,'Compatible with existing RFP recovery routes');assert.equal(saved.invited_vendors.length,0);
 const replay=await confirm();assert.equal(replay.status,200);assert.equal(store.peekJson<{manage_token:string}>(`rfp:${before.project_id}`)!.manage_token,saved.manage_token,'Retry must not replace project credentials');assert.equal(mails.length,1,'Only buyer confirmation mail; no supplier mail');
 const repeatedAfterConfirmation=await post();assert.equal(repeatedAfterConfirmation.status,200);assert.equal((await repeatedAfterConfirmation.json()).status,'desk_review');
 for(let i=0;i<4;i++)assert.equal((await post()).status,200,'Idempotent retries do not consume new-request allowance');
 const tampered=await confirmRoute.POST(makeRequest('POST','https://preview.example/sase/api/sourcing/confirm/',{body:{id:receipt.request_id,token:'x'.repeat(43),confirm:true}}));assert.equal(tampered.status,403);
 const privateRaw=JSON.stringify(store.peekJson(`sourcing:request:${receipt.request_id}`));assert(!privateRaw.includes(token),'Raw token must not persist');

 // Confirmation persisted but queue write interrupted: a retry must repair membership.
 store.command(['DEL','sourcing:desk-review']);failQueueOnce=true;
 assert.equal((await confirm()).status,403);
 assert.equal((await confirm()).status,200);
 assert((store.command(['ZRANGE','sourcing:desk-review',0,-1]) as string[]).includes(receipt.request_id));
 const rejectedOrigin=await requestRoute.POST(makeRequest('POST','https://preview.example/sase/api/sourcing/request/',{body,headers:{origin:'https://attacker.example'}}));assert.equal(rejectedOrigin.status,403);
 const tooLarge=await confirmRoute.POST(makeRequest('POST','https://preview.example/sase/api/sourcing/confirm/',{body:{token:'x'.repeat(3000)}}));assert.equal(tooLarge.status,413);
 const noConsent=await requestRoute.POST(makeRequest('POST','https://preview.example/sase/api/sourcing/request/',{body:{...body,consent:false}}));assert.equal(noConsent.status,422);
 const forged=await requestRoute.POST(makeRequest('POST','https://preview.example/sase/api/sourcing/request/',{body:{...body,recipients:[{slug:'invented-supplier',actions:['demo']}]}}));assert.equal(forged.status,422);
 const desk=await import('../src/app/api/sourcing/desk/route');assert.equal((await desk.GET(makeRequest('GET','https://preview.example/sase/api/sourcing/desk/'))).status,403);
 const rfpStore=await import('../src/lib/rfp-store');
 const staff=await rfpStore.createSession({role:'netify',email:'desk@example.org',vendor_slug:null});
 const deskResponse=await desk.GET(makeRequest('GET','https://preview.example/sase/api/sourcing/desk/',{cookie:`netify_session=${staff.token}`}));assert.equal(deskResponse.status,200);const deskData=await deskResponse.json();assert(deskData.requests.some((r:{id:string})=>r.id===receipt.request_id));assert(!JSON.stringify(deskData).includes(token));
 const buyer=await rfpStore.createSession({role:'buyer',email:body.email,vendor_slug:null});assert.equal((await desk.GET(makeRequest('GET','https://preview.example/sase/api/sourcing/desk/',{cookie:`netify_session=${buyer.token}`}))).status,403);
 delete process.env.ANTHROPIC_API_KEY;
 const privateProject=await import('../src/app/api/sourcing/projects/[id]/route');
 const proposalScope=(await import('../src/lib/sourcing-proposal-scope')).sourcingScopeHash((await rfpStore.getProject(before.project_id))!);
 const proposal={id:randomUUID(),scope_hash:proposalScope,vendor_slug:'aryaka',vendor:'Aryaka',answers:{},pricing:{model:'total_monthly',amount:null,currency:'GBP',unit_note:'12-site scope; installation excluded',notes:'Amount not yet confirmed'},evidence_url:'https://supplier.example/proposal.pdf',supplier_confirmed:true};
 const proposalPost=(payload:unknown,cookie:string)=>privateProject.POST(makeRequest('POST',`https://preview.example/sase/api/sourcing/projects/${before.project_id}/`,{body:payload,cookie}),ctx);
 assert.equal((await proposalPost(proposal,scopedCookie.split(';')[0])).status,403);
 const deskCookie=`netify_session=${staff.token}`;assert.equal((await proposalPost({...proposal,vendor_slug:'cisco'},deskCookie)).status,422);
 assert.equal((await proposalPost({...proposal,scope_hash:'0'.repeat(64)},deskCookie)).status,409,'Stale requirement scope rejected');
 assert.equal((await proposalPost({...proposal,pricing:{...proposal.pricing,unit_note:'   '}},deskCookie)).status,422,'Whitespace is not a comparable charging basis');
 const proposalResult=await proposalPost({...proposal,vendor:'Untrusted submitted name'},deskCookie);assert.equal(proposalResult.status,200);assert.equal((await proposalResult.json()).project_id,before.project_id);assert.equal((await proposalPost({...proposal,vendor:'Untrusted submitted name'},deskCookie)).status,200);assert.equal((await proposalPost(proposal,deskCookie)).status,422,'Payload reuse must reject changes');
 const projectRead=await privateProject.GET(scopedRequest,ctx);assert.equal(projectRead.status,200);const joined=await projectRead.json();assert.equal(joined.feed.length,1);assert.equal(joined.feed[0].actor_name,"Aryaka");assert.equal(joined.feed[0].pricing.amount,null);assert.equal(joined.responses[0].rfp_id,before.project_id);assert.equal(joined.reviews[0].rfp_id,before.project_id);assert.equal(joined.reviews[0].evidence_checks.find((c:{key:string})=>c.key==='mandatory_coverage').pass,false,'No requirements is not full coverage');
 assert.equal((await connectivity.GET(makeRequest('GET','https://preview.example/',{cookie:`netify_session=${buyer.token}`}),ctx)).status,200,'Account ownership recovers private connectivity after browser grant expires');
 const activity=await import('../src/app/api/sourcing/projects/[id]/activity/route');
 const event={id:randomUUID(),stage:'supplier_approached',supplier_slug:'aryaka',evidence_url:'https://supplier.example/evidence',note:'Synthetic recorded evidence',occurred_at:'2026-09-29T10:00:00Z'};
 const activityPost=(payload:unknown,cookie=deskCookie)=>activity.POST(makeRequest('POST','https://preview.example/sase/api/activity/',{body:payload,cookie}),ctx);
 assert.equal((await activityPost(event,scopedCookie.split(';')[0])).status,403);
 assert.equal((await activityPost(event)).status,422,'Approach needs prior supplier acknowledgement');
 const ack={...event,id:randomUUID(),stage:'introduction_acknowledged',occurred_at:'2026-09-28T10:00:00Z'};
 assert.equal((await activityPost({...ack,supplier_slug:'not-approved'})).status,422);
 assert.equal((await activityPost(ack)).status,200);assert.equal((await activityPost(ack)).status,200);
 assert.equal((await activityPost({...ack,note:'changed'})).status,422);
 assert.equal((await activityPost(event)).status,200);
 assert.equal((await activityPost({...event,id:randomUUID(),occurred_at:'2099-01-01T00:00:00Z'})).status,422);
 assert.equal((await activityPost({...event,id:randomUUID(),stage:'comparable_set_ready',supplier_slug:null})).status,422,'Missing price and one supplier cannot make a comparable set');
 assert.equal((await activity.GET(makeRequest('GET','https://preview.example/'),ctx)).status,403);
 assert.equal(mails.length,1,'Desk recording does not send supplier messages');
 console.log('PASS sourcing desk: staff-only, approved recipients, acknowledgement before approach, idempotency, future dates and missing-price comparison gate');
 const pendingReceiptKey=`rfp:${before.project_id}:proposal-receipt:${proposal.id}`;const pendingReceipt=store.peekJson<{payload:string;review:unknown}>(pendingReceiptKey)!;store.command(['SET',pendingReceiptKey,JSON.stringify({...pendingReceipt,review:null})]);assert.equal((await proposalPost({...proposal,vendor:'Untrusted submitted name'},deskCookie)).status,200,'Interrupted receipt recovers existing review');assert.equal((await (await privateProject.GET(scopedRequest,ctx)).json()).reviews.length,1,'Recovery does not duplicate reviews');
 const unchangedProject=(await rfpStore.getProject(before.project_id))!;
 await rfpStore.saveProject({...unchangedProject,buyer:{...unchangedProject.buyer,site_count:11}});
 const changedRead=await (await privateProject.GET(scopedRequest,ctx)).json();assert.equal(changedRead.feed.length,0);assert.equal(changedRead.previous_feed.length,1);assert.equal(changedRead.reviews.length,0,'Previous-scope review cannot appear current');
 await rfpStore.saveProject(unchangedProject);
 const documentRoute=await import('../src/app/api/sourcing/projects/[id]/document/route');const draft=await documentRoute.GET(scopedRequest,ctx);assert.equal(draft.status,200);assert.match(await draft.text(),/private draft/);
 const outcomeEvents=store.command(['LRANGE','marketplace:funnel:events',0,-1]) as string[];
 const projectEvents=outcomeEvents.map(x=>JSON.parse(x)).filter(x=>x.project_id===before.project_id);
 assert.equal(projectEvents.filter(x=>x.event==='sourcing_confirmed').length,1,'Confirmation replay counts once');
 assert.equal(projectEvents.filter(x=>x.event==='supplier_response').length,1,'Proposal retries count one project reaching response');
 console.log('PASS one project: owner RFP read, private connectivity, staff-confirmed proposal, existing response/review stores, missing price preserved, private draft export without publication');
 // Mail returns after the buyer confirms: delivery bookkeeping must not restore pending status.
 onMail=async mail=>{const m=mail.text.match(/#request=([^&\s]+)&token=([^\s]+)/)!;const r=await confirmRoute.POST(makeRequest('POST','https://preview.example/sase/api/sourcing/confirm/',{body:{id:m[1],token:m[2],confirm:true}}));assert.equal(r.status,200);};
 const rapidBody={...body,email:'rapid@example.org',idempotency_key:randomUUID()};
 const rapid=await requestRoute.POST(makeRequest('POST','https://preview.example/sase/api/sourcing/request/',{body:rapidBody}));assert.equal(rapid.status,200);const rapidId=(await rapid.json()).request_id;assert.equal(store.peekJson<{status:string}>(`sourcing:request:${rapidId}`)?.status,'desk_review');onMail=null;
 // An interrupted mail transport must never be reported as delivered on retry.
 const failedBody={...body,email:'interrupted@example.org',idempotency_key:randomUUID()};throwMail=true;
 const failedPost=()=>requestRoute.POST(makeRequest('POST','https://preview.example/sase/api/sourcing/request/',{body:failedBody}));assert.equal((await failedPost()).status,422);throwMail=false;const retry=await failedPost();assert.equal(retry.status,422);assert.match((await retry.json()).error,/delivery is not yet confirmed/);
 // A definite provider rejection can be retried safely with the same client request key.
 const rejectBody={...body,email:'rejected@example.org',idempotency_key:randomUUID()};rejectMail=true;
 const rejectPost=()=>requestRoute.POST(makeRequest('POST','https://preview.example/sase/api/sourcing/request/',{body:rejectBody}));assert.equal((await rejectPost()).status,422);rejectMail=false;assert.equal((await rejectPost()).status,200);
 const expiryBody={...body,email:'expired@example.org',idempotency_key:randomUUID()};
 const expiryPost=()=>requestRoute.POST(makeRequest('POST','https://preview.example/sase/api/sourcing/request/',{body:expiryBody}));const expiryReceipt=await (await expiryPost()).json();const expiryRecord=store.peekJson<{expires_at:number}>(`sourcing:request:${expiryReceipt.request_id}`)!;expiryRecord.expires_at=Date.now()-1;store.command(['SET',`sourcing:request:${expiryReceipt.request_id}`,JSON.stringify(expiryRecord)]);const expiredRetry=await expiryPost();assert.equal(expiredRetry.status,422);assert.match((await expiredRetry.json()).error,/expired/);
 // The UI and MCP must expose the same matches, without authentication or disclosure.
 const plan=await import('../src/app/api/sourcing/plan/route');const mcp=await import('../src/lib/mcp-sourcing-tools');
 const webPlan=await plan.POST(makeRequest('POST','https://preview.example/sase/api/sourcing/plan/',{body:body.brief}));assert.equal(webPlan.status,200);
 const assistantPlan=await mcp.callSourcingTool('prepare_sourcing_plan',body.brief,'fixture');assert.deepEqual((await webPlan.json()).matches,(assistantPlan as {matches:unknown}).matches);
 if(process.env.NETIFY_FIXTURE_OUTPUT)fs.writeFileSync(process.env.NETIFY_FIXTURE_OUTPUT,JSON.stringify({commands:store.fixtureCommands(),confirmation:`/sase/shortlist/confirm/#request=${receipt.request_id}&token=${token}`,project_id:before.project_id}),{mode:0o600});
 console.log('PASS adversarial boundaries: origin, consent, recipient validation, private caching, body size, desk auth, interrupted queue repair, rapid-confirm mail race, ambiguous mail retry, rejected mail retry, web/MCP parity');
 console.log('PASS request/confirmation routes: one captured buyer email per accepted request, token binding, expiry, staff-only desk, safe replay, no supplier invitations or mail');
});
