/**
 * Milestone 3 — FIRST CUT: "Conversation Creates a First-Class Project"
 * (Robert's build prompt, 9 Aug 2026).
 *
 * The persisted Understanding: everything the buyer has told Netify about
 * their situation, richer than the rulebook's own SecurityRequirementInput
 * contract and explicitly, permanently separate from it (Gap A/C rulings).
 * SecurityRequirementInputSchema stays the rulebook's own narrow,
 * policy-bound assessment-input contract — this module never touches it.
 *
 * Two concepts this file keeps distinct, by Robert's explicit ruling (Gap
 * C): Understanding COMPLETENESS ("how well does Netify understand this
 * buyer's situation") is computed here, deterministically, from which
 * canonical sections have at least one standing fact. SecurityScopeVerdict
 * CONFIDENCE ("how confident is Netify in this security-sourcing
 * assessment") is the rulebook's own, separately computed, separately
 * stored value (rulebook.ts). Neither is derived from the other, and
 * nothing in this file reads or writes verdict.confidence.
 *
 * The fact ledger itself is NOT reinvented here: `facts` stores the exact
 * WorkspaceFact shape draft.ts already defines and merges (mergeUpdates,
 * standing, requirementFrom) — this file adds a Zod persistence shape for
 * that same ledger, and a deterministic completeness read over it, nothing
 * else. Reuse, not a second engine.
 */

import { z } from "zod";
import { statedObjectivesIn } from "@/lib/workspace/extract";

/* ------------------------------------------------------------------ */
/* Persisted shape                                                     */
/* ------------------------------------------------------------------ */

/**
 * Structurally the same shape as draft.ts's WorkspaceFact (id, path, value,
 * provenance, quote/reason, struck, source, cycle). `path` is kept as a
 * bare string rather than re-declaring extract.ts's AllowedPath union here:
 * every fact that reaches this schema has already passed extract.ts's own
 * validate() gate once, so duplicating that union in a second location
 * would only create a second place to update it (Robert: "do not invent
 * parallel fields when a suitable canonical field already exists").
 */
export const UnderstandingFactSchema = z.object({
  id: z.string(),
  path: z.string(),
  value: z.unknown(),
  provenance: z.enum(["stated", "inferred"]),
  quote: z.string().optional(),
  reason: z.string().optional(),
  struck: z.boolean(),
  source: z.enum(["extract", "answer", "link"]),
  cycle: z.number().int().min(1),
}).strict();
export type UnderstandingFact = z.infer<typeof UnderstandingFactSchema>;

/** An objective the buyer stated in their own words (extract.ts's
 *  statedObjectivesIn — the one existing, narrow, strict-phrase objective
 *  signal in the codebase today; reused exactly, not replaced). */
export const UnderstandingObjectiveSchema = z.object({
  id: z.string(),
  label: z.string(),
}).strict();
export type UnderstandingObjective = z.infer<typeof UnderstandingObjectiveSchema>;

export const UnderstandingCompletenessSchema = z.object({
  /** present-sections / total-sections, rounded to 2dp. Deterministic:
   *  no model scoring anywhere in this calculation (Robert's Gap C
   *  ruling: "prefer deterministic completeness over opaque AI scoring
   *  where practical"). */
  score: z.number().min(0).max(1),
  sections_present: z.array(z.string()),
  sections_missing: z.array(z.string()),
  /** Buyer-facing prose for every missing section, so an agent (or a
   *  human reading the raw record) can see exactly what is still
   *  unknown without re-deriving it from sections_missing's keys. */
  missing_information: z.array(z.string()),
}).strict();
export type UnderstandingCompleteness = z.infer<typeof UnderstandingCompletenessSchema>;

export const UnderstandingSchema = z.object({
  facts: z.array(UnderstandingFactSchema).default([]),
  objectives: z.array(UnderstandingObjectiveSchema).default([]),
  completeness: UnderstandingCompletenessSchema,
  /** The number of conversational turns folded into this Understanding so
   *  far (mirrors draft.ts's per-fact `cycle`, at the record level). */
  cycle: z.number().int().min(0).default(0),
  updated_at: z.number(),
}).strict();
export type Understanding = z.infer<typeof UnderstandingSchema>;

/* ------------------------------------------------------------------ */
/* Canonical sections (Robert's minimum field list, build prompt 9 Aug) */
/* ------------------------------------------------------------------ */

