// @ts-expect-error Node 24 provides registerHooks.
import {registerHooks} from 'node:module';
registerHooks({resolve(s:string,c:object,n:(s:string,c:object)=>{url:string}){return s==='server-only'?{url:'data:text/javascript,export {};',shortCircuit:true}:n(s,c);}});
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {withFakeKv,makeRequest,FAKE_KV_URL} from './fake-kv-harness';
await withFakeKv(async store=>{
 process.env.VERCEL_ENV='production';process.env.RESEND_API_KEY='test';delete process.env.PROVIDER_MATCH_DATA_URL;
 const priorFetch=global.fetch;let mail='';global.fetch=async(input,init)=>{const url=String(input);if(url==='https://api.resend.com/emails'){mail=JSON.parse(String(init?.body)).text;return Response.json({id:'fake'});}assert.equal(url,FAKE_KV_URL,'No external network permitted');return priorFetch(input,init);};
 const rr=await import('../src/app/api/sourcing/request/route');const cr=await import('../src/app/api/sourcing/confirm/route');
 const input={brief:{sites:10,remote_users:50,region:'uk_ireland',sector:'manufacturing',need:'sdwan',when:'Within 3 months',requirement:'PRIVATE original company name',supplier_brief:'PRIVATE anonymous supplier brief'},recipients:[{slug:'aryaka',actions:['proposals']}],email:'buyer@example.org',consent:true,anonymous:true,idempotency_key:randomUUID()};
 assert.equal((await rr.POST(makeRequest('POST','https://preview.example/sase/api/sourcing/request/',{body:input}))).status,200);
 const match=mail.match(/#request=([^&\s]+)&token=([^\s]+)/)!;assert(match);
 const confirmed=await cr.POST(makeRequest('POST','https://preview.example/sase/api/sourcing/confirm/',{body:{id:match[1],token:match[2],confirm:true}}));assert.equal(confirmed.status,200);
 const raw=store.peekJson<{project_id:string}>(`sourcing:request:${match[1]}`)!;const id=raw.project_id;const buyerCookie=confirmed.headers.get('set-cookie')!.split(';')[0];
 const db=await import('../src/lib/rfp-store');const staff=await db.createSession({role:'netify',email:'staff@example.org',vendor_slug:null});const other=await db.createSession({role:'buyer',email:'outsider@example.org',vendor_slug:null});const staffCookie=`netify_session=${staff.token}`;
 const route=await import('../src/app/api/sourcing/projects/[id]/outcome/route');const lib=await import('../src/lib/market-outcomes');const {OUTCOME_CONSENT}=await import('../src/lib/market-outcome-contract');const ctx={params:Promise.resolve({id})};
 const post=(cookie:string,body:unknown)=>route.POST(makeRequest('POST',`https://preview.example/sase/api/sourcing/projects/${id}/outcome/`,{cookie,body}),ctx);
 const get=(cookie:string)=>route.GET(makeRequest('GET','https://preview.example/',{cookie}),ctx);
 assert.equal((await get('')).status,401);assert.equal((await get(`netify_session=${other.token}`)).status,401);assert.equal((await post(buyerCookie,{action:'draft',revision:0})).status,403);
 assert.equal((await post(staffCookie,{action:'draft',revision:0})).status,200);assert.equal((await (await get(buyerCookie)).json()).record,null,'Unreviewed draft is private to staff');assert.equal((await lib.listPublicOutcomes()).length,0);
 let r=(await (await get(staffCookie)).json()).record;const firstId=r.public.id;
 const content={scope:'Managed SD-WAN provider sourcing',outcome:'incomplete',summary:'Netify reviewed the brief. Supplier engagement remains incomplete.'};
 assert.equal((await post(staffCookie,{action:'review',revision:r.revision,content,redaction_reviewed:true})).status,422,'No evidence cannot be published');
 await db.kvSetJson(`rfp:${id}:sourcing-activity`,[{id:randomUUID(),stage:'introduction_acknowledged',supplier_slug:'aryaka',occurred_at:'2026-09-24T10:00:00.000Z',evidence_url:'https://private.example/terms'},{id:randomUUID(),stage:'supplier_approached',supplier_slug:'aryaka',occurred_at:'2026-09-25T10:00:00.000Z',evidence_url:'https://private.example/approach'},{id:randomUUID(),stage:'supplier_declined',supplier_slug:'aryaka',occurred_at:'2026-09-28T10:00:00.000Z',evidence_url:'https://private.example/decline'}]);
 await post(staffCookie,{action:'draft',revision:r.revision});r=(await (await get(staffCookie)).json()).record;assert.equal(r.public.id,firstId);assert.equal(r.public.approached,1);assert.equal(r.public.declined,1);assert.equal(r.public.site_band,'10–24');assert.equal(r.public.user_band,'50–249');
 assert.equal((await post(staffCookie,{action:'review',revision:r.revision,content:{...content,summary:'Contact buyer@example.org to learn all the details.'},redaction_reviewed:true})).status,422);
 assert.equal((await post(staffCookie,{action:'review',revision:r.revision,content:{...content,outcome:'contract_awarded'},redaction_reviewed:true})).status,422);
 assert.equal((await post(staffCookie,{action:'review',revision:r.revision,content,redaction_reviewed:false})).status,422);
 await post(staffCookie,{action:'review',revision:r.revision,content,redaction_reviewed:true});r=(await (await get(buyerCookie)).json()).record;
 assert(!JSON.stringify(r).includes('private.example'));assert(!JSON.stringify(r).includes('buyer@example.org'));assert(!JSON.stringify(r).includes('PRIVATE'));
 assert.equal((await post(staffCookie,{action:'approve',revision:r.revision,consent:OUTCOME_CONSENT})).status,403);
 assert.equal((await post(buyerCookie,{action:'approve',revision:r.revision-1,consent:OUTCOME_CONSENT})).status,409);
 assert.equal((await post(staffCookie,{action:'publish',revision:r.revision})).status,409);
 assert.equal((await post(buyerCookie,{action:'approve',revision:r.revision,consent:OUTCOME_CONSENT})).status,200);
 assert.equal((await post(buyerCookie,{action:'publish',revision:r.revision})).status,403);
 // Editing an approved draft revokes consent.
 await post(staffCookie,{action:'review',revision:r.revision,content,redaction_reviewed:true});r=(await (await get(buyerCookie)).json()).record;
 assert.equal((await post(staffCookie,{action:'publish',revision:r.revision})).status,409);
 await post(buyerCookie,{action:'approve',revision:r.revision,consent:OUTCOME_CONSENT});assert.equal((await post(staffCookie,{action:'publish',revision:r.revision})).status,200);
 const feed=await lib.listPublicOutcomes();assert.equal(feed.length,1);assert.equal((await lib.publicOutcome(firstId))?.id,firstId);
 for(const secret of [id,'PRIVATE','private.example','buyer@example.org','staff@example.org','evidence_references','approval'])assert(!JSON.stringify(feed).includes(secret),`No leak: ${secret}`);
 assert.equal((await post(staffCookie,{action:'review',revision:r.revision,content,redaction_reviewed:true})).status,409);
 assert.equal((await post(buyerCookie,{action:'withdraw',revision:r.revision})).status,200);assert.equal((await lib.listPublicOutcomes()).length,0);assert.equal(await lib.publicOutcome(firstId),null);assert(store.peekJson(`rfp:${id}:market-outcome:history:${r.revision}:published`),'Publication and its exact approval retained privately after withdrawal');
 assert.equal((await post(staffCookie,{action:'publish',revision:r.revision})).status,409);
 // Current-scope response count and weekday duration; stale proposals excluded.
 const project=(await db.getProject(id))!;const {sourcingScopeHash}=await import('../src/lib/sourcing-proposal-scope');
 await db.kvSetJson(`rfp:${id}:sourcing-pricing`,[{id:'current',actor_slug:'aryaka',created:Date.parse('2026-09-28T10:00:00Z'),links:['https://private.example/proposal']},{id:'stale',actor_slug:'other',created:Date.parse('2026-09-25T11:00:00Z'),links:['https://private.example/old']}]);
 await db.kvSetJson(`rfp:${id}:proposal-receipt:current`,{scope_hash:sourcingScopeHash(project)});
 await db.kvSetJson(`rfp:${id}:proposal-receipt:stale`,{scope_hash:'old'});
 await post(staffCookie,{action:'draft',revision:r.revision});r=(await (await get(staffCookie)).json()).record;
 assert.equal(r.public.responded,1);assert.equal(r.public.first_proposal_working_days,1);assert(!r.evidence_references.includes('https://private.example/old'));
 await post(staffCookie,{action:'review',revision:r.revision,content:{...content,outcome:'proposals_received'},redaction_reviewed:true});r=(await (await get(buyerCookie)).json()).record;
 await post(buyerCookie,{action:'decline',revision:r.revision});assert.equal((await post(staffCookie,{action:'publish',revision:r.revision})).status,409);
 if(process.env.OUTCOME_BROWSER_FIXTURE==='1'){
  const fs=await import('node:fs');fs.writeFileSync('/tmp/netify-outcome-browser-fixture.json',JSON.stringify({commands:store.fixtureCommands(),id,buyer_cookie:buyerCookie,staff_cookie:staffCookie}),{mode:0o600});
 }
 const csrf=await route.POST(makeRequest('POST','https://preview.example/test',{cookie:staffCookie,headers:{origin:'https://evil.example'},body:{action:'draft',revision:r.revision}}),ctx);assert.equal(csrf.status,403);
 const cross=await route.GET(makeRequest('GET','https://preview.example/',{cookie:buyerCookie}),{params:Promise.resolve({id:'rfp_other'})});assert.equal(cross.status,401);
 assert.match((await get(buyerCookie)).headers.get('cache-control')??'',/no-store/);
 console.log('PASS outcome workflow: real confirmation grant, staff-only review, exact buyer approval, stale/edited approval denial, separate publication, anonymous projection, withdrawal, origin and cross-project controls');
});
