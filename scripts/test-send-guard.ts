/* eslint-disable @typescript-eslint/no-explicit-any -- fake Neon/Resend wire payloads */
/**
 * Beta desk send without email verification: abuse protection and the
 * unverified record. No network, no database: Neon HTTP and Resend are
 * answered by an in-process fake that records every request.
 * Run: npm run test:send-guard
 */
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import type {IncomingMessage,ServerResponse} from 'node:http';

const DEV_URL='postgres://fixture:fixture@ep-old-union-zaxn5pyr-pooler.c-2.eu-west-2.aws.neon.tech/neondb';
Object.assign(process.env,{NODE_ENV:'test',NETIFY_CORE_ENABLED:'1',NETIFY_CORE_BRANCH_ID:'br-aged-union-zar77mut',NETIFY_CORE_DATABASE_URL:DEV_URL,NETIFY_CORE_RUNTIME_DATABASE_URL:DEV_URL,NETIFY_CORE_IDENTITY_KEY:'a'.repeat(64),NETIFY_CORE_DESK_ENABLED:'1',NETIFY_CORE_MAIL_MODE:'live',NETIFY_CORE_MAIL_READY:'1',NETIFY_CORE_SECURITY_TRACKING_OFF:'1',SOURCING_DESK_EMAIL:'desk-fixture@example.test',NETIFY_CORE_MAIL_TEST_TO:'desk-fixture@example.test',RESEND_API_KEY:'re_fixture_not_a_key',NETIFY_PLATFORM_OWNER_VISIBILITY:'1',NETIFY_PLATFORM_OWNER_EMAIL:'owner-fixture@example.test'});
for(const k of ['VERCEL','VERCEL_ENV','KV_REST_API_URL','KV_REST_API_TOKEN','NETIFY_PLATFORM_FUNNEL','NETIFY_PLATFORM_OWNER_MAIL_MODE','NETIFY_CORE_PHASE23'])delete process.env[k];

const guard=await import('../src/lib/send-guard');
const {guardAnonymousSend,enforceSendLimits,SendGuardError,SEND_PROTECTION,sendGuardRuntime}=guard;
const human=async()=>'human' as const;
const store=()=>{const m=new Map<string,number>();return {incr:async(k:string)=>{const n=(m.get(k)??0)+1;m.set(k,n);return n;}};};
const rejects=async(p:Promise<unknown>,status:number,code:string)=>{try{await p;}catch(e){assert(e instanceof SendGuardError,'expected SendGuardError, got '+e);assert.equal(e.status,status);assert.equal(e.code,code);return e;}assert.fail('expected '+status+' '+code);};
const ok={channel:'desk' as const,ip:'198.51.100.1',email:'Buyer@Example.co.uk',honeypot:'',formElapsedMs:5000};

// 1. Order and each rejection.
await rejects(guardAnonymousSend({...ok,honeypot:'http://spam'},{bot:human,store:store()}),400,'request_rejected');
await rejects(guardAnonymousSend({...ok,formElapsedMs:200},{bot:human,store:store()}),400,'review_before_sending');
await rejects(guardAnonymousSend({...ok,formElapsedMs:undefined},{bot:human,store:store()}),400,'review_before_sending');
await rejects(guardAnonymousSend({...ok,email:''},{bot:human,store:store()}),422,'enter_contact_email');
await rejects(guardAnonymousSend({...ok,email:'not-an-email'},{bot:human,store:store()}),422,'enter_contact_email');
await rejects(guardAnonymousSend({...ok,email:'a@b.co\r\nBcc: x@y.z'},{bot:human,store:store()}),422,'enter_contact_email');
await rejects(guardAnonymousSend(ok,{bot:async()=>'bot',store:store()}),403,'bot_check_failed');
await rejects(guardAnonymousSend(ok,{bot:async()=>'unavailable',store:store()}),503,'bot_check_unavailable');
// A bot never reaches the counters.
{const s=store();let touched=0;await rejects(guardAnonymousSend(ok,{bot:async()=>'bot',store:{incr:async(k)=>{touched++;return s.incr(k);}}}),403,'bot_check_failed');assert.equal(touched,0);}
assert.deepEqual(await guardAnonymousSend(ok,{bot:human,store:store()}),{email:'buyer@example.co.uk'});

