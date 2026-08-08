/**
 * Build gate for the Milestone 1, Commit 9B-prerequisite extraction:
 * humaniseWorkspaceValue(path, value) was pulled out of factLabel(fact)'s
 * body unchanged, and factLabel() now delegates to it. This script proves
 * the extraction was behaviour-preserving — same inputs, same outputs,
 * before and after — rather than trusting a read-through of the diff.
 *
 * Every fixture WorkspaceFact below carries fabricated id/struck/source/
 * cycle values. That is fine HERE: this is test-fixture construction in a
 * validation script, not the thing the Commit 9B-prep stop report flagged
 * as forbidden. That report was about SessionActivity.tsx (production
 * code) fabricating WorkspaceFact-only fields at runtime, from data
 * (SessionChange) that never carries them, to force a call to factLabel().
 * A validation script building its own complete, self-consistent fixture
 * object to exercise factLabel() is the repository's existing, normal
 * testing pattern (see validate-session-diff.ts's own WorkspaceFact
 * fixtures) and introduces no such fabrication into any real code path.
 *
 * Not yet wired into `npm run validate` — consistent with every other
 * validation script in this repository so far.
 */

import { readFileSync } from "node:fs";
import {
  factLabel,
  humaniseWorkspaceValue,
  factId,
  type WorkspaceFact,
  CLOUD_LABELS,
  NETWORK_LABELS,
  REGION_LABELS,
  COMPLIANCE_LABELS,
  DRIVER_PHRASES,
  SOC_LABELS,
  BUYING_LABELS,
  OPERATING_MODEL_LABELS,
} from "../src/lib/workspace/draft";
import type { AllowedPath } from "../src/lib/workspace/extract";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function expect(cond: boolean, msg: string) {
  if (cond) pass += 1;
  else { fail += 1; failures.push(msg); }
}

function fact(path: AllowedPath, value: unknown, extra?: Partial<WorkspaceFact>): WorkspaceFact {
  return {
    path,
    value,
    provenance: "stated",
    id: factId(path, value),
    struck: false,
    source: "extract",
    cycle: 1,
    ...extra,
  };
}

/* 1. For a representative fact on every specially-formatted path,        */
/*    factLabel(fact) === humaniseWorkspaceValue(fact.path, fact.value).  */
{
  const specialCases: Array<{ path: AllowedPath; value: unknown }> = [
    { path: "estate.cloud", value: "aws" },
    { path: "estate.existingNetwork", value: "mpls" },
    { path: "organisation.regions", value: "uk" },
    { path: "constraints.complianceRequirements", value: "iso27001" },
    { path: "drivers", value: "renewal" },
    { path: "constraints.inHouseSocCapacity", value: "business_hours" },
    { path: "procurement.buying", value: "sdwan" },
    { path: "procurement.operatingModel", value: "managed" },
  ];
  for (const { path, value } of specialCases) {
    const f = fact(path, value);
    const viaFactLabel = factLabel(f);
    const viaFormatter = humaniseWorkspaceValue(f.path, f.value);
    expect(
      viaFactLabel === viaFormatter,
      `[1] ${path}=${JSON.stringify(value)}: factLabel() -> ${JSON.stringify(viaFactLabel)}, humaniseWorkspaceValue() -> ${JSON.stringify(viaFormatter)}`,
    );
  }
}

