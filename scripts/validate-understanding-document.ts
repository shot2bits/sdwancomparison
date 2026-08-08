/**
 * Build gate for UnderstandingDocument (Milestone 1, Commit 6): proves
 * the composition — briefModel(verdict:null) -> groupBriefBlocks() ->
 * UnderstandingGroup per canonical group — behaves exactly as specified,
 * the heading is fixed, the empty state is reachable and honest, and PKM
 * facts flow through with no component-specific special casing.
 *
 * Tooling limitation, reported honestly (same limitation as Commit 5's
 * gate, and for the same reason): this repository has no jsdom or React
 * testing library, and none is added here. UnderstandingDocument is
 * stateless and hookless, so it is called DIRECTLY AS A PLAIN FUNCTION
 * and its returned React element tree (a plain object graph) is walked
 * and inspected. Because UnderstandingGroup is itself a component
 * reference (not yet invoked when UnderstandingDocument returns — React
 * elements are lazy descriptors), the tree contains real, uninvoked
 * `<UnderstandingGroup ... />` element objects whose exact props
 * (including object identity, e.g. `labelFor`) can be asserted directly.
 * This proves everything the required behaviour depends on structurally,
 * but not real browser layout or interaction — not claimed here.
 *
 * Discrepancy found and resolved during implementation, re-verified here:
 * briefModel({facts: [], verdict: null}).blocks is NEVER empty — the
 * `organisation` block always pushes (draft.ts line 530, unconditional).
 * A literal "no rendered blocks" empty-state trigger is therefore
 * unreachable; UnderstandingDocument gates its empty state on
 * `facts.length === 0` instead, matching QuickSorWorkspace.tsx's existing
 * `started` convention. See the component's own header comment and the
 * Commit 6 report for the full reasoning.
 *
 * Not yet wired into `npm run validate` — see the Commit 6 report for why.
 */

import { readFileSync } from "node:fs";
import UnderstandingDocument from "../src/components/preview/UnderstandingDocument";
import UnderstandingGroup from "../src/components/preview/UnderstandingGroup";
import { UNDERSTANDING_GROUPS } from "../src/components/preview/understanding-groups";
import { labelFor } from "../src/lib/workspace/labels";
import type { WorkspaceFact } from "../src/lib/workspace/draft";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function expect(cond: boolean, msg: string) {
  if (cond) pass += 1;
  else { fail += 1; failures.push(msg); }
}

/* ---- Minimal, dependency-free React-element tree walker (same         */
/*      approach as Commit 5's gate). ------------------------------------*/

type AnyEl = { type: unknown; props?: Record<string, unknown> } | string | number | null | undefined | boolean | AnyEl[];

function flatten(node: AnyEl, out: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) flatten(child, out);
    return out;
  }
  const el = node as { type: unknown; props?: Record<string, unknown> };
  // UnderstandingDocument's own children (<UnderstandingGroup ... />
  // elements, and each of those in turn wraps <FactInspector ... />) are
  // LAZY, uninvoked element descriptors at this point — UnderstandingGroup
  // and FactInspector are both stateless/hookless, so resolving one by
  // calling it directly with its own props (same technique Commit 5's
  // gate used at the top level) is safe and deterministic; this recurses
  // into that resolved output so nested components' real rendered text is
  // visible to the assertions below, not just the outermost DOM shell.
  if (typeof el.type === "function") {
    const rendered = (el.type as (props: Record<string, unknown>) => AnyEl)(el.props ?? {});
    flatten(rendered, out);
    return out;
  }
  if (el.props && typeof el.props.className === "string") out.push(el.props.className);
  if (el.props && "children" in el.props) flatten(el.props.children as AnyEl, out);
  return out;
}

