import {z} from 'zod';
import {requestOriginAllowed} from '@/lib/request-origin';
import {SEND_PROTECTION} from '@/lib/send-guard';
import {requestAccessCode,PublishArgs} from '@/lib/agent-access';
import {MarketError} from '@/lib/marketplace-mcp';

/**
 * Web gate for downloading the RFP and recommended-providers bundle. A work
 * email and explicit publish consent are both required before a code is sent.
 * Same rules, same functions as the MCP tools request_access_code and publish_opportunity.
 */
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
const body=z.object({email:z.string().max(254),...PublishArgs.shape,honeypot:z.string().max(200).optional(),elapsed_ms:z.number().optional()}).strict();
export async function POST(req:Request){
 if(!requestOriginAllowed(req))return Response.json({error:'origin_not_allowed'},{status:403,headers});
 let raw:unknown;try{const text=await req.text();if(text.length>200_000)return Response.json({error:'too_large'},{status:413,headers});raw=JSON.parse(text);}catch{return Response.json({error:'invalid_json'},{status:400,headers});}
 const p=body.safeParse(raw);
 if(!p.success){const consent=p.error.issues.some(i=>i.path[0]==='consent_publish');return Response.json({error:consent?'publish_consent_required':'invalid_request',message:consent?'To download, tick the agreement to publish your requirement to the opportunity board.':'Check the details and try again.',issues:p.error.issues.slice(0,6).map(i=>({path:i.path.join('.'),message:i.message}))},{status:422,headers});}
 if(p.data.honeypot?.trim())return Response.json({error:'request_rejected'},{status:400,headers});
 if(!Number.isFinite(p.data.elapsed_ms)||(p.data.elapsed_ms as number)<SEND_PROTECTION.minFormMs)return Response.json({error:'review_before_sending',message:'Please read the details, then try again.'},{status:400,headers});
 if(p.data.show_company&&!(p.data.company_name??'').trim())return Response.json({error:'company_name_required',message:'Enter the company name to show, or untick the option.'},{status:422,headers});
 const ip=(req.headers.get('x-forwarded-for')??'not-provided').split(',')[0].trim();
 try{
  const {email,honeypot:_h,elapsed_ms:_e,...pending}=p.data;void _h;void _e;
  return Response.json(await requestAccessCode(email,ip,pending),{headers});
 }catch(e){if(e instanceof MarketError)return Response.json({error:e.code,...e.detail},{status:e.status,headers});return Response.json({error:'unavailable'},{status:500,headers});}
}
