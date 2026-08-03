/**
 * Session activity diff (Milestone 1, Commit 2): a pure, presentation-only
 * helper that turns one mergeUpdates() call into the buyer-visible list of
 * "Session activity" entries (Ruling 1/4: temporary, session-scoped, never
 * called "history" — Article 9's real append-only record only begins at
 * real Project creation).
 *
 * This module does not merge anything itself. It is handed the ledger
 * before a mergeUpdates() call, the ledger after that same call, the exact
 * FieldUpdate[] batch that produced it, and the cycle number that call
 * used, and it reconstructs — from fact identity and cycle data only,
 * never from rendered prose or human labels (Revision 3 requirement 9) —
 * which facts that specific call actually touched and how.
 *
 * Identity + cycle, not cycle alone: the set of ids considered is derived
 * by exploding `updates` with the same (path, value) -> id rule draft.ts's
 * mergeUpdates() itself uses (LIST_FACT_PATHS + factId()), so a fact that
 * happens to share this cycle number for an unrelated reason can never be
 * misattributed to this batch. A candidate id only becomes a SessionChange
 * if it is BOTH derived from `updates` AND stamped with `cycle` in `after`
 * (mergeUpdates only stamps cycle on facts it actually touched — see
 * draft.ts's mergeUpdates: unchanged same-value facts, and struck facts
 * that didn't qualify to return, are left untouched and keep their old
 * cycle, which is exactly why the cycle check alone already satisfies
 * requirements 5 and 6; the identity check makes it not the *only* guard).
 *
 * Finding worth recording: list/PKM-path facts can never produce a
 * "corrected" action. factId() folds the value itself into a list fact's
 * id (`${path}:${norm(value)}`), so any value change for a list path is
 * structurally a *new* id, not a same-id mutation — it always lands in
 * the added/inferred branch below, never corrected. Only scalar-path
 * facts (whose id is the bare path, independent of value) can have their
 * value overwritten in place, which is the only way "corrected" occurs.
 *
 * Edge case, flagged rather than silently resolved (no test scenario in
 * the Commit 2 instructions covers it): a struck fact that is un-struck
 * this cycle by a stated/answer update (draft.ts mergeUpdates, the
 * `existing.struck` branch) has an id that already existed in `before`
 * (the struck fact is still present in the ledger, just excluded from
 * standing()), so this helper reports it as "corrected", with
 * previousValue set to the struck fact's old (pre-strike) value. That is
 * the same bucket a genuine value correction uses; there is no separate
 * "restored" action in Revision 3's three-action taxonomy. If a buyer
 * struck a fact and then re-stated the SAME value, this will render as a
 * "corrected" entry whose previousValue === nextValue, visually identical
 * to the inferred-to-stated upgrade case (requirement 7) even though the
 * underlying event is different (a resurrection, not a provenance
 * upgrade). Flagging this rather than inventing a new action, per the
 * Commit 2 instruction to stop and report ambiguity instead of inventing
 * behaviour.
 */

import { factId, type WorkspaceFact } from "@/lib/workspace/draft";
import { LIST_FACT_PATHS, type AllowedPath, type FieldUpdate } from "@/lib/workspace/extract";

export type SessionChange = {
  path: AllowedPath;
  action: "added" | "corrected" | "inferred";
  /** Present only for "corrected". */
  previousValue?: unknown;
  nextValue: unknown;
  provenance: "stated" | "inferred";
  quote?: string;
  reason?: string;
};

/**
 * Mirrors draft.ts's private explode(): a list-path update carrying an
 * array value becomes one id per array element; every other update is one
 * id for its own (path, value). Reproduced locally because explode() is
 * not exported (Commit 2 must not modify draft.ts) — factId() and
 * LIST_FACT_PATHS, the two pieces that actually determine identity, are
 * both imported from the authoritative modules rather than re-derived.
 */
function explodedIds(updates: FieldUpdate[]): Array<{ path: AllowedPath; id: string }> {
  const out: Array<{ path: AllowedPath; id: string }> = [];
  for (const u of updates) {
    if (LIST_FACT_PATHS.has(u.path) && Array.isArray(u.value)) {
      for (const v of u.value) {
        out.push({ path: u.path, id: factId(u.path, v) });
      }
    } else {
      out.push({ path: u.path, id: factId(u.path, u.value) });
    }
  }
  return out;
}

/**
 * Compute the temporary "Session activity" entries for one mergeUpdates()
 * call. Pure: reads before/after/updates, never writes to any of them.
 */
export function computeSessionChanges(
  before: WorkspaceFact[],
  after: WorkspaceFact[],
  updates: FieldUpdate[],
  cycle: number,
): SessionChange[] {
  const beforeById = new Map(before.map((f) => [f.id, f]));
  const afterById = new Map(after.map((f) => [f.id, f]));

  const changes: SessionChange[] = [];
  const seen = new Set<string>();

  for (const { id } of explodedIds(updates)) {
    if (seen.has(id)) continue; // "recorded exactly once", even if `updates` names the same fact twice

    const afterFact = afterById.get(id);
    if (!afterFact) continue; // proposal was invalid/dropped upstream of merge; nothing to report
    if (afterFact.cycle !== cycle) continue; // mergeUpdates left this fact untouched this call (§5/§6)

    seen.add(id);

    const beforeFact = beforeById.get(id);
    if (!beforeFact) {
      // Brand new fact this cycle: the only case that creates a new id.
      changes.push({
        path: afterFact.path,
        action: afterFact.provenance === "stated" ? "added" : "inferred",
        nextValue: afterFact.value,
        provenance: afterFact.provenance,
        quote: afterFact.quote,
        reason: afterFact.reason,
      });
    } else {
      // Same id, touched this cycle: a scalar correction, an
      // inferred-to-stated same-value upgrade (requirement 7), or a
      // struck-fact resurrection (flagged above) — Revision 3 gives none
      // of these a separate action, so all three render as "corrected".
      changes.push({
        path: afterFact.path,
        action: "corrected",
        previousValue: beforeFact.value,
        nextValue: afterFact.value,
        provenance: afterFact.provenance,
        quote: afterFact.quote,
        reason: afterFact.reason,
      });
    }
  }

  return changes;
}
