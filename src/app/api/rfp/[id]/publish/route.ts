import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, saveProject, kvConfigured } from "@/lib/rfp-store";
import { sessionFromRequest } from "@/lib/auth";
import { inviteSupplier } from "@/lib/rfp-connect";
import { buildShortlist } from "@/lib/shortlist-core";
import { FEATURE_NAMES, getShortlistDataset } from "@/lib/vendors";
import { SITE_URL } from "@/lib/structured-data";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * Publish an RFP to the curated supplier list: invite the best-fit graded
 * vendors and move the RFP to published. This is a push action (it reaches
 * named suppliers), so it requires identity: a buyer/Netify magic-link session
 * OR the RFP's manage_token. An authorised agent passes the manage_token it
 * received when it created the RFP.
 */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });

  let body: { manage_token?: string; shortlist_size?: number } = {};
  try { body = await req.json(); } catch { /* body optional */ }

  const session = await sessionFromRequest(req);
  const sessionOk = session?.role === "buyer" || session?.role === "netify";
  const tokenOk = Boolean(project.manage_token) && body.manage_token === project.manage_token;
  if (!sessionOk && !tokenOk) {
    return Response.json(
      { error: "Publishing reaches named suppliers, so it needs identity. Sign in with your work email, or pass the RFP manage_token (issued when the RFP was created). Agents authorise with the manage_token.", auth_required: true },
      { status: 401, headers: cors },
    );
  }

  const size = Math.min(Math.max(Number(body.shortlist_size ?? 8), 3), 12);
  const result = buildShortlist(getShortlistDataset(), {
    sector: project.buyer.sector ?? null,
    organisation_size: project.buyer.organisation_size ?? "any",
    service_model: project.buyer.operating_model ?? "any",
    required_regions: project.buyer.regions ?? [],
    shortlist_size: size,
  }, FEATURE_NAMES);

  const invited: { slug: string; name: string; supplier_url: string }[] = [];
  for (const v of result.shortlist) {
    const r = await inviteSupplier(project.id, v.slug, `You are invited to respond to the RFP "${project.title}".`);
    if (!("error" in r)) invited.push({ slug: v.slug, name: r.vendor_name, supplier_url: `${SITE_URL}/rfp-builder/${project.id}/respond?token=${project.share_token}` });
  }

  const published = await saveProject({ ...project, status: "published", invited_vendors: Array.from(new Set([...project.invited_vendors, ...invited.map((i) => i.slug)])) });
  return Response.json({ ok: true, status: published.status, invited, criteria: result.criteria_summary }, { headers: cors });
}
