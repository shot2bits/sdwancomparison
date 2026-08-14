import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, kvConfigured } from "@/lib/rfp-store";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";
import { buildMarketReport } from "@/lib/market-report";
import { getLatestPublishedSnapshot } from "@/lib/published-snapshot";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * The Market Report for an RFP, owner-gated (manage_token via ?manage= or
 * the owning session).
 *
 * Living Procurement Canvas Phase 2 (14 Aug 2026), Robert's product rule:
 * publication is the boundary that unlocks a project's matched vendors and
 * service providers, not a UI event. Before publication this route MUST
 * NOT reveal a project-specific ranked match result -- no matched vendor
 * names, no count, no "top three" partial list (the previous
 * `names.slice(0, 3)` preview did exactly this and is the bug this round
 * fixes). It may still return document readiness, completeness, gaps and
 * the general evaluated-market size (clearly labelled as the whole
 * marketplace, never as this project's matches) -- what publication
 * unlocks, not a taste of it.
 *
 * After publication, every reader of this route sees the SAME frozen
 * market report the snapshot cached at publish time (published-
 * snapshot.ts) -- never a freshly recomputed one that could drift from
 * what the board notice, the invited vendors and the exported documents
 * all represent. A published record from before Phase 2 (no snapshot yet)
 * falls back to a fresh build so it still functions, rather than erroring.
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
    // Draft readiness (Phase 2 replaces the old value-preview panel, which
    // leaked project-specific matches, with an honest locked-outcome
    // reading): document completeness, gaps, the indicative price band
    // (not vendor-identifying) and the general marketplace size -- never
    // this project's own ranked matches.
    const full = buildMarketReport(project);
    const readiness = {
      document: full.document,
      gaps: full.gaps,
      estimate: full.estimate,
      assumptions: full.assumptions,
      evaluated_market_total: full.matched.total_evaluated_market,
    };
    return Response.json({
      ok: true,
      preview: true,
      readiness,
      unlocked_at_publish:
        "Publish to match this project against Netify's evaluated vendors and service providers, invite the strongest fits, and unlock your project documents. The full vendor list, complete gap detail, the Word and PDF documents and delivery to your matched vendors and service providers unlock together, the moment you publish. Publishing is free.",
    }, { headers: cors });
  }
  const snapshot = await getLatestPublishedSnapshot(id);
  return Response.json({ ok: true, market_report: snapshot?.market_report ?? buildMarketReport(project) }, { headers: cors });
}
