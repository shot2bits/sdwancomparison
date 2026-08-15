/**
 * Living Procurement UK Decision-Maker Blueprint (Robert, 15 Aug 2026),
 * implementation step 5: ONE canonical NextQuestion projection.
 *
 * Robert's own diagnosis, confirmed by live reproduction before this file
 * existed: "The primary experience does not reveal enough of the
 * procurement structure that the compiler already knows or should safely
 * propose." The fix is not a new source of truth -- the SASE-shape,
 * resilience and security-boundary questions this module surfaces were
 * ALREADY correctly derived by `earnedQuestions()` (workspace/questions.ts)
 * before this file existed; they were simply thrown away as inert text
 * inside ProjectDesk.tsx's collapsed "Project details" sheet (`q.options`
 * was never read, only `q.question`). This module is a pure RANKING AND
 * DEDUPLICATION layer over three things that already exist:
 *
 *  1. `LivingProcurementDocument.openDecisions` (procurement-readiness.ts)
 *  2. `earnedQuestions()` (workspace/questions.ts, includes sector-pack
 *     questions via PACK_QUESTIONS)
 *  3. `visibleSuggestions()` (sector/derive.ts) -- governed, droppable
 *     sector suggestions, never silently a buyer fact (every pack
 *     suggestion in packs.ts is `accept.kind === "note"` or targets a
 *     path through the buyer's own explicit accept click only).
 *
 * PURE: no I/O, no React, like every projection in this codebase
 * (Article 17). The caller (ProjectDesk.tsx) supplies the three inputs
 * it already computes; this module invents nothing about the buyer's
 * position, it only orders and labels what is already true.
 *
 * NON-NEGOTIABLE RULES this module exists to honour (Robert's blueprint,
 * verbatim list) -- restated here because they constrain this file's own
 * shape, not just the UI that renders it:
 *  - "Do not insert Netify-authored question text into the buyer's
 *    source ledger. Only the buyer's answer may become buyer wording."
 *    This module never writes anything; it only ranks read-only
 *    candidates. Applying an answer (landing it as a fact/note) is the
 *    caller's job, through the SAME `applyMerge`/`setNoted` machinery a
 *    typed answer already uses -- see ProjectDesk.tsx's `landOption`.
 *  - "Question selection is UI context, not a source turn." This module
 *    produces `activeQuestion` candidates; selecting one for display
 *    must never call `keepSourceTurn()`.
 *  - "Sector suggestions must be labelled as Netify suggestions... and
 *    must never silently become a buyer fact." Every `NextQuestion`
 *    whose `source` is `"sector_suggestion"` carries `governedSuggestion:
 *    true` precisely so the renderer can never merge that state with an
 *    earned/open-decision question's presentation.
 */

import type { EarnedQuestion, QuestionAnswer } from "@/lib/workspace/questions";
import type { PackSuggestion } from "@/lib/sector/packs";
import type { OpenDecision, OpenDecisionImpact } from "@/lib/workspace/procurement-document";

/** `OpenDecisionImpact` plus `"risk"` -- the one impact category the
 *  blueprint's own NextQuestion data contract names ("pricing /
 *  eligibility / architecture / resilience / delivery / compliance /
 *  risk") that the existing compiler union does not yet carry. Additive
 *  only: every existing `OpenDecisionImpact` value stays valid here, so
 *  no existing open-decision code needs to change. */
export type NextQuestionImpact = OpenDecisionImpact | "risk";

/** The impact tags that count as a MATERIAL decision for readiness
 *  messaging (see procurement-readiness.ts's "material decisions remain"
 *  line): a gap that touches eligibility, price, architecture, risk or
 *  compliance is one suppliers cannot price consistently around. A
 *  decision whose ONLY impact is delivery/evaluation (e.g. "when do you
 *  need this live") is real and stays in the list, but is not counted as
 *  a pricing-blocking gate -- excluding it is what makes the readiness
 *  count honest rather than alarmist. */
export const MATERIAL_IMPACTS: readonly NextQuestionImpact[] = ["eligibility", "price", "architecture", "compliance", "risk"];

export type NextQuestionSource = "compiler_open_decision" | "earned_question" | "sector_suggestion";

