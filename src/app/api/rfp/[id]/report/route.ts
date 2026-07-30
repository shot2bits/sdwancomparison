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
    // Draft preview (20 July 2026, the draft-pool fix): the publish payout
    // shown before identity, tiered so publishing still unlocks the rest.
    // 52 of last week's 61 drafts were anonymous ghosts; the preview is the
    // value moment that earns the email.
    const full = buildMarketReport(project);
    const preview = {
      ...full,
      matched: {
        count: full.matched.count,
        names: full.matched.names.slice(0, 3),
        ...(full.matched.region_assumption ? { region_assumption: full.matched.region_assumption } : {}),
      },
      gaps: full.gaps.length > 1
        ? [full.gaps[0], `Plus ${full.gaps.length - 1} more gap${full.gaps.length - 1 === 1 ? "" : "s"}, shown in full when you publish.`]
        : full.gaps,
    };
    return Response.json({
      ok: true,
      preview: true,
      market_report: preview,
      unlocked_at_publish: "The full vendor list, complete gap detail, the Word and PDF documents and delivery to your matched vendors and service providers unlock when you publish. Publishing is free.",
    }, { headers: cors });
  }
  return Response.json({ ok: true, market_report: buildMarketReport(project) }, { headers: cors });
}
