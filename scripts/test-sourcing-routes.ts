import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {withFakeKv,makeRequest,FAKE_KV_URL} from './fake-kv-harness';
// Hermetic: no network passes through; production behaviour is exercised only
// against the in-memory KV and captured mail. Never import stores before this.
await withFakeKv(async store=>{
 process.env.VERCEL_ENV='production';process.env.RESEND_API_KEY='synthetic-mail-key';
 delete process.env.PROVIDER_MATCH_DATA_URL;delete process.env.PROVIDER_MATCH_SERVICE_TOKEN;
 const fakeFetch=global.fetch;const mails:{to:string;text:string}[]=[];
 global.fetch=async(input,init)=>{
  const url=typeof input==='string'?input:input instanceof URL?input.toString():input.url;
  if(url==='https://api.resend.com/emails'){mails.push(JSON.parse(String(init?.body)));return Response.json({id:'captured-mail'});}
  assert.equal(url,FAKE_KV_URL,'No network may escape this fixture');return fakeFetch(input,init);
 };
 const requestRoute=await import('../src/app/api/sourcing/request/route');
 const confirmRoute=await import('../src/app/api/sourcing/confirm/route');
 const body={brief:{sites:10,remote_users:50,region:'uk_ireland',sector:'manufacturing',need:'sdwan',when:'Within 3 months',requirement:'PRIVATE ORIGINAL',supplier_brief:'Anonymous ten-site requirement'},recipients:[{slug:'cisco',actions:['demo']},{slug:'aryaka',actions:['proposals']}],email:'fixture@example.org',consent:true,anonymous:true,idempotency_key:randomUUID()};
 const post=()=>requestRoute.POST(makeRequest('POST','https://preview.example/sase/api/sourcing/request/',{body}));
 const first=await post();assert.equal(first.status,200);const receipt=await first.json();assert.equal(mails.length,1);assert(!mails[0].text.includes('PRIVATE ORIGINAL'));
 const repeat=await post();assert.equal(repeat.status,200);assert.equal((await repeat.json()).request_id,receipt.request_id);assert.equal(mails.length,1);
 const match=mails[0].text.match(/#request=([^&\s]+)&token=([^\s]+)/);assert(match);const token=match[2];
 const read=await confirmRoute.POST(makeRequest('POST','https://preview.example/sase/api/sourcing/confirm/',{body:{id:receipt.request_id,token,confirm:false}}));assert.equal(read.status,200);assert.equal((await read.json()).status,'pending_confirmation');
 const before=store.peekJson<{project_id:string}>(`sourcing:request:${receipt.request_id}`)!;assert.equal(store.peekJson(`rfp:${before.project_id}`),null,'Opening email must not create a project');
 const confirm=()=>confirmRoute.POST(makeRequest('POST','https://preview.example/sase/api/sourcing/confirm/',{body:{id:receipt.request_id,token,confirm:true}}));
 const accepted=await confirm();assert.equal(accepted.status,200);assert.equal((await accepted.json()).status,'desk_review');
 const saved=store.peekJson<{id:string;manage_token:string;invited_vendors:unknown[]}>(`rfp:${before.project_id}`)!;assert(saved);assert.match(saved.id,/^rfp_[a-z0-9]+$/,'Compatible with existing RFP recovery routes');assert.equal(saved.invited_vendors.length,0);
 const replay=await confirm();assert.equal(replay.status,200);assert.equal(store.peekJson<{manage_token:string}>(`rfp:${before.project_id}`)!.manage_token,saved.manage_token,'Retry must not replace project credentials');assert.equal(mails.length,1,'Only buyer confirmation mail; no supplier mail');
 const repeatedAfterConfirmation=await post();assert.equal(repeatedAfterConfirmation.status,200);assert.equal((await repeatedAfterConfirmation.json()).status,'desk_review');
 for(let i=0;i<4;i++)assert.equal((await post()).status,200,'Idempotent retries do not consume new-request allowance');
 const tampered=await confirmRoute.POST(makeRequest('POST','https://preview.example/sase/api/sourcing/confirm/',{body:{id:receipt.request_id,token:'x'.repeat(43),confirm:true}}));assert.equal(tampered.status,403);
 const privateRaw=JSON.stringify(store.peekJson(`sourcing:request:${receipt.request_id}`));assert(!privateRaw.includes(token),'Raw token must not persist');
 console.log('PASS real request/confirmation routes: one captured buyer email, token binding, no auto-confirmation, one existing-format project, safe replay, no supplier invitations or mail');
});
