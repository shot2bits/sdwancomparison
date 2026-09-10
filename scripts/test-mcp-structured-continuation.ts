// @ts-expect-error Node 24 test runtime; project types target Node 20.
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier:string,context:object,next:(s:string,c:object)=>{url:string}){return specifier==='server-only'?{url:'data:text/javascript,export {};',shortCircuit:true}:next(specifier,context)}});
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import { withFakeKv } from './fake-kv-harness';
import { mcpToolResult } from '../src/lib/mcp-tool-result';
delete process.env.ANTHROPIC_API_KEY;
await withFakeKv(async()=>{
 const { POST }=await import('../src/app/api/mcp/route');
 const rpc=async(method:string,params:object)=>{
  const response=await POST(new Request('http://localhost/sase/api/mcp/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}));
  return response.json();
 };
 const list=await rpc('tools/list',{});
 const schemas=new Map<string,object>(list.result.tools.filter((t:{outputSchema?:object})=>t.outputSchema).map((t:{name:string;outputSchema:object})=>[t.name,t.outputSchema]));
 assert.equal(schemas.size,8);
 const ajv=new Ajv({allErrors:true});
 const tested=new Set<string>();
 const call=async(name:string,args:object,success=true)=>{
  const wire=await rpc('tools/call',{name,arguments:args});
  assert(wire.result,JSON.stringify(wire.error));
  const result=wire.result;
  if(!success){assert.equal(result.isError,true);assert.equal(result.structuredContent,undefined);return JSON.parse(result.content[0].text);}
  assert(!result.isError, result.content[0].text);
  assert.deepEqual(result.structuredContent,JSON.parse(result.content[0].text));
  if(schemas.has(name)) {const check=ajv.compile(schemas.get(name)!);assert(check(result.structuredContent),JSON.stringify(check.errors));tested.add(name);}
  return result.structuredContent;
 };
 const requirement={organisation:{sector:'Manufacturing',regions:['uk']},estate:{sites:15,users:30,cloud:['azure'],existingNetwork:['mpls']},drivers:[],constraints:{timeline:'within six months',inHouseSocCapacity:'none'}};
 await call('assess_security_requirement',{requirement});
 const created=await call('create_security_project',{requirement,consent:true,test:true});
 const owner={project_id:created.project_id,manage_token:created.manage_token};
 await call('get_security_project_status',owner);
 await call('get_security_project_status',{project_id:'missing',manage_token:'invalid'});
 await call('generate_security_rfp',owner);
 await call('rescope_security_project',{...owner,requirement,consent:true,replace_edits_consent:true});
 await call('continue_security_conversation',{text:'We are a UK manufacturing business with 15 sites and 30 users. We need managed security and have no in house SOC.',consent:true,test:true});
 await call('create_security_project',{requirement,consent:false},false);
 const first=await call('workspace_cycle',{text:'We are a manufacturing business with 15 sites, 30 remote users and Microsoft Azure. We need managed SASE within six months.',include_fit:false});
 const second=await call('workspace_cycle',{text:'We need separation of OT and IT. We now have 40 remote users.',continuation:first.continuation,include_fit:false,document_purpose:'rfi'});
 assert.equal(second.requirement.estate.sites,15);assert.equal(second.requirement.estate.users,40);assert.equal(second.procurement.buying,'sase');assert.equal(second.continuation.source_turns.length,2);
 assert(!second.workspace_url.includes('?q='));
 const saved=await call('start_project',second.next_call.arguments);
 const {readMarketplaceProject}=await import('../src/lib/marketplace-project-session');
 const restored=await readMarketplaceProject(saved.project_reference,saved.project_session_token);
 assert.equal(restored.envelope_revision,1);
 assert.deepEqual(restored.workspace_payload?.source_turns,second.continuation.source_turns);
 assert.equal(restored.entrance_context?.raw_input.document_purpose,'rfi');
 assert.equal(restored.workspace_payload?.facts.find(f=>f.path==='estate.sites'&&!f.struck)?.value,15);
 const long='We need managed SASE for 15 manufacturing sites.\r\n'+('Document requirement to review. '.repeat(600))+' FINAL SOURCE CLAUSE.';
 const ingested=await call('workspace_ingest',{text:long,include_fit:false});
 assert(ingested.read_summary.includes('exceeded'));
 assert.equal(ingested.continuation.source_turns[0].text,long);
 assert(ingested.next_call.arguments.entrance_context.requirement_text.endsWith(' FINAL SOURCE CLAUSE.'));
 await call('workspace_ingest',{text:'x'.repeat(200001),include_fit:false},false);
 await call('workspace_cycle',{text:'hello',continuation:{facts:'invalid'}},false);
 assert.equal(mcpToolResult(null).isError,true);
 assert.equal((await rpc('tools/call',{name:'missing',arguments:{}})).error.code,-32602);
 assert.equal(tested.size,8);
 console.log('PASS all eight actual MCP output schemas, null/error paths, multicycle canonical source continuation and fake-KV save/reload; long input retains complete source and reports read budget.');
});
