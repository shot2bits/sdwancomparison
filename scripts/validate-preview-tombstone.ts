/**
 * Build gate for the preview tombstone helper (Milestone 1, Commit 3):
 * proves src/components/preview/tombstone-preview.ts reproduces
 * ProjectDesk.tsx's `neverReinfer` mechanism exactly.
 *
 * Every fixture below encodes the CURRENT live rule as read directly from
 * ProjectDesk.tsx (lines 729-733, 795, 1119-1127):
 *   - identity key:      `${path}::${String(value)}`               (nrKey, line 733)
 *   - filter predicate:  provenance === "inferred" && tombstones.has(key)   (line 795)
 *   - record operation:  add key only when provenance === "inferred"        (line 1122)
 *   - no removal exists anywhere in the source (verified: exactly 3
 *     references to `neverReinfer` in the whole file, none a delete/clear).
 *
 * Does not import ProjectDesk.tsx (a React component with hooks; the
 * fixtures instead encode its verified rule as plain data/assertions).
 *
 * Not yet wired into `npm run validate` — see the Commit 3 report for why.
 */

import {
  createTombstoneSet,
  tombstoneKey,
  recordDroppedInference,
  filterTombstonedUpdates,
} from "../src/components/preview/tombstone-preview";
import type { FieldUpdate } from "../src/lib/workspace/extract";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function expect(cond: boolean, msg: string) {
  if (cond) pass += 1;
  else { fail += 1; failures.push(msg); }
}

/* 1. Dropped inferred fact, identical later inferred proposal: suppressed. */
{
  const tombstones = createTombstoneSet();
  recordDroppedInference(tombstones, "estate.users", 250, "inferred");
  const updates: FieldUpdate[] = [{ path: "estate.users", value: 250, provenance: "inferred", reason: "sector average" }];
  const result = filterTombstonedUpdates(updates, tombstones);
  expect(result.length === 0, `[1] expected the repeated identical inferred proposal to be suppressed, got ${result.length} survivors`);
}

/* 2. Dropped inferred fact, identical later STATED proposal: allowed. ---- */
{
  const tombstones = createTombstoneSet();
  recordDroppedInference(tombstones, "estate.users", 250, "inferred");
  const updates: FieldUpdate[] = [{ path: "estate.users", value: 250, provenance: "stated", quote: "we have 250 staff" }];
  const result = filterTombstonedUpdates(updates, tombstones);
  expect(result.length === 1, `[2] expected the stated proposal to pass despite the tombstone, got ${result.length} survivors`);
  expect(result[0] === updates[0], `[2] expected the surviving update to be the same object reference`);
}

/* 3. Same path, different value: proved from source, not assumed. ------- */
/*    nrKey embeds the value, so a different value produces a different   */
/*    key and is therefore NOT suppressed, even though it is inferred.    */
{
  const tombstones = createTombstoneSet();
  recordDroppedInference(tombstones, "estate.users", 250, "inferred");
  expect(
    tombstoneKey("estate.users", 250) !== tombstoneKey("estate.users", 300),
    `[3] expected different values to produce different tombstone keys`,
  );
  const updates: FieldUpdate[] = [{ path: "estate.users", value: 300, provenance: "inferred", reason: "revised estimate" }];
  const result = filterTombstonedUpdates(updates, tombstones);
  expect(result.length === 1, `[3] expected a differently-valued inferred proposal on the same path to survive, got ${result.length}`);
}

/* 4. Different path, same value: not incorrectly suppressed. ------------ */
{
  const tombstones = createTombstoneSet();
  recordDroppedInference(tombstones, "estate.users", 250, "inferred");
  const updates: FieldUpdate[] = [{ path: "estate.sites", value: 250, provenance: "inferred", reason: "same headcount-derived guess" }];
  const result = filterTombstonedUpdates(updates, tombstones);
  expect(result.length === 1, `[4] expected an inferred proposal on a different path with the same value to survive, got ${result.length}`);
}