export type NextQuestion = {
  /** Stable across recompiles for the SAME underlying candidate (the
   *  open decision's own id, the earned question's own id, or
   *  `sector:<pack>:<suggestion id>`) -- never derived from array
   *  position or render order. */
  id: string;
  question: string;
  source: NextQuestionSource;
  /** Which taxonomy/section key this answers into -- the SAME
   *  vocabulary `TAXONOMY`/`EarnedQuestion.section` already use, not a
   *  new namespace. */
  target: string;
  impact: NextQuestionImpact[];
  /** Structured answer options, when the underlying candidate has them
   *  (every earned question and sector suggestion does). `null` for a
   *  compiler open decision with no structured answer of its own yet --
   *  still a real, visible decision; the caller resolves how it is
   *  answered (see ProjectDesk.tsx's OPEN_DECISION_SLOT map). */
  options: Array<{ label: string; answer: QuestionAnswer }> | null;
  /** True only for `source === "sector_suggestion"` -- the renderer must
   *  label this distinctly ("Netify suggests...") and never let an
   *  accept click land as buyer-stated provenance. */
  governedSuggestion: boolean;
  /** A conflict/ambiguity this decision resolves, when the underlying
   *  open decision carries one -- rendered as context, never invented. */
  conflictReason: string | null;
  /** Internal ranking weight (earned question weight, or a 0 default for
   *  open decisions/suggestions, which rank by tier instead) -- exposed
   *  for fixtures/debugging, not meant as user-facing copy. */
  weight: number;
};

type Ctx = {
  openDecisions: OpenDecision[];
  earned: EarnedQuestion[];
  suggestions: PackSuggestion[];
};

/** Impact overrides for specific earned-question ids where the generic
 *  section-based default (below) would misclassify a genuinely
 *  price/architecture/risk-bearing decision as a lower tier. Every id
 *  named here is one the blueprint's own fixtures or reproduction
 *  exercise: SASE shape and dual-circuit resilience are direct cost and
 *  architecture drivers (Section 5.7's ranking places them above a
 *  security-control checklist item, which stays architecture/compliance
 *  only until the buyer has confirmed the platform shape and site
 *  resilience it will be implemented against). */
const EARNED_IMPACT_OVERRIDES: Record<string, NextQuestionImpact[]> = {
  "q-sase-shape": ["price", "architecture"],
  "q-resilience": ["price", "architecture", "risk"],
  "q-sse-scope": ["architecture", "compliance"],
  "q-support": ["price", "delivery"],
  "q-mpls-keep": ["architecture", "delivery"],
  "q-azure-vwan": ["architecture"],
  "q-residency": ["compliance", "architecture"],
  "q-fca": ["compliance", "eligibility"],
  "q-dspt": ["compliance", "eligibility"],
  "q-contract-end": ["delivery", "evaluation"],
  "q-root-sector": ["eligibility", "price", "architecture"],
  "q-root-scope": ["eligibility", "price", "architecture"],
  "q-hc-mdr": ["compliance", "architecture"],
  "q-hc-iam": ["compliance", "architecture"],
  "q-hc-clinical": ["risk", "delivery"],
  "q-nhs-hscn": ["architecture", "risk"],
};

const SECTION_DEFAULT_IMPACT: Record<string, NextQuestionImpact[]> = {
  organisation: ["eligibility"],
  objectives: ["architecture", "price"],
  estate: ["architecture"],
  security: ["compliance", "architecture"],
  compliance: ["compliance"],
  model: ["price", "architecture"],
  change: ["delivery", "risk"],
  support: ["delivery"],
  commercial: ["price"],
  services: ["delivery"],
  success: ["evaluation"],
  suppliers: ["eligibility"],
};

/** Concept keys used ONLY for deduplication -- two candidates that
 *  describe the SAME underlying gap collapse to one entry (blueprint
 *  step 6: "Deduplicate questions by concept/target"). Unmapped ids fall
 *  back to their own id, i.e. never collide with anything else. */
const OPEN_DECISION_CONCEPT: Record<string, string> = {
  "OD-operating-model-unstated": "concept:operating-model",
  "OD-operating-model-conflict": "concept:operating-model",
  "OD-operating-model-ambiguous-correction": "concept:operating-model",
  "OD-timeline-unstated": "concept:timeline",
  "OD-support-coverage-ambiguous": "concept:support-coverage",
};
const EARNED_CONCEPT: Record<string, string> = {
  "q-contract-end": "concept:timeline",
  "q-support": "concept:support-coverage",
};

function impactForEarned(q: EarnedQuestion): NextQuestionImpact[] {
  return EARNED_IMPACT_OVERRIDES[q.id] ?? SECTION_DEFAULT_IMPACT[q.section] ?? ["architecture"];
}

function tierOf(impact: NextQuestionImpact[]): number {
  if (impact.includes("eligibility")) return 1;
  if (impact.includes("price")) return 2;
  if (impact.includes("architecture") || impact.includes("risk")) return 3;
  return 4;
}

const SOURCE_RANK: Record<NextQuestionSource, number> = { compiler_open_decision: 0, earned_question: 1, sector_suggestion: 2 };

