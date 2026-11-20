import {sessionFromRequest} from '@/lib/auth';
import {isAdminEmail} from '@/lib/access-control';
import {teamList} from '@/lib/agent-threads';

/** Netify team: every conversation, newest activity first. */
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'cache-control':'private, no-store','x-robots-tag':'noindex'};
export async function GET(req:Request){
 const s=await sessionFromRequest(req);if(!s||!isAdminEmail(s.email))return Response.json({error:'Admin access required'},{status:403,headers});
 const threads=await teamList();
 return Response.json({count:threads.length,threads:threads.map(t=>({id:t.id,title:t.title,kind:t.kind,provider:t.provider_name,buyer_email:t.buyer_email,messages:t.messages,last_from:t.last_from,team_joined:t.team_joined.length>0,updated:new Date(t.updated).toISOString(),url:`https://netify.co.uk/sase/thread/${t.id}/`}))},{headers});
}