/* 5. Multiple tombstones: each behaves independently. -------------------- */
{
  const tombstones = createTombstoneSet();
  recordDroppedInference(tombstones, "estate.users", 250, "inferred");
  recordDroppedInference(tombstones, "organisation.sizeBand", "51-250", "inferred");
  const updates: FieldUpdate[] = [
    { path: "estate.users", value: 250, provenance: "inferred", reason: "a" },
    { path: "organisation.sizeBand", value: "51-250", provenance: "inferred", reason: "b" },
    { path: "estate.sites", value: 10, provenance: "inferred", reason: "c" },
  ];
  const result = filterTombstonedUpdates(updates, tombstones);
  expect(result.length === 1, `[5] expected only the non-tombstoned update to survive, got ${result.length}`);
  expect(result[0]?.path === "estate.sites", `[5] expected the surviving update to be estate.sites, got ${result[0]?.path}`);
}

/* 6. Empty update list: returns an empty list. --------------------------- */
{
  const tombstones = createTombstoneSet();
  recordDroppedInference(tombstones, "estate.users", 250, "inferred");
  const result = filterTombstonedUpdates([], tombstones);
  expect(Array.isArray(result) && result.length === 0, `[6] expected an empty array, got ${JSON.stringify(result)}`);
}

/* 7. Mixed update list: suppress only the prohibited updates, preserve   */
/*    order of every allowed update. --------------------------------------*/
{
  const tombstones = createTombstoneSet();
  recordDroppedInference(tombstones, "estate.users", 250, "inferred");
  const a: FieldUpdate = { path: "organisation.sector", value: "Retail & e-commerce", provenance: "stated", quote: "we're in retail" };
  const b: FieldUpdate = { path: "estate.users", value: 250, provenance: "inferred", reason: "tombstoned, must be dropped" };
  const c: FieldUpdate = { path: "estate.sites", value: 10, provenance: "stated", quote: "10 sites" };
  const d: FieldUpdate = { path: "organisation.regions", value: ["uk"], provenance: "inferred", reason: "not tombstoned" };
  const updates = [a, b, c, d];
  const result = filterTombstonedUpdates(updates, tombstones);
  expect(result.length === 3, `[7] expected 3 surviving updates, got ${result.length}`);
  expect(
    result[0] === a && result[1] === c && result[2] === d,
    `[7] expected surviving order [a, c, d], got ${result.map((u) => u.path).join(", ")}`,
  );
}

/* 8. Scalar and list-path updates: behave exactly as the live            */
/*    implementation, including the array-stringification quirk verified */
/*    from source (nrKey gives list paths no special handling). ----------*/
{
  // 8a. A tombstone recorded against one exploded list-fact value (always
  //     a single value, per dropFact's f.value) suppresses a later
  //     single-element-array proposal for the same path+value, because
  //     String(["Cisco Meraki"]) === "Cisco Meraki" (no comma/brackets).
  const tombstonesA = createTombstoneSet();
  recordDroppedInference(tombstonesA, "estate.namedTechnologies", "Cisco Meraki", "inferred");
  const singleElementUpdate: FieldUpdate[] = [
    { path: "estate.namedTechnologies", value: ["Cisco Meraki"], provenance: "inferred", reason: "seen in prior notes" },
  ];
  const resultA = filterTombstonedUpdates(singleElementUpdate, tombstonesA);
  expect(resultA.length === 0, `[8a] expected the single-element-array proposal to be suppressed, got ${resultA.length}`);

  // 8b. The same tombstone does NOT suppress a multi-element-array
  //     proposal that happens to include the tombstoned value, because
  //     the joined key ("estate.namedTechnologies::Cisco Meraki,Fortinet")
  //     never matches the single-value tombstone key. This is the live
  //     behaviour as written, not a gap this helper closes.
  const tombstonesB = createTombstoneSet();
  recordDroppedInference(tombstonesB, "estate.namedTechnologies", "Cisco Meraki", "inferred");
  const multiElementUpdate: FieldUpdate[] = [
    { path: "estate.namedTechnologies", value: ["Cisco Meraki", "Fortinet"], provenance: "inferred", reason: "seen in prior notes" },
  ];
  const resultB = filterTombstonedUpdates(multiElementUpdate, tombstonesB);
  expect(resultB.length === 1, `[8b] expected the multi-element-array proposal to survive (joined key does not match), got ${resultB.length}`);

  // 8c. Ordinary scalar-path parity (already covered structurally by
  //     cases 1-4, restated here explicitly under the "scalar vs list"
  //     requirement for completeness).
  const tombstonesC = createTombstoneSet();
  recordDroppedInference(tombstonesC, "estate.users", 250, "inferred");
  const scalarUpdate: FieldUpdate[] = [{ path: "estate.users", value: 250, provenance: "inferred", reason: "x" }];
  const resultC = filterTombstonedUpdates(scalarUpdate, tombstonesC);
  expect(resultC.length === 0, `[8c] expected the tombstoned scalar proposal to be suppressed, got ${resultC.length}`);
}