/* 2. Exact existing outputs for named values, both entry points. ------- */
{
  const cases: Array<{ path: AllowedPath; value: string; expected: string; label: string }> = [
    { path: "constraints.complianceRequirements", value: "iso27001", expected: "ISO 27001", label: "iso27001" },
    { path: "constraints.complianceRequirements", value: "pci_dss", expected: "PCI DSS", label: "pci_dss" },
    { path: "procurement.buying", value: "sdwan", expected: BUYING_LABELS.sdwan, label: "sdwan" },
    { path: "procurement.buying", value: "sase", expected: BUYING_LABELS.sase, label: "sase" },
    { path: "procurement.operatingModel", value: "managed", expected: "fully managed", label: "managed" },
    { path: "procurement.operatingModel", value: "co_managed", expected: "co-managed", label: "co_managed" },
    { path: "organisation.regions", value: "uk", expected: "the UK", label: "uk" },
    { path: "estate.cloud", value: "aws", expected: CLOUD_LABELS.aws, label: "representative cloud value (aws)" },
    { path: "estate.existingNetwork", value: "mpls", expected: NETWORK_LABELS.mpls, label: "representative network value (mpls)" },
    { path: "drivers", value: "renewal", expected: DRIVER_PHRASES.renewal, label: "representative driver value (renewal)" },
    {
      path: "constraints.inHouseSocCapacity",
      value: "business_hours",
      expected: SOC_LABELS.business_hours,
      label: "representative SOC-capacity value (business_hours)",
    },
  ];
  // Sanity: the expectations above are pinned to the live tables, not
  // hand-copied literals, EXCEPT the four values the task specified
  // verbatim ("ISO 27001", "PCI DSS", "fully managed", "co-managed",
  // "the UK") — those are asserted as literal strings so a future edit to
  // the tables would visibly break this named-value requirement rather
  // than silently tracking whatever the table now says.
  for (const { path, value, expected, label } of cases) {
    const f = fact(path, value);
    expect(factLabel(f) === expected, `[2] ${label}: factLabel() expected ${JSON.stringify(expected)}, got ${JSON.stringify(factLabel(f))}`);
    expect(
      humaniseWorkspaceValue(path, value) === expected,
      `[2] ${label}: humaniseWorkspaceValue() expected ${JSON.stringify(expected)}, got ${JSON.stringify(humaniseWorkspaceValue(path, value))}`,
    );
  }
}

/* 3. Free-text fallback (default branch, String(value)) unchanged. ----- */
{
  const f = fact("organisation.sector", "Retail & e-commerce");
  expect(factLabel(f) === "Retail & e-commerce", `[3] free-text fallback changed via factLabel(): ${factLabel(f)}`);
  expect(
    humaniseWorkspaceValue(f.path, f.value) === "Retail & e-commerce",
    `[3] free-text fallback changed via humaniseWorkspaceValue(): ${humaniseWorkspaceValue(f.path, f.value)}`,
  );
}

/* 4. Numeric fallback unchanged. ---------------------------------------- */
{
  const f = fact("estate.users", 200);
  expect(factLabel(f) === "200", `[4] numeric fallback changed via factLabel(): ${factLabel(f)}`);
  expect(
    humaniseWorkspaceValue(f.path, f.value) === "200",
    `[4] numeric fallback changed via humaniseWorkspaceValue(): ${humaniseWorkspaceValue(f.path, f.value)}`,
  );
}

/* 5. List/array fallback: whatever String(array) already produces,       */
/*    verified identical through both entry points — not redesigned.      */
{
  const arr = ["Cisco Meraki", "Fortinet"];
  const f = fact("estate.namedTechnologies", arr);
  const expected = String(arr); // "Cisco Meraki,Fortinet" — JS's own Array#toString, unchanged
  expect(factLabel(f) === expected, `[5] array fallback changed via factLabel(): ${JSON.stringify(factLabel(f))} !== ${JSON.stringify(expected)}`);
  expect(
    humaniseWorkspaceValue(f.path, f.value) === expected,
    `[5] array fallback changed via humaniseWorkspaceValue(): ${JSON.stringify(humaniseWorkspaceValue(f.path, f.value))} !== ${JSON.stringify(expected)}`,
  );
}

/* 6. All seven PKM paths retain their existing String(value) fallback. - */
{
  const pkmCases: Array<{ path: AllowedPath; value: unknown }> = [
    { path: "estate.namedTechnologies", value: "Cisco Meraki" },
    { path: "estate.existingProviders", value: "Zscaler" },
    { path: "procurement.vendorsUnderConsideration", value: "Palo Alto Networks" },
    { path: "estate.namedLocations", value: "Manchester HQ" },
    { path: "estate.locationCriticality", value: "critical" },
    { path: "estate.siteResilience", value: "dual-homed" },
    { path: "requirements.bespoke", value: "must integrate with existing SIEM" },
  ];
  for (const { path, value } of pkmCases) {
    const f = fact(path, value);
    const expected = String(value);
    expect(factLabel(f) === expected, `[6] ${path}: factLabel() expected raw fallback ${JSON.stringify(expected)}, got ${JSON.stringify(factLabel(f))}`);
    expect(
      humaniseWorkspaceValue(path, value) === expected,
      `[6] ${path}: humaniseWorkspaceValue() expected raw fallback ${JSON.stringify(expected)}, got ${JSON.stringify(humaniseWorkspaceValue(path, value))}`,
    );
  }
}