// 2. Limits: 3 per IP per hour, 10 per IP per day, 3 per email per day, 50 global per day.
assert.deepEqual(SEND_PROTECTION.limits.map(l=>[l.scope,l.windowSeconds,l.max]),[['ip',3600,3],['ip',86400,10],['email',86400,3],['global',86400,50]]);
const noon=Date.UTC(2026,10,19,12,0,0);
{const s=store();for(let i=0;i<3;i++)await enforceSendLimits('desk','ip-a','e'+i+'@x.test',s,noon+i);const e=await rejects(enforceSendLimits('desk','ip-a','e9@x.test',s,noon+5),429,'too_many_requests');assert.match(e.userMessage,/up to 3 per hour/);assert(e.retryAfterSeconds!>0&&e.retryAfterSeconds!<=3600);}
{const s=store();let sent=0;for(let h=0;h<5;h++)for(let i=0;i<3;i++){try{await enforceSendLimits('desk','ip-b','u'+h+i+'@x.test',s,noon-4*3600*1000+h*3600*1000+i);sent++;}catch(e){assert(e instanceof SendGuardError&&e.status===429);}}assert.equal(sent,10,'10 per IP per day');}
{const s=store();for(let i=0;i<3;i++)await enforceSendLimits('desk','ip-c'+i,'same@x.test',s,noon+i);const e=await rejects(enforceSendLimits('desk','ip-c9','same@x.test',s,noon+9),429,'too_many_requests');assert.match(e.userMessage,/This email address has sent 3 requests today/);}
{const s=store();for(let i=0;i<50;i++)await enforceSendLimits('desk','g'+i,'g'+i+'@x.test',s,noon+i);const e=await rejects(enforceSendLimits('desk','g99','g99@x.test',s,noon+99),429,'too_many_requests');assert.match(e.userMessage,/daily limit for new requests/);}
// One noisy IP over its limit does not consume the global allowance.
{const s=store();for(let i=0;i<200;i++){try{await enforceSendLimits('desk','noisy','n'+i+'@x.test',s,noon+i);}catch{}}for(let i=0;i<47;i++)await enforceSendLimits('desk','fair'+i,'f'+i+'@x.test',s,noon+i);await rejects(enforceSendLimits('desk','fair99','f99@x.test',s,noon),429,'too_many_requests');}// only its 3 allowed sends count globally
// Channels are counted separately.
{const s=store();for(let i=0;i<3;i++)await enforceSendLimits('desk','ip-d','d'+i+'@x.test',s,noon);await enforceSendLimits('lead','ip-d','d9@x.test',s,noon);}
// A counter store failure fails closed.
await rejects(enforceSendLimits('desk','ip-e','e@x.test',{incr:async()=>{throw Error('down');}},noon),503,'send_protection_unavailable');
console.log('guard ok');

// 3. HTTP layer: the desk send route is guarded before the feature flag and before core.
const {coreIdentityHttp}=await import('./context-identity-http');
const origin='http://127.0.0.1:3023';
async function post(body:unknown,ip='203.0.113.7'){
 const raw=Buffer.from(JSON.stringify(body));const req=Object.assign(Readable.from([raw]),{method:'POST',url:'/api/context-preview/core/identity/pricing-approve',headers:{host:'127.0.0.1:3023',origin,'content-type':'application/json'},socket:{remoteAddress:ip}}) as unknown as IncomingMessage;
 let status=0,headers:Record<string,string>={},out='';const res={writeHead:(s:number,h:Record<string,string>)=>{status=s;headers=h;return res;},end:(b:string)=>{out=b;}} as unknown as ServerResponse;
 await coreIdentityHttp(req,res,new URL(origin+'/api/context-preview/core/identity/pricing-approve'),origin);return {status,headers,body:JSON.parse(out)};
}
const valid={project_id:'00000000-0000-4000-8000-000000000000',contact_email:'buyer@example.co.uk',website:'',form_elapsed_ms:6000,confirmed:true};
sendGuardRuntime.bot=async()=>'bot';
let r=await post(valid);assert.equal(r.status,403);assert.equal(r.body.error,'bot_check_failed');assert.match(r.body.message,/could not confirm/);
sendGuardRuntime.bot=human;
r=await post({...valid,website:'filled-by-bot'});assert.equal(r.status,400);assert.equal(r.body.error,'request_rejected');
r=await post({...valid,form_elapsed_ms:100});assert.equal(r.status,400);assert.equal(r.body.error,'review_before_sending');
r=await post({...valid,contact_email:'nope'});assert.equal(r.status,422);assert.equal(r.body.error,'enter_contact_email');
for(let i=0;i<3;i++){r=await post(valid,'203.0.113.99');assert.equal(r.status,403);assert.equal(r.body.error,'local_development_only','passes the guard, then the flag-off core refuses');}
r=await post(valid,'203.0.113.99');assert.equal(r.status,429);assert.equal(r.body.error,'too_many_requests');assert.match(r.body.message,/Too many requests from your connection/);assert(Number(r.headers['retry-after'])>0);
console.log('http ok');

