/**
 * The six-state area derivation (slice four's gate, Robert's order: the
 * areas constellation may only be built once this derivation is real and
 * fixtured). PURE: a function of actual position data, never hand-authored
 * presentation logic. One area state per desk section, derived with a
 * strict priority so every state has exactly one honest meaning:
 *
 *  1. needs_attention: an open question stands in the section (a real gap
 *     or a standing earned question). Unresolved beats everything.
 *  2. suggested: a standing inferred fact awaits the buyer's confirmation
 *     or strike. Nothing suggested counts until they decide.
 *  3. excluded: the section's only history is struck facts: the buyer
 *     considered it and ruled it out, kept on the record.
 *  4. confirmed: standing stated facts and every one of the section's
 *     ledger paths holds one: fully in the buyer's own words.
 *  5. stated: the buyer's words are present but the section is not yet
 *     fully answered.
 *  6. example: nothing real has landed; the section still demonstrates.
 *
 * Ready is reserved for the journey areas (evaluation, publication,
 * responses) and derives from the sign chain's real state.
 */

import type { BriefGap, WorkspaceFact } from "@/lib/workspace/draft";
import { TAXONOMY } from "@/lib/workspace/taxonomy";

export type AreaState = "example" | "stated" | "confirmed" | "suggested" | "needs_attention" | "excluded";

export function deriveAreaState(input: {
  facts: WorkspaceFact[]; // the section's facts, struck included
  openQuestions: number; // real gaps plus standing earned questions here
  noted: number; // noted-tier selections in this section
}): AreaState {
  const standing = input.facts.filter((f) => !f.struck);
  const struck = input.facts.filter((f) => f.struck);
  if (input.openQuestions > 0) return "needs_attention";
  if (standing.some((f) => f.provenance === "inferred")) return "suggested";
  if (standing.length === 0 && input.noted === 0) return struck.length > 0 ? "excluded" : "example";
  return "stated";
}

/** The per-section refinement to confirmed: stated everywhere the section
 *  can hold a fact. Split from deriveAreaState so the base priority stays
 *  path-agnostic and separately testable. */
export function refineConfirmed(sectionKey: string, state: AreaState, facts: WorkspaceFact[]): AreaState {
  if (state !== "stated") return state;
  const sec = TAXONOMY.find((s) => s.key === sectionKey);
  if (!sec || sec.paths.length === 0) return state;
  const standing = facts.filter((f) => !f.struck && f.provenance === "stated");
  const covered = sec.paths.every((p) => standing.some((f) => f.path === p));
  return covered ? "confirmed" : "stated";
}

export type JourneyStates = { evaluation: AreaState | "ready"; publication: AreaState | "ready"; responses: AreaState | "ready" };

/** The journey areas from the sign chain's real state: nothing here is a
 *  presentation choice. Evaluation is ready when a graded fit stands;
 *  publication is ready when the gate is passable, needs_attention while
 *  questions block labelled assumptions; responses exist only after a
 *  real publish. */
export function deriveJourneyStates(input: { fitGraded: boolean; readyToSign: boolean; openQuestions: number; published: boolean }): JourneyStates {
  return {
    evaluation: input.fitGraded ? "ready" : "example",
    publication: input.published ? "ready" : input.readyToSign ? (input.openQuestions > 0 ? "needs_attention" : "ready") : "example",
    responses: input.published ? "ready" : "example",
  };
}