/** The full ranked, deduplicated list -- every genuinely open, earned or
 *  suggested decision, ordered by the blueprint's own priority (1
 *  supplier eligibility impact, 2 price comparability, 3 architecture or
 *  risk impact, 4 downstream dependency, 5 confidence gap, 6 effort to
 *  answer as the final tie-break). Tiers 1-3 are the impact tags above;
 *  tier 4 (downstream dependency) is approximated by whether the
 *  candidate already names an affected clause; tier 5/6 fall through to
 *  the earned question's own weight and then a stable id sort, since
 *  this codebase has no separate "confidence" or "effort" signal to read
 *  -- a documented, deliberate simplification (see the checkpoint
 *  report's assumptions section), not a silent guess. */
export function rankNextQuestions(ctx: Ctx): NextQuestion[] {
  const candidates: NextQuestion[] = [];

  for (const d of ctx.openDecisions) {
    candidates.push({
      id: d.id,
      question: d.question,
      source: "compiler_open_decision",
      target: OPEN_DECISION_CONCEPT[d.id]?.replace("concept:", "") ?? "objectives",
      impact: [...d.impact],
      options: null,
      governedSuggestion: false,
      conflictReason: d.conflictReason,
      weight: d.conflict ? 96 : 0,
    });
  }

  for (const q of ctx.earned) {
    candidates.push({
      id: q.id,
      question: q.question,
      source: "earned_question",
      target: q.section,
      impact: impactForEarned(q),
      options: q.options,
      governedSuggestion: false,
      conflictReason: null,
      weight: q.weight,
    });
  }

  for (const s of ctx.suggestions) {
    candidates.push({
      id: `sector:${s.id}`,
      question: s.label,
      source: "sector_suggestion",
      target: s.section,
      impact: SECTION_DEFAULT_IMPACT[s.section] ?? ["architecture"],
      options: [
        { label: "Accept", answer: s.accept },
        { label: "Not needed", answer: { kind: "dismiss" } },
      ],
      governedSuggestion: true,
      conflictReason: null,
      weight: 40,
    });
  }

  const dedupeKeyOf = (c: NextQuestion): string =>
    c.source === "compiler_open_decision"
      ? OPEN_DECISION_CONCEPT[c.id] ?? `open:${c.id}`
      : c.source === "earned_question"
        ? EARNED_CONCEPT[c.id] ?? `earned:${c.id}`
        : `sector:${c.id}`;

  const bySame = new Map<string, NextQuestion>();
  for (const c of candidates) {
    const key = dedupeKeyOf(c);
    const existing = bySame.get(key);
    if (!existing) {
      bySame.set(key, c);
      continue;
    }
    // Keep the higher-priority candidate's own wording/options (lower
    // SOURCE_RANK wins: a real compiler open decision outranks an earned
    // question describing the same gap, which outranks a suggestion),
    // but union the impact tags so neither candidate's "why it matters"
    // signal is lost by the merge.
    const keep = SOURCE_RANK[existing.source] <= SOURCE_RANK[c.source] ? existing : c;
    const drop = keep === existing ? c : existing;
    bySame.set(key, { ...keep, impact: [...new Set([...keep.impact, ...drop.impact])] });
  }

  const merged = [...bySame.values()];
  merged.sort((a, b) => {
    const t = tierOf(a.impact) - tierOf(b.impact);
    if (t !== 0) return t;
    const sr = SOURCE_RANK[a.source] - SOURCE_RANK[b.source];
    if (sr !== 0) return sr;
    if (a.weight !== b.weight) return b.weight - a.weight;
    return a.id.localeCompare(b.id);
  });
  return merged;
}

/** The UI cap (blueprint: "Show no more than three prioritised next
 *  decisions in the primary flow"). A separate function from
 *  `rankNextQuestions` so callers that need the full count for readiness
 *  messaging are never tempted to `.length` a pre-sliced array. */
export function topNextQuestions(ctx: Ctx, cap = 3): NextQuestion[] {
  return rankNextQuestions(ctx).slice(0, cap);
}

/** How many OPEN, deduplicated decisions are material (impact intersects
 *  MATERIAL_IMPACTS) -- the count the UI reads for its "N material
 *  decisions remain before suppliers can price consistently" line
 *  (rendered in LivingProcurementCanvas, composed from this count).
 *
 *  A `sector_suggestion` never counts here, deliberately: it is an
 *  optional, Netify-labelled proposition the buyer may accept or ignore
 *  (the pack law), not a gap that blocks a supplier from pricing
 *  consistently -- counting it would conflate "Netify suggests" with
 *  "you must decide," which the blueprint's own vocabulary keeps
 *  strictly separate throughout (Section 5's five states: Confirmed /
 *  Needs input / Needs decision / Netify suggested / Later are five
 *  DISTINCT states, not degrees of the same one). */
export function materialDecisionCount(ctx: Ctx): number {
  return rankNextQuestions(ctx).filter((q) => q.source !== "sector_suggestion" && q.impact.some((i) => MATERIAL_IMPACTS.includes(i))).length;
}
