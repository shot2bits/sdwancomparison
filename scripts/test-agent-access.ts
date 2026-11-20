// @ts-expect-error Node 24 supplies registerHooks.
import {registerHooks} from 'node:module';
registerHooks({resolve(s:string,c:object,n:(s:string,c:object)=>{url:string}){return s==='server-only'?{url:'data:text/javascript,export {};',shortCircuit:true}:n(s,c);}});
import assert from 'node:assert/strict';
import {withFakeKv,FAKE_KV_URL} from './fake-kv-harness';
await withFakeKv(async()=>{
 process.env.VERCEL_ENV='production';process.env.RESEND_API_KEY='synthetic-test-key-never-sent';
 const mails:{to:string;html:string}[]=[];const original=global.fetch;
 global.fetch=async(input,init)=>{const url=String(input);if(url===FAKE_KV_URL)return original(input,init);assert.equal(url,'https://api.resend.com/emails');const b=JSON.parse(String(init?.body));mails.push({to:b.to,html:b.html});return Response.json({id:'synthetic'});};
 const A=await import('../src/lib/agent-access');const M=await import('../src/lib/marketplace-tools');const kv=await import('../src/lib/rfp-store');const {MarketError}=await import('../src/lib/marketplace-mcp');
 const ctx={origin:'https://netify.co.uk',token:'',ip:'203.0.113.9'};
 const call=(name:string,args:unknown,c=ctx)=>M.callMarketTool(name,args,c) as Promise<any>;
 const fails=async(p:Promise<unknown>,code:string)=>assert.rejects(()=>p,(e:any)=>e instanceof MarketError&&e.code===code,code);

 // free webmail never receives a code
 for(const e of ['someone@gmail.com','x@outlook.com','x@hotmail.co.uk','x@yahoo.com','x@icloud.com'])await fails(call('request_access_code',{email:e}),'work_email_required');
 assert.equal(mails.length,0);
 await fails(call('request_access_code',{email:'not-an-email'}),'enter_work_email');

 // unauthenticated buyer tools
 await fails(call('publish_opportunity',{requirement:{products:['sdwan'],sites:{count:1},users:{count:1}},consent_publish:true}),'verified_email_required');
 await fails(call('list_my_opportunities',{}),'verified_email_required');

 // code flow
 const email='jane.smith@acmeretail.co.uk';
 const sent=await call('request_access_code',{email});assert.equal(sent.data.sent,true);assert.equal(sent.data.preview_code,undefined,'never return the code in production');
 assert.equal(mails.length,1);assert.equal(mails[0].to,email);const code=mails[0].html.match(/>(\d{6})</)![1];
 await fails(call('verify_access_code',{email,code:code==='000000'?'111111':'000000'}),'wrong_code');
 const v=await call('verify_access_code',{email,code});const token:string=v.data.access_token;assert.match(token,/^netify_buyer_/);
 await fails(call('verify_access_code',{email,code}),'code_expired');
 const auth={...ctx,token};

 // publish rules
 const req={organisation:{sector:'retail_ecommerce',description:'Acme Retail Holdings Limited runs 40 shops. Contact Jane Smith on 020 7946 0958 or jane.smith@acmeretail.co.uk. HQ 14 High Street, Leeds LS1 4AB. See https://acmeretail.co.uk'},products:['sdwan','sse'],sites:{count:40,regions:['UK']},users:{count:800,remote:200},current_environment:'Legacy MPLS at 14 High Street, Leeds. Call 07700 900123.',desired_outcomes:'Acme wants resilient branches.',operating_model:'co_managed'};
 await fails(call('publish_opportunity',{requirement:req},auth),'invalid_arguments');
 await fails(call('publish_opportunity',{requirement:req,consent_publish:false},auth),'invalid_arguments');
 await fails(call('publish_opportunity',{requirement:req,consent_publish:true,show_company:true},auth),'company_name_required');
 const pub=await call('publish_opportunity',{requirement:req,consent_publish:true},auth);
 const id:string=pub.data.opportunity_id;assert.match(id,/^opp_/);
 const board=await kv.listPublicOpportunities();const listed=board.find(o=>o.id===id)!;assert.ok(listed,'listed on the public board');
 const publicJson=JSON.stringify(listed).toLowerCase();
 for(const bad of ['acme','jane','smith','acmeretail','7946','7700','high street','ls1','@','https'])assert.ok(!publicJson.includes(bad),`public board leaked "${bad}": ${publicJson}`);
 assert.equal(listed.buyer_org,'');assert.equal(listed.buyer_visibility,'anonymous');
 const stored=await kv.getOpportunity(id);assert.equal(stored!.owner_email,email);

 // opt-in shows the company, and only the company
 const pub2=await call('publish_opportunity',{requirement:req,consent_publish:true,show_company:true,company_name:'Acme Retail Holdings Limited'},auth);
 const shown=(await kv.listPublicOpportunities()).find(o=>o.id===pub2.data.opportunity_id)!;
 assert.equal(shown.buyer_org,'Acme Retail Holdings Limited');
 const shownJson=JSON.stringify(shown).toLowerCase();for(const bad of ['jane','smith','7946','7700','high street','ls1','@','https'])assert.ok(!shownJson.includes(bad),`opt-in leaked "${bad}"`);

 // mine, bundle, ownership
 const mine=await call('list_my_opportunities',{},auth);assert.equal(mine.data.count,2);
 const bundle=await call('get_rfp_bundle',{opportunity_id:id,format:'markdown'},auth);
 assert.ok(bundle.data.markdown.includes('Questions for suppliers')&&bundle.data.markdown.includes('Recommended providers to approach'));assert.ok(bundle.data.recommended_providers.length>0);
 const otherSent=await call('request_access_code',{email:'other.person@differentco.com'});void otherSent;const code2=mails.filter(m=>m.to==='other.person@differentco.com').at(-1)!.html.match(/>(\d{6})</)![1];
 const t2=(await call('verify_access_code',{email:'other.person@differentco.com',code:code2})).data.access_token as string;
 await fails(call('get_rfp_bundle',{opportunity_id:id},{...ctx,token:t2}),'opportunity_not_found');
 await fails(call('withdraw_opportunity',{opportunity_id:id},{...ctx,token:t2}),'opportunity_not_found');
 // download gate needs verified email plus publish consent
 await assert.rejects(()=>A.requireDownloadAccess('Bearer '+t2),(e:any)=>e.code==='publish_consent_required');
 await A.requireDownloadAccess('Bearer '+token);
 await assert.rejects(()=>A.requireDownloadAccess(null),(e:any)=>e.code==='verified_email_required');

 // withdraw hides it
 await call('withdraw_opportunity',{opportunity_id:id},auth);assert.ok(!(await kv.listPublicOpportunities()).some(o=>o.id===id));
 // revoke
 await call('revoke_access_token',{},auth);await fails(call('list_my_opportunities',{},auth),'verified_email_required');
 const adminMails=mails.filter(m=>m.to!==email&&m.to!=='other.person@differentco.com');console.log('admin alert mails to Netify only:',adminMails.map(m=>m.to));
 console.log('agent access ok:',{tools:M.MARKET_TOOLS.map(t=>t.name).length});
 global.fetch=original;
});
