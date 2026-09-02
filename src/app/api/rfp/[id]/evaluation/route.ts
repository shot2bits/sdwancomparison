import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, listResponses, kvConfigured } from "@/lib/rfp-store";
import { evaluateResponse } from "@/lib/rfp-evaluation";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";
import { getLatestPublishedSnapshot } from "@/lib/published-snapshot";
import { getLiveShortlistDataset } from "@/lib/live-shortlist";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(req: Request) {
  return preflight(req);
}

/** Buyer evaluation view: every supplier response cross-checked against Netify
 *  grades. Owner-only: this is the buyer's private comparison of named
 *  supplier submissions, which competing suppliers must never read. */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });
  const access = await requireRfpOwner(req, project);
  if (!access.ok) return ownerRequired("Reading vendor evaluations", cors);
  const responses = await listResponses(id);
  const snapshot = await getLatestPublishedSnapshot(id);
  const frozen = snapshot?.provider_evidence?.map((provider) => provider.record);
  const live = frozen?.length ? null : await getLiveShortlistDataset();
  const vendors = frozen?.length ? frozen : live!.vendors;
  const evaluations = responses.map((r) => evaluateResponse(project, r, vendors));
  return Response.json({
    evaluations,
    provider_evidence_source: frozen?.length ? "published_snapshot" : live!.source,
    provider_dataset_versions: snapshot?.provider_provenance?.dataset_versions ?? live!.datasetVersions,
    note: "Flags compare vendor self-reports against Netify's independent capability grades. Always confirm via the requested evidence.",
  }, { headers: cors });
}
