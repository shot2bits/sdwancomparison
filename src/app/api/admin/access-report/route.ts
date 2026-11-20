import {sessionFromRequest} from '@/lib/auth';
import {isAdminEmail} from '@/lib/access-control';
import {accessReport} from '@/lib/auth-access-report';
export const dynamic = 'force-dynamic';
const headers = {'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
export async function GET(req: Request) {
  const session = await sessionFromRequest(req);
  if (!session || !isAdminEmail(session.email)) return Response.json({error:'Netify administrator access required.'},{status:403,headers});
  try { return Response.json(await accessReport(),{headers}); }
  catch { return Response.json({error:'Access report unavailable. No zero counts substituted.'},{status:503,headers}); }
}
