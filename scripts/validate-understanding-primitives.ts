/**
 * Build gate for the Understanding presentational primitives (Milestone 1,
 * Commit 5): FactInspector and UnderstandingGroup.
 *
 * Tooling limitation, reported honestly rather than worked around: this
 * repository has no React rendering test tooling (no jsdom, no
 * @testing-library/react — package.json's only relevant deps are react,
 * react-dom, next). ReactDOM.render()/hydration and a real DOM are not
 * available here. Per the Commit 5 instructions, no testing library is
 * added. Instead, this script calls each component DIRECTLY AS A PLAIN
 * FUNCTION (both are stateless, hookless, effectless — this is safe and
 * deterministic) and inspects the returned React element tree, which is a
 * plain JS object graph ({ type, props, ... }) that `react`'s
 * createElement produces without needing any DOM or renderer. That is
 * enough to assert: what text is present, what is absent, which concrete
 * prop objects were passed through unchanged, and structural order — the
 * things this commit's required behaviour actually depends on. It cannot
 * prove browser layout, CSS behaviour, or actual click interaction with
 * <details>/<summary> — those are outside what static tree inspection can
 * verify, and are not claimed here.
 *
 * Not yet wired into `npm run validate` — see the Commit 5 report for why.
 */

import FactInspector from "../src/components/preview/FactInspector";
import UnderstandingGroup from "../src/components/preview/UnderstandingGroup";
import type { BriefBlock, BriefGap, Seg, WorkspaceFact } from "../src/lib/workspace/draft";
import { labelFor } from "../src/lib/workspace/labels";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function expect(cond: boolean, msg: string) {
  if (cond) pass += 1;
  else { fail += 1; failures.push(msg); }
}

/* ---- Minimal, dependency-free React-element tree walker --------------- */

type AnyEl = { type: unknown; props?: Record<string, unknown> } | string | number | null | undefined | boolean | AnyEl[];

/** Every string/number leaf, plus every className string, flattened into
 *  one array — enough to assert presence/absence of rendered text and of
 *  the style hooks (e.g. "line-through") this commit's behaviour relies
 *  on, without a DOM. */
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
  if (el.props && typeof el.props.className === "string") out.push(el.props.className);
  if (el.props && "children" in el.props) flatten(el.props.children as AnyEl, out);
  return out;
}

/** Find every element in the tree whose `.type` is exactly `target`
 *  (reference equality — used to find nested FactInspector elements by
 *  the actual imported function reference, not by name matching). */
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

/* ---- Fixtures, using the real WorkspaceFact / BriefBlock / Seg types --- */

const statedFact: WorkspaceFact = {
  id: "estate.users",
  path: "estate.users",
  value: 250,
  provenance: "stated",
  quote: "we have 250 staff",
  struck: false,
  source: "extract",
  cycle: 1,
};

const inferredFact: WorkspaceFact = {
  id: "estate.sites",
  path: "estate.sites",
  value: 10,
  provenance: "inferred",
  reason: "typical estate size for this sector",
  struck: false,
  source: "extract",
  cycle: 1,
};

const statedNoQuoteFact: WorkspaceFact = {
  id: "organisation.sizeBand",
  path: "organisation.sizeBand",
  value: "51-250",
  provenance: "stated",
  struck: false,
  source: "answer",
  cycle: 2,
};

const inferredNoReasonFact: WorkspaceFact = {
  id: "drivers:renewal",
  path: "drivers",
  value: "renewal",
  provenance: "inferred",
  struck: false,
  source: "extract",
  cycle: 1,
};

const struckFact: WorkspaceFact = {
  id: "estate.cloud:aws",
  path: "estate.cloud",
  value: "aws",
  provenance: "stated",
  quote: "we use AWS",
  struck: true,
  source: "extract",
  cycle: 1,
};

const gapNumber: BriefGap = {
  key: "estate.users",
  question: "How many staff do you have?",
  path: "estate.users",
  control: "number",
};

const gapChips: BriefGap = {
  key: "organisation.sector",
  question: "What sector are you in?",
  path: "organisation.sector",
  control: "chips",
  options: [
    { value: "Retail & e-commerce", label: "Retail & e-commerce" },
    { value: "Financial services", label: "Financial services" },
  ],
  whyItMatters: "Sector shapes which compliance regimes typically apply.",
};

