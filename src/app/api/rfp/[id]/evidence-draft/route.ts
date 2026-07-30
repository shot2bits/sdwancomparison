import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, kvConfigured } from "@/lib/rfp-store";
import { buildEvidenceDraft } from "@/lib/evidence-response";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * The Evidence Response draft for an invited supplier (18 July 2026).
 * Share-token gated, exactly like the supplier projection: possession of the
 * response link is the credential. Deterministic and rebuilt per request from
 * the vendor dataset; contains no buyer-private data beyond the active
 * question list the supplier already sees.
 */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });

  const url = new URL(req.url);
  const token = (url.searchParams.get("token") ?? "").trim();
  if (!token || token !== project.share_token) {
    return Response.json({ error: "A valid response token is required." }, { status: 401, headers: cors });
  }
  const vendor = (url.searchParams.get("vendor") ?? "").trim();
  if (!vendor) return Response.json({ error: "vendor is required (your organisation name)." }, { status: 422, headers: cors });

  return Response.json(buildEvidenceDraft(project, vendor), { headers: cors });
}
