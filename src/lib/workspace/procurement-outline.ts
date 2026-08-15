/**
 * Living Procurement UK Decision-Maker Blueprint (Robert, 15 Aug 2026),
 * implementation step 10: the section outline. A read-only PROJECTION,
 * not a new data model -- it reuses the same facts/clauses/open-decision
 * state `ProjectDesk.tsx` already computes and labels each row Confirmed
 * / Needs input / Needs decision / Netify suggested / Later, per the
 * blueprint's own required shape for the manufacturing reproduction:
 *
 *   Organisation and scale        confirmed
 *   Solution scope                confirmed
 *   Current estate                needs input
 *   Resilience and availability   needs decision
 *   Security, identity and data   needs decision
 *   <sector> (e.g. Manufacturing and OT)   Netify suggested
 *   Operating model and support   needs decision
 *   Migration and implementation  needs input
 *   Commercial and contractual    later, but material
 *   Success and evaluation        later
 *
 * Deliberately does NOT redefine `ProcurementSectionKey` (the compiler's
 * own 9-value section enum used for clause grouping/weighting): that
 * enum is a diffing/weighting primitive with fixtures of its own, and
 * this outline is a coarser, more buyer-facing view of the SAME
 * underlying state, not a replacement for it. The sector row (row 6) is
 * OMITTED entirely when no sector pack is active -- "do not display
 * irrelevant sections merely because a static template contains them"
 * (the blueprint's own instruction) applies here as much as it does to
 * the primary flow's question cards.
 *
 * PURE: no I/O, no React.
 */

import type { SecurityRequirementInput } from "@/lib/security/rulebook";
import type { BuyingId } from "@/lib/workspace/extract";
import type { ProcurementClause } from "@/lib/workspace/procurement-document";

export type OutlineState = "confirmed" | "needs_input" | "needs_decision" | "netify_suggested" | "later";

export type OutlineRow = {
  key: string;
  title: string;
  state: OutlineState;
  /** One short, factual line -- never invented copy, always derived from
   *  a real value or count the caller already holds. */
  detail: string;
};

const STATE_LABEL: Record<OutlineState, string> = {
  confirmed: "Confirmed",
  needs_input: "Needs input",
  needs_decision: "Needs decision",
  netify_suggested: "Netify suggested",
  later: "Later",
};

export function outlineStateLabel(s: OutlineState): string {
  return STATE_LABEL[s];
}

/**
 * Living Procurement UK Decision-Maker Blueprint, correction pass
 * (Robert, 15 Aug 2026), defect 2: "The Resilience and availability
 * outline row may say Confirmed only when the canonical document
 * contains the corresponding governed resilience state or clause.
 * Question disappearance alone is not sufficient proof." Pulled out of
 * ProjectDesk.tsx into this pure module specifically so it is a real,
 * directly testable unit -- exercised behaviourally (against an actual
 * compiled document) rather than proven only by inspecting the
 * component's source text.
 *
 * `q-resilience` (questions.ts) is earned purely from site count and
 * buying type; it is never resolved by notedIds, so its disappearance
 * from the ranked NextQuestion list means only "the buyer dismissed the
 * card" or "site count/buying type changed" -- never "a resilience
 * decision was actually compiled." The one thing that DOES prove a real
 * decision is the presence of the `site-resilience-scope` clause
 * (network:site-resilience, procurement-templates.ts), which compiles
 * from the buyer's own stated per-site circuit language regardless of
 * whether the NextQuestion card is still showing.
 */
/**
 * Living Procurement UK Decision-Maker Blueprint, correction pass round 2
 * (Robert, 15 Aug 2026), defect 1: the single, shared clause-existence
 * check for the canonical resilience decision. Extracted out of
 * `deriveResilienceOutlineState()` so the SAME boolean also gates whether
 * `q-resilience` is still an earned candidate in the ranked NextQuestion
 * list / materialDecisionsRemaining (procurement-next-questions.ts) --
 * previously those two surfaces each answered "is resilience resolved?"
 * differently (this one from the compiled clause, that one from
 * dismissedIds/notedIds), which is exactly the drift this correction
 * closes. Deliberately just the clause check -- NOT `resolved` as a
 * whole -- because `resolved` here is additionally ANDed with
 * `!hasOperatingModelConflict`, and `hasOperatingModelConflict` is itself
 * derived FROM `rankedNextQuestions`, which is downstream of the earned
 * list this same boolean also filters. Reusing `resolved` directly at
 * that layer would be circular; the clause check alone is not, because
 * `q-resilience`'s own `earnedBy` already re-derives materiality
 * (site count + buying) independently every time.
 */
