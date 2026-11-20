// @ts-expect-error Node 24 supplies registerHooks.
import {registerHooks} from 'node:module';
registerHooks({resolve(s:string,c:object,n:(s:string,c:object)=>{url:string}){return s==='server-only'?{url:'data:text/javascript,export {};',shortCircuit:true}:n(s,c);}});
import assert from 'node:assert/strict';
import {withFakeKv,FAKE_KV_URL,FAKE_KV_TOKEN} from './fake-kv-harness';

process.env.KV_REST_API_URL=FAKE_KV_URL;
process.env.KV_REST_API_TOKEN=FAKE_KV_TOKEN;

const {sendGuardRuntime}=await import('../src/lib/send-guard');
const {POST}=await import('../src/app/api/access/request/route');

const body={email:'someone@company.co.uk',requirement:{organisation:{sector:'retail_ecommerce'},products:['sdwan'],sites:{count:1},users:{count:1}},consent_publish:true,elapsed_ms:4000};
const post=()=>POST(new Request('https://netify.co.uk/sase/api/access/request/',{method:'POST',headers:{origin:'https://netify.co.uk','content-type':'application/json'},body:JSON.stringify(body)}));
const original=sendGuardRuntime.bot;
try{
 sendGuardRuntime.bot=async()=>'bot';
 const bot=await post();assert.equal(bot.status,403);assert.equal((await bot.json()).error,'bot_check_failed');
 sendGuardRuntime.bot=async()=>'unavailable';
 const down=await post();assert.equal(down.status,503);assert.equal((await down.json()).error,'bot_check_unavailable');
}finally{sendGuardRuntime.bot=original;}

await withFakeKv(async()=>{
 process.env.VERCEL_ENV='production';process.env.RESEND_API_KEY='synthetic-test-key-never-sent';
 const mails:string[]=[];const fetchOriginal=global.fetch;
 global.fetch=async(input,init)=>{
  const url=String(input);
  if(url===FAKE_KV_URL)return fetchOriginal(input,init);
  assert.equal(url,'https://api.resend.com/emails');
  mails.push('sent');
  return Response.json({id:'synthetic'});
 };
 try{
  let botCalls=0;
  sendGuardRuntime.bot=async()=>{botCalls++;return 'human';};
  const ok=await post();
  const payload=await ok.json() as {sent?:boolean;error?:string};
  assert.equal(ok.status,200,payload.error);
  assert.equal(payload.sent,true);
  assert.equal(botCalls,1);
  assert.equal(mails.length,1);
  botCalls=0;
  const M=await import('../src/lib/marketplace-tools');
  const r=await M.callMarketTool('request_access_code',{email:'other.person@company.co.uk'},{origin:'https://netify.co.uk',token:'',ip:'203.0.113.9'});
  assert.equal((r as {data:{sent:boolean}}).data.sent,true);
  assert.equal(botCalls,0,'MCP request_access_code must not use the web BotID gate');
  console.log('access gate BotID: web blocked when bot, MCP unchanged');
 }finally{sendGuardRuntime.bot=original;global.fetch=fetchOriginal;delete process.env.VERCEL_ENV;delete process.env.RESEND_API_KEY;}
});
