/**
 * Build gate for EarnedQuestionsList (Milestone 1, Commit 8): proves the
 * component renders an already-computed EarnedQuestion[] exactly as
 * supplied — every question once, in order, as plain text — and never
 * drifts into gap/blocker/priority/next-step terminology or renders any
 * of the fields the approved ruling reserves (weight, evidence, options).
 *
 * Tooling limitation, reported honestly (same as every prior Understanding
 * primitives gate in this milestone): this repository has no jsdom or
 * React testing library, and none is added here. EarnedQuestionsList is
 * stateless and hookless, so it is called DIRECTLY AS A PLAIN FUNCTION and
 * its returned React element tree — a plain object graph — is walked and
 * inspected. This proves everything the required behaviour depends on
 * structurally, not real browser layout or interaction.
 *
 * Not yet wired into `npm run validate` — see the Commit 8 report for why.
 */

import { readFileSync } from "node:fs";
import EarnedQuestionsList from "../src/components/preview/EarnedQuestionsList";
import type { EarnedQuestion } from "../src/lib/workspace/questions";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function expect(cond: boolean, msg: string) {
  if (cond) pass += 1;
  else { fail += 1; failures.push(msg); }
}

/* ---- Minimal, dependency-free React-element tree walker (same         */
/*      approach as every prior Understanding primitives gate). ---------- */

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
  if (typeof el.type === "function") {
    const rendered = (el.type as (props: Record<string, unknown>) => AnyEl)(el.props ?? {});
    flatten(rendered, out);
    return out;
  }
  if (el.props && typeof el.props.className === "string") out.push(el.props.className);
  if (el.props && "children" in el.props) flatten(el.props.children as AnyEl, out);
  return out;
}

/** Collects every DOM element type string in the tree (e.g. "button",
 *  "input") — used to prove no answer control exists. */
function collectDomTypes(node: AnyEl, out: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") return out;
  if (Array.isArray(node)) {
    for (const child of node) collectDomTypes(child, out);
    return out;
  }
  const el = node as { type: unknown; props?: Record<string, unknown> };
  if (typeof el.type === "string") out.push(el.type);
  if (typeof el.type === "function") {
    const rendered = (el.type as (props: Record<string, unknown>) => AnyEl)(el.props ?? {});
    collectDomTypes(rendered, out);
    return out;
  }
  if (el.props && "children" in el.props) collectDomTypes(el.props.children as AnyEl, out);
  return out;
}

/* ---- Fixtures, using the real EarnedQuestion type ------------------------ */

function mkQuestion(id: string, question: string, extra: Partial<EarnedQuestion> = {}): EarnedQuestion {
  return {
    id,
    question,
    section: "estate",
    weight: 7,
    options: [{ label: "Yes", answer: { kind: "note", text: "yes" } }],
    evidence: [{ source: "bing_ai_live", query: "sase vendors uk", citations: 1234, note: "sample" }],
    ...extra,
  };
}

const threeQuestions: EarnedQuestion[] = [
  mkQuestion("q1", "Do you already run a SIEM your team monitors?"),
  mkQuestion("q2", "How many of your sites carry PCI-scoped traffic?"),
  mkQuestion("q3", "Is your existing network contract close to renewal?"),
];

const componentSource = readFileSync(
  new URL("../src/components/preview/EarnedQuestionsList.tsx", import.meta.url),
  "utf8",
);

/* 1. Empty array renders null. --------------------------------------------- */
{
  const el = EarnedQuestionsList({ questions: [] });
  expect(el === null, `[1] expected an empty questions array to render null, got ${JSON.stringify(el)}`);
}

/* 2. Heading renders exactly "Questions". ---------------------------------- */
{
  const el = EarnedQuestionsList({ questions: threeQuestions });
  const headings = (() => {
    const out: { type: unknown; props?: Record<string, unknown> }[] = [];
    const walk = (node: AnyEl) => {
      if (node === null || node === undefined || typeof node === "boolean" || typeof node === "string" || typeof node === "number") return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      const e = node as { type: unknown; props?: Record<string, unknown> };
      if (e.type === "h3") out.push(e);
      if (e.props && "children" in e.props) walk(e.props.children as AnyEl);
    };
    walk(el);
    return out;
  })();
  expect(headings.length === 1, `[2] expected exactly one h3, found ${headings.length}`);
  const headingText = flatten(headings[0]?.props?.children as AnyEl).join("");
  expect(headingText === "Questions", `[2] expected the heading to be exactly "Questions", got "${headingText}"`);
}

