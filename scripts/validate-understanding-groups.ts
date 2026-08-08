/**
 * Build gate for the Understanding grouping contract (Milestone 1,
 * Commit 4): proves the eight buyer-facing groups, their order and
 * titles, and the BriefBlock.key -> UnderstandingGroupId mapping are
 * exactly what Revision 3 specifies, and that groupBriefBlocks() is a
 * pure, order-preserving, loudly-failing grouping function.
 *
 * Blocks are constructed using the real BriefBlock type from draft.ts,
 * with minimal stub `paras` content — this gate is about grouping, not
 * about briefModel()'s prose, so paragraph content is deliberately inert.
 *
 * Not yet wired into `npm run validate` — see the Commit 4 report for why.
 */

import type { BriefBlock } from "../src/lib/workspace/draft";
import {
  UNDERSTANDING_GROUPS,
  BRIEF_BLOCK_KEY_TO_GROUP,
  groupBriefBlocks,
  type UnderstandingGroupId,
} from "../src/components/preview/understanding-groups";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function expect(cond: boolean, msg: string) {
  if (cond) pass += 1;
  else { fail += 1; failures.push(msg); }
}

const stubBlock = (key: string, heading = `heading:${key}`): BriefBlock => ({
  key,
  heading,
  paras: [[{ kind: "text", text: `stub paragraph for ${key}` }]],
});

/* Every BriefBlock key briefModel() currently emits, verified directly
   against src/lib/workspace/draft.ts's blocks.push(...) call sites. */
const EXPECTED_BLOCK_KEYS = [
  "organisation",
  "estate",
  "vendors",
  "locations",
  "drivers",
  "operations",
  "services",
  "scope",
  "bespoke",
  "gaps",
];

/* The full expected key -> group mapping, including the researched
   `services` decision (Security and compliance — see the Commit 4
   report for the reasoning). */
const EXPECTED_MAPPING: Record<string, UnderstandingGroupId> = {
  organisation: "organisation",
  drivers: "objectives_drivers",
  estate: "estate",
  vendors: "technologies_providers",
  locations: "locations_resilience",
  operations: "security_compliance",
  services: "security_compliance",
  scope: "requirements_constraints",
  bespoke: "requirements_constraints",
  gaps: "gaps",
};

/* 1. Exact eight-group order. ------------------------------------------- */
{
  const ids = UNDERSTANDING_GROUPS.map((g) => g.id);
  const expected: UnderstandingGroupId[] = [
    "organisation",
    "objectives_drivers",
    "estate",
    "technologies_providers",
    "locations_resilience",
    "security_compliance",
    "requirements_constraints",
    "gaps",
  ];
  expect(JSON.stringify(ids) === JSON.stringify(expected), `[1] group order mismatch: ${JSON.stringify(ids)}`);
}

/* 2. Exact group titles. -------------------------------------------------- */
{
  const titles = UNDERSTANDING_GROUPS.map((g) => g.title);
  const expected = [
    "Organisation",
    "Objectives and drivers",
    "Current estate",
    "Technologies and providers",
    "Locations and resilience",
    "Security and compliance",
    "Requirements and constraints",
    "Unresolved gaps",
  ];
  expect(JSON.stringify(titles) === JSON.stringify(expected), `[2] group titles mismatch: ${JSON.stringify(titles)}`);
}

/* 3. Every current BriefBlock key has exactly one mapping, matching the  */
/*    verified expectation (including the researched `services` choice). */
{
  for (const key of EXPECTED_BLOCK_KEYS) {
    const mapped = BRIEF_BLOCK_KEY_TO_GROUP[key];
    expect(mapped !== undefined, `[3] BriefBlock key "${key}" has no mapping`);
    expect(mapped === EXPECTED_MAPPING[key], `[3] "${key}" mapped to "${mapped}", expected "${EXPECTED_MAPPING[key]}"`);
  }
}

/* 4. No BriefBlock key maps twice (no accidental duplicate/overwrite in  */
/*    the mapping table: exactly one entry per expected key). ------------ */
{
  const mappedKeys = Object.keys(BRIEF_BLOCK_KEY_TO_GROUP);
  expect(mappedKeys.length === EXPECTED_BLOCK_KEYS.length, `[4] expected ${EXPECTED_BLOCK_KEYS.length} mapped keys, found ${mappedKeys.length}`);
  expect(new Set(mappedKeys).size === mappedKeys.length, `[4] duplicate keys found in the mapping table`);
  for (const key of EXPECTED_BLOCK_KEYS) {
    expect(mappedKeys.includes(key), `[4] expected key "${key}" missing from the mapping table`);
  }
}

/* 5. Input block order preserved within a group. ------------------------- */
{
  const scope = stubBlock("scope");
  const bespoke = stubBlock("bespoke");
  const groups = groupBriefBlocks([scope, bespoke]);
  const reqConstraints = groups.find((g) => g.id === "requirements_constraints")!;
  expect(reqConstraints.blocks.length === 2, `[5] expected 2 blocks in requirements_constraints, got ${reqConstraints.blocks.length}`);
  expect(
    reqConstraints.blocks[0] === scope && reqConstraints.blocks[1] === bespoke,
    `[5] expected [scope, bespoke] order preserved, got [${reqConstraints.blocks.map((b) => b.key).join(", ")}]`,
  );

  // Reversed input must produce reversed output within the group.
  const groupsReversed = groupBriefBlocks([bespoke, scope]);
  const reqConstraintsReversed = groupsReversed.find((g) => g.id === "requirements_constraints")!;
  expect(
    reqConstraintsReversed.blocks[0] === bespoke && reqConstraintsReversed.blocks[1] === scope,
    `[5] expected [bespoke, scope] order when input is reversed`,
  );
}