export function siteResilienceClauseExists(clauses: Pick<ProcurementClause, "templateId">[]): boolean {
  return clauses.some((c) => c.templateId === "site-resilience-scope");
}

export function deriveResilienceOutlineState(input: {
  clauses: Pick<ProcurementClause, "templateId">[];
  requirement: SecurityRequirementInput;
  buying: BuyingId | null;
  hasOperatingModelConflict: boolean;
}): { resolved: boolean; detail: string } {
  const hasSiteResilienceClause = siteResilienceClauseExists(input.clauses);
  const materiallyApplicable =
    (input.requirement.estate?.sites ?? 0) >= 10 &&
    (input.buying === "sase" || input.buying === "sdwan" || input.buying === "sse");
  const resolved = (hasSiteResilienceClause || !materiallyApplicable) && !input.hasOperatingModelConflict;
  const detail = hasSiteResilienceClause
    ? "Per-site resilience requirement stated and compiled into the document."
    : materiallyApplicable
      ? "Dual-circuit resilience per site not yet decided."
      : "Resilience requirement not yet applicable at this site count.";
  return { resolved, detail };
}

export function buildSectionOutline(input: {
  /** Organisation and scale: sector/sites/regions/users all stated. */
  orgScaleComplete: boolean;
  orgScaleDetail: string;
  /** Solution scope: what is being bought is stated. */
  scopeComplete: boolean;
  scopeDetail: string;
  /** Current estate: any existing-network/cloud/security fact stated. */
  estateSignal: boolean;
  estateDetail: string;
  /** Resilience and availability: no open resilience-concept decision remains. */
  resilienceResolved: boolean;
  resilienceDetail: string;
  /** Security, identity and data: no open security/identity-concept decision remains. */
  securityResolved: boolean;
  securityDetail: string;
  /** Sector intelligence row -- null when no pack is active. */
  sector: { title: string; pendingSuggestions: number; acceptedOrDismissed: number } | null;
  /** Operating model and support: operating model stated and no support-coverage ambiguity. */
  operatingModelResolved: boolean;
  operatingModelDetail: string;
  /** Migration and implementation: any migration/services signal stated. */
  migrationSignal: boolean;
  migrationDetail: string;
  /** Commercial and contractual: any term/commercial-preference signal stated. */
  commercialSignal: boolean;
  commercialDetail: string;
  /** Success and evaluation: any success-criteria signal stated. */
  successSignal: boolean;
  successDetail: string;
}): OutlineRow[] {
  const rows: OutlineRow[] = [
    {
      key: "organisation_scale",
      title: "Organisation and scale",
      state: input.orgScaleComplete ? "confirmed" : "needs_input",
      detail: input.orgScaleDetail,
    },
    {
      key: "solution_scope",
      title: "Solution scope",
      state: input.scopeComplete ? "confirmed" : "needs_input",
      detail: input.scopeDetail,
    },
    {
      key: "current_estate",
      title: "Current estate",
      state: input.estateSignal ? "confirmed" : "needs_input",
      detail: input.estateDetail,
    },
    {
      key: "resilience_availability",
      title: "Resilience and availability",
      state: input.resilienceResolved ? "confirmed" : "needs_decision",
      detail: input.resilienceDetail,
    },
    {
      key: "security_identity_data",
      title: "Security, identity and data",
      state: input.securityResolved ? "confirmed" : "needs_decision",
      detail: input.securityDetail,
    },
  ];

  if (input.sector) {
    rows.push({
      key: "sector_intelligence",
      title: input.sector.title,
      state: input.sector.pendingSuggestions > 0 ? "netify_suggested" : "confirmed",
      detail:
        input.sector.pendingSuggestions > 0
          ? `${input.sector.pendingSuggestions} sector suggestion${input.sector.pendingSuggestions === 1 ? "" : "s"} to review`
          : input.sector.acceptedOrDismissed > 0
            ? "Reviewed."
            : "No sector suggestions yet.",
    });
  }

  rows.push(
    {
      key: "operating_model_support",
      title: "Operating model and support",
      state: input.operatingModelResolved ? "confirmed" : "needs_decision",
      detail: input.operatingModelDetail,
    },
    {
      key: "migration_implementation",
      title: "Migration and implementation",
      state: input.migrationSignal ? "confirmed" : "needs_input",
      detail: input.migrationDetail,
    },
    {
      key: "commercial_contractual",
      title: "Commercial and contractual",
      state: input.commercialSignal ? "confirmed" : "later",
      detail: input.commercialDetail,
    },
    {
      key: "success_evaluation",
      title: "Success and evaluation",
      state: input.successSignal ? "confirmed" : "later",
      detail: input.successDetail,
    },
  );

  return rows;
}