/* 3. Supporting line does not imply requirement, ranking or urgency. ------- */
{
  const flat = flatten(EarnedQuestionsList({ questions: threeQuestions })).join(" | ");
  expect(flat.includes("Questions that would sharpen this further."), `[3] expected the fixed supporting line, got: ${flat}`);
  const forbiddenInLine = ["must", "required", "urgent", "priority", "recommend", "next step"];
  for (const term of forbiddenInLine) {
    expect(!flat.toLowerCase().includes(term), `[3] supporting/heading text implies urgency/requirement via "${term}": ${flat}`);
  }
}

/* 4. Every supplied question text renders exactly once. -------------------- */
{
  const flat = flatten(EarnedQuestionsList({ questions: threeQuestions }));
  for (const q of threeQuestions) {
    const occurrences = flat.filter((s) => s === q.question).length;
    expect(occurrences === 1, `[4] expected "${q.question}" to render exactly once, found ${occurrences}`);
  }
}

/* 5. Input order is preserved. ---------------------------------------------- */
{
  const flat = flatten(EarnedQuestionsList({ questions: threeQuestions }));
  const indices = threeQuestions.map((q) => flat.indexOf(q.question));
  expect(indices.every((i) => i >= 0), `[5] expected all three questions to be found in the rendered output`);
  expect(indices[0]! < indices[1]! && indices[1]! < indices[2]!, `[5] expected input order preserved, got indices ${indices.join(", ")}`);

  // Reversed input must produce reversed output.
  const reversed = [...threeQuestions].reverse();
  const flatReversed = flatten(EarnedQuestionsList({ questions: reversed }));
  const indicesReversed = reversed.map((q) => flatReversed.indexOf(q.question));
  expect(
    indicesReversed[0]! < indicesReversed[1]! && indicesReversed[1]! < indicesReversed[2]!,
    `[5] expected reversed input to render in reversed order`,
  );
}

/* 6. The component does not render question weights. ------------------------ */
{
  const flat = flatten(EarnedQuestionsList({ questions: [mkQuestion("qw", "Does your firewall estate need refreshing?", { weight: 4242 })] })).join(" | ");
  expect(!flat.includes("4242"), `[6] the question's weight leaked into rendered output: ${flat}`);
}

/* 7. The component does not render evidence. --------------------------------- */
{
  const q = mkQuestion("qe", "Do you already have cyber insurance in place?", {
    evidence: [{ source: "bing_ai_live", query: "cyber insurance sme uk", citations: 987654, note: "distinctive-citation-marker" }],
  });
  const flat = flatten(EarnedQuestionsList({ questions: [q] })).join(" | ");
  expect(!flat.includes("987654"), `[7] evidence citation count leaked into rendered output: ${flat}`);
  expect(!flat.includes("distinctive-citation-marker"), `[7] evidence note leaked into rendered output: ${flat}`);
  expect(!flat.includes("bing_ai_live"), `[7] evidence source leaked into rendered output: ${flat}`);
}

/* 8. The component does not render options. ---------------------------------- */
{
  const q = mkQuestion("qo", "Would you consider a co-managed operating model?", {
    options: [{ label: "DISTINCTIVE-OPTION-LABEL", answer: { kind: "note", text: "distinctive-answer-text" } }],
  });
  const flat = flatten(EarnedQuestionsList({ questions: [q] })).join(" | ");
  expect(!flat.includes("DISTINCTIVE-OPTION-LABEL"), `[8] option label leaked into rendered output: ${flat}`);
  expect(!flat.includes("distinctive-answer-text"), `[8] option answer text leaked into rendered output: ${flat}`);
}