/* 9. Input immutability: neither the updates array nor its objects are   */
/*    mutated. ------------------------------------------------------------*/
{
  const tombstones = createTombstoneSet();
  recordDroppedInference(tombstones, "estate.users", 250, "inferred");
  const updates: FieldUpdate[] = [
    { path: "estate.users", value: 250, provenance: "inferred", reason: "tombstoned" },
    { path: "estate.sites", value: 10, provenance: "stated", quote: "10 sites" },
  ];
  const before = JSON.stringify(updates);
  const result = filterTombstonedUpdates(updates, tombstones);
  expect(JSON.stringify(updates) === before, `[9] the input "updates" array or its objects were mutated`);
  expect(updates.length === 2, `[9] the input "updates" array length changed`);
  expect(result[0] === updates[1], `[9] expected the surviving item to be the SAME object reference as the input, not a copy`);
}

/* 10. Tombstone mutation: filtering must not mutate the tombstone set;   */
/*     only recordDroppedInference may add. --------------------------------*/
{
  const tombstones = createTombstoneSet();
  recordDroppedInference(tombstones, "estate.users", 250, "inferred");
  const sizeBefore = tombstones.size;
  const contentsBefore = [...tombstones].sort();

  filterTombstonedUpdates(
    [
      { path: "estate.users", value: 250, provenance: "inferred", reason: "x" },
      { path: "estate.sites", value: 10, provenance: "inferred", reason: "y" },
      { path: "estate.users", value: 250, provenance: "stated", quote: "z" },
    ],
    tombstones,
  );

  expect(tombstones.size === sizeBefore, `[10] filtering changed the tombstone set's size`);
  expect(
    JSON.stringify([...tombstones].sort()) === JSON.stringify(contentsBefore),
    `[10] filtering changed the tombstone set's contents`,
  );

  // recordDroppedInference is the only operation that may add.
  recordDroppedInference(tombstones, "estate.sites", 10, "inferred");
  expect(tombstones.size === sizeBefore + 1, `[10] recordDroppedInference did not add a new tombstone`);

  // A stated proposal is a no-op for recording (mirrors dropFact's own
  // guard, which only ever calls .add() for an inferred fact).
  const sizeAfterAdd = tombstones.size;
  recordDroppedInference(tombstones, "organisation.sector", "Retail & e-commerce", "stated");
  expect(tombstones.size === sizeAfterAdd, `[10] recordDroppedInference added a tombstone for a stated fact, which the live dropFact never does`);
}

/* 11. Later stated assertion: must not silently remove the tombstone —   */
/*     the live source never deletes anything, so the entry must still   */
/*     be present after a stated update with the same key passes through. */
{
  const tombstones = createTombstoneSet();
  recordDroppedInference(tombstones, "estate.users", 250, "inferred");
  const key = tombstoneKey("estate.users", 250);
  expect(tombstones.has(key), `[11] sanity check: tombstone should be present before filtering`);

  const updates: FieldUpdate[] = [{ path: "estate.users", value: 250, provenance: "stated", quote: "we have 250 staff" }];
  const result = filterTombstonedUpdates(updates, tombstones);

  expect(result.length === 1, `[11] expected the stated proposal to pass through`);
  expect(tombstones.has(key), `[11] the tombstone must still be present after a stated proposal passes through — the source never removes it`);
}

console.log(`preview-tombstone: ${pass} checks pass (${fail} fail)`);
if (fail > 0) {
  console.error(failures.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
