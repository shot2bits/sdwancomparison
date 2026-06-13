import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, listResponses, kvConfigured } from "@/lib/rfp-store";
import { evaluateResponse } from "@/lib/rfp-evaluation";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(req: Request) {
  return preflight(req);
}

/** Buyer evaluation view: every supplier response cross-checked against Netify grades. */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });
  const responses = await listResponses(id);
  const evaluations = responses.map((r) => evaluateResponse(project, r));
  return Response.json({
    evaluations,
    note: "Flags compare supplier self-reports against Netify's independent capability grades. Always confirm via the requested evidence.",
  }, { headers: cors });
}