/* 6. All input blocks present exactly once after grouping. --------------- */
{
  const inputBlocks = EXPECTED_BLOCK_KEYS.map((k) => stubBlock(k));
  const groups = groupBriefBlocks(inputBlocks);
  const allOutputBlocks = groups.flatMap((g) => g.blocks);
  expect(allOutputBlocks.length === inputBlocks.length, `[6] expected ${inputBlocks.length} total blocks after grouping, got ${allOutputBlocks.length}`);
  for (const b of inputBlocks) {
    const occurrences = allOutputBlocks.filter((x) => x === b);
    expect(occurrences.length === 1, `[6] block "${b.key}" appeared ${occurrences.length} times after grouping, expected exactly 1`);
  }
}

/* 7. Empty input produces the eight empty groups, in order. -------------- */
{
  const groups = groupBriefBlocks([]);
  expect(groups.length === 8, `[7] expected 8 groups for empty input, got ${groups.length}`);
  expect(groups.every((g) => g.blocks.length === 0), `[7] expected every group to be empty`);
  expect(
    JSON.stringify(groups.map((g) => g.id)) === JSON.stringify(UNDERSTANDING_GROUPS.map((g) => g.id)),
    `[7] expected group order to match UNDERSTANDING_GROUPS even for empty input`,
  );
}

/* 8. Unknown block key produces the explicit failure. --------------------- */
{
  let threw = false;
  try {
    groupBriefBlocks([stubBlock("some_future_block_key_not_yet_mapped")]);
  } catch {
    threw = true;
  }
  expect(threw, `[8] expected groupBriefBlocks() to throw for an unmapped BriefBlock key`);
}

/* 9. estate remains under Current estate. --------------------------------- */
{
  const estate = stubBlock("estate");
  const groups = groupBriefBlocks([estate]);
  const found = groups.find((g) => g.blocks.includes(estate));
  expect(found?.id === "estate", `[9] expected the estate block under group "estate", found under "${found?.id}"`);
  expect(found?.title === "Current estate", `[9] expected title "Current estate", got "${found?.title}"`);
}

/* 10. operations remains under Security and compliance. ------------------- */
{
  const operations = stubBlock("operations");
  const groups = groupBriefBlocks([operations]);
  const found = groups.find((g) => g.blocks.includes(operations));
  expect(found?.id === "security_compliance", `[10] expected the operations block under "security_compliance", found under "${found?.id}"`);
  expect(found?.title === "Security and compliance", `[10] expected title "Security and compliance", got "${found?.title}"`);
}

/* 11. scope and bespoke share Requirements and constraints. --------------- */
{
  const scope = stubBlock("scope");
  const bespoke = stubBlock("bespoke");
  const groups = groupBriefBlocks([scope, bespoke]);
  const scopeGroup = groups.find((g) => g.blocks.includes(scope));
  const bespokeGroup = groups.find((g) => g.blocks.includes(bespoke));
  expect(scopeGroup?.id === "requirements_constraints", `[11] expected scope under "requirements_constraints", found under "${scopeGroup?.id}"`);
  expect(bespokeGroup?.id === "requirements_constraints", `[11] expected bespoke under "requirements_constraints", found under "${bespokeGroup?.id}"`);
  expect(scopeGroup === bespokeGroup, `[11] expected scope and bespoke to land in the same group instance`);
}

/* 12. Input array and block objects remain unmodified. -------------------- */
{
  const inputBlocks = EXPECTED_BLOCK_KEYS.map((k) => stubBlock(k));
  const before = JSON.stringify(inputBlocks);
  const beforeLength = inputBlocks.length;

  groupBriefBlocks(inputBlocks);

  expect(JSON.stringify(inputBlocks) === before, `[12] the input blocks array or its objects were mutated`);
  expect(inputBlocks.length === beforeLength, `[12] the input blocks array length changed`);
}

/* 13. security_compliance's mapping is content-verified for `services`   */
/*     specifically (see the Commit 4 report for the full reasoning):     */
/*     services is Netify's own capability verdict, mapped alongside      */
/*     operations rather than requirements_constraints or elsewhere. ----- */
{
  expect(
    BRIEF_BLOCK_KEY_TO_GROUP["services"] === "security_compliance",
    `[13] expected "services" mapped to "security_compliance", got "${BRIEF_BLOCK_KEY_TO_GROUP["services"]}"`,
  );
  const services = stubBlock("services");
  const groups = groupBriefBlocks([services]);
  const found = groups.find((g) => g.blocks.includes(services));
  expect(found?.id === "security_compliance", `[13] expected the services block under "security_compliance", found under "${found?.id}"`);
}

console.log(`understanding-groups: ${pass} checks pass (${fail} fail)`);
if (fail > 0) {
  console.error(failures.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