/* 9. The component has no callbacks or answer controls. ---------------------- */
{
  const el = EarnedQuestionsList({ questions: threeQuestions });
  const domTypes = collectDomTypes(el);
  const forbiddenTags = ["button", "input", "select", "textarea", "form", "a"];
  for (const tag of forbiddenTags) {
    expect(!domTypes.includes(tag), `[9] found a forbidden interactive element <${tag}> in the rendered tree: [${domTypes.join(", ")}]`);
  }
  // No function-valued props anywhere (a callback would show up as a prop
  // whose value is a function on some element in the tree).
  const hasCallbackProp = (() => {
    let found = false;
    const walk = (node: AnyEl) => {
      if (found || node === null || node === undefined || typeof node === "boolean" || typeof node === "string" || typeof node === "number") return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      const e = node as { type: unknown; props?: Record<string, unknown> };
      if (e.props) {
        for (const [k, v] of Object.entries(e.props)) {
          if (k !== "children" && typeof v === "function") found = true;
        }
      }
      if (e.props && "children" in e.props) walk(e.props.children as AnyEl);
    };
    walk(el);
    return found;
  })();
  expect(!hasCallbackProp, `[9] found a function-valued prop somewhere in the rendered tree — implies a callback`);
}

/* 10. No question is styled or labelled as "next", "top", "priority" or    */
/*     "recommended". ---------------------------------------------------------*/
{
  const flat = flatten(EarnedQuestionsList({ questions: threeQuestions })).join(" | ").toLowerCase();
  for (const term of ["next", "top", "priority", "recommended"]) {
    expect(!flat.includes(term), `[10] forbidden singling-out term "${term}" found in rendered output: ${flat}`);
  }
}

/* 11. Rendered buyer-facing output does not contain forbidden terms. -------- */
{
  const flat = flatten(EarnedQuestionsList({ questions: threeQuestions })).join(" | ").toLowerCase();
  const forbidden = ["gap", "unresolved", "missing", "blocker", "required", "priority", "recommended", "next step", "next question"];
  for (const term of forbidden) {
    expect(!flat.includes(term), `[11] forbidden term "${term}" found in rendered output: ${flat}`);
  }
}

/* 12. Input array and objects remain unmodified. ---------------------------- */
{
  const questions = threeQuestions.map((q) => ({ ...q }));
  const before = JSON.stringify(questions);
  EarnedQuestionsList({ questions });
  expect(JSON.stringify(questions) === before, `[12] the input questions array or its objects were mutated`);
}

/* 13. Duplicate question text in the input remains duplicated in output. --- */
{
  const dupQuestions: EarnedQuestion[] = [
    mkQuestion("dup1", "Do you have a named security lead?"),
    mkQuestion("dup2", "Do you have a named security lead?"),
  ];
  const flat = flatten(EarnedQuestionsList({ questions: dupQuestions }));
  const occurrences = flat.filter((s) => s === "Do you have a named security lead?").length;
  expect(occurrences === 2, `[13] expected the duplicate question text to render twice (no silent dedup), found ${occurrences}`);
}

/* 14. The component does not call earnedQuestions() itself. ---------------- */
{
  // Static source assertion, scoped to actual import/code statements
  // rather than prose: strip line comments and block comments first, so
  // this doesn't false-positive on the file's own doc comment explaining
  // that it does NOT call earnedQuestions() (which necessarily contains
  // the literal text "earnedQuestions()").
  const codeOnly = componentSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  expect(!/\bearnedQuestions\s*\(/.test(codeOnly), `[14] the component's actual code (comments excluded) appears to call earnedQuestions()`);
  expect(!/import\s*\{[^}]*\bearnedQuestions\b[^}]*\}/.test(codeOnly), `[14] the component's actual code (comments excluded) imports earnedQuestions as a value`);
}

/* 15. The component imports and uses the production EarnedQuestion type. --- */
{
  expect(
    /import\s+type\s*\{\s*EarnedQuestion\s*\}\s*from\s*"@\/lib\/workspace\/questions"/.test(componentSource),
    `[15] expected the component to import the production EarnedQuestion type from @/lib/workspace/questions`,
  );
  expect(!/type\s+EarnedQuestion\s*=/.test(componentSource), `[15] the component source appears to redefine EarnedQuestion instead of importing it`);
}

console.log(`earned-questions-list: ${pass} checks pass (${fail} fail)`);
if (fail > 0) {
  console.error(failures.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
