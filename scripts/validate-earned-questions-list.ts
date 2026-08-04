/**
 * Build gate for EarnedQuestionsList (Milestone 1, Commit 8; extended in
 * Commit 11B for the zero-question rendering): proves the component
 * renders an already-computed EarnedQuestion[] exactly as supplied — every
 * question once, in order, as plain text — and never drifts into
 * gap/blocker/priority/next-step terminology or renders any of the fields
 * the approved ruling reserves (weight, evidence, options). Commit 11B
 * adds coverage that the empty-array state renders an honest, neutral
 * "Questions" card instead of null, and that neither state implies
 * completeness, readiness or success.
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

/** Finds every h3 in a rendered tree (helper reused by several checks). */
function findHeadings(el: AnyEl): { type: unknown; props?: Record<string, unknown> }[] {
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
}

/* 1. Empty array no longer renders null — it renders the neutral card. ----- */
{
  const el = EarnedQuestionsList({ questions: [] });
  expect(el !== null, `[1] expected an empty questions array to render a neutral card, got null`);
}

/* 2. Empty array renders the heading exactly "Questions". ------------------ */
{
  const el = EarnedQuestionsList({ questions: [] });
  const headings = findHeadings(el);
  expect(headings.length === 1, `[2] expected exactly one h3 in the empty state, found ${headings.length}`);
  const headingText = flatten(headings[0]?.props?.children as AnyEl).join("");
  expect(headingText === "Questions", `[2] expected the empty-state heading to be exactly "Questions", got "${headingText}"`);
}

/* 3. Empty array renders the exact approved neutral copy. ------------------ */
{
  const flat = flatten(EarnedQuestionsList({ questions: [] })).join(" ");
  const APPROVED_EMPTY_COPY =
    "No questions are currently suggested from the information captured so far. You can continue adding or correcting detail at any time.";
  expect(flat.includes(APPROVED_EMPTY_COPY), `[3] expected the exact approved empty-state copy, got: ${flat}`);
}

/* Non-empty heading still renders exactly "Questions" (pre-existing check,  */
/* kept unchanged in substance, now split out from the old combined [2]).   */
{
  const el = EarnedQuestionsList({ questions: threeQuestions });
  const headings = findHeadings(el);
  expect(headings.length === 1, `[2b] expected exactly one h3, found ${headings.length}`);
  const headingText = flatten(headings[0]?.props?.children as AnyEl).join("");
  expect(headingText === "Questions", `[2b] expected the heading to be exactly "Questions", got "${headingText}"`);
}

/* Supporting line does not imply requirement, ranking or urgency (either    */
/* state), and the non-empty count phrasing matches the approved wording.  */
{
  const flat = flatten(EarnedQuestionsList({ questions: threeQuestions })).join(" | ");
  expect(flat.includes("3 questions could still sharpen this Understanding."), `[3b] expected the count-based supporting line, got: ${flat}`);
  const forbiddenInLine = ["must", "urgent", "priority", "recommend", "next step", "outstanding", "remaining", "required"];
  for (const term of forbiddenInLine) {
    expect(!flat.toLowerCase().includes(term), `[3b] supporting/heading text implies urgency/requirement via "${term}": ${flat}`);
  }
}

