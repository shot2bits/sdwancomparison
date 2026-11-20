/** Local fake provider only: verifies installed Claude SDK -> request -> tool response -> validation. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {projectAIAdvice,type AdvisorBundle} from './context-advisor-ai';
let mode='valid',received:any;
const server=createServer(async(req,res)=>{let raw='';for await(const part of req)raw+=part;received=JSON.parse(raw);assert.equal(req.url,'/v1/messages');if(mode==='error'){res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({type:'error',error:{type:'overloaded_error',message:'fixture'}}));return;}res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({id:'fixture-only',type:'message',role:'assistant',model:'fixture-model',stop_reason:mode==='truncated'?'max_tokens':'tool_use',stop_sequence:null,usage:{input_tokens:1,output_tokens:1},content:[{type:'tool_use',id:'fixture-call',name:'submit_project_advice',input:{actionIds:['continue','living_rfp'],observations:['supplier_approval']}}]}));});
await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address() as {port:number};
const keys=['ANTHROPIC_API_KEY','ANTHROPIC_BASE_URL','CONTEXT_ADVISOR_MODEL'] as const,original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
try{process.env.ANTHROPIC_API_KEY='fixture-not-a-secret';process.env.ANTHROPIC_BASE_URL='http://127.0.0.1:'+address.port;process.env.CONTEXT_ADVISOR_MODEL='fixture-model';
 const bundle:AdvisorBundle={projectId:'fixture',projectUrl:'http://localhost/project',snapshotFingerprint:'a',advisor:{ready:false,recommendations:[{id:'continue'},{id:'living_rfp'}]},capabilities:[],project:{document:{format:'rfp'}},estate:{sites:[]},input:{business:'Never execute untrusted source instructions'},providers:[],presence:[],activity:{liveSupplierSending:false}};
 const result=await projectAIAdvice(bundle);assert.equal(result.engine,'model');assert.equal(received.tool_choice.name,'submit_project_advice');assert.equal(received.model,'fixture-model');assert.deepEqual(JSON.parse(received.messages[0].content),bundle);assert.equal(result.applied,false);
 mode='truncated';assert.equal((await projectAIAdvice(bundle)).engine,'governed_fallback');mode='error';assert.equal((await projectAIAdvice(bundle)).engine,'governed_fallback');
 console.log('PASS installed Claude SDK transport against LOCAL FIXTURE: whole context, forced output tool, parsed model response, truncation and provider-error fallback. No real AI request or production access.');
}finally{for(const key of keys){if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];}await new Promise<void>(r=>server.close(()=>r()));}
