import {z} from 'zod';
import {sessionFromRequest} from '@/lib/auth';
import {isAdminEmail} from '@/lib/access-control';
import {requestOriginAllowed} from '@/lib/request-origin';
import {setProviderContact} from '@/lib/agent-threads';
import {MarketError} from '@/lib/marketplace-mcp';

/** Netify team: set the verified contact for a provider. The address must sit on a domain approved for that provider. */
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'cache-control':'private, no-store','x-robots-tag':'noindex'};
export async function PUT(req:Request){
 const s=await sessionFromRequest(req);if(!s||!isAdminEmail(s.email))return Response.json({error:'Admin access required'},{status:403,headers});
 if(!requestOriginAllowed(req))return Response.json({error:'origin_not_allowed'},{status:403,headers});
 let raw:unknown;try{raw=JSON.parse(await req.text());}catch{return Response.json({error:'invalid_json'},{status:400,headers});}
 const p=z.object({provider_slug:z.string().max(80),email:z.string().max(254),name:z.string().max(80).optional()}).strict().safeParse(raw);if(!p.success)return Response.json({error:'invalid_request'},{status:422,headers});
 try{return Response.json(await setProviderContact(p.data.provider_slug,p.data.email,p.data.name),{headers});}
 catch(e){if(e instanceof MarketError)return Response.json({error:e.code,...e.detail},{status:e.status,headers});return Response.json({error:'unavailable'},{status:500,headers});}
}
