import {z} from 'zod';
import {requestOriginAllowed} from '@/lib/request-origin';
import {relink} from '@/lib/agent-threads';
import {MarketError} from '@/lib/marketplace-mcp';

/** Emails a fresh link to the provider contact on record. The reply never says whether the thread exists. */
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'cache-control':'private, no-store','x-robots-tag':'noindex'};
export async function POST(req:Request){
 if(!requestOriginAllowed(req))return Response.json({error:'origin_not_allowed'},{status:403,headers});
 let raw:unknown;try{raw=JSON.parse(await req.text());}catch{return Response.json({error:'invalid_json'},{status:400,headers});}
 const p=z.object({thread_id:z.string().max(60)}).strict().safeParse(raw);if(!p.success)return Response.json({error:'invalid_request'},{status:422,headers});
 try{return Response.json(await relink(p.data.thread_id),{headers});}
 catch(e){if(e instanceof MarketError)return Response.json({error:e.code,...e.detail},{status:e.status,headers});return Response.json({error:'unavailable'},{status:500,headers});}
}
