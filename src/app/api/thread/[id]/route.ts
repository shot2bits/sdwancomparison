import {z} from 'zod';
import {requestOriginAllowed} from '@/lib/request-origin';
import {sessionFromRequest,parseCookie} from '@/lib/auth';
import {isAdminEmail} from '@/lib/access-control';
import {finalEnabled} from '@/lib/final-platform-flags';
import {validThreadId,providerViewer,providerView,providerReply,teamView,teamPost,sessionCookieName} from '@/lib/agent-threads';
import {MarketError} from '@/lib/marketplace-mcp';

/** One conversation, for the provider (HttpOnly session from the emailed link) or a signed-in Netify admin. */
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff','x-robots-tag':'noindex'};
type Ctx={params:Promise<{id:string}>};
async function viewer(req:Request,id:string){
 const s=await sessionFromRequest(req);if(s&&isAdminEmail(s.email))return {role:'team' as const,email:s.email};
 if(finalEnabled('intake')&&await providerViewer(id,parseCookie(req,sessionCookieName(id))))return {role:'provider' as const,email:''};
 return null;
}
const fail=(e:unknown)=>e instanceof MarketError?Response.json({error:e.code,...e.detail},{status:e.status,headers}):Response.json({error:'unavailable'},{status:500,headers});
export async function GET(req:Request,ctx:Ctx){
 const {id}=await ctx.params;if(!validThreadId(id))return Response.json({error:'thread_not_found'},{status:404,headers});
 const v=await viewer(req,id);if(!v)return Response.json({error:'thread_access_required',message:'Open the link in your email again, or ask for a new one.'},{status:401,headers});
 try{if(v.role==='team'){const t=await teamView(id);return Response.json({role:'team',thread:{id:t.thread.id,title:t.thread.title,kind:t.thread.kind,provider:t.thread.provider_name,buyer_email:t.thread.buyer_email,status:t.thread.status,team_joined:t.thread.team_joined},messages:t.messages},{headers});}
  return Response.json({role:'provider',...await providerView(id)},{headers});}catch(e){return fail(e);}
}
export async function POST(req:Request,ctx:Ctx){
 const {id}=await ctx.params;if(!validThreadId(id))return Response.json({error:'thread_not_found'},{status:404,headers});
 if(!requestOriginAllowed(req))return Response.json({error:'origin_not_allowed'},{status:403,headers});
 const v=await viewer(req,id);if(!v)return Response.json({error:'thread_access_required'},{status:401,headers});
 let raw:unknown;try{raw=JSON.parse(await req.text());}catch{return Response.json({error:'invalid_json'},{status:400,headers});}
 const p=z.object({body:z.string().max(5000)}).strict().safeParse(raw);if(!p.success)return Response.json({error:'invalid_request'},{status:422,headers});
 try{const m=v.role==='team'?await teamPost(id,v.email,p.data.body):await providerReply(id,p.data.body);return Response.json({ok:true,message:{from:m.from,name:m.name,body:m.body,at:m.at}},{headers});}catch(e){return fail(e);}
}