/* 1. FactInspector never renders a raw path string. ----------------------- */
{
  const el = FactInspector({ fact: statedFact, labelFor });
  const flat = flatten(el).join(" | ");
  expect(!flat.includes("estate.users"), `[1] rendered output leaked the raw path "estate.users": ${flat}`);
  expect(flat.includes(labelFor("estate.users")), `[1] expected the human label "${labelFor("estate.users")}" to be present`);
}

/* 2. Stated fact exposes its quote. --------------------------------------- */
{
  const el = FactInspector({ fact: statedFact, labelFor });
  const flat = flatten(el).join(" | ");
  expect(flat.includes("we have 250 staff"), `[2] expected the stated fact's quote to be rendered, got: ${flat}`);
}

/* 3. Inferred fact exposes its reason. ------------------------------------ */
{
  const el = FactInspector({ fact: inferredFact, labelFor });
  const flat = flatten(el).join(" | ");
  expect(flat.includes("typical estate size for this sector"), `[3] expected the inferred fact's reason to be rendered, got: ${flat}`);
}

/* 4. Missing quote/reason does not invent evidence. ----------------------- */
{
  const elStated = FactInspector({ fact: statedNoQuoteFact, labelFor });
  const flatStated = flatten(elStated).join(" | ");
  expect(flatStated.includes("No source quote is available"), `[4] expected an honest "no quote" message, got: ${flatStated}`);
  expect(!flatStated.includes("undefined") && !flatStated.includes("null"), `[4] expected no fabricated placeholder text, got: ${flatStated}`);

  const elInferred = FactInspector({ fact: inferredNoReasonFact, labelFor });
  const flatInferred = flatten(elInferred).join(" | ");
  expect(flatInferred.includes("No inference reason is available"), `[4] expected an honest "no reason" message, got: ${flatInferred}`);
}

/* 5. Struck fact is visibly distinguishable. ------------------------------ */
{
  const elStruck = FactInspector({ fact: struckFact, labelFor });
  const elLive = FactInspector({ fact: statedFact, labelFor });
  const flatStruck = flatten(elStruck).join(" | ");
  const flatLive = flatten(elLive).join(" | ");
  expect(flatStruck.includes("line-through"), `[5] expected a struck fact to carry a line-through style, got: ${flatStruck}`);
  expect(flatStruck.includes("Superseded"), `[5] expected a struck fact to be labelled Superseded, got: ${flatStruck}`);
  expect(!flatLive.includes("Superseded"), `[5] expected a live (non-struck) fact NOT to be labelled Superseded`);
  // Not hidden: the fact's own value/quote must still be present.
  expect(flatStruck.includes("aws") && flatStruck.includes("we use AWS"), `[5] expected the struck fact's value and quote to still be rendered, got: ${flatStruck}`);
}

/* 6. Text Seg renders supplied text. -------------------------------------- */
{
  const textSeg: Seg = { kind: "text", text: "The buyer is a retail organisation." };
  const block: BriefBlock = { key: "organisation", heading: "The organisation", paras: [[textSeg]] };
  const el = UnderstandingGroup({ id: "organisation", title: "Organisation", blocks: [block], labelFor });
  const flat = flatten(el).join(" | ");
  expect(flat.includes("The buyer is a retail organisation."), `[6] expected the text seg's exact text to be rendered, got: ${flat}`);
}

/* 7. Fact Seg passes the exact attached WorkspaceFact object through. ---- */
{
  const factSeg: Seg = { kind: "fact", fact: statedFact, text: "250 staff" };
  const block: BriefBlock = { key: "estate", heading: "Estate and current position", paras: [[factSeg]] };
  const el = UnderstandingGroup({ id: "estate", title: "Current estate", blocks: [block], labelFor });
  const inspectors = findByType(el, FactInspector);
  expect(inspectors.length === 1, `[7] expected exactly 1 FactInspector element, found ${inspectors.length}`);
  expect(inspectors[0]?.props?.fact === statedFact, `[7] expected the exact same WorkspaceFact object reference to be passed through, not a copy`);
  const flat = flatten(el).join(" | ");
  expect(flat.includes("250 staff"), `[7] expected the fact seg's sentence-fragment text to be rendered, got: ${flat}`);
}

