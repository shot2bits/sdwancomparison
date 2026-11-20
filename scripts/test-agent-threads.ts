// @ts-expect-error Node 24 supplies registerHooks.
import {registerHooks} from 'node:module';
registerHooks({resolve(s:string,c:object,n:(s:string,c:object)=>{url:string}){return s==='server-only'?{url:'data:text/javascript,export {};',shortCircuit:true}:n(s,c);}});
import assert from 'node:assert/strict';
import {withFakeKv,FAKE_KV_URL} from './fake-kv-harness';
await withFakeKv(async()=>{
 process.env.VERCEL_ENV='production';process.env.RESEND_API_KEY='synthetic-test-key-never-sent';
 delete process.env.NETIFY_PLATFORM_SUPPLIER_DISPATCH;delete process.env.NETIFY_PLATFORM_SUPPLIER_INTAKE;
 const mails:{to:string;subject:string;text:string}[]=[];const original=global.fetch;
 global.fetch=async(input,init)=>{const url=String(input);if(url===FAKE_KV_URL)return original(input,init);assert.equal(url,'https://api.resend.com/emails');const b=JSON.parse(String(init?.body));mails.push({to:b.to,subject:b.subject,text:b.text});return Response.json({id:'synthetic'});};
 const A=await import('../src/lib/agent-access');const T=await import('../src/lib/agent-threads');const M=await import('../src/lib/marketplace-tools');
 const kv=await import('../src/lib/rfp-store');const {MarketError}=await import('../src/lib/marketplace-mcp');const {addFeedItem,inviteSupplierToOpportunity}=await import('../src/lib/opportunity');
 const exchangeRoute=await import('../src/app/api/thread/exchange/route');const threadRoute=await import('../src/app/api/thread/[id]/route');
 const ctx={origin:'https://netify.co.uk',token:'',ip:'203.0.113.9'};
 const call=(name:string,args:unknown,c=ctx)=>M.callMarketTool(name,args,c) as Promise<any>;
 const fails=async(p:Promise<unknown>,code:string)=>assert.rejects(()=>p,(e:any)=>e instanceof MarketError&&e.code===code,code);
 const lastMail=(to:string)=>[...mails].reverse().find(m=>m.to===to);
 const origin={origin:'https://netify.co.uk','content-type':'application/json'};

 // tool surface
 const names=M.MARKET_TOOLS.map(t=>t.name);for(const n of ['list_responses','list_threads','read_thread','send_message','request_expert_help'])assert.ok(names.includes(n),n);
 for(const [n,a] of [['list_responses',{opportunity_id:'opp_abcdefgh12'}],['list_threads',{}],['read_thread',{thread_id:'thr_abcdefgh12'}],['send_message',{opportunity_id:'opp_abcdefgh12',to:'netify_team',body:'x'}],['request_expert_help',{question:'x'}]] as [string,object][])await fails(call(n,a),'verified_email_required');

 // a verified buyer with a published requirement
 const email='buyer.one@northwindgroup.co.uk';
 await call('request_access_code',{email});const code=lastMail(email)!.text.match(/code is (\d{6})/)![1];
 const token:string=(await call('verify_access_code',{email,code})).data.access_token;const auth={...ctx,token};
 const req={organisation:{sector:'retail_ecommerce'},products:['sdwan','sse'],sites:{count:12},users:{count:300}};
 const oppId:string=(await call('publish_opportunity',{requirement:req,consent_publish:true},auth)).data.opportunity_id;
 const opp=(await kv.getOpportunity(oppId))!;await inviteSupplierToOpportunity(opp,'cato-networks');

 // expert help reaches the owner mailbox whatever the supplier flags say
 const ex=await call('request_expert_help',{question:'Can you add a second provider? Please help.',opportunity_id:oppId},auth);
 assert.equal(ex.data.owner_notified,true);const ownerMail=lastMail('rsturt@netify.co.uk')!;assert.match(ownerMail.subject,/Expert help requested/);assert.match(ownerMail.text,/buyer\.one@northwindgroup\.co\.uk/);assert.match(ownerMail.text,/\/thread\/thr_/);
 const exThread:string=ex.data.thread_id;

 // supplier flags off: nothing goes to a provider, nothing is accepted from one
 await fails(call('send_message',{opportunity_id:oppId,provider_slug:'fortinet',body:'hello'},auth),'provider_not_engaged');
 await fails(call('send_message',{opportunity_id:oppId,provider_slug:'no-such-provider',body:'hello'},auth),'unknown_provider');
 await fails(call('send_message',{body:'hello'},auth),'invalid_arguments');
 const before=mails.length;
 const held=await call('send_message',{opportunity_id:oppId,provider_slug:'cato-networks',body:'What is your price for 12 sites?'},auth);
 assert.equal(held.data.status,'held');assert.equal(mails.length,before,'no mail while dispatch is off');const provThread:string=held.data.thread_id;
 await fails(T.exchangeLink('A'.repeat(43)),'feature_not_enabled');
 await fails(T.providerReply(provThread,'hi'),'feature_not_enabled');
 const offResp=await threadRoute.GET(new Request('https://netify.co.uk/sase/api/thread/'+provThread+'/'),{params:Promise.resolve({id:provThread})});assert.equal(offResp.status,401);

 // contacts must sit on an approved domain
 await assert.rejects(()=>T.setProviderContact('cato-networks','sales@gmail.com','Sales'),(e:any)=>e.code==='domain_not_approved_for_provider');
 await assert.rejects(()=>T.setProviderContact('cato-networks','sales@evil-example.com','Sales'),(e:any)=>e.code==='domain_not_approved_for_provider');
 await T.setProviderContact('cato-networks','sales@catonetworks.com','Cato sales');

 // dispatch on, intake off: provider is emailed, cannot reply
 process.env.NETIFY_PLATFORM_SUPPLIER_DISPATCH='1';
 const sent=await call('send_message',{thread_id:provThread,body:'Second question: do you support Azure vWAN?'},auth);assert.equal(sent.data.status,'sent');assert.equal(sent.data.preview_provider_link,undefined);
 const pm=lastMail('sales@catonetworks.com')!;assert.match(pm.text,/Azure vWAN/);assert.ok(!/buyer\.one|northwind/i.test(pm.text),'provider mail must not carry buyer identity');
 const link=pm.text.match(/https:\/\/netify\.co\.uk\/sase\/thread\/open\/#([A-Za-z0-9_-]{43})/)![1];
 await fails(T.exchangeLink(link),'feature_not_enabled');

 // intake on: one-time link becomes a thread-scoped session
 process.env.NETIFY_PLATFORM_SUPPLIER_INTAKE='1';
 const ex1=await exchangeRoute.POST(new Request('https://netify.co.uk/sase/api/thread/exchange/',{method:'POST',headers:origin,body:JSON.stringify({token:link})}));
 assert.equal(ex1.status,200);const setCookie=ex1.headers.get('set-cookie')!;assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/Secure/);assert.match(setCookie,/SameSite=Lax/);assert.match(setCookie,/Path=\/sase/);
 const cookie=setCookie.split(';')[0];assert.equal((await ex1.json()).thread_id,provThread);
 const again=await exchangeRoute.POST(new Request('https://netify.co.uk/sase/api/thread/exchange/',{method:'POST',headers:origin,body:JSON.stringify({token:link})}));assert.equal(again.status,410,'a link works once');
 const badOrigin=await exchangeRoute.POST(new Request('https://netify.co.uk/sase/api/thread/exchange/',{method:'POST',headers:{...origin,origin:'https://evil.example'},body:JSON.stringify({token:link})}));assert.equal(badOrigin.status,403);
 const view=await threadRoute.GET(new Request('https://netify.co.uk/sase/api/thread/'+provThread+'/',{headers:{cookie}}),{params:Promise.resolve({id:provThread})});assert.equal(view.status,200);
 const vj=await view.json() as any;assert.equal(vj.role,'provider');assert.deepEqual(vj.messages.map((m:any)=>m.body),['Second question: do you support Azure vWAN?'],'held messages are never shown to the provider');assert.ok(!JSON.stringify(vj).includes('northwind'));
 const otherId=exThread;const cross=await threadRoute.GET(new Request('https://netify.co.uk/sase/api/thread/'+otherId+'/',{headers:{cookie}}),{params:Promise.resolve({id:otherId})});assert.equal(cross.status,401,'a session opens one thread only');
 const rep=await threadRoute.POST(new Request('https://netify.co.uk/sase/api/thread/'+provThread+'/',{method:'POST',headers:{...origin,cookie},body:JSON.stringify({body:'Yes, Azure vWAN is supported. Indicative price is 4,800 pounds a month.'})}),{params:Promise.resolve({id:provThread})});assert.equal(rep.status,200,JSON.stringify(await rep.clone().json()));
 const bm=lastMail('buyer.one@northwindgroup.co.uk')!;assert.match(bm.text,/Azure vWAN is supported/);

 // buyer sees the conversation, held message included with its state
 const th=await call('read_thread',{thread_id:provThread},auth);assert.deepEqual(th.data.messages.map((m:any)=>[m.from,m.state]),[['buyer','held'],['buyer','sent'],['provider','sent']]);
 const lt=await call('list_threads',{},auth);assert.equal(lt.data.count,2);assert.equal(lt.data.threads.find((t:any)=>t.thread_id===provThread).awaiting_your_reply,true);
 const stranger=await call('request_access_code',{email:'someone.else@othercorp.co.uk'}).then(()=>lastMail('someone.else@othercorp.co.uk')!.text.match(/code is (\d{6})/)![1]);
 const strangerTok:string=(await call('verify_access_code',{email:'someone.else@othercorp.co.uk',code:stranger})).data.access_token;
 await fails(call('read_thread',{thread_id:provThread},{...ctx,token:strangerTok}),'thread_not_found');
 await fails(call('send_message',{thread_id:provThread,body:'hijack'},{...ctx,token:strangerTok}),'thread_not_found');
 await fails(call('list_responses',{opportunity_id:oppId},{...ctx,token:strangerTok}),'opportunity_not_found');

 // Netify team joins; buyer and provider are both told
 const mailsBefore=mails.length;await T.teamPost(provThread,'rsturt@netify.co.uk','Netify here. We have added Fortinet as a second option.');
 assert.ok(mails.slice(mailsBefore).some(m=>m.to==='buyer.one@northwindgroup.co.uk'),'buyer told');assert.ok(mails.slice(mailsBefore).some(m=>m.to==='sales@catonetworks.com'&&/Reply here/.test(m.text)),'provider told');
 const th2=await call('read_thread',{thread_id:provThread},auth);assert.equal(th2.data.netify_team_joined,true);assert.ok(th2.data.messages.some((m:any)=>m.from==='netify_team'));
 await T.teamPost(exThread,'rsturt@netify.co.uk','Happy to help.');assert.ok((await call('read_thread',{thread_id:exThread},auth)).data.messages.some((m:any)=>m.from==='netify_team'));

 // relink goes only to the contact on record
 const n=mails.length;await T.relink(provThread);assert.equal(mails.length,n+1);assert.equal(mails[n].to,'sales@catonetworks.com');
 assert.deepEqual(await T.relink('thr_doesnotexist1'),{ok:true});

 // responses: legacy supplier posts show to the owner with threads
 const o2=(await kv.getOpportunity(oppId))!;await addFeedItem(o2,'supplier','cato-networks','Cato Networks','response','We can deliver this in 8 weeks.',null,[],{});
 const lr=await call('list_responses',{opportunity_id:oppId},auth);assert.equal(lr.data.response_count,1);assert.equal(lr.data.threads.length,2);assert.equal(lr.data.invited_providers[0].provider_slug,'cato-networks');

 // the test provider exists off production only, and never reaches a real address
 await fails(call('send_message',{opportunity_id:oppId,provider_slug:T.TEST_PROVIDER.slug,body:'test'},auth),'unknown_provider');
 process.env.VERCEL_ENV='preview';
 const pv=await call('send_message',{opportunity_id:oppId,provider_slug:T.TEST_PROVIDER.slug,body:'Dummy provider test message'},auth);
 assert.equal(pv.data.status,'sent');assert.match(pv.data.preview_provider_link,/\/thread\/open\/#[A-Za-z0-9_-]{43}$/);assert.ok(!mails.some(m=>m.to.includes('example.invalid')),'nothing is mailed to the dummy address outside production');
 process.env.VERCEL_ENV='production';

 // limits
 await fails(call('request_expert_help',{question:'x'.repeat(4001)},auth),'invalid_arguments');
 console.log('agent threads ok:',{tools:names.length,mails:mails.length});
 global.fetch=original;
});