/* One-question state uses the singular form ("1 question could still       */
/* sharpen this Understanding.") — item 6 of the brief. --------------------- */
{
  const oneQuestion = [mkQuestion("q1", "Do you already run a SIEM your team monitors?")];
  const flat = flatten(EarnedQuestionsList({ questions: oneQuestion })).join(" | ");
  expect(flat.includes("1 question could still sharpen this Understanding."), `[6b] expected the singular count-based supporting line, got: ${flat}`);
  expect(!flat.includes("1 questions"), `[6b] singular count incorrectly pluralised: ${flat}`);
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

/* ------------------------------------------------------------------------ */
/* Commit 11B — zero-question rendering. Checks 16-21 below cover the       */
/* remaining items from the correction brief not already exercised above   */
/* (items 1-3, 6-10, 13 were satisfied by rewriting/reusing checks 1-3b,    */
/* 12-13 above; the rest are new).                                          */
/* ------------------------------------------------------------------------ */

/* 16. Empty state contains none of the completeness/readiness/success      */
/*     terms the brief explicitly forbids (item 4).                         */
{
  const flat = flatten(EarnedQuestionsList({ questions: [] })).join(" | ").toLowerCase();
  const forbiddenCompleteness = [
    "readiness",
    "ready",
    "complete",
    "completeness",
    "enough",
    "finished",
    "success",
    "approved",
    "progress",
    "market-ready",
    "publication-ready",
  ];
  for (const term of forbiddenCompleteness) {
    expect(!flat.includes(term), `[16] empty-state output contains the forbidden completeness/readiness term "${term}": ${flat}`);
  }
}

/* 17. Empty state has no checkmark or success badge (item 5) — no          */
/*     checkmark glyphs, "badge"/"success" wording, and no success/green    */
/*     colour utility classes on the card or its children. ------------------ */
{
  const el = EarnedQuestionsList({ questions: [] });
  const flat = flatten(el).join(" | ");
  expect(!/[✓✔☑]/.test(flat), `[17] empty-state output contains a checkmark glyph: ${flat}`);
  expect(!/\bbadge\b/i.test(flat), `[17] empty-state output mentions a "badge": ${flat}`);
  const classFlat = flat.toLowerCase();
  for (const term of ["bg-green", "text-green", "border-green", "bg-emerald", "text-emerald", "bg-lime"]) {
    expect(!classFlat.includes(term), `[17] empty-state rendered className list contains a success-colour utility "${term}"`);
  }
}

/* 18. No controls, callbacks or interactive elements in the empty state    */
/*     (item 12, empty-state variant of check [9]). -------------------------- */
{
  const el = EarnedQuestionsList({ questions: [] });
  const domTypes = collectDomTypes(el);
  const forbiddenTags = ["button", "input", "select", "textarea", "form", "a"];
  for (const tag of forbiddenTags) {
    expect(!domTypes.includes(tag), `[18] found a forbidden interactive element <${tag}> in the empty-state rendered tree: [${domTypes.join(", ")}]`);
  }
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
  expect(!hasCallbackProp, `[18] found a function-valued prop somewhere in the empty-state rendered tree — implies a callback`);
}

/* 19. Buyer-facing output (both states) does not contain the broader       */
/*     forbidden-term list from item 16 of the brief. ------------------------ */
{
  const forbidden16 = [
    "gap",
    "blocker",
    "missing",
    "required",
    "priority",
    "recommended",
    "next step",
    "next question",
    "outstanding",
    "remaining",
  ];
  const flatEmpty = flatten(EarnedQuestionsList({ questions: [] })).join(" | ").toLowerCase();
  const flatNonEmpty = flatten(EarnedQuestionsList({ questions: threeQuestions })).join(" | ").toLowerCase();
  for (const term of forbidden16) {
    expect(!flatEmpty.includes(term), `[19] empty-state output contains forbidden term "${term}": ${flatEmpty}`);
    expect(!flatNonEmpty.includes(term), `[19] non-empty-state output contains forbidden term "${term}": ${flatNonEmpty}`);
  }
}

/* 20. No sorting, filtering or deduplication is added — static source      */
/*     check (item 15): the questions array/prop is never passed through   */
/*     .sort(/.filter(/a dedupe helper before being mapped. ----------------- */
{
  const codeOnly = componentSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  expect(!/questions\s*\.\s*sort\s*\(/.test(codeOnly), `[20] component source appears to sort the questions array`);
  expect(!/questions\s*\.\s*filter\s*\(/.test(codeOnly), `[20] component source appears to filter the questions array`);
  expect(!/dedup/i.test(codeOnly), `[20] component source appears to deduplicate the questions array`);
  // The only array method used on `questions` should be the single .map()
  // that renders each item — proven positively, not just by absence.
  expect(/questions\s*\.\s*map\s*\(/.test(codeOnly), `[20] expected exactly a questions.map() render call`);
}

/* 21. Same neutral card treatment for both states — the outer <section>'s  */
/*     className is identical regardless of question count, and contains   */
/*     no success/warning/urgency colour utility. ---------------------------- */
{
  const emptyEl = EarnedQuestionsList({ questions: [] }) as { type: unknown; props?: Record<string, unknown> };
  const nonEmptyEl = EarnedQuestionsList({ questions: threeQuestions }) as { type: unknown; props?: Record<string, unknown> };
  const emptyClass = emptyEl?.props?.className as string;
  const nonEmptyClass = nonEmptyEl?.props?.className as string;
  expect(typeof emptyClass === "string" && emptyClass.length > 0, `[21] expected the empty-state root element to have a className`);
  expect(emptyClass === nonEmptyClass, `[21] expected the same card className for both states, got "${emptyClass}" vs "${nonEmptyClass}"`);
  const forbiddenColour = ["green", "emerald", "amber", "yellow", "red", "warning", "success", "danger"];
  for (const term of forbiddenColour) {
    expect(!emptyClass?.toLowerCase().includes(term), `[21] card className contains a non-neutral colour utility "${term}": ${emptyClass}`);
  }
}

console.log(`earned-questions-list: ${pass} checks pass (${fail} fail)`);
if (fail > 0) {
  console.error(failures.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
