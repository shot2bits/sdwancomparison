/**
 * Living Procurement Canvas -- Phase 1: readiness, gates' point weights,
 * the 100-point category balance and high-impact open decisions (brief
 * Section 5.4, Section 5.7, Section 14.5's "Balanced" invariant).
 *
 * ONE BUCKETING, reused everywhere a clause's SECTION needs to become a
 * coarser group: the four Supplier Pack response groups (Section 3.5) and
 * the four Evaluation categories (Section 3.6, "Resilience, security,
 * service and delivery weights") are the SAME four buckets, so this is
 * the one place that mapping is defined (procurement-document.ts imports
 * it rather than keeping its own, independent copy).
 */

import type { SecurityRequirementInput } from "@/lib/security/rulebook";
import type { SecurityScopeVerdict } from "@/lib/security/rulebook";
import type { BuyingId, OperatingModelId } from "@/lib/workspace/extract";
import type { ClauseOrigin, EvaluationGate, OpenDecision, ProcurementSectionKey } from "@/lib/workspace/procurement-document";
import { detectOperatingModelConflict, detectSupplierStrategyConflict, type ReceiptLike } from "@/lib/workspace/procurement-templates";

export type EvaluationCategoryKey = "network_resilience" | "security_identity_data" | "managed_service_delivery" | "commercial";

export const CATEGORY_FOR_SECTION: Record<ProcurementSectionKey, EvaluationCategoryKey> = {
  network: "network_resilience",
  security: "security_identity_data",
  identity: "security_identity_data",
  application: "managed_service_delivery",
  operations: "managed_service_delivery",
  project: "managed_service_delivery",
  supplier: "managed_service_delivery",
  additional: "managed_service_delivery",
  commercial: "commercial",
};

/** Default category shape when no clause yet stands in a bucket (Section
 *  14.5: "Balanced: evaluation categories always total exactly 100" holds
 *  unconditionally, even before the first prompt). Sums to 100. */
export const DEFAULT_CATEGORY_WEIGHTS: Record<EvaluationCategoryKey, number> = {
  network_resilience: 25,
  security_identity_data: 25,
  managed_service_delivery: 30,
  commercial: 20,
};

/** One deterministic per-clause point value: a base weight, +2 for a
 *  mandatory clause (evaluators still score the QUALITY of a mandatory
 *  response beyond the pass/fail gate), +1 for a sector-derived clause
 *  (Section 5.4: "Show the source of each weight"). Never randomised,
 *  never a function of array position -- the same clause always carries
 *  the same weight (Section 14.5, "Deterministic"). */
export function clauseWeight(c: { mandatory: boolean; origin: ClauseOrigin }): number {
  let w = 3;
  if (c.mandatory) w += 2;
  if (c.origin === "sector") w += 1;
  return w;
}

/** Section 5.4: "Weighted categories total exactly 100. Rebalance
 *  deterministically when a prompt changes priorities." Largest-remainder
 *  rounding, ties broken by key name (never by insertion order), so the
 *  SAME raw totals always balance to the SAME integer weights. Falls back
 *  to DEFAULT_CATEGORY_WEIGHTS when nothing has weight yet (an empty
 *  document still reports a valid, balanced 100-point split). */
export function balanceCategoriesTo100(raw: Record<EvaluationCategoryKey, number>): Record<EvaluationCategoryKey, number> {
  const total = (Object.values(raw) as number[]).reduce((a, b) => a + b, 0);
  if (total <= 0) return { ...DEFAULT_CATEGORY_WEIGHTS };
  const keys = Object.keys(raw) as EvaluationCategoryKey[];
  const exact = keys.map((k) => ({ k, exact: (raw[k] / total) * 100 }));
  const floored = exact.map((s) => ({ ...s, floor: Math.floor(s.exact) }));
  const used = floored.reduce((a, s) => a + s.floor, 0);
  const remainder = 100 - used;
  const byFrac = [...floored].sort((a, b) => (b.exact - b.floor) - (a.exact - a.floor) || a.k.localeCompare(b.k));
  const out = {} as Record<EvaluationCategoryKey, number>;
  for (const s of floored) out[s.k] = s.floor;
  for (let i = 0; i < remainder; i++) out[byFrac[i % byFrac.length].k] += 1;
  return out;
}

/* ------------------------------------------------------------------ */
/* Open decisions (Section 5.7, Section 16.4)                          */
/* ------------------------------------------------------------------ */

const OP_MODEL_LABEL: Record<OperatingModelId, string> = { managed: "fully managed", co_managed: "co-managed", diy: "self-managed" };

