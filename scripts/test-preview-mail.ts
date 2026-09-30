// @ts-expect-error Node 24 provides registerHooks.
import {registerHooks} from 'node:module';
registerHooks({resolve(s:string,c:object,n:(s:string,c:object)=>{url:string}){return s==='server-only'?{url:'data:text/javascript,export {};',shortCircuit:true}:n(s,c);}});
import assert from 'node:assert/strict';
import {withFakeKv,FAKE_KV_URL} from './fake-kv-harness';
await withFakeKv(async store=>{
 process.env.VERCEL_ENV='preview';process.env.NETIFY_PREVIEW_MAIL_CAPTURE='1';process.env.VERCEL_URL='synthetic-preview.vercel.app';delete process.env.RESEND_API_KEY;
 const {activityMailFetch,activityMailKey}=await import('../src/lib/activity-mail');
 const fake=global.fetch;let external=0;
 global.fetch=async(input,init)=>{if(String(input)==='https://api.resend.com/emails'){external++;return Response.json({id:'production-fixture'});}assert.equal(String(input),FAKE_KV_URL);return fake(input,init);};
 const send=(subject='Synthetic confirmation')=>activityMailFetch('https://api.resend.com/emails',{method:'POST',headers:{'Idempotency-Key':'test-one'},body:JSON.stringify({to:'synthetic@example.org',subject,text:'https://netify.co.uk/sase/shortlist/confirm/#token=synthetic'})});
 assert(activityMailKey());const a=await (await send()).json();assert.equal(a.delivery,'captured_not_sent');const captured=store.peekJson<{payload:{text:string}}>(`preview:mail:${a.id}`)!;assert.match(captured.payload.text,/synthetic-preview.vercel.app/);assert(!captured.payload.text.includes('netify.co.uk'));
 assert.equal((await (await send()).json()).id,a.id);assert.equal((await send('different payload')).status,409);assert.equal(external,0);
 process.env.NETIFY_PREVIEW_MAIL_CAPTURE='0';assert.equal(activityMailKey(),undefined);await assert.rejects(send,/disabled/);
 process.env.NETIFY_PREVIEW_MAIL_CAPTURE='1';process.env.VERCEL_URL='netify.co.uk';await assert.rejects(send,/deployment host/);
 process.env.VERCEL_ENV='unknown';await assert.rejects(send,/disabled/);
 process.env.VERCEL_ENV='preview';process.env.VERCEL_URL='synthetic-preview.vercel.app';
 const localUrl=process.env.KV_REST_API_URL;process.env.KV_REST_API_URL='https://production-storage.example';delete process.env.NETIFY_ISOLATED_KV_REST_API_URL;delete process.env.NETIFY_ISOLATED_KV_REST_API_TOKEN;
 assert.equal(activityMailKey(),undefined);await assert.rejects(send,/disabled/);process.env.KV_REST_API_URL=localUrl;
 process.env.NETIFY_PREVIEW_MAIL_CAPTURE='0';process.env.ADMIN_EMAILS='preview-admin@example.org';
 const auth=await import('../src/app/api/auth/request/route');
 const denied=await auth.POST(new Request('https://synthetic-preview.vercel.app/sase/api/auth/request/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'preview-admin@example.org',role:'buyer'})}));
 assert.equal(denied.status,503);const deniedBody=await denied.json();assert(!('dev_link' in deniedBody));assert(!('token' in deniedBody));
 const {kvRaw}=await import('../src/lib/rfp-store');global.fetch=async()=>Response.json({error:'ERR synthetic Redis rejection'});await assert.rejects(()=>kvRaw(['GET','fixture']),/rejected/);global.fetch=async(input,init)=>{if(String(input)==='https://api.resend.com/emails'){external++;return Response.json({id:'production-fixture'});}return fake(input,init);};

 process.env.VERCEL_ENV='production';process.env.RESEND_API_KEY='fake-key';assert.equal(activityMailKey(),'fake-key');assert.equal((await (await send()).json()).id,'production-fixture');assert.equal(external,1);
 console.log('PASS preview mail: private capture, no external sending, deployment links, idempotency, conflicts, disabled/unknown fail closed, production unchanged');
});
