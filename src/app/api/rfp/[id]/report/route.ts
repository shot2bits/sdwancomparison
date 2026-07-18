import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, kvConfigured } from "@/lib/rfp-store";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";
import { buildMarketReport } from "@/lib/market-report";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * The Market Report for a published RFP, owner-gated (manage_token via
 * ?manage= or the owning session). Deterministic and rebuilt per request so
 * it always reflects the current document; the workspace renders it as the
 * publish reward panel.
 */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });
  const access = await requireRfpOwner(req, project);
  if (!access.ok) return ownerRequired("Reading this RFP's market report", cors);
  if (project.status !== "published") {
    return Response.json({ error: "The market report generates when the RFP is published.", status: project.status }, { status: 409, headers: cors });
  }
  return Response.json({ ok: true, market_report: buildMarketReport(project) }, { headers: cors });
}