export const UNDERSTANDING_SECTIONS = [
  { key: "objective", label: "objective" },
  { key: "drivers", label: "drivers" },
  { key: "estate", label: "estate" },
  { key: "geography", label: "geography" },
  { key: "timescale", label: "timescale" },
  { key: "existingSuppliers", label: "existing suppliers or providers" },
  { key: "vendorsUnderConsideration", label: "vendors under consideration" },
  { key: "technologies", label: "named technologies" },
  { key: "constraints", label: "constraints" },
  { key: "bespoke", label: "bespoke requirements" },
] as const;
export type UnderstandingSectionKey = (typeof UNDERSTANDING_SECTIONS)[number]["key"];

/** Which extraction paths satisfy each section. "objective" is deliberately
 *  absent: it is answered from `objectives`, not from a fact path (see
 *  computeCompleteness below). */
const SECTION_PATHS: Record<Exclude<UnderstandingSectionKey, "objective">, string[]> = {
  drivers: ["drivers"],
  estate: ["estate.users", "estate.sites", "estate.cloud", "estate.existingSecurity", "estate.existingNetwork"],
  geography: ["organisation.regions", "estate.namedLocations"],
  timescale: ["constraints.timeline"],
  existingSuppliers: ["estate.existingProviders"],
  vendorsUnderConsideration: ["procurement.vendorsUnderConsideration"],
  technologies: ["estate.namedTechnologies"],
  constraints: ["constraints.complianceRequirements", "constraints.inHouseSocCapacity", "constraints.budgetBand"],
  bespoke: ["requirements.bespoke"],
};

const MISSING_PROSE: Record<UnderstandingSectionKey, string> = {
  objective: "No stated objective yet: what the buyer is trying to achieve.",
  drivers: "No driver stated yet: why this project, why now.",
  estate: "No estate detail yet: users, sites, cloud or existing tooling.",
  geography: "No geography stated yet: regions or named locations.",
  timescale: "No timescale stated yet: when this needs to be live.",
  existingSuppliers: "No existing supplier or provider named yet.",
  vendorsUnderConsideration: "No vendor under consideration named yet.",
  technologies: "No named technology stated yet.",
  constraints: "No constraint stated yet: compliance, budget or in-house capability.",
  bespoke: "No bespoke or free-text requirement stated yet.",
};

/**
 * Deterministic completeness: a section is "present" when at least one
 * STANDING (non-struck) fact lands on one of its paths, or — for
 * "objective" — when at least one objective has been recognised. No model
 * call, no opaque score; every present/missing decision traces to a real
 * fact or its absence, and the same decision is provable from the stored
 * record alone. Distinct, by design, from SecurityScopeVerdict.confidence.
 */
export function computeCompleteness(
  standingFacts: Array<{ path: string }>,
  objectives: UnderstandingObjective[],
): UnderstandingCompleteness {
  const presentPaths = new Set(standingFacts.map((f) => f.path));
  const present: string[] = [];
  const missing: string[] = [];
  const missingInfo: string[] = [];
  for (const s of UNDERSTANDING_SECTIONS) {
    const has = s.key === "objective"
      ? objectives.length > 0
      : SECTION_PATHS[s.key].some((p) => presentPaths.has(p));
    if (has) present.push(s.key);
    else { missing.push(s.key); missingInfo.push(MISSING_PROSE[s.key]); }
  }
  return {
    score: Math.round((present.length / UNDERSTANDING_SECTIONS.length) * 100) / 100,
    sections_present: present,
    sections_missing: missing,
    missing_information: missingInfo,
  };
}

/**
 * Fold this turn's stated objectives (extract.ts's statedObjectivesIn — the
 * one existing objective signal, reused exactly, not replaced) into the
 * Understanding's standing objectives list. Additive and idempotent: an
 * objective already recognised in an earlier turn is never duplicated or
 * dropped by a later turn that doesn't repeat it (objectives, unlike
 * numeric facts, are never "corrected" by a later message that simply
 * doesn't mention them again).
 */
export function mergeObjectives(
  prev: UnderstandingObjective[],
  text: string,
): UnderstandingObjective[] {
  const found = statedObjectivesIn(text);
  if (!found.length) return prev;
  const byId = new Map(prev.map((o) => [o.id, o] as const));
  for (const f of found) byId.set(f.id, f);
  return [...byId.values()];
}
