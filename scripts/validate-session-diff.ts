/**
 * Build gate for computeSessionChanges() (Milestone 1, Commit 2): the
 * "Session activity" surface must derive its entries purely from ledger
 * fact identity and cycle data, matching mergeUpdates()'s own semantics
 * exactly, never from rendered prose or human labels.
 *
 * Every scenario here drives the REAL, unmodified mergeUpdates() from
 * draft.ts to produce `after` from `before` + `updates` + `cycle`, then
 * asserts what computeSessionChanges() reports for that exact call — so
 * this gate breaks if session-diff.ts's classification ever drifts from
 * production merge behaviour, not just from a hand-written expectation.
 *
 * Not yet wired into `npm run validate` — see the Commit 2 report for why.
 */

import { mergeUpdates, factId, type WorkspaceFact } from "../src/lib/workspace/draft";
import type { FieldUpdate } from "../src/lib/workspace/extract";
import {
  computeSessionChanges,
  type SessionChange,
  type BoundedClarification,
  type SessionActivityEntry,
} from "../src/components/preview/session-diff";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function expect(cond: boolean, msg: string) {
  if (cond) pass += 1;
  else { fail += 1; failures.push(msg); }
}

/* 1. New stated scalar fact -> "added". ------------------------------ */
{
  const before: WorkspaceFact[] = [];
  const updates: FieldUpdate[] = [
    { path: "organisation.sizeBand", value: "51-250", provenance: "stated", quote: "we're a mid-size firm, about 200 staff" },
  ];
  const after = mergeUpdates(before, updates, 1, "extract").facts;
  const changes = computeSessionChanges(before, after, updates, 1);

  expect(changes.length === 1, `[1] expected 1 change, got ${changes.length}`);
  const c = changes[0];
  expect(c?.action === "added", `[1] expected action "added", got ${c?.action}`);
  expect(c?.path === "organisation.sizeBand", `[1] unexpected path ${c?.path}`);
  expect(c?.nextValue === "51-250", `[1] unexpected nextValue ${c?.nextValue}`);
  expect(c?.previousValue === undefined, `[1] expected no previousValue on an addition`);
  expect(c?.provenance === "stated", `[1] unexpected provenance ${c?.provenance}`);
  expect(c?.quote === "we're a mid-size firm, about 200 staff", `[1] quote not preserved`);
}

/* 2. New inferred scalar fact -> "inferred". -------------------------- */
{
  const before: WorkspaceFact[] = [];
  const updates: FieldUpdate[] = [
    { path: "estate.users", value: 200, provenance: "inferred", reason: "derived from the stated size band" },
  ];
  const after = mergeUpdates(before, updates, 1, "extract").facts;
  const changes = computeSessionChanges(before, after, updates, 1);

  expect(changes.length === 1, `[2] expected 1 change, got ${changes.length}`);
  const c = changes[0];
  expect(c?.action === "inferred", `[2] expected action "inferred", got ${c?.action}`);
  expect(c?.nextValue === 200, `[2] unexpected nextValue ${c?.nextValue}`);
  expect(c?.previousValue === undefined, `[2] expected no previousValue on an addition`);
  expect(c?.reason === "derived from the stated size band", `[2] reason not preserved`);
  expect(c?.quote === undefined, `[2] inferred fact should carry no quote`);
}

/* 3. Corrected scalar fact, 50 -> 52. ---------------------------------- */
{
  const before = mergeUpdates(
    [],
    [{ path: "estate.users", value: 50, provenance: "stated", quote: "we have 50 staff" }],
    1,
    "extract",
  ).facts;
  const updates: FieldUpdate[] = [
    { path: "estate.users", value: 52, provenance: "stated", quote: "sorry, actually 52 staff" },
  ];
  const after = mergeUpdates(before, updates, 2, "extract").facts;
  const changes = computeSessionChanges(before, after, updates, 2);

  expect(changes.length === 1, `[3] expected 1 change, got ${changes.length}`);
  const c = changes[0];
  expect(c?.action === "corrected", `[3] expected action "corrected", got ${c?.action}`);
  expect(c?.previousValue === 50, `[3] expected previousValue 50, got ${c?.previousValue}`);
  expect(c?.nextValue === 52, `[3] expected nextValue 52, got ${c?.nextValue}`);
  expect(c?.quote === "sorry, actually 52 staff", `[3] quote not updated to the new stated quote`);
}