/* 8. Gap Seg exposes question and whyItMatters when present. ------------- */
{
  const gapSegNoWhy: Seg = { kind: "gap", gap: gapNumber };
  const gapSegWithWhy: Seg = { kind: "gap", gap: gapChips };
  const block: BriefBlock = {
    key: "organisation",
    heading: "The organisation",
    paras: [[gapSegNoWhy], [gapSegWithWhy]],
  };
  const el = UnderstandingGroup({ id: "organisation", title: "Organisation", blocks: [block], labelFor });
  const flat = flatten(el).join(" | ");
  expect(flat.includes("How many staff do you have?"), `[8] expected the gap's question to be rendered, got: ${flat}`);
  expect(flat.includes("What sector are you in?"), `[8] expected the second gap's question to be rendered, got: ${flat}`);
  expect(flat.includes("Sector shapes which compliance regimes typically apply."), `[8] expected whyItMatters to be rendered when present, got: ${flat}`);
  expect(flat.includes("expects a number"), `[8] expected the number gap's answer shape to be described, got: ${flat}`);
  expect(flat.includes("Retail & e-commerce") && flat.includes("Financial services"), `[8] expected the chips gap's options to be described, got: ${flat}`);
}

/* 9. Paragraph and segment order are preserved. --------------------------- */
{
  const segA: Seg = { kind: "text", text: "AAA" };
  const segB: Seg = { kind: "text", text: "BBB" };
  const segC: Seg = { kind: "text", text: "CCC" };
  const block: BriefBlock = {
    key: "organisation",
    heading: "The organisation",
    paras: [[segA, segB], [segC]],
  };
  const el = UnderstandingGroup({ id: "organisation", title: "Organisation", blocks: [block], labelFor });
  const flat = flatten(el);
  const iA = flat.indexOf("AAA");
  const iB = flat.indexOf("BBB");
  const iC = flat.indexOf("CCC");
  expect(iA >= 0 && iB >= 0 && iC >= 0, `[9] expected all three segments to render`);
  expect(iA < iB && iB < iC, `[9] expected order AAA, BBB, CCC to be preserved, got indices ${iA}, ${iB}, ${iC}`);
}

/* 10. Multiple blocks remain in order. ------------------------------------ */
{
  const blockOne: BriefBlock = { key: "operations", heading: "Compliance and operations", paras: [[{ kind: "text", text: "ONE" }]] };
  const blockTwo: BriefBlock = { key: "services", heading: "Services required", paras: [[{ kind: "text", text: "TWO" }]] };
  const el = UnderstandingGroup({ id: "security_compliance", title: "Security and compliance", blocks: [blockOne, blockTwo], labelFor });
  const flat = flatten(el);
  const iOne = flat.indexOf("ONE");
  const iTwo = flat.indexOf("TWO");
  expect(iOne >= 0 && iTwo >= 0 && iOne < iTwo, `[10] expected block order [operations, services] preserved, got indices ${iOne}, ${iTwo}`);
}

/* 11. Empty group behaviour matches the chosen rule (render nothing). ---- */
{
  const el = UnderstandingGroup({ id: "locations_resilience", title: "Locations and resilience", blocks: [], labelFor });
  expect(el === null, `[11] expected an empty group to render null, got ${JSON.stringify(el)}`);
}

/* 12. Input BriefBlock, Seg and WorkspaceFact objects remain unmodified. - */
{
  const fact: WorkspaceFact = { ...statedFact };
  const factSeg: Seg = { kind: "fact", fact, text: "250 staff" };
  const textSeg: Seg = { kind: "text", text: "plain text" };
  const gapSeg: Seg = { kind: "gap", gap: { ...gapChips } };
  const block: BriefBlock = { key: "estate", heading: "Estate and current position", paras: [[textSeg, factSeg], [gapSeg]] };
  const blocksBefore = JSON.stringify([block]);
  const factBefore = JSON.stringify(fact);

  UnderstandingGroup({ id: "estate", title: "Current estate", blocks: [block], labelFor });
  FactInspector({ fact, labelFor });

  expect(JSON.stringify([block]) === blocksBefore, `[12] the input BriefBlock/Seg structure was mutated`);
  expect(JSON.stringify(fact) === factBefore, `[12] the input WorkspaceFact was mutated`);
}

console.log(`understanding-primitives: ${pass} checks pass (${fail} fail)`);
if (fail > 0) {
  console.error(failures.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