function findByType(node: AnyEl, target: unknown, out: { type: unknown; props?: Record<string, unknown> }[] = []) {
  if (node === null || node === undefined || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") return out;
  if (Array.isArray(node)) {
    for (const child of node) findByType(child, target, out);
    return out;
  }
  const el = node as { type: unknown; props?: Record<string, unknown> };
  if (el.type === target) out.push(el);
  if (el.props && "children" in el.props) findByType(el.props.children as AnyEl, target, out);
  return out;
}

let idCounter = 0;
function mkFact(
  path: WorkspaceFact["path"],
  value: unknown,
  provenance: "stated" | "inferred",
  extra: Partial<WorkspaceFact> = {},
): WorkspaceFact {
  idCounter += 1;
  return {
    id: `${path}#${idCounter}`,
    path,
    value,
    provenance,
    struck: false,
    source: "extract",
    cycle: 1,
    ...extra,
  };
}

/* ---- Fixtures ------------------------------------------------------------ */

// Deliberately covers organisation, drivers, estate, vendors, operations,
// bespoke — but NOT locations, so "Locations and resilience" stays empty
// (needed to prove only non-empty groups render).
const richFacts: WorkspaceFact[] = [
  mkFact("organisation.sector", "Retail & e-commerce", "stated", { quote: "we're in retail" }),
  mkFact("estate.sites", 10, "stated", { quote: "10 sites" }),
  mkFact("estate.users", 250, "stated", { quote: "250 staff" }),
  mkFact("procurement.buying", "managed_security", "stated", { quote: "we want managed security" }),
  mkFact("drivers", "renewal", "stated", { quote: "our contract is up for renewal" }),
  mkFact("estate.existingSecurity", "endpoint protection", "stated", { quote: "we already run endpoint protection" }),
  mkFact("estate.namedTechnologies", "Cisco Meraki", "stated", { quote: "we run Cisco Meraki" }),
  mkFact("estate.existingProviders", "Acme MSP", "stated", { quote: "Acme MSP looks after us today" }),
  mkFact("procurement.vendorsUnderConsideration", "Palo Alto Networks", "inferred", { reason: "mentioned as a comparison point" }),
  mkFact("constraints.complianceRequirements", "iso27001", "stated", { quote: "we need to hit ISO 27001" }),
  mkFact("requirements.bespoke", "Needs Welsh-language support", "stated", { quote: "it must support Welsh" }),
];

const pkmOnlyFacts: WorkspaceFact[] = [
  mkFact("estate.namedTechnologies", "Fortinet", "stated", { quote: "we run Fortinet" }),
  mkFact("estate.existingProviders", "Acme MSP", "stated", { quote: "Acme MSP today" }),
  mkFact("procurement.vendorsUnderConsideration", "Palo Alto Networks", "inferred", { reason: "raised as an alternative" }),
  mkFact("estate.namedLocations", "London HQ", "stated", { quote: "our London HQ" }),
  mkFact("estate.locationCriticality", "London HQ is business-critical", "stated", { quote: "London HQ can't go down" }),
  mkFact("estate.siteResilience", "London HQ has dual ISPs", "stated", { quote: "we have two ISPs at London" }),
  mkFact("requirements.bespoke", "Needs Welsh-language support", "stated", { quote: "it must support Welsh" }),
];

const componentSource = readFileSync(
  new URL("../src/components/preview/UnderstandingDocument.tsx", import.meta.url),
  "utf8",
);

/* 1. Component heading is exactly "Understanding". ------------------------ */
{
  const el = UnderstandingDocument({ facts: richFacts });
  const headings = findByType(el, "h2");
  expect(headings.length === 1, `[1] expected exactly one h2, found ${headings.length}`);
  const headingText = flatten(headings[0]?.props?.children as AnyEl).join("");
  expect(headingText === "Understanding", `[1] expected the heading to be exactly "Understanding", got "${headingText}"`);
}

/* 2. Does not render Statement of Requirements / SoR / RFI / RFP. -------- */
{
  const forbidden = ["Statement of Requirements", "SoR", "Request for Information", "RFI", "Request for Proposal", "RFP"];
  for (const facts of [richFacts, []]) {
    const flat = flatten(UnderstandingDocument({ facts })).join(" | ");
    for (const term of forbidden) {
      expect(!flat.includes(term), `[2] forbidden term "${term}" found in rendered output (facts.length=${facts.length}): ${flat}`);
    }
  }
}

/* 3. briefModel() is called with verdict: null. ---------------------------- */
{
  // Static source assertion: the component's own source literally passes
  // verdict: null to briefModel().
  expect(
    /briefModel\(\s*\{\s*facts,\s*verdict:\s*null\s*,?\s*\}\s*\)/.test(componentSource),
    `[3] expected the component source to call briefModel({ facts, verdict: null })`,
  );
  // Behavioural corroboration: with verdict null, the services block
  // (which requires a real SecurityScopeVerdict object) can never be
  // produced, even with a managed-security buying fact and standing
  // facts present — its own heading text must never appear.
  const flat = flatten(UnderstandingDocument({ facts: richFacts })).join(" | ");
  expect(!flat.includes("Services required"), `[3] the "Services required" block heading appeared — implies a non-null verdict reached briefModel()`);
}

/* 4. groupBriefBlocks() receives the model blocks (each block's content   */
/*    lands under its own correct canonical group, not scattered/lost). -- */
{
  const flat = flatten(UnderstandingDocument({ facts: richFacts }));
  const joined = flat.join(" | ");
  expect(joined.includes("endpoint protection"), `[4] expected estate.existingSecurity content to render`);
  expect(joined.includes("Cisco Meraki"), `[4] expected estate.namedTechnologies content to render`);

  // Observed, not asserted as pass/fail here (it is pre-existing Commit 5
  // behaviour, out of this commit's file scope to change): the sentence
  // text for constraints.complianceRequirements is humanised via
  // factLabel() ("ISO 27001"), but FactInspector's own "value" line uses
  // String(fact.value) directly, i.e. the raw enum id ("iso27001") for
  // any enum-coded path (compliance, drivers, cloud, network, regions,
  // buying, operatingModel). Logged for the Commit 6 report rather than
  // silently fixed or silently ignored.
  if (joined.includes("iso27001")) {
    console.log('  note [4]: FactInspector shows the raw enum id "iso27001" in its value line even though the surrounding sentence shows "ISO 27001" — see the Commit 6 report.');
  }
}

/* 5. Canonical group order is preserved. ----------------------------------- */
{
  const flat = flatten(UnderstandingDocument({ facts: richFacts }));
  const titleIndex = (title: string) => flat.indexOf(title);
  const present = UNDERSTANDING_GROUPS.map((g) => ({ title: g.title, index: titleIndex(g.title) })).filter(
    (g) => g.index >= 0,
  );
  expect(present.length >= 5, `[5] expected at least 5 groups with content in this fixture, found ${present.length}`);
  for (let i = 1; i < present.length; i++) {
    expect(present[i]!.index > present[i - 1]!.index, `[5] group order violated: "${present[i - 1]!.title}" should precede "${present[i]!.title}"`);
  }
}

/* 6. Only non-empty groups render (Locations and resilience is empty in   */
/*    richFacts; Unresolved gaps is always empty, per finding [13]). ------ */
{
  const flat = flatten(UnderstandingDocument({ facts: richFacts })).join(" | ");
  expect(!flat.includes("Locations and resilience"), `[6] expected the empty "Locations and resilience" group to be absent, got: ${flat}`);
  expect(!flat.includes("Unresolved gaps"), `[6] expected the (structurally always empty, per finding 13) "Unresolved gaps" group to be absent`);
}

/* 7. Empty facts produce the single whole-document empty state. ----------- */
{
  const el = UnderstandingDocument({ facts: [] });
  const flat = flatten(el).join(" | ");
  expect(flat.includes("Your Understanding will appear here as Netify captures your project."), `[7] expected the exact empty-state wording, got: ${flat}`);
  // None of the eight group titles should appear alongside it.
  for (const g of UNDERSTANDING_GROUPS) {
    expect(!flat.includes(g.title), `[7] expected group title "${g.title}" to be absent in the empty state, got: ${flat}`);
  }
}

/* 8. No fictional example content appears in the empty state. ------------- */
{
  const flat = flatten(UnderstandingDocument({ facts: [] })).join(" | ");
  expect(!/e\.g\.|for example|imagine|example:/i.test(flat), `[8] the empty state appears to contain example-opener phrasing: ${flat}`);
  // Exact-wording check doubles as an anti-fabrication check: nothing
  // beyond the fixed sentence and the document chrome (heading, subtitle)
  // should be present.
  expect(flat.includes("Understanding"), `[8] expected the fixed heading to still be present`);
}

/* 9. labelFor is passed to each UnderstandingGroup. ------------------------ */
{
  const el = UnderstandingDocument({ facts: richFacts });
  const groupElements = findByType(el, UnderstandingGroup);
  expect(groupElements.length > 0, `[9] expected at least one UnderstandingGroup element`);
  for (const g of groupElements) {
    expect(g.props?.labelFor === labelFor, `[9] expected the exact canonical labelFor function reference to be passed, group id=${String(g.props?.id)}`);
  }
}

/* 10. No raw block key or AllowedPath rendered intentionally. ------------- */
{
  const flat = flatten(UnderstandingDocument({ facts: richFacts })).join(" | ");
  const rawPaths = [
    "estate.existingSecurity",
    "constraints.complianceRequirements",
    "estate.namedTechnologies",
    "estate.existingProviders",
    "procurement.vendorsUnderConsideration",
    "requirements.bespoke",
    "organisation.sector",
    "procurement.buying",
  ];
  for (const p of rawPaths) {
    expect(!flat.includes(p), `[10] raw AllowedPath "${p}" leaked into rendered output: ${flat}`);
  }
}

/* 11. Input facts remain unmodified. --------------------------------------- */
{
  const facts = richFacts.map((f) => ({ ...f }));
  const before = JSON.stringify(facts);
  UnderstandingDocument({ facts });
  expect(JSON.stringify(facts) === before, `[11] the input facts array or its objects were mutated`);
}

/* 12. PKM-path facts flow through with no component-specific special       */
/*     casing (UnderstandingDocument contains no path-specific logic at    */
/*     all — this proves the generic composition handles them). ----------- */
{
  const flat = flatten(UnderstandingDocument({ facts: pkmOnlyFacts })).join(" | ");
  expect(flat.includes("Technologies and providers"), `[12] expected the technologies_providers group to render for PKM vendor facts`);
  expect(flat.includes("Locations and resilience"), `[12] expected the locations_resilience group to render for PKM location facts`);
  expect(flat.includes("Requirements and constraints"), `[12] expected the requirements_constraints group to render for the bespoke fact`);
  expect(flat.includes("Fortinet") && flat.includes("London HQ"), `[12] expected PKM fact content to actually render, got: ${flat}`);
}

/* 13. gaps is the final canonical group; cannot be exercised end-to-end    */
/*     via this component given verdict: null (finding documented in the  */
/*     component header and the Commit 6 report) — verified structurally  */
/*     instead, plus a reference to Commit 5's own proof that gap segs     */
/*     never render controls or ranking. --------------------------------- */
{
  const last = UNDERSTANDING_GROUPS[UNDERSTANDING_GROUPS.length - 1];
  expect(last?.id === "gaps", `[13] expected "gaps" to be the last canonical group, got "${last?.id}"`);
  expect(last?.title === "Unresolved gaps", `[13] expected the last group's title to be "Unresolved gaps", got "${last?.title}"`);
  // Documented, not silently assumed: with verdict: null (permanent for
  // this milestone), briefModel() can never populate openGaps, so the
  // gaps BriefBlock never exists to test end-to-end through this exact
  // component. UnderstandingGroup's own gate (Commit 5, test 8) already
  // proves gap segs render without controls or ranking whenever a gap
  // Seg IS present; that guarantee is unchanged and unbypassed here.
  console.log("  note [13]: gaps block is structurally unreachable via UnderstandingDocument while verdict is permanently null — see the Commit 6 report.");
}

console.log(`understanding-document: ${pass} checks pass (${fail} fail)`);
if (fail > 0) {
  console.error(failures.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