/* 4. New PKM list fact, matched by id, recorded exactly once each. ---- */
{
  const before: WorkspaceFact[] = [];
  const updates: FieldUpdate[] = [
    {
      path: "estate.namedTechnologies",
      value: ["Cisco Meraki", "Fortinet"],
      provenance: "stated",
      quote: "we run Cisco Meraki and Fortinet",
    },
  ];
  const after = mergeUpdates(before, updates, 1, "extract").facts;
  const changes = computeSessionChanges(before, after, updates, 1);

  expect(changes.length === 2, `[4] expected 2 changes (one per list value), got ${changes.length}`);
  expect(changes.every((c) => c.path === "estate.namedTechnologies"), `[4] unexpected path in list changes`);
  expect(changes.every((c) => c.action === "added"), `[4] expected all list additions to be "added"`);
  const values = changes.map((c) => c.nextValue).sort();
  expect(
    JSON.stringify(values) === JSON.stringify(["Cisco Meraki", "Fortinet"]),
    `[4] expected both named technologies present exactly once, got ${JSON.stringify(values)}`,
  );
  const ids = new Set(changes.map((c) => factId(c.path, c.nextValue)));
  expect(ids.size === 2, `[4] expected 2 distinct fact ids, got ${ids.size}`);
}

/* 5. Unchanged fact (same value, same provenance, resubmitted) is       */
/*    excluded: mergeUpdates() performs no mutation, so cycle is not     */
/*    re-stamped. -------------------------------------------------------*/
{
  const before = mergeUpdates(
    [],
    [{ path: "organisation.sector", value: "Retail & e-commerce", provenance: "stated", quote: "we're in retail" }],
    1,
    "extract",
  ).facts;
  const updates: FieldUpdate[] = [
    { path: "organisation.sector", value: "Retail & e-commerce", provenance: "stated", quote: "we're in retail" },
  ];
  const after = mergeUpdates(before, updates, 2, "extract").facts;
  const changes = computeSessionChanges(before, after, updates, 2);

  expect(changes.length === 0, `[5] expected 0 changes for an unchanged resubmission, got ${changes.length}`);
}

/* 6. A fact untouched this cycle must not appear, even though it exists */
/*    in both before and after alongside a fact that WAS touched. ------ */
{
  const before = mergeUpdates(
    [],
    [
      { path: "organisation.sizeBand", value: "51-250", provenance: "stated", quote: "about 200 staff" },
      { path: "organisation.sector", value: "Retail & e-commerce", provenance: "stated", quote: "we're in retail" },
    ],
    1,
    "extract",
  ).facts;
  const updates: FieldUpdate[] = [
    { path: "organisation.sizeBand", value: "251-1000", provenance: "stated", quote: "actually more like 500 staff" },
  ];
  const after = mergeUpdates(before, updates, 2, "extract").facts;
  const changes = computeSessionChanges(before, after, updates, 2);

  expect(changes.length === 1, `[6] expected 1 change (sector untouched), got ${changes.length}`);
  expect(changes[0]?.path === "organisation.sizeBand", `[6] unexpected path ${changes[0]?.path}`);
  expect(
    !changes.some((c) => c.path === "organisation.sector"),
    `[6] the untouched sector fact leaked into the diff`,
  );
}

/* 7. Inferred -> stated upgrade with an unchanged value: classified as  */
/*    "corrected" with previousValue === nextValue (Revision 3 §7). ---- */
{
  const before = mergeUpdates(
    [],
    [{ path: "estate.users", value: 100, provenance: "inferred", reason: "estimated from sector average" }],
    1,
    "extract",
  ).facts;
  const updates: FieldUpdate[] = [
    { path: "estate.users", value: 100, provenance: "stated", quote: "we have 100 staff" },
  ];
  const after = mergeUpdates(before, updates, 2, "extract").facts;
  const changes = computeSessionChanges(before, after, updates, 2);

  expect(changes.length === 1, `[7] expected 1 change, got ${changes.length}`);
  const c = changes[0];
  expect(c?.action === "corrected", `[7] expected action "corrected" (no "confirmed" action in this commit), got ${c?.action}`);
  expect(c?.previousValue === 100 && c?.nextValue === 100, `[7] expected previousValue === nextValue === 100`);
  expect(c?.provenance === "stated", `[7] expected the upgraded provenance "stated"`);
  expect(c?.quote === "we have 100 staff", `[7] quote not preserved on the upgrade`);
}

/* 8. Empty cycle returns an empty array. ------------------------------- */
{
  const changes = computeSessionChanges([], [], [], 1);
  expect(Array.isArray(changes) && changes.length === 0, `[8] expected an empty array, got ${JSON.stringify(changes)}`);
}

