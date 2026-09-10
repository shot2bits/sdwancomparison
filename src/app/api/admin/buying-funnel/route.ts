import { sessionFromRequest } from "@/lib/auth";
import { isAdminEmail } from "@/lib/access-control";
import { kvRaw, kvConfigured } from "@/lib/rfp-store";
import { aggregateFunnel } from "@/lib/marketplace-funnel-report";
export const dynamic = "force-dynamic";
const headers={"Cache-Control":"private, no-store", "X-Robots-Tag":"noindex, nofollow"};
export async function GET(req:Request) {
 const session=await sessionFromRequest(req);
 if(!session)return Response.json({error:"Sign in with a Netify admin account."},{status:401,headers});
 if(!isAdminEmail(session.email))return Response.json({error:"Admin access only."},{status:403,headers});
 if(!kvConfigured())return Response.json({error:"Reporting storage is unavailable."},{status:503,headers});
 try {const raw=await kvRaw(["LRANGE","marketplace:funnel:events",0,9999]);if(!Array.isArray(raw))throw new Error("Unavailable");return Response.json(aggregateFunnel(raw),{headers});}
 catch{return Response.json({error:"The report could not be loaded. Try again."},{status:503,headers});}
}
