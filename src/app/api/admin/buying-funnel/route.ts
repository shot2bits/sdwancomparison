import { sessionFromRequest } from "@/lib/auth";
import { isAdminEmail } from "@/lib/access-control";
import { activityClassification } from "@/lib/activity-provenance";
import { kvGetJson, kvRaw, kvConfigured } from "@/lib/rfp-store";
import { aggregateFunnel } from "@/lib/marketplace-funnel-report";
export const dynamic = "force-dynamic";
const headers={"Cache-Control":"private, no-store", "X-Robots-Tag":"noindex, nofollow"};
export async function GET(req:Request) {
 const session=await sessionFromRequest(req);
 if(!session)return Response.json({error:"Sign in with a Netify admin account."},{status:401,headers});
 if(!isAdminEmail(session.email))return Response.json({error:"Admin access only."},{status:403,headers});
 if(!kvConfigured())return Response.json({error:"Reporting storage is unavailable."},{status:503,headers});
 try {const raw=await kvRaw(["LRANGE","marketplace:funnel:events",0,9999]);if(!Array.isArray(raw))throw new Error("Unavailable");const parsed = raw.map(item => { try { return typeof item === "string" ? JSON.parse(item) : item; } catch { return null; } });
 const ids = [...new Set(parsed.filter(e => e && typeof e.project_id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(e.project_id)).map(e => e.project_id as string))];
 const tests = new Set<string>();
 for (let offset = 0; offset < ids.length; offset += 25) {
  await Promise.all(ids.slice(offset, offset + 25).map(async id => { const record=await kvGetJson<{activity?:{environment?:string};activity_environment?:string}>(`rfp:${id}`); if (activityClassification(record) === "test") tests.add(`${record?.activity?.environment??record?.activity_environment??"unknown"}:${id}`); }));
 }
 return Response.json(aggregateFunnel(parsed.map(e => e && tests.has(`${e.environment??"unknown"}:${e.project_id}`) ? {...e, classification:"test"} : e)),{headers});}
 catch{return Response.json({error:"The report could not be loaded. Try again."},{status:503,headers});}
}