// 4. Unverified desk send through the real core-desk code, against a fake Neon + Resend.
process.env.NETIFY_CORE_PHASE23='1';
const EDIT='E'.repeat(43);
const projectId='11111111-1111-4111-8111-111111111111',previewId='22222222-2222-4222-8222-222222222222',scopeHash='c'.repeat(64);
const queries:{sql:string;params:unknown[]}[]=[],mails:any[]=[];const ownerRows:any[]=[];
const field=(name:string,id=25)=>({name,dataTypeID:id});
function answer(sql:string,params:unknown[]){
 queries.push({sql,params});
 if(sql.includes('FROM netify_core_phase1.projects p\n JOIN netify_core_phase1.scope_revisions'))return {fields:[field('id'),field('current_revision',23),field('expires_at'),field('owner_id'),field('last_verified_owner_at'),field('reminder_at'),field('purge_after'),field('scope_hash'),field('snapshot',3802),field('authority')],rows:[[projectId,'4','2027-01-01',null,null,null,null,scopeHash,JSON.stringify({packet:{project:{selectedProviders:['aryaka']}}}),'edit']]};
 if(sql.includes('FROM netify_core_phase1.pricing_previews WHERE project_id=$1 AND revision=$2'))return {fields:[field('id'),field('payload',3802),field('revision',23),field('scope_hash')],rows:[[previewId,JSON.stringify({scope:{sites:6},rfp:'RFP TEXT',recipients:[{provider_id:'aryaka'}]}),'4',scopeHash]]};
 if(sql.includes("event='desk.unverified_mail_accepted'"))return {fields:[field('detail',3802)],rows:queries.some(q=>q.sql.includes('INSERT INTO netify_core_phase1.audit_events'))?[[JSON.stringify({request_id:'prior'})]]:[]};
 if(sql.includes('SELECT payload FROM netify_core_phase1.pricing_previews'))return {fields:[field('payload',3802)],rows:[[JSON.stringify({scope:{sites:6},rfp:'RFP TEXT',recipients:[{provider_id:'aryaka'}]})]]};
 if(sql.includes('SELECT disposable_fixture'))return {fields:[field('disposable_fixture',16)],rows:[['f']]};
 if(sql.includes('INSERT INTO netify_core_phase1.owner_notifications')){ownerRows.push({id:params[0],kind:params[1],payload_cipher:params[3]});return {fields:[],rows:[]};}
 if(sql.includes('SELECT id,kind,payload_cipher FROM netify_core_phase1.owner_notifications'))return {fields:[field('id'),field('kind'),field('payload_cipher')],rows:ownerRows.map(o=>[o.id,o.kind,o.payload_cipher])};
 if(sql.includes("SET status='sending'")&&sql.includes('owner_notifications'))return {fields:[field('id')],rows:[[params[0]]]};
 if(/^\s*(UPDATE|INSERT)/.test(sql))return {fields:[],rows:[]};
 throw Error('unexpected query: '+sql.slice(0,120));
}
globalThis.fetch=(async(input:any,init:any)=>{
 const url=String(input);
 if(url.endsWith('/sql')){const b=JSON.parse(init.body);const out=b.queries?{results:b.queries.map((q:any)=>answer(q.query,q.params))}:answer(b.query,b.params);return new Response(JSON.stringify(out),{status:200});}
 if(url==='https://api.resend.com/emails'){mails.push({headers:init.headers,body:JSON.parse(init.body)});return new Response(JSON.stringify({id:'resend-fixture-'+mails.length}),{status:200});}
 throw Error('unexpected fetch '+url);
}) as typeof fetch;
const {reviewDeskRequest,approveDeskRequest}=await import('../src/lib/core-desk');
const reviewed=await reviewDeskRequest(projectId,EDIT,'',origin);
assert.equal(reviewed.buyer_email,null,'no verified owner, no reply address shown');assert.equal(reviewed.contact_email_required,true);assert.equal(reviewed.preview_id,previewId);
await assert.rejects(approveDeskRequest(projectId,EDIT,'',{preview_id:previewId,revision:4,scope_hash:scopeHash,confirmed:true},origin),(e:any)=>e.code==='enter_contact_email');
await assert.rejects(approveDeskRequest(projectId,EDIT,'',{preview_id:previewId,revision:3,scope_hash:scopeHash,confirmed:true,contact_email:'buyer@example.co.uk'},origin),(e:any)=>e.code==='revision_conflict');
const sent=await approveDeskRequest(projectId,EDIT,'',{preview_id:previewId,revision:4,scope_hash:scopeHash,confirmed:true,contact_email:'buyer@example.co.uk'},origin) as any;
assert.equal(sent.status,'With Netify');assert.equal(sent.verified,false);assert.equal(mails.length,1);
const desk=mails[0].body;assert.deepEqual(desk.to,['desk-fixture@example.test']);assert.equal(desk.reply_to,'buyer@example.co.uk');assert.match(desk.subject,/^SYNTHETIC OWNER TEST: \[UNVERIFIED CONTACT\] Netify pricing request/);assert.match(desk.text,/^UNVERIFIED CONTACT: .*NOT been confirmed/);assert.match(desk.text,/Buyer contact \(unverified\): buyer@example.co.uk/);assert.equal(mails[0].headers['idempotency-key'],'netify-desk-unverified-'+previewId);
const audit=queries.find(q=>q.sql.includes('INSERT INTO netify_core_phase1.audit_events'))!;assert.equal(audit.params[2],JSON.stringify({type:'unverified_contact',channel:'approved_netify_desk_only'}));const detail=JSON.parse(String(audit.params[3]));assert.equal(detail.verified,false);assert.equal(detail.preview_id,previewId);assert(!JSON.stringify(detail).includes('buyer@example.co.uk'),'contact stored sealed, not in clear');
assert(!queries.some(q=>/INSERT INTO netify_core_phase1\.(owners|desk_requests)/.test(q.sql)),'never creates a verified owner or desk_requests row');
assert(queries.some(q=>q.sql.includes("UPDATE netify_core_phase1.projects SET status='with_netify'")));
// Retrying the same version does not send twice.
const again=await approveDeskRequest(projectId,EDIT,'',{preview_id:previewId,revision:4,scope_hash:scopeHash,confirmed:true,contact_email:'buyer@example.co.uk'},origin) as any;assert.equal(again.request_id,'prior');assert.equal(mails.length,1);
// Owner notification is marked unverified in the owner email.
assert.equal(ownerRows.length,1);assert.equal(ownerRows[0].kind,'request_approved_and_sent');
process.env.NETIFY_PLATFORM_OWNER_MAIL_MODE='live';
const {deliverOwnerNotifications}=await import('../src/lib/final-notifications');await deliverOwnerNotifications();
const owner=mails[1].body;assert.deepEqual(owner.to,['owner-fixture@example.test']);assert.equal(owner.subject,'[UNVERIFIED] Netify: request approved and sent');assert.match(owner.text,/Contact email: UNVERIFIED/);
console.log('desk ok');
console.log('send guard tests passed');
