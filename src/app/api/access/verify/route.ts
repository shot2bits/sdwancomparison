import {z} from 'zod';
import {requestOriginAllowed} from '@/lib/request-origin';
import {verifyAccessCode,authenticate,publishOpportunity} from '@/lib/agent-access';
import {MarketError} from '@/lib/marketplace-mcp';

/** Verifies the emailed code. When the code was requested with publish consent, it also publishes the requirement. */
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
const body=z.object({email:z.string().max(254),code:z.string().max(12)}).strict();
export async function POST(req:Request){
 if(!requestOriginAllowed(req))return Response.json({error:'origin_not_allowed'},{status:403,headers});
 let raw:unknown;try{raw=JSON.parse(await req.text());}catch{return Response.json({error:'invalid_json'},{status:400,headers});}
 const p=body.safeParse(raw);if(!p.success)return Response.json({error:'invalid_request'},{status:422,headers});
 try{
  const v=await verifyAccessCode(p.data.email,p.data.code);
  let published:unknown=null;
  if(v.pending?.requirement&&v.pending.consent_publish){published=await publishOpportunity(await authenticate(v.token),{requirement:v.pending.requirement,consent_publish:true,show_company:Boolean(v.pending.show_company),company_name:v.pending.company_name});}
  return Response.json({access_token:v.token,email:v.email,expires_in_days:v.expires_in_days,published},{headers});
 }catch(e){if(e instanceof MarketError)return Response.json({error:e.code,...e.detail},{status:e.status,headers});return Response.json({error:'unavailable'},{status:500,headers});}
}
