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
  /** The specific, named things still unstated for this row (Robert, 19
   *  Aug 2026: "make those rows name what's actually missing").
   *
   *  WHY THIS EXISTS. Some rows are satisfied by a COMPOSITE of several
   *  facts, and a single `detail` string could only ever report the ones
   *  already present -- so "Organisation and scale" rendered
   *  "Healthcare & pharma, 20 sites" beside a NEEDS INPUT chip, which
   *  reads as a contradiction: populated, yet incomplete, with no way to
   *  tell what would complete it. Worse in the other direction, "Current
   *  estate" is satisfied by ANY ONE of network/cloud/security, so a
   *  buyer who stated only their MPLS network got a flat "Confirmed"
   *  while two thirds of the row was genuinely unknown.
   *
   *  Every entry is a real, checkable gap the caller already evaluates to
   *  decide the row's own state -- never a generic prompt, never a
   *  suggestion about what the buyer SHOULD want. Absent or empty means
   *  there is genuinely nothing left to name, which is why it is optional
   *  rather than defaulted to []. */
  missing?: string[];
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

/* ------------------------------------------------------------------ */
/* ONE DENOMINATOR (Robert, 20 Aug 2026)                               */
/* ------------------------------------------------------------------ */

/**
 * "right now, it is 100% not clear how the user is progressing."
 *
 * The cause was four numbers that never agreed. The product showed, at
 * once: a 0-100 readiness score, a "3 of 5" publish checklist, an
 * "N open decisions" badge and a raw "Document gaps" tile — four
 * different denominators for one question ("how far am I?"), three of
 * them unbounded or opaque, and the ONE finite structure that genuinely
 * answers it (this file's own section rows, each already carrying a real
 * five-value state) was rendered as a list and counted by nothing.
 *
 * This function promotes that list to being the progress number. It
 * derives, it does not store: give it the rows the canvas already renders
 * and every surface — document subtitle, wizard rail, question card —
 * reads the same fraction off the same array, so they cannot disagree.
 *
 * `later` rows are EXCLUDED from the denominator, deliberately. They are
 * the rows this file has already judged not to be needed for a
 * publishable, comparable enquiry (Commercial, Success). Counting them
 * would make the fraction unreachable and recreate exactly the
 * "no end in sight" feeling this exists to end — a buyer must be able to
 * see the target and hit it. `laterCount` is returned separately so a
 * surface can say so out loud rather than silently hiding rows.
 *
 * PURE: no React, no I/O (Article 17).
 */
export type OutlineProgress = {
  /** Confirmed rows among those actually required. */
  ready: number;
  /** Rows required for a publishable enquiry (everything not `later`). */
  total: number;
  /** Rows deliberately deferred — shown, never counted against you. */
  laterCount: number;
  /** The first required row that is not yet confirmed, or null when done. */
  next: OutlineRow | null;
  /** 1-based position of `next` within the required rows; 0 when done. */
  nextPosition: number;
};

export function outlineProgress(rows: readonly OutlineRow[]): OutlineProgress {
  const required = rows.filter((r) => r.state !== "later");
  const ready = required.filter((r) => r.state === "confirmed").length;
  const idx = required.findIndex((r) => r.state !== "confirmed");
  return {
    ready,
    total: required.length,
    laterCount: rows.length - required.length,
    next: idx === -1 ? null : required[idx],
    nextPosition: idx === -1 ? 0 : idx + 1,
  };
}

/** The one sentence every surface renders, so the wording cannot drift
 *  either. Deliberately a fraction and never a percentage: a percentage
 *  invites a second percentage, which is how four numbers happened. */