/* 9. Input arrays (and their fact objects) are not mutated. ----------- */
{
  const before = mergeUpdates(
    [],
    [{ path: "estate.users", value: 50, provenance: "stated", quote: "we have 50 staff" }],
    1,
    "extract",
  ).facts;
  const updates: FieldUpdate[] = [
    { path: "estate.users", value: 52, provenance: "stated", quote: "sorry, actually 52 staff" },
  ];
  const after = mergeUpdates(before, updates, 2, "extract").facts;

  const beforeSnapshot = JSON.stringify(before);
  const afterSnapshot = JSON.stringify(after);
  const updatesSnapshot = JSON.stringify(updates);

  computeSessionChanges(before, after, updates, 2);

  expect(JSON.stringify(before) === beforeSnapshot, `[9] "before" array was mutated`);
  expect(JSON.stringify(after) === afterSnapshot, `[9] "after" array was mutated`);
  expect(JSON.stringify(updates) === updatesSnapshot, `[9] "updates" array was mutated`);
}

/* 10. Flagged edge case (not one of the 9 named scenarios): a struck    */
/*     fact resurrected by a stated update this cycle. mergeUpdates()    */
/*     has no separate "restored" outcome, so this renders as            */
/*     "corrected", visually identical to an inferred->stated upgrade    */
/*     when the resurrected value is unchanged. Documented, not silently */
/*     resolved — see the Commit 2 report. ------------------------------*/
{
  const before: WorkspaceFact[] = [
    {
      path: "drivers",
      value: "renewal",
      provenance: "stated",
      quote: "contract renewal coming up",
      id: factId("drivers", "renewal"),
      struck: true,
      source: "extract",
      cycle: 1,
    },
  ];
  const updates: FieldUpdate[] = [
    { path: "drivers", value: "renewal", provenance: "stated", quote: "yes, renewal is driving this" },
  ];
  const after = mergeUpdates(before, updates, 2, "extract").facts;
  const changes = computeSessionChanges(before, after, updates, 2);

  expect(changes.length === 1, `[10] expected 1 change for the resurrection, got ${changes.length}`);
  const c = changes[0];
  expect(c?.action === "corrected", `[10] expected the resurrection to fall into "corrected", got ${c?.action}`);
  expect(
    c?.previousValue === "renewal" && c?.nextValue === "renewal",
    `[10] expected previousValue === nextValue === "renewal" for this same-value resurrection`,
  );
}

/* ---------------------------------------------------------------------- */
/* Commit 9A: BoundedClarification / SessionActivityEntry.                */
/*                                                                        */
/* These are type-only additions — no constructor, no function, nothing  */
/* that runs. Two different kinds of guarantee are being checked below,  */
/* and they are NOT the same strength:                                   */
/*                                                                        */
/* COMPILE-TIME (enforced by `npx tsc --noEmit`, not by this script at   */
/* runtime): that a `SessionActivityEntry` object literal with a given   */
/* `kind` is structurally assignable to the type at all — i.e. that      */
/* `cycle` is a number, `kind` is one of the three literal strings,      */
/* `changes` is a `SessionChange[]`, and `clarification`, when present,  */
/* matches `BoundedClarification`. Tests 11-13 below only compile in the */
/* first place because of this — if, say, `cycle` were assigned a        */
/* string, `tsc --noEmit` would fail this whole script before it ever    */
/* ran. That is the compile-time half of the contract.                   */
/*                                                                        */
/* RUNTIME ONLY, NOT COMPILE-TIME ENFORCED: the "by convention" rules in  */
/* session-diff.ts's SessionActivityEntry doc comment — that a            */
/* "clarification" entry's `changes` is empty, that a "no_change" entry's */
/* `changes` is empty AND `clarification` is absent, that a "changes"     */
/* entry's `clarification` is normally absent. The type as specified is   */
/* `{ cycle: number; kind: "changes" | "clarification" | "no_change";     */
/* changes: SessionChange[]; clarification?: BoundedClarification }` —    */
/* `kind` and `clarification`/`changes` are NOT linked by a discriminated */
/* union (that would require, e.g., three separate object types unioned   */
/* on `kind`, each with its own required/absent fields). Structurally,    */
/* nothing stops `{ cycle: 1, kind: "no_change", changes: [...], clarification: {...} }` */
/* from compiling — `tsc --noEmit` will accept it. So the convention      */
/* rules can only be checked by constructing fixtures and asserting on    */
/* them at runtime, which is what tests 11-13 do; they are NOT a          */
/* guarantee the type system enforces for every possible caller.         */
/* ---------------------------------------------------------------------- */

/* 11. Valid "changes" entry: built from computeSessionChanges()'s own   */
/*     output (scenario 1's addition), clarification normally absent.    */
{
  const before: WorkspaceFact[] = [];
  const updates: FieldUpdate[] = [
    { path: "organisation.sizeBand", value: "51-250", provenance: "stated", quote: "about 200 staff" },
  ];
  const after = mergeUpdates(before, updates, 1, "extract").facts;
  const changes: SessionChange[] = computeSessionChanges(before, after, updates, 1);

  const entry: SessionActivityEntry = {
    cycle: 1,
    kind: "changes",
    changes,
  };

  expect(entry.kind === "changes", `[11] expected kind "changes", got ${entry.kind}`);
  expect(entry.changes.length === 1, `[11] expected 1 change carried on the entry, got ${entry.changes.length}`);
  expect(entry.changes[0] === changes[0], `[11] entry.changes should carry the same SessionChange objects, not copies`);
  expect(entry.clarification === undefined, `[11] a "changes" entry should normally have no clarification`);
}