export function buildOpenDecisions(input: {
  requirement: SecurityRequirementInput;
  buying: BuyingId | null;
  opModel: OperatingModelId | null;
  receipts: ReceiptLike[];
  verdict: SecurityScopeVerdict | null;
  clauses: Array<{ id: string; templateId: string }>;
  /** Phase 1 checkpoint round 2, item 2 (13 Aug 2026): a non-null value
   *  means the durable ledger's LAST relevant occurrence named two or
   *  more operating models with no correction signal ("instead of",
   *  "no longer", ...) to say which one the buyer actually intends --
   *  operatingModelFromHistory() (procurement-templates.ts) deliberately
   *  did not guess, and this is where that becomes a visible decision
   *  instead of a silently-dropped signal. */
  operatingModelAmbiguousText?: string | null;
  /** Phase 2 (14 Aug 2026): non-null means resolveSupportCoverage()
   *  (procurement-templates.ts) found a genuine support-coverage
   *  ambiguity -- an explicit "no preference" statement, or a clicked
   *  24x7 selection conflicting with explicit textual wording -- and
   *  deliberately did NOT guess. Mirrors operatingModelAmbiguousText
   *  above exactly. */
  supportCoverageAmbiguousText?: string | null;
}): OpenDecision[] {
  const { requirement, buying, opModel, receipts, clauses, operatingModelAmbiguousText, supportCoverageAmbiguousText } = input;
  const out: OpenDecision[] = [];

  // Section 16.4: a genuine contradiction becomes a visible decision, not
  // a silent choice -- never suppressed, never auto-resolved.
  const conflict = detectOperatingModelConflict(receipts);
  if (conflict?.active) {
    const affected = clauses.filter((c) => c.templateId === "managed-service-boundary").map((c) => c.id);
    out.push({
      id: "OD-operating-model-conflict",
      question: "The buyer has stated both a managed-service model and a wish to retain sole operational control over policy changes. Which applies?",
      impact: ["architecture", "delivery", "price"],
      conflict: true,
      conflictReason: conflict.quote,
      affectedClauseIds: affected,
    });
  }

  // Phase 3 Stage A correction round (Robert, 14 Aug 2026), Prompt D: a
  // second, distinct kind of contradiction -- single-supplier
  // consolidation vs. a wish for independently-selected, best-of-breed
  // security controls. Visible, non-mandatory, no invented gate (no
  // `affectedClauseIds` -- buildCandidateClauses() deliberately never
  // materialises a competing clause for either side of this tension), and
  // the buyer's own sentence is retained verbatim in `conflictReason`.
  const supplierStrategyConflict = detectSupplierStrategyConflict(receipts);
  if (supplierStrategyConflict?.active) {
    out.push({
      id: "OD-supplier-strategy-conflict",
      question:
        "The buyer wants a single supplier but also requires independently-selected, best-of-breed security controls. These pull in opposite directions -- which takes priority, or should the single-supplier scope exclude security?",
      impact: ["architecture", "delivery", "price"],
      conflict: true,
      conflictReason: supplierStrategyConflict.quote,
      affectedClauseIds: [],
    });
  }

  // Phase 1 checkpoint round 2, item 2: an unresolved same-turn
  // contradiction over the operating model (two model names, no
  // correction signal) -- distinct from `conflict` above, which is about
  // a managed model conflicting with a wish to retain sole control, not
  // about which model was even named.
  if (operatingModelAmbiguousText) {
    const affected = clauses.filter((c) => c.templateId === "managed-service-boundary").map((c) => c.id);
    out.push({
      id: "OD-operating-model-ambiguous-correction",
      question: "This statement names more than one operating model with no clear correction. Which operating model applies: fully managed, co-managed or self-managed?",
      impact: ["price", "delivery", "architecture"],
      conflict: true,
      conflictReason: operatingModelAmbiguousText,
      affectedClauseIds: affected,
    });
  }

  // Phase 2 (14 Aug 2026): a genuine support-coverage ambiguity --
  // resolveSupportCoverage() (procurement-templates.ts) found either an
  // explicit "no preference" statement or a clicked 24x7 selection
  // conflicting with explicit textual wording, and deliberately did not
  // guess. Robert's brief: "prevent the system from publishing an
  // inverted support requirement" -- this is that prevention made
  // visible, mirroring OD-operating-model-ambiguous-correction exactly.
  if (supportCoverageAmbiguousText) {
    const affected = clauses.filter((c) => c.templateId === "managed-service-boundary").map((c) => c.id);
    out.push({
      id: "OD-support-coverage-ambiguous",
      question: "Support coverage hours are not clearly resolved. Is 24x7 support required, or business hours only?",
      impact: ["price", "delivery"],
      conflict: true,
      conflictReason: supportCoverageAmbiguousText,
      affectedClauseIds: affected,
    });
  }

  // Section 16.3: the legal interpretation a data-residency statement may
  // need stays a decision, never a buyer fact or an invented statute.
  const residencyClause = clauses.find((c) => c.templateId === "uk-data-residency");
  if (residencyClause) {
    out.push({
      id: "OD-data-residency-legal-basis",
      question: "Confirm which UK data-protection framework(s) govern the stated data-residency constraint. This is a legal interpretation, not a fact this document asserts.",
      impact: ["compliance"],
      conflict: false,
      conflictReason: null,
      affectedClauseIds: [residencyClause.id],
    });
  }

  const networkBuying = buying === "sase" || buying === "sdwan" || buying === "sse";
  if (networkBuying && !opModel && !conflict?.active) {
    out.push({
      id: "OD-operating-model-unstated",
      question: "Which operating model is required: fully managed, co-managed or self-managed?",
      impact: ["price", "delivery", "architecture"],
      conflict: false,
      conflictReason: null,
      affectedClauseIds: [],
    });
  }

  if (!requirement.constraints?.timeline) {
    out.push({
      id: "OD-timeline-unstated",
      question: "When must this be live, or when does the current contract end?",
      impact: ["delivery", "evaluation"],
      conflict: false,
      conflictReason: null,
      affectedClauseIds: [],
    });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Readiness (Section 5.7)                                             */
/* ------------------------------------------------------------------ */

export function buildReadiness(input: {
  requirement: SecurityRequirementInput;
  buying: BuyingId | null;
  opModel: OperatingModelId | null;
  clauses: Array<{ mandatory: boolean; acceptanceTest: string | null }>;
  openDecisions: OpenDecision[];
  gates: EvaluationGate[];
  /** Phase 1 checkpoint correction, item 4 (13 Aug 2026): the earned
   *  instrument and how many of this compile's supplier questions were
   *  reused from the RFI bank -- a real, provable effect of instrument
   *  state on this document, not a decorative passthrough. See
   *  procurement-document.ts's questionsForClause()/buildResponseGroups()
   *  for where `bankQuestionCount` and `rfiBankVersion` are computed. */
  instrument: "sor" | "rfi" | "rfp";
  bankQuestionCount: number;
  rfiBankVersion: string | null;
  /**
   * Living Procurement UK Decision-Maker Blueprint, correction pass
   * (Robert, 15 Aug 2026), defect 5: "Do not merely relabel the existing
   * score bands. Readiness must be derived from: material section
   * coverage; ...; remaining material open questions; accepted-but-
   * unresolved sector rules where applicable." These four fields carry
   * exactly that -- the SAME projections the NextQuestion cards and
   * section outline already compute (procurement-next-questions.ts's
   * materialDecisionCount(), procurement-outline.ts's buildSectionOutline(),
   * sector/derive.ts's visibleSuggestions()) -- into the two buckets below
   * that were previously blind to them (a flat "any clause at all" 30pts,
   * and an open-decisions-only 15pts). All four are OPTIONAL: every
   * existing caller (every fixture, the throwaway repro script) that has
   * not been updated to compute and pass this outer NextQuestion-layer
   * state keeps the EXACT prior fallback formula for both buckets, so
   * this correction pass changes NO existing compiler-level fixture's
   * expected score. The real caller (ProjectDesk.tsx) DOES pass them,
   * computed in a useMemo downstream of both compiledDocument and
   * rankedNextQuestions/sectionOutline -- readiness is deliberately still
   * not woven INTO the compiler itself (compileProcurementDocument()'s own
   * signature is untouched), because rankedNextQuestions/sectionOutline
   * both read compiledDocument.openDecisions, so feeding them back INTO
   * the same compile would be circular; this keeps readiness a downstream
   * projection over the compiled document, exactly like sectionOutline
   * already is, not a second data model.
   */
  materialDecisionsRemaining?: number;
  pendingSectorSuggestions?: number;
  sectionsConfirmed?: number;
  sectionsTotal?: number;
}): { score: number; label: string; reasons: string[] } {
  const { requirement, opModel, clauses, openDecisions, instrument, bankQuestionCount, rfiBankVersion, materialDecisionsRemaining, pendingSectorSuggestions, sectionsConfirmed, sectionsTotal } = input;
  const reasons: string[] = [];
  let score = 0;

  if (typeof sectionsConfirmed === "number" && typeof sectionsTotal === "number" && sectionsTotal > 0) {
    const sectionPoints = Math.round(30 * (sectionsConfirmed / sectionsTotal));
    score += sectionPoints;
    reasons.push(`${sectionsConfirmed} of ${sectionsTotal} procurement sections confirmed.`);
  } else if (clauses.length > 0) {
    score += 30;
    reasons.push(`${clauses.length} testable requirement${clauses.length === 1 ? "" : "s"} compiled.`);
  } else {
    reasons.push("No testable requirements compiled yet.");
  }

  if (opModel) {
    score += 15;
    reasons.push(`Operating model stated: ${OP_MODEL_LABEL[opModel]}.`);
  } else {
    reasons.push("Operating model not yet stated.");
  }

  if (requirement.constraints?.timeline) {
    score += 15;
    reasons.push("Delivery timeline stated.");
  } else {
    reasons.push("Delivery timeline not yet stated.");
  }

  if (requirement.constraints?.budgetBand) {
    score += 10;
    reasons.push("Budget position stated.");
  } else {
    reasons.push("Budget position not yet stated.");
  }

  const mandatoryClauses = clauses.filter((c) => c.mandatory);
  const mandatoryWithAcceptance = mandatoryClauses.length === 0 || mandatoryClauses.every((c) => c.acceptanceTest !== null);
  if (mandatoryWithAcceptance) {
    score += 15;
    reasons.push(mandatoryClauses.length ? "Every mandatory clause carries an acceptance test." : "No mandatory clauses yet.");
  } else {
    reasons.push("A mandatory clause is unresolved and carries no acceptance test yet (see open decisions).");
  }

  if (typeof materialDecisionsRemaining === "number") {
    const sectorPenalty = Math.min(3, pendingSectorSuggestions ?? 0);
    const decisionCredit = Math.max(0, 15 - materialDecisionsRemaining * 3 - sectorPenalty);
    score += decisionCredit;
    reasons.push(
      materialDecisionsRemaining
        ? `${materialDecisionsRemaining} material decision${materialDecisionsRemaining === 1 ? "" : "s"} remain${materialDecisionsRemaining === 1 ? "s" : ""} (open decisions, unresolved earned questions and unaccepted sector suggestions combined)${sectorPenalty ? `, including ${sectorPenalty} pending sector suggestion${sectorPenalty === 1 ? "" : "s"}` : ""}.`
        : "No material decisions remain.",
    );
  } else {
    const decisionCredit = Math.max(0, 15 - Math.min(15, openDecisions.length * 5));
    score += decisionCredit;
    reasons.push(openDecisions.length ? `${openDecisions.length} high-impact open decision${openDecisions.length === 1 ? "" : "s"} remain.` : "No high-impact open decisions remain.");
  }

  // Informational only -- never added to `score` (readiness, here, is
  // about THIS document's own testable-requirements state, a different
  // notion from the instrument ladder's own "ready to earn RFI/RFP"; the
  // two are not conflated into one number, only the instrument's real,
  // provable effect on THIS compile's supplier questions is named).
  reasons.push(
    instrument === "sor"
      ? "Instrument: SoR. Supplier questions are drawn from generated clause templates; the earned RFI question bank joins once the RFI instrument is earned."
      : bankQuestionCount > 0
        ? `Instrument: ${instrument.toUpperCase()}. ${bankQuestionCount} supplier question${bankQuestionCount === 1 ? "" : "s"} reused from the earned RFI question bank${rfiBankVersion ? ` (bank v${rfiBankVersion})` : ""}.`
        : `Instrument: ${instrument.toUpperCase()}.`,
  );

  score = Math.max(0, Math.min(100, score));
  // Living Procurement UK Decision-Maker Blueprint (Robert, 15 Aug 2026),
  // Section 5.7's readiness bands, replacing the old "Substantially
  // ready"/"Ready to issue" wording -- the exact defect Robert reported
  // live ("50, SUBSTANTIALLY READY" while three material decisions sat
  // hidden). New cut points (39/59/79) are deliberately NOT the old ones
  // (19/49/79): the old 50-79 band read "Substantially ready" for a
  // document that, by this file's own scoring, still has an unstated
  // operating model, timeline and several material open decisions --
  // the blueprint's own target wording ("Core scope captured. Four
  // material decisions remain before suppliers can price consistently.")
  // only reads honestly once 50 lands in "Scope forming", not
  // "Substantially ready". The message itself (how many material
  // decisions remain) is composed by the UI layer from the NextQuestion
  // projection (procurement-next-questions.ts's `materialDecisionCount`),
  // not here -- this compiler has no knowledge of earned questions or
  // sector suggestions, which are computed outside it (see that file's
  // own header comment for why that boundary is deliberate).
  const label = score >= 80 ? "Ready to publish" : score >= 60 ? "Comparable enquiry" : score >= 40 ? "Scope forming" : "Starting shape";
  return { score, label, reasons };
}