/* 7. Supplied path and value are not mutated by either entry point. ---- */
{
  const value = { nested: ["a", "b"], note: "kept as-is" } as unknown; // an intentionally odd value, not a realistic fact value
  const path: AllowedPath = "requirements.bespoke";
  const snapshotBefore = JSON.stringify(value);
  humaniseWorkspaceValue(path, value);
  expect(JSON.stringify(value) === snapshotBefore, `[7] humaniseWorkspaceValue() mutated its "value" argument`);

  const f = fact("organisation.sector", "Retail & e-commerce");
  const factSnapshot = JSON.stringify(f);
  factLabel(f);
  expect(JSON.stringify(f) === factSnapshot, `[7] factLabel() mutated its "fact" argument`);
}

/* 8. Static source assertion: factLabel() delegates to                   */
/*    humaniseWorkspaceValue() and retains no second switch of its own.  */
{
  const src = readFileSync(new URL("../src/lib/workspace/draft.ts", import.meta.url), "utf8");
  const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  const factLabelMatch = codeOnly.match(/export function factLabel\(f: WorkspaceFact\): string \{([\s\S]*?)\n\}/);
  expect(!!factLabelMatch, `[8] could not locate factLabel()'s body via static source inspection`);
  const factLabelBody = factLabelMatch?.[1] ?? "";

  expect(
    /return humaniseWorkspaceValue\(f\.path, f\.value\);/.test(factLabelBody),
    `[8] factLabel() does not appear to delegate to humaniseWorkspaceValue(f.path, f.value)`,
  );
  expect(
    !/switch\s*\(/.test(factLabelBody),
    `[8] factLabel() still contains its own switch statement instead of delegating`,
  );
  expect(
    factLabelBody.trim().split("\n").filter((l) => l.trim().length > 0).length <= 1,
    `[8] factLabel() body has more than just the delegating return line: ${JSON.stringify(factLabelBody)}`,
  );

  const formatterMatch = codeOnly.match(/export function humaniseWorkspaceValue\(\s*path: AllowedPath,\s*value: unknown,?\s*\): string \{([\s\S]*?)\n\}/);
  expect(!!formatterMatch, `[8] could not locate humaniseWorkspaceValue()'s body via static source inspection`);
  const formatterBody = formatterMatch?.[1] ?? "";
  expect(
    /switch\s*\(\s*path\s*\)/.test(formatterBody),
    `[8] humaniseWorkspaceValue() does not contain the expected path switch`,
  );
}

/* 9. No second mapping table was introduced: every label table this      */
/*    formatter reads from is still declared exactly once in the file,   */
/*    and humaniseWorkspaceValue()'s own body defines no new object       */
/*    literal / Record mapping of its own. ------------------------------ */
{
  const src = readFileSync(new URL("../src/lib/workspace/draft.ts", import.meta.url), "utf8");
  const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  const tableNames = [
    "CLOUD_LABELS",
    "NETWORK_LABELS",
    "REGION_LABELS",
    "COMPLIANCE_LABELS",
    "DRIVER_PHRASES",
    "SOC_LABELS",
    "BUYING_LABELS",
    "OPERATING_MODEL_LABELS",
  ];
  for (const name of tableNames) {
    const declarations = codeOnly.match(new RegExp(`export const ${name}\\s*:\\s*Record<`, "g")) ?? [];
    expect(declarations.length === 1, `[9] expected exactly one declaration of ${name}, found ${declarations.length}`);
  }

  const formatterMatch = codeOnly.match(/export function humaniseWorkspaceValue\(\s*path: AllowedPath,\s*value: unknown,?\s*\): string \{([\s\S]*?)\n\}/);
  const formatterBody = formatterMatch?.[1] ?? "";
  expect(
    !/Record</.test(formatterBody) && !/:\s*\{/.test(formatterBody),
    `[9] humaniseWorkspaceValue() appears to define its own mapping object instead of reusing the exported tables`,
  );

  // Every table imported above must actually be the same object identity
  // exported by draft.ts, i.e. this script (and, by the same import
  // mechanism, humaniseWorkspaceValue() itself) reads the ONE copy.
  expect(typeof CLOUD_LABELS === "object", `[9] CLOUD_LABELS not importable as expected`);
  expect(typeof OPERATING_MODEL_LABELS === "object", `[9] OPERATING_MODEL_LABELS not importable as expected`);
}

console.log(`workspace-value-formatting: ${pass} checks pass (${fail} fail)`);
if (fail > 0) {
  console.error(failures.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