/* 12. Valid "clarification" entry: changes empty, clarification carries */
/*     the given question/explanation preserved exactly (including       */
/*     punctuation/whitespace, to catch any accidental trimming or       */
/*     reformatting). ---------------------------------------------------*/
{
  const clarification: BoundedClarification = {
    question: "How many sites need coverage?",
    explanation: "  Recorded from the buyer's reply — kept exactly as typed, extra spaces and all.  ",
  };
  const entry: SessionActivityEntry = {
    cycle: 3,
    kind: "clarification",
    changes: [],
    clarification,
  };

  expect(entry.kind === "clarification", `[12] expected kind "clarification", got ${entry.kind}`);
  expect(entry.changes.length === 0, `[12] a "clarification" entry's changes should be empty by convention, got ${entry.changes.length}`);
  expect(entry.clarification !== undefined, `[12] expected clarification to be present`);
  expect(
    entry.clarification?.question === "How many sites need coverage?",
    `[12] question not preserved exactly, got ${JSON.stringify(entry.clarification?.question)}`,
  );
  expect(
    entry.clarification?.explanation ===
      "  Recorded from the buyer's reply — kept exactly as typed, extra spaces and all.  ",
    `[12] explanation not preserved exactly (byte-for-byte, including surrounding whitespace), got ${JSON.stringify(entry.clarification?.explanation)}`,
  );
}

/* 12b. `question` is optional on BoundedClarification — a clarification */
/*      entry with only `explanation` must also be valid and preserved.  */
{
  const clarification: BoundedClarification = {
    explanation: "No open question for this turn, just a recorded explanation.",
  };
  const entry: SessionActivityEntry = {
    cycle: 4,
    kind: "clarification",
    changes: [],
    clarification,
  };

  expect(entry.clarification?.question === undefined, `[12b] expected no question when none was supplied`);
  expect(
    entry.clarification?.explanation === "No open question for this turn, just a recorded explanation.",
    `[12b] explanation not preserved exactly when question is absent`,
  );
}

/* 13. Valid "no_change" entry: changes empty, clarification absent. ---- */
{
  const entry: SessionActivityEntry = {
    cycle: 5,
    kind: "no_change",
    changes: [],
  };

  expect(entry.kind === "no_change", `[13] expected kind "no_change", got ${entry.kind}`);
  expect(entry.changes.length === 0, `[13] a "no_change" entry's changes should be empty, got ${entry.changes.length}`);
  expect(entry.clarification === undefined, `[13] a "no_change" entry should have no clarification`);
}

/* 14. Entry and nested arrays remain unmodified: constructing a          */
/*     SessionActivityEntry around computeSessionChanges()'s output must  */
/*     not copy or mutate that output — the entry carries the same        */
/*     `changes` array/objects its caller already computed. --------------*/
{
  const before = mergeUpdates(
    [],
    [{ path: "estate.users", value: 50, provenance: "stated", quote: "we have 50 staff" }],
    1,
    "extract",
  ).facts;
  const updates: FieldUpdate[] = [
    { path: "estate.users", value: 52, provenance: "stated", quote: "sorry, actually 52 staff" },
  ];
  const after = mergeUpdates(before, updates, 2, "extract").facts;
  const changes = computeSessionChanges(before, after, updates, 2);
  const changesSnapshot = JSON.stringify(changes);

  const entry: SessionActivityEntry = { cycle: 2, kind: "changes", changes };

  expect(JSON.stringify(changes) === changesSnapshot, `[14] "changes" array was mutated by being carried on an entry`);
  expect(JSON.stringify(entry.changes) === changesSnapshot, `[14] entry.changes diverged from the original changes array`);
  expect(entry.changes === changes, `[14] entry.changes should be the exact same array reference, not a copy`);
}

/* 15. computeSessionChanges() itself is completely unchanged by Commit   */
/*     9A: tests 1-10 above are the original Commit 2 assertions, run     */
/*     verbatim with no edits. Their pass/fail is folded into the same    */
/*     pass/fail counters checked below, so this script fails as a whole  */
/*     if Commit 9A regressed any pre-existing behaviour. ------------------*/

console.log(`session-diff: ${pass} checks pass (${fail} fail)`);
if (fail > 0) {
  console.error(failures.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
