import { corsHeaders, preflight } from "@/lib/cors";
import { sessionFromRequest } from "@/lib/auth";
import { listBuyerRfpIds, getProject, kvConfigured } from "@/lib/rfp-store";

export const runtime = "nodejs";
export async function OPTIONS(req: Request) { return preflight(req); }

/** A signed-in buyer's saved RFPs. Requires a buyer session. */
export async function GET(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const session = await sessionFromRequest(req);
  if (!session || (session.role !== "buyer" && session.role !== "netify")) {
    return Response.json({ error: "Sign in to see your saved RFPs.", auth_required: true }, { status: 401, headers: cors });
  }
  const ids = await listBuyerRfpIds(session.email);
  const rfps = [];
  for (const id of ids) {
    const p = await getProject(id);
    if (p) rfps.push({ id: p.id, title: p.title, status: p.status, updated: p.updated });
  }
  return Response.json({ rfps: rfps.sort((a, b) => b.updated - a.updated) }, { headers: cors });
}
