/**
 * Preview-only tombstone parity helper (Milestone 1, Commit 3): a literal
 * mirror of ProjectDesk.tsx's `neverReinfer` mechanism, isolated so the
 * Understanding preview can reuse "dropped inferences never return"
 * (rule 7) before any new UI depends on it, without touching the live
 * desk. This commit adds NO new behaviour — every operation below is
 * verified against ProjectDesk.tsx's actual source, not against an
 * earlier summary of it.
 *
 * Source verified directly (src/components/ProjectDesk.tsx):
 *
 *   729   /** Dropped inferences never return (rule 7): once a guess is
 *   730    *  dropped, the extractor may not re-infer the same path and
 *   731    *  value. A later STATED assertion still lands: saying it is
 *   732    *  the buyer's own act. *\/
 *   732   const neverReinfer = useRef<Set<string>>(new Set());
 *   733   const nrKey = (path: string, value: unknown) => `${path}::${String(value)}`;
 *   ...
 *   795   const allowed = updates.filter((u) => !(u.provenance === "inferred" && neverReinfer.current.has(nrKey(u.path, u.value))));
 *   ...
 *   1122  if (f.provenance === "inferred") neverReinfer.current.add(nrKey(f.path, f.value));
 *
 * Those three lines are the entire live mechanism — `neverReinfer` is
 * referenced nowhere else in ProjectDesk.tsx (verified: exactly three
 * matches for the identifier in the whole file). There is no `.delete()`
 * or `.clear()` anywhere. A later stated assertion is never blocked
 * because the filter predicate on line 795 only applies when
 * `provenance === "inferred"` — the tombstone entry itself is never
 * removed. This helper mirrors that exactly: it offers no "remove" or
 * "clear" operation, because the source has none.
 *
 * Parity notes, not redesign choices — each one is the live rule, proved
 * from source rather than assumed:
 *
 * - Identity key: `${path}::${String(value)}`, EXACTLY nrKey's own rule.
 *   No normalisation (no trim, no lowercasing), unlike draft.ts's
 *   norm()/factId(). A tombstone's identity is deliberately left as
 *   coarse/strict as the live code's, not aligned with the ledger's own
 *   fact-identity rule.
 *
 * - The filter predicate is `provenance === "inferred" && tombstones.has(key)`,
 *   not a general "this path+value is blocked" rule: a stated update with
 *   a tombstoned path+value key is never filtered, matching line 795
 *   exactly (the `u.provenance === "inferred"` guard is evaluated first).
 *
 * - List paths receive NO special handling in the live code, so this
 *   helper gives them none either. nrKey stringifies whatever `value` is.
 *   A raw (pre-explode) FieldUpdate for a list path can carry an ARRAY of
 *   values (draft.ts's own explode() branches on `Array.isArray(u.value)`
 *   for exactly this reason — LIST_FACT_PATHS-driven updates are not
 *   always pre-split before reaching merge). `String()` on an array joins
 *   with commas EXCEPT for a single-element array, which stringifies to
 *   just that element with no punctuation (`String(["Cisco Meraki"]) ===
 *   "Cisco Meraki"`, a plain JS Array.prototype.toString quirk — not
 *   something this helper introduces). Concretely, verified from source:
 *     - a tombstone recorded against one exploded WorkspaceFact value
 *       (dropFact's f.value, line 1122, is always a single value, never
 *       an array) CAN later suppress a single-element-array list update
 *       for the same path+value, because the two stringify identically;
 *     - it will NOT suppress a multi-element-array list update, even one
 *       that includes the tombstoned value among others, because the
 *       joined string never matches a single-value key.
 *   This is the live behaviour as written, not a gap this helper closes.
 *
 * No redesign: this file does not change the identity rule, does not
 * normalise values, introduces no timestamps or persistence, introduces
 * no new action taxonomy, does not touch mergeUpdates()/extractRequirement()/
 * WorkspaceFact, and does not touch ProjectDesk.tsx. It stays under
 * src/components/preview/ — experimental preview infrastructure only,
 * not a shared production tombstone module.
 */

import type { FieldUpdate, Provenance } from "@/lib/workspace/extract";

/** Same shape as the live `neverReinfer` ref's value: a plain Set of
 *  composite string keys. Ownership and lifetime (e.g. holding it in a
 *  React ref for the life of a preview session) are the caller's concern;
 *  this module adds no persistence of its own, matching the live code. */
export type TombstoneSet = Set<string>;

/** Creates a new, empty, owned tombstone set — mirrors the live
 *  `useRef<Set<string>>(new Set())`'s initial value. */
export function createTombstoneSet(): TombstoneSet {
  return new Set<string>();
}

/** The exact composite identity ProjectDesk.tsx's nrKey computes:
 *  `${path}::${String(value)}`. No trimming, no case-folding, no
 *  per-list-item splitting — reproduced verbatim, not "cleaned up". */
export function tombstoneKey(path: string, value: unknown): string {
  return `${path}::${String(value)}`;
}

/**
 * Records a dropped inferred path/value (mirrors dropFact's line 1122
 * exactly: `if (f.provenance === "inferred") neverReinfer.current.add(nrKey(f.path, f.value))`).
 *
 * Scope note: this mirrors only that one guarded `.add()`, not the whole
 * of dropFact — dropFact also strikes the fact in the ledger (lines
 * 1119-1127), which is separate, out-of-scope fact-striking behaviour,
 * not part of the tombstone mechanism itself. Mutates `tombstones` in
 * place via `.add()`, exactly like the live ref's Set — this is the one
 * operation permitted to add a tombstone.
 *
 * A no-op for a stated path/value, matching the live guard: dropFact's
 * call site never invokes the add for a stated fact, so there is no live
 * behaviour to mirror for that case beyond "nothing happens".
 */
export function recordDroppedInference(
  tombstones: TombstoneSet,
  path: string,
  value: unknown,
  provenance: Provenance,
): void {
  if (provenance !== "inferred") return;
  tombstones.add(tombstoneKey(path, value));
}

/**
 * Filters proposed FieldUpdate[] before they would reach mergeUpdates() —
 * mirrors applyMerge's line 795 exactly:
 *   updates.filter((u) => !(u.provenance === "inferred" && neverReinfer.current.has(nrKey(u.path, u.value))))
 *
 * Read-only with respect to `tombstones` (typed ReadonlySet<string> so the
 * compiler itself refuses a `.add()`/`.delete()` here — the same
 * compiler-enforced-guarantee pattern already used by
 * src/lib/workspace/labels.ts's Record<AllowedPath, string>). Does not
 * mutate `updates` or any individual update object; returns a new array
 * via Array.prototype.filter, preserving the order and identity of every
 * surviving update.
 */
export function filterTombstonedUpdates(
  updates: FieldUpdate[],
  tombstones: ReadonlySet<string>,
): FieldUpdate[] {
  return updates.filter(
    (u) => !(u.provenance === "inferred" && tombstones.has(tombstoneKey(u.path, u.value))),
  );
}