export function outlineProgressLine(p: OutlineProgress): string {
  return `${p.ready} of ${p.total} section${p.total === 1 ? "" : "s"} ready`;
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
  /** Which of sector/sites/regions/user count are still unstated -- the
   *  SAME four conditions `orgScaleComplete` is ANDed from, so the chip
   *  and the named gaps can never disagree. */
  orgScaleMissing?: string[];
  /** Solution scope: what is being bought is stated. */
  scopeComplete: boolean;
  scopeDetail: string;
  /** Current estate: any existing-network/cloud/security fact stated. */
  estateSignal: boolean;
  estateDetail: string;
  /** Which of network/cloud/security estate are still unstated. Reported
   *  even when `estateSignal` is true, because ANY ONE of the three
   *  satisfies the row -- so "Confirmed" here has never meant "all three
   *  known", and saying so is the honest reading. */
  estateMissing?: string[];
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
      missing: input.orgScaleMissing,
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
      missing: input.estateMissing,
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

/**
 * Which outline row a still-open decision answers into — the reference
 * design's "Resolves &ldquo;X&rdquo; in the outline once answered."
 * footnote (Robert's "UI mockups request" handoff bundle, screenshot
 * 02-decisions.png; structural pass 19 Aug 2026).
 *
 * HONESTY RULE, same as every other projection here: this returns a row
 * title ONLY where the relationship is already real and 1:1 in the
 * existing vocabularies, and `null` everywhere else. A decision whose
 * target has no unambiguous outline home simply renders no footnote —
 * never a guessed section name, which would promise the buyer that
 * answering moves a row it may not move.
 *
 * The three input vocabularies, all pre-existing:
 *  · `EarnedQuestion.section` (questions.ts): organisation | objectives |
 *    estate | security | compliance | support | commercial
 *  · open-decision ids (procurement-document.ts), whose `OD-` prefixes
 *    already name their own subject
 *  · governed sector suggestions, which by construction answer into the
 *    sector row — its title is passed in because it is pack-derived
 *    (`Manufacturing and OT`, `Healthcare and clinical systems`, …) and
 *    only the caller knows which pack is active.
 *
 * `compliance` is deliberately absent from the section map: a compliance
 * question can land in either the security row or the active sector row
 * depending on the pack, so there is no 1:1 answer and it correctly
 * returns null rather than picking one.
 */
const SECTION_TO_OUTLINE_TITLE: Record<string, string> = {
  organisation: "Organisation and scale",
  objectives: "Solution scope",
  estate: "Current estate",
  security: "Security, identity and data",
  support: "Operating model and support",
  commercial: "Commercial and contractual",
};

const OPEN_DECISION_TO_OUTLINE_TITLE: Record<string, string> = {
  "OD-operating-model-unstated": "Operating model and support",
  "OD-operating-model-conflict": "Operating model and support",
  "OD-operating-model-ambiguous-correction": "Operating model and support",
  "OD-support-coverage-ambiguous": "Operating model and support",
  "OD-timeline-unstated": "Success and evaluation",
};

export function outlineRowForDecision(input: {
  id: string;
  target: string;
  governedSuggestion: boolean;
  /** The active sector pack's own row title, when a pack is active. */
  sectorSectionTitle: string | null;
}): string | null {
  if (input.governedSuggestion) return input.sectorSectionTitle;
  if (OPEN_DECISION_TO_OUTLINE_TITLE[input.id]) return OPEN_DECISION_TO_OUTLINE_TITLE[input.id];
  const section = input.target.split(".")[0];
  return SECTION_TO_OUTLINE_TITLE[section] ?? null;
}

/**
 * Where a section sits in the run of required rows — the other half of
 * the one denominator (Robert, 20 Aug 2026). `outlineRowForDecision`
 * already tells a question WHICH section it fills; this tells it WHERE
 * that section is, so a card can say "section 5 of 8" instead of
 * arriving with no position at all. That absence is most of why the
 * questions read as "a list of random questions with no end in sight":
 * each one was locally sensible and globally unplaceable.
 *
 * Returns null for a `later` section — deliberately. A row excluded from
 * the denominator must not be given a position inside it, or the fraction
 * and the card would quietly disagree.
 */
export function sectionPosition(
  rows: readonly OutlineRow[],
  title: string | null,
): { position: number; total: number; state: OutlineState } | null {
  if (!title) return null;
  const required = rows.filter((r) => r.state !== "later");
  const i = required.findIndex((r) => r.title === title);
  if (i === -1) return null;
  return { position: i + 1, total: required.length, state: required[i].state };
}

/**
 * 2030 UI rebuild (Robert, 20 Aug 2026: "tell the user that the AI prompt
 * will auto populate all sections... the portal should update all
 * sections"). Which outline rows genuinely changed between two snapshots
 * of this same projection — the one thing that can honestly answer "did
 * my sentence just touch more than one section?" without ProjectDesk
 * re-deriving that from raw facts a second time.
 *
 * A row counts as changed when its state, its detail line, or its named
 * missing items differ — i.e. anything a buyer would actually SEE change
 * on the row. A row present in `next` but not in `prev` (a sector pack
 * activating mid-conversation) counts too: it is new information on
 * screen, which is exactly what this exists to name.
 *
 * PURE: no React, no I/O (Article 17) — a plain array diff, so it is
 * testable on two literal `OutlineRow[]` fixtures with no component
 * mounted.
 */
export function diffOutlineSections(prev: readonly OutlineRow[], next: readonly OutlineRow[]): string[] {
  const prevByKey = new Map(prev.map((r) => [r.key, r]));
  const changed: string[] = [];
  for (const row of next) {
    const before = prevByKey.get(row.key);
    if (
      !before ||
      before.state !== row.state ||
      before.detail !== row.detail ||
      (before.missing ?? []).join("") !== (row.missing ?? []).join("")
    ) {
      changed.push(row.title);
    }
  }
  return changed;
}
