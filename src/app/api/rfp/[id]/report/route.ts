import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, kvConfigured } from "@/lib/rfp-store";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";
import { buildMarketReport } from "@/lib/market-report";
import { getLatestPublishedSnapshot } from "@/lib/published-snapshot";
import { hasPublished } from "@/lib/project-machine";

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
 * all represent.
 *
 * Round 4 correction (14 Aug 2026), Robert's findings 1, 2, 4 and 5:
 *
 *   1. The publication gate used to be `status !== "published"`, which
 *      undercounts every project that has since moved into QA or
 *      evaluation (STATUS_FOR_PHASE in project-machine.ts maps every
 *      phase from "published" onward -- including the post-evaluation
 *      phases -- onto one of "published"/"qa"/"evaluation"). Now uses the
 *      shared `hasPublished()` predicate.
 *   2. A published record from before Phase 2 (no snapshot at all) used
 *      to fall back to a fresh `buildMarketReport()` recompute silently --
 *      functioning, but letting a caller present a recomputed figure as
 *      if it were the frozen one. The response now carries `frozen: true|
 *      false` so a caller can tell the difference and word it honestly.
 *   4/5. `market_report.matched` comes from `matchSuppliers()`, a
 *      DIFFERENT, simpler ranking than the `buildShortlist()` call that
 *      actually selected this project's real matched/invited vendors
 *      (they can genuinely diverge -- a live-demo run showed an invited
 *      vendor absent from `market_report.matched.names`'s capped top-8).
 *      The response now also carries `matched_vendor_ids`/
 *      `invited_vendor_ids` (always present on any real snapshot,
 *      the REAL selection) and `matched_vendors`/`invited_vendors`
 *      (vendor NAMES frozen at publish time, present only on a snapshot
 *      written after this round's schema addition -- null on an older
 *      snapshot or a no-snapshot legacy record, so a caller resolving
 *      names from the live directory in that fallback case can label it
 *      honestly rather than claiming it is frozen).
 */
export async function GET(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return Response.json({ error: "RFP not found." }, { status: 404, headers: cors });
  const access = await requireRfpOwner(req, project);
  if (!access.ok) return ownerRequired("Reading this RFP's market report", cors);
  if (!hasPublished(project.status)) {
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
  return Response.json({
    ok: true,
    // Round 4, finding 2: true only when a REAL snapshot backs this read.
    // A legacy published record with none falls back to a fresh recompute
    // below (still functions), but a caller must not present that as
    // "exactly as published".
    frozen: snapshot !== null,
    market_report: snapshot?.market_report ?? buildMarketReport(project),
    // Round 4, findings 4/5: the REAL matched/invited selection, always
    // present on any real snapshot; the legacy no-snapshot case is honest
    // about not having one (null), rather than inventing a substitute --
    // `invited_vendor_ids` still falls back to the live project's own
    // persisted field (real, just not necessarily this exact publish's
    // frozen moment) since that one field survives regardless of a
    // snapshot's existence.
    matched_vendor_ids: snapshot?.matched_vendor_ids ?? null,
    invited_vendor_ids: snapshot?.invited_vendor_ids ?? project.invited_vendors ?? [],
    // Vendor NAMES frozen at publish time -- present only on a snapshot
    // written after this round's schema addition. Null (not an empty
    // array) when absent, so a caller can tell "no frozen names" apart
    // from "frozen, and there happen to be none".
    matched_vendors: snapshot?.matched_vendors ?? null,
    invited_vendors: snapshot?.invited_vendors ?? null,
  }, { headers: cors });
}
