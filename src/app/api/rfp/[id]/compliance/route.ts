import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, kvConfigured } from "@/lib/rfp-store";
import { complianceCoverage, clausesFor } from "@/lib/rfp-compliance";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(req: Request) {
  return preflight(req);
}

/** Compliance coverage matrix and clause pack for the RFP's selected regulations. */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });

  const active = project.rfp_sections
    .filter((s) => s.included)
    .flatMap((s) => s.questions.filter((q) => q.priority !== "optional").map((q) => ({ feature_id: q.feature_id, id: q.id })));

  const { rows, gaps } = complianceCoverage(project.buyer.compliance, active);
  return Response.json({
    selected: project.buyer.compliance,
    coverage: rows,
    gaps,
    clauses: clausesFor(project.buyer.compliance),
  }, { headers: cors });
}
