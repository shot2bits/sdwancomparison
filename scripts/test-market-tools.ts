import assert from 'node:assert/strict';
import {OPEN_TOOLS,buildRfp,RFP_INPUT_SCHEMA} from '../src/lib/marketplace-mcp';
const ctx={origin:'https://netify.co.uk',token:'',ip:'test'};
const call=async(name:string,args:unknown)=>(await OPEN_TOOLS.find(t=>t.name===name)!.handler(args,ctx)) as any;
(async()=>{
 const s=await call('search_providers',{sector:'retail',need:'zero trust private application access',limit:5});
 assert.ok(s.data.providers.length>0&&s.data.providers.length<=5);assert.ok(s.data.providers[0].profile_url.startsWith('https://netify.co.uk/marketplace/'));assert.ok(!JSON.stringify(s).includes('/sase/vendors/'));
 const slugs=s.data.providers.slice(0,2).map((p:any)=>p.slug);
 const c=await call('compare_providers',{providers:slugs,limit:5});assert.equal(c.data.providers.length,2);assert.ok(c.data.rows.length>0);
 const sec=await call('get_sector_shortlist',{sector:'retail'});assert.ok(sec.data.providers.length>0);
 const p=await call('get_list_prices',{uk_only:true,limit:5});assert.ok(p.data.lines.length>0);assert.ok(p.data.lines.every((l:any)=>l.source_url));
 const r=await call('build_rfp',{organisation:{sector:'retail_ecommerce'},products:['sdwan','sse'],sites:{count:40,regions:['UK']},users:{count:800,remote:200}});
 assert.equal(r.data.persisted,false);assert.ok(r.data.questions.length>=10);assert.equal(r.data.markdown,undefined);
 await assert.rejects(()=>call('compare_providers',{providers:['nope-x','also-nope']}),(e:any)=>e.code==='unknown_provider');
 await assert.rejects(()=>call('build_rfp',{products:['sdwan']}),(e:any)=>e.code==='invalid_arguments');
 assert.ok(!/—|;\s/.test(JSON.stringify(RFP_INPUT_SCHEMA.shape.organisation.description??'')));
 console.log('marketplace-mcp read tools ok',s.data.providers.map((x:any)=>x.slug).join(','));
})();
(async()=>{
 process.env.NETIFY_CORE_PHASE23='1';
 const {buyerMcpResponse}=await import('../src/lib/core-buyer-mcp');
 const rpc=async(method:string,params?:unknown,id=1)=>{const r=await buyerMcpResponse(new Request('http://localhost:3000/sase/api/mcp/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id,method,params})}));return r.status===204?null:await r.json() as any;};
 const list=await rpc('tools/list');const names=list.result.tools.map((t:any)=>t.name);
 for(const n of ['search_providers','compare_providers','get_sector_shortlist','get_list_prices','build_rfp','get_opportunity_board','get_provider_evidence','create_project'])assert.ok(names.includes(n),n);
 const call=await rpc('tools/call',{name:'search_providers',arguments:{sector:'healthcare',limit:3}});assert.equal(call.result.isError,false);assert.ok(call.result.structuredContent.data.providers.length>0);
 const bad=await rpc('tools/call',{name:'build_rfp',arguments:{}});assert.equal(bad.result.isError,true);assert.equal(bad.result.structuredContent.error,'invalid_arguments');
 console.log('mcp dispatch ok, tools:',names.length);
})();
