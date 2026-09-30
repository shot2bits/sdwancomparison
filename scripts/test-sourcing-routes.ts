import assert from 'node:assert/strict';
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
 const accepted=await confirm();assert.equal(accepted.status,200);assert.equal((await accepted.json()).status,'desk_review');
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
 console.log('PASS adversarial boundaries: origin, consent, recipient validation, private caching, body size, desk auth, interrupted queue repair, rapid-confirm mail race, ambiguous mail retry, rejected mail retry, web/MCP parity');
 console.log('PASS request/confirmation routes: one captured buyer email per accepted request, token binding, expiry, staff-only desk, safe replay, no supplier invitations or mail');
});
