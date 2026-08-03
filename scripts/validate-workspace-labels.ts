/**
 * Build gate for the workspace fact-label table (Milestone 1, Commit 1):
 * the Understanding surface must never show a raw AllowedPath string to a
 * buyer, and every path (including the seven PKM extension paths) must
 * resolve to exactly one, non-duplicated label.
 *
 * Distinct from validate-labels.ts, which gates the unrelated notice/RFP
 * document label catalogue (SECTORS, REGIONS, COMPLIANCE_OPTIONS, ...) in
 * src/lib/notice-options.ts. This gate is workspace-ledger labels only.
 *
 * Not yet wired into `npm run validate` — see the Commit 1 report for why.
 */

import { PATH_LABELS, labelFor } from "../src/lib/workspace/labels";
import type { AllowedPath } from "../src/lib/workspace/extract";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function expect(cond: boolean, msg: string) {
  if (cond) pass += 1;
  else { fail += 1; failures.push(msg); }
}

/* 1. Every AllowedPath currently defined in extract.ts must appear here.
      ALLOWED_PATHS itself is not exported from extract.ts (by design, per
      Milestone 1's "do not alter extraction" boundary), so this list is
      maintained by hand against the verbatim source and must be updated
      if extract.ts's ALLOWED_PATHS ever changes. The Record<AllowedPath,
      string> type on PATH_LABELS is the primary, compiler-enforced
      guarantee of completeness; this list is a secondary, explicit check. */
const EXPECTED_PATHS: AllowedPath[] = [
  "organisation.sector",
  "organisation.sizeBand",
  "organisation.regions",
  "estate.users",
  "estate.sites",
  "estate.cloud",
  "estate.existingSecurity",
  "estate.existingNetwork",
  "drivers",
  "constraints.complianceRequirements",
  "constraints.inHouseSocCapacity",
  "constraints.timeline",
  "constraints.budgetBand",
  "procurement.buying",
  "procurement.operatingModel",
  "estate.namedTechnologies",
  "estate.existingProviders",
  "procurement.vendorsUnderConsideration",
  "estate.namedLocations",
  "estate.locationCriticality",
  "estate.siteResilience",
  "requirements.bespoke",
];

expect(EXPECTED_PATHS.length === 22, `expected 22 AllowedPath entries (15 base + 7 PKM), counted ${EXPECTED_PATHS.length}`);

for (const path of EXPECTED_PATHS) {
  const label = PATH_LABELS[path];
  expect(typeof label === "string" && label.length > 0, `${path}: missing or empty label`);
}

/* 2. The seven PKM extension paths specifically, named individually so a
      regression here fails loudly rather than blending into the loop above. */
const PKM_PATHS: AllowedPath[] = [
  "estate.namedTechnologies",
  "estate.existingProviders",
  "procurement.vendorsUnderConsideration",
  "estate.namedLocations",
  "estate.locationCriticality",
  "estate.siteResilience",
  "requirements.bespoke",
];
for (const path of PKM_PATHS) {
  expect(path in PATH_LABELS, `PKM path ${path} is missing from PATH_LABELS`);
}
expect(PKM_PATHS.length === 7, `expected exactly 7 PKM paths, counted ${PKM_PATHS.length}`);

/* 3. No two paths share a label (a buyer must never see the same word for
      two different facts). */
const allLabels = Object.values(PATH_LABELS);
const uniqueLabels = new Set(allLabels);
expect(allLabels.length === uniqueLabels.size, `duplicate labels found: ${allLabels.length} entries, ${uniqueLabels.size} unique`);

/* 4. No label is, or contains, a raw internal path string (the literal
      buyer-facing-safety check). */
for (const [path, label] of Object.entries(PATH_LABELS)) {
  expect(!label.includes("."), `${path}: label "${label}" looks like it leaked a dotted path`);
  expect(label !== path, `${path}: label is identical to the raw path`);
}

/* 5. labelFor() is the one sanctioned accessor and agrees with the table. */
for (const path of EXPECTED_PATHS) {
  expect(labelFor(path) === PATH_LABELS[path], `labelFor(${path}) disagrees with PATH_LABELS`);
}

console.log(`workspace-labels: ${pass} checks pass (${fail} fail)`);
if (fail > 0) {
  console.error(failures.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
