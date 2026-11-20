import {z} from 'zod';
import {requestOriginAllowed} from '@/lib/request-origin';
import {exchangeLink,sessionCookieName} from '@/lib/agent-threads';
import {MarketError} from '@/lib/marketplace-mcp';
import {defaultCounterStore} from '@/lib/send-guard';

/** Turns an emailed one-time link into a short HttpOnly session for that one conversation. */
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff','x-robots-tag':'noindex'};
export async function POST(req:Request){
 if(!requestOriginAllowed(req))return Response.json({error:'origin_not_allowed'},{status:403,headers});
 let raw:unknown;try{raw=JSON.parse(await req.text());}catch{return Response.json({error:'invalid_json'},{status:400,headers});}
 const p=z.object({token:z.string().max(100)}).strict().safeParse(raw);if(!p.success)return Response.json({error:'invalid_request'},{status:422,headers});
 try{
  if(process.env.VERCEL_ENV==='production'){const ip=(req.headers.get('x-forwarded-for')??'not-provided').split(',')[0].trim();let n=0;try{n=await defaultCounterStore().incr('netify:thr:exchange:'+ip+':'+Math.floor(Date.now()/3600000),3900);}catch{n=Infinity;}if(n>30)return Response.json({error:'please_wait_before_retrying'},{status:429,headers:{...headers,'retry-after':'60'}});}
  const r=await exchangeLink(p.data.token);
  return Response.json({thread_id:r.thread_id},{headers:{...headers,'set-cookie':`${sessionCookieName(r.thread_id)}=${r.session}; Path=/sase; Max-Age=${r.max_age}; HttpOnly; Secure; SameSite=Lax`}});
 }catch(e){if(e instanceof MarketError)return Response.json({error:e.code,...e.detail},{status:e.status,headers});return Response.json({error:'unavailable'},{status:500,headers});}
}
