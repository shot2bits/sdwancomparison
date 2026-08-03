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
import { computeSessionChanges } from "../src/components/preview/session-diff";

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

console.log(`session-diff: ${pass} checks pass (${fail} fail)`);
if (fail > 0) {
  console.error(failures.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
