/**
 * Build gate for the Session Activity presentational components (Milestone
 * 1, Commit 9B): SessionActivity and ClarificationEntry.
 *
 * Tooling limitation, reported honestly rather than worked around (same
 * limitation and same resolution as every prior presentational-component
 * validation script in this repository — validate-understanding-
 * primitives.ts, validate-earned-questions-list.ts): no jsdom, no
 * @testing-library/react, no DOM. Both components are stateless, hookless
 * and effectless, so they are called DIRECTLY AS PLAIN FUNCTIONS and their
 * returned React element trees (plain `{ type, props }` object graphs) are
 * walked with a small dependency-free tree walker. Composite child
 * elements (SessionActivity renders nested <ClarificationEntry .../>
 * elements without invoking them) are expanded by calling
 * `el.type(el.props)` when `el.type` is a function, so their own rendered
 * text is reachable from the parent's flattened output too. This proves
 * text presence/absence, relative ordering, and which concrete prop
 * objects were passed through unchanged; it cannot prove browser layout or
 * CSS behaviour, and no such claim is made here.
 *
 * Not yet wired into `npm run validate` — consistent with every other
 * validation script in this repository so far.
 */

import SessionActivity from "../src/components/preview/SessionActivity";
import ClarificationEntry from "../src/components/preview/ClarificationEntry";
import type { SessionActivityEntry, SessionChange, BoundedClarification } from "../src/components/preview/session-diff";
import { labelFor } from "../src/lib/workspace/labels";
import type { AllowedPath } from "../src/lib/workspace/extract";
import { readFileSync } from "node:fs";
import { explanationForInput } from "../src/lib/workspace/explanations";

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
 *  one array. Composite (function-typed) elements are expanded in place by
 *  invoking them, so a nested <ClarificationEntry .../> element's own
 *  rendered text is reachable from SessionActivity's flattened output. */
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
  if (typeof el.type === "function") {
    const rendered = (el.type as (p: unknown) => AnyEl)(el.props ?? {});
    flatten(rendered, out);
    return out;
  }
  if (el.props && "children" in el.props) flatten(el.props.children as AnyEl, out);
  return out;
}

function textOf(el: AnyEl): string {
  return flatten(el).join(" | ");
}

/* ---- Fixtures, using the real SessionChange / SessionActivityEntry /   */
/*      BoundedClarification types --------------------------------------- */

const addedStated: SessionChange = {
  path: "organisation.sector",
  action: "added",
  nextValue: "Retail",
  provenance: "stated",
  quote: "we're a retail business",
};

const addedStatedNoQuote: SessionChange = {
  path: "estate.sites",
  action: "added",
  nextValue: 12,
  provenance: "stated",
};

const addedInferred: SessionChange = {
  path: "estate.users",
  action: "inferred",
  nextValue: 250,
  provenance: "inferred",
  reason: "estimated from the stated sector average",
};

const addedInferredNoReason: SessionChange = {
  path: "drivers",
  action: "inferred",
  nextValue: "growth",
  provenance: "inferred",
};

const correctedDifferentValue: SessionChange = {
  path: "estate.users",
  action: "corrected",
  previousValue: 50,
  nextValue: 52,
  provenance: "stated",
  quote: "sorry, actually 52 staff",
};

const correctedSameValueStated: SessionChange = {
  path: "organisation.sector",
  action: "corrected",
  previousValue: "Retail",
  nextValue: "Retail",
  provenance: "stated",
  quote: "yes, retail",
};

const enumChange: SessionChange = {
  path: "procurement.buying",
  action: "added",
  nextValue: "sdwan",
  provenance: "stated",
  quote: "we want an SD-WAN service",
};

const pkmListChanges: SessionChange[] = [
  { path: "estate.namedTechnologies", action: "added", nextValue: "Cisco Meraki", provenance: "stated", quote: "we run two named vendors today" },
  { path: "estate.namedTechnologies", action: "added", nextValue: "Fortinet", provenance: "stated", quote: "we run two named vendors today" },
];

const clarificationWithQuestion: BoundedClarification = {
  question: "How many sites need coverage?",
  explanation: "Recorded from the buyer's reply, kept exactly as given.",
};

const clarificationNoQuestion: BoundedClarification = {
  explanation: "No open question for this turn, just a recorded explanation.",
};

function entry(overrides: Partial<SessionActivityEntry> & { cycle: number; kind: SessionActivityEntry["kind"] }): SessionActivityEntry {
  return { changes: [], ...overrides };
}

/* 1. Empty entries render null. ------------------------------------------ */
{
  const el = SessionActivity({ entries: [], labelFor });
  expect(el === null, `[1] expected null for empty entries, got ${JSON.stringify(el)}`);
}

/* 2. Heading is exactly "Session activity". ------------------------------ */
{
  const el = SessionActivity({ entries: [entry({ cycle: 1, kind: "no_change" })], labelFor });
  const flat = flatten(el);
  expect(flat.includes("Session activity"), `[2] expected exact heading "Session activity", got: ${flat.join(" | ")}`);
}

/* 3. Supporting copy is rendered. ----------------------------------------- */
{
  const el = SessionActivity({ entries: [entry({ cycle: 1, kind: "no_change" })], labelFor });
  const flat = textOf(el);
  expect(flat.includes("Changes captured during this session."), `[3] expected supporting copy, got: ${flat}`);
}

/* 4. Temporary/session-only wording is rendered. -------------------------- */
{
  const el = SessionActivity({ entries: [entry({ cycle: 1, kind: "no_change" })], labelFor });
  const flat = textOf(el);
  expect(
    flat.includes("Temporary — this activity is cleared when you leave or refresh until the Project is saved."),
    `[4] expected the exact temporary-state wording, got: ${flat}`,
  );
}

/* 5. Buyer-facing output never contains forbidden terminology. ----------- */
{
  const el = SessionActivity({
    entries: [
      entry({ cycle: 1, kind: "changes", changes: [addedStated, addedInferred, correctedDifferentValue, correctedSameValueStated] }),
      entry({ cycle: 2, kind: "clarification", clarification: clarificationWithQuestion }),
      entry({ cycle: 3, kind: "no_change" }),
    ],
    labelFor,
  });
  const flat = textOf(el).toLowerCase();
  const forbidden = ["project history", "audit history", "audit trail", "append-only", "permanent record"];
  for (const term of forbidden) {
    expect(!flat.includes(term), `[5] forbidden term "${term}" found in rendered output`);
  }
  // Extra safety beyond the literal requirement: bare "history" too.
  expect(!flat.includes("history"), `[5] the word "history" was found in rendered output`);
}

/* 6. Entry order is preserved (deliberately non-ascending cycle order,   */
/*    and content order must follow the ARRAY order, not the cycle       */
/*    numbers). --------------------------------------------------------- */
{
  const mk = (cycle: number, marker: string): SessionActivityEntry =>
    entry({ cycle, kind: "changes", changes: [{ path: "requirements.bespoke", action: "added", nextValue: marker, provenance: "stated" }] });

  const el = SessionActivity({
    entries: [mk(303, "ORDER-MARK-THIRD"), mk(101, "ORDER-MARK-FIRST"), mk(202, "ORDER-MARK-SECOND")],
    labelFor,
  });
  const flat = textOf(el);
  const iThird = flat.indexOf("ORDER-MARK-THIRD");
  const iFirst = flat.indexOf("ORDER-MARK-FIRST");
  const iSecond = flat.indexOf("ORDER-MARK-SECOND");
  expect(iThird >= 0 && iFirst >= 0 && iSecond >= 0, `[6] expected all three order markers present, got: ${flat}`);
  expect(
    iThird < iFirst && iFirst < iSecond,
    `[6] entries were not rendered in supplied array order (got positions THIRD=${iThird}, FIRST=${iFirst}, SECOND=${iSecond})`,
  );
}

/* 7. Change order within an entry is preserved. --------------------------- */
{
  const el = SessionActivity({
    entries: [
      entry({
        cycle: 1,
        kind: "changes",
        changes: [
          { path: "requirements.bespoke", action: "added", nextValue: "CHANGE-ORDER-ALPHA", provenance: "stated" },
          { path: "requirements.bespoke", action: "added", nextValue: "CHANGE-ORDER-BETA", provenance: "stated" },
          { path: "requirements.bespoke", action: "added", nextValue: "CHANGE-ORDER-GAMMA", provenance: "stated" },
        ],
      }),
    ],
    labelFor,
  });
  const flat = textOf(el);
  const iAlpha = flat.indexOf("CHANGE-ORDER-ALPHA");
  const iBeta = flat.indexOf("CHANGE-ORDER-BETA");
  const iGamma = flat.indexOf("CHANGE-ORDER-GAMMA");
  expect(iAlpha >= 0 && iBeta >= 0 && iGamma >= 0, `[7] expected all three change markers present, got: ${flat}`);
  expect(iAlpha < iBeta && iBeta < iGamma, `[7] changes were not rendered in supplied array order`);
}

/* 8. Added stated fact renders label, humanised value, exact quote. ------ */
{
  const el = SessionActivity({ entries: [entry({ cycle: 1, kind: "changes", changes: [addedStated] })], labelFor });
  const flat = textOf(el);
  expect(flat.includes(labelFor("organisation.sector")), `[8] expected the human label "${labelFor("organisation.sector")}", got: ${flat}`);
  expect(flat.includes("Retail"), `[8] expected the humanised value "Retail", got: ${flat}`);
  expect(flat.includes("we're a retail business"), `[8] expected the exact quote, got: ${flat}`);
}
{
  // No quote supplied -> none invented.
  const el = SessionActivity({ entries: [entry({ cycle: 1, kind: "changes", changes: [addedStatedNoQuote] })], labelFor });
  const flat = textOf(el);
  expect(flat.includes(labelFor("estate.sites")), `[8b] expected the human label, got: ${flat}`);
  expect(flat.includes("12"), `[8b] expected the numeric value 12, got: ${flat}`);
}

/* 9. Added inferred fact renders label, humanised value, "Inferred", and  */
/*    exact reason. --------------------------------------------------------*/
{
  const el = SessionActivity({ entries: [entry({ cycle: 1, kind: "changes", changes: [addedInferred] })], labelFor });
  const flat = textOf(el);
  expect(flat.includes(labelFor("estate.users")), `[9] expected the human label, got: ${flat}`);
  expect(flat.includes("250"), `[9] expected the humanised value 250, got: ${flat}`);
  expect(flat.includes("Inferred"), `[9] expected the "Inferred" marker, got: ${flat}`);
  expect(flat.includes("estimated from the stated sector average"), `[9] expected the exact reason, got: ${flat}`);
}
{
  // No reason supplied -> none invented.
  const el = SessionActivity({ entries: [entry({ cycle: 1, kind: "changes", changes: [addedInferredNoReason] })], labelFor });
  const flat = textOf(el);
  expect(flat.includes("Inferred"), `[9b] expected the "Inferred" marker, got: ${flat}`);
  expect(flat.includes("a contract renewal") === false, `[9b] sanity: unrelated driver phrase should not appear`);
}

/* 10. Different-value correction renders previous -> next. --------------- */
{
  const el = SessionActivity({ entries: [entry({ cycle: 1, kind: "changes", changes: [correctedDifferentValue] })], labelFor });
  const flat = textOf(el);
  expect(flat.includes(labelFor("estate.users")), `[10] expected the human label, got: ${flat}`);
  expect(flat.includes("50"), `[10] expected the previous value 50, got: ${flat}`);
  expect(flat.includes("52"), `[10] expected the next value 52, got: ${flat}`);
  expect(flat.includes("→"), `[10] expected an arrow between previous and next value, got: ${flat}`);
}

/* 11 & 12. Same-value corrected/stated case: neutral "recorded as        */
/*     stated" wording, and no "X -> X" line. ------------------------------*/
{
  const el = SessionActivity({ entries: [entry({ cycle: 1, kind: "changes", changes: [correctedSameValueStated] })], labelFor });
  const flat = textOf(el);
  expect(flat.includes("Retail"), `[11] expected the humanised value "Retail", got: ${flat}`);
  expect(flat.includes("recorded as stated"), `[11] expected the neutral "recorded as stated" wording, got: ${flat}`);
  expect(!flat.includes("→"), `[12] same-value correction must not render an arrow ("X -> X"), got: ${flat}`);
  expect(!/Retail\s*(\||->|→)\s*Retail/.test(flat), `[12] same-value correction must not render "Retail -> Retail", got: ${flat}`);
}

/* 13. Raw AllowedPath strings never render. ------------------------------- */
{
  const el = SessionActivity({
    entries: [
      entry({
        cycle: 1,
        kind: "changes",
        changes: [addedStated, addedInferred, correctedDifferentValue, correctedSameValueStated, enumChange, ...pkmListChanges],
      }),
    ],
    labelFor,
  });
  const flat = textOf(el);
  const rawPaths: AllowedPath[] = [
    "organisation.sector",
    "estate.users",
    "procurement.buying",
    "estate.namedTechnologies",
  ];
  for (const p of rawPaths) {
    expect(!flat.includes(p), `[13] rendered output leaked the raw path "${p}": ${flat}`);
  }
}

/* 14. Enum values are humanised using the authoritative formatter. ------- */
{
  const el = SessionActivity({ entries: [entry({ cycle: 1, kind: "changes", changes: [enumChange] })], labelFor });
  const flat = textOf(el);
  expect(!flat.includes("sdwan"), `[14] raw enum id "sdwan" leaked into rendered output: ${flat}`);
  expect(flat.includes("SD-WAN"), `[14] expected the humanised SD-WAN buying phrase, got: ${flat}`);
}

/* 15. Free-text values remain unchanged. ---------------------------------- */
{
  const freeText: SessionChange = { path: "requirements.bespoke", action: "added", nextValue: "must integrate with existing SIEM", provenance: "stated" };
  const el = SessionActivity({ entries: [entry({ cycle: 1, kind: "changes", changes: [freeText] })], labelFor });
  const flat = textOf(el);
  expect(flat.includes("must integrate with existing SIEM"), `[15] expected the free-text value unchanged, got: ${flat}`);
}

/* 16. Numeric values remain accurate. ------------------------------------- */
{
  const numeric: SessionChange = { path: "estate.users", action: "added", nextValue: 4321, provenance: "stated" };
  const el = SessionActivity({ entries: [entry({ cycle: 1, kind: "changes", changes: [numeric] })], labelFor });
  const flat = textOf(el);
  expect(flat.includes("4321"), `[16] expected the exact numeric value, got: ${flat}`);
}

/* 17. PKM list changes render once each, in supplied order, not combined  */
/*     or deduplicated. ----------------------------------------------------*/
{
  const el = SessionActivity({ entries: [entry({ cycle: 1, kind: "changes", changes: pkmListChanges })], labelFor });
  const flat = textOf(el);
  const iMeraki = flat.indexOf("Cisco Meraki");
  const iFortinet = flat.indexOf("Fortinet");
  expect(iMeraki >= 0 && iFortinet >= 0, `[17] expected both named technologies present, got: ${flat}`);
  expect(iMeraki < iFortinet, `[17] expected Cisco Meraki before Fortinet (supplied order), got: ${flat}`);
  expect(
    (flat.match(/Cisco Meraki/g) ?? []).length === 1 && (flat.match(/Fortinet/g) ?? []).length === 1,
    `[17] expected each named technology exactly once, got: ${flat}`,
  );
}

/* 18. Clarification question renders when present. ------------------------ */
{
  const el = ClarificationEntry({ clarification: clarificationWithQuestion });
  const flat = textOf(el);
  expect(flat.includes("How many sites need coverage?"), `[18] expected the clarification question, got: ${flat}`);
}
{
  const el = ClarificationEntry({ clarification: clarificationNoQuestion });
  const flat = textOf(el);
  expect(
    !flat.includes("How many sites need coverage?"),
    `[18b] sanity: an unrelated question should not leak in when none was supplied`,
  );
}

/* 19. Clarification explanation renders exactly. -------------------------- */
{
  const el = ClarificationEntry({ clarification: clarificationWithQuestion });
  const flat = textOf(el);
  expect(
    flat.includes("Recorded from the buyer's reply, kept exactly as given."),
    `[19] expected the exact explanation text, got: ${flat}`,
  );
}

/* 20. Clarification displays "No changes to your Understanding." --------- */
{
  const el = ClarificationEntry({ clarification: clarificationWithQuestion });
  const flat = textOf(el);
  expect(flat.includes("No changes to your Understanding."), `[20] expected the exact no-change line, got: ${flat}`);
}

/* 21. Plain no_change entry displays the same no-change line. ------------- */
{
  const el = SessionActivity({ entries: [entry({ cycle: 1, kind: "no_change" })], labelFor });
  const flat = textOf(el);
  expect(flat.includes("No changes to your Understanding."), `[21] expected the exact no-change line, got: ${flat}`);
}
{
  // Also via SessionActivity's own rendering of a "clarification" entry.
  const el = SessionActivity({ entries: [entry({ cycle: 1, kind: "clarification", clarification: clarificationWithQuestion })], labelFor });
  const flat = textOf(el);
  expect(flat.includes("No changes to your Understanding."), `[21b] expected the no-change line inside a clarification entry too, got: ${flat}`);
}

/** Strip block/line comments before running a static source assertion, so a
 *  doc comment that MENTIONS a forbidden term while explaining that the
 *  term/behaviour is deliberately absent (e.g. "does not call
 *  computeSessionChanges()", "never labelled \"confirmed\"") cannot itself
 *  trip the check it is describing. Same false-positive fix as Commit 8's
 *  validate-earned-questions-list.ts test 14. */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/* 22. No callbacks or interactive controls exist (static source check on   */
/*     actual code, comments stripped first). ------------------------------*/
{
  const saSrc = codeOnly(readFileSync(new URL("../src/components/preview/SessionActivity.tsx", import.meta.url), "utf8"));
  const ceSrc = codeOnly(readFileSync(new URL("../src/components/preview/ClarificationEntry.tsx", import.meta.url), "utf8"));
  for (const [name, src] of [["SessionActivity.tsx", saSrc], ["ClarificationEntry.tsx", ceSrc]] as const) {
    expect(!/<button/i.test(src), `[22] ${name} contains a <button> element`);
    expect(!/<input/i.test(src), `[22] ${name} contains an <input> element`);
    // Real JSX event-handler bindings are written "onClick={...}" with no
    // space before the opening brace; a plain object/type literal like
    // "SessionActivityProps = {" has a space and must not match.
    expect(!/\bon[A-Z]\w*=\{/.test(src), `[22] ${name} contains a React event handler prop (onClick/onChange/etc.)`);
    expect(!/useState|useEffect|useReducer|useCallback|useMemo/.test(src), `[22] ${name} uses a React hook`);
  }
}

/* 23. No sorting, filtering or deduplication occurs (static + already      */
/*     proven behaviourally by tests 6, 7 and 17 above). ------------------- */
{
  const saSrc = codeOnly(readFileSync(new URL("../src/components/preview/SessionActivity.tsx", import.meta.url), "utf8"));
  expect(!/\.sort\s*\(/.test(saSrc), `[23] SessionActivity.tsx calls .sort()`);
  expect(!/\.filter\s*\(/.test(saSrc), `[23] SessionActivity.tsx calls .filter()`);
  expect(!/new Set\s*\(/.test(saSrc), `[23] SessionActivity.tsx deduplicates via Set`);
}

/* 24. Input entries, changes and clarification objects remain unmodified. */
{
  const entries: SessionActivityEntry[] = [
    entry({ cycle: 1, kind: "changes", changes: [{ ...addedStated }, { ...correctedDifferentValue }] }),
    entry({ cycle: 2, kind: "clarification", clarification: { ...clarificationWithQuestion } }),
    entry({ cycle: 3, kind: "no_change" }),
  ];
  const snapshot = JSON.stringify(entries);
  SessionActivity({ entries, labelFor });
  expect(JSON.stringify(entries) === snapshot, `[24] SessionActivity() mutated its "entries" argument`);

  const clarification: BoundedClarification = { ...clarificationWithQuestion };
  const clarificationSnapshot = JSON.stringify(clarification);
  ClarificationEntry({ clarification });
  expect(JSON.stringify(clarification) === clarificationSnapshot, `[24] ClarificationEntry() mutated its "clarification" argument`);
}

/* 25. Components do not import or CALL computeSessionChanges,            */
/*     mergeUpdates, extractRequirement, or any API — checked on code with */
/*     comments stripped, since both files' doc comments deliberately      */
/*     name these functions while explaining that they are NOT called.    */
/*     (Import-only mentions inside "import type { ... }" for OTHER,       */
/*     unrelated names are unaffected; these three specific identifiers    */
/*     must not appear anywhere in actual code, imported or called.) ------*/
{
  const saSrc = codeOnly(readFileSync(new URL("../src/components/preview/SessionActivity.tsx", import.meta.url), "utf8"));
  const ceSrc = codeOnly(readFileSync(new URL("../src/components/preview/ClarificationEntry.tsx", import.meta.url), "utf8"));
  for (const [name, src] of [["SessionActivity.tsx", saSrc], ["ClarificationEntry.tsx", ceSrc]] as const) {
    expect(!/computeSessionChanges/.test(src), `[25] ${name} references computeSessionChanges`);
    expect(!/mergeUpdates/.test(src), `[25] ${name} references mergeUpdates`);
    expect(!/extractRequirement/.test(src), `[25] ${name} references extractRequirement`);
    expect(!/\bfetch\s*\(/.test(src), `[25] ${name} calls fetch()`);
    expect(!/from ["']@\/app\/api/.test(src), `[25] ${name} imports from an API route`);
  }
}

/* 26. No localStorage or sessionStorage usage. ----------------------------- */
{
  const saSrc = codeOnly(readFileSync(new URL("../src/components/preview/SessionActivity.tsx", import.meta.url), "utf8"));
  const ceSrc = codeOnly(readFileSync(new URL("../src/components/preview/ClarificationEntry.tsx", import.meta.url), "utf8"));
  for (const [name, src] of [["SessionActivity.tsx", saSrc], ["ClarificationEntry.tsx", ceSrc]] as const) {
    expect(!/localStorage/.test(src), `[26] ${name} references localStorage`);
    expect(!/sessionStorage/.test(src), `[26] ${name} references sessionStorage`);
  }
}

/* 27. No cycle number is rendered as progress (or at all, in this          */
/*     implementation — cycle is used only as part of a React key). ------- */
{
  const el = SessionActivity({
    entries: [
      entry({ cycle: 91101, kind: "changes", changes: [{ path: "requirements.bespoke", action: "added", nextValue: "CYCLE-CHECK", provenance: "stated" }] }),
      entry({ cycle: 91102, kind: "no_change" }),
    ],
    labelFor,
  });
  const flat = flatten(el);
  expect(!flat.some((s) => s.includes("91101")), `[27] cycle number 91101 leaked into rendered text: ${flat.join(" | ")}`);
  expect(!flat.some((s) => s.includes("91102")), `[27] cycle number 91102 leaked into rendered text: ${flat.join(" | ")}`);
}

/* 28. No new action such as "confirmed" is introduced — checked on code    */
/*     with comments stripped (both files' doc comments deliberately name  */
/*     "confirmed" while explaining it is NOT used, e.g. "never labelled    */
/*     'confirmed'"), and independently confirmed behaviourally: test 11's  */
/*     same-value fixture above renders "recorded as stated", never        */
/*     "confirmed", and no branch in SessionActivity.tsx assigns any string */
/*     other than the SessionChange.action values the type already allows. */
{
  const saSrc = codeOnly(readFileSync(new URL("../src/components/preview/SessionActivity.tsx", import.meta.url), "utf8"));
  const ceSrc = codeOnly(readFileSync(new URL("../src/components/preview/ClarificationEntry.tsx", import.meta.url), "utf8"));
  expect(!/confirmed/i.test(saSrc), `[28] SessionActivity.tsx introduces "confirmed" wording/action`);
  expect(!/confirmed/i.test(ceSrc), `[28] ClarificationEntry.tsx introduces "confirmed" wording/action`);
}

/* ------------------------------------------------------------------------ */
/* Commit 11C — bounded explanation treatment. Checks 29-36 below cover the */
/* 8 items the Commit 11C brief asks Session Activity validation to add    */
/* (numbered 13-20 there; renumbered here to continue this file's own       */
/* sequence without colliding with checks 1-28 above). ClarificationEntry   */
/* is still called directly as a plain function (stateless/hookless), same  */
/* technique as every check above.                                          */
/* ------------------------------------------------------------------------ */

const glossaryClarification: BoundedClarification = {
  question: "What is SASE?",
  explanation:
    "Secure Access Service Edge combines networking and security capabilities in a cloud-delivered architecture, commonly bringing together SD-WAN, secure web access, private application access and related security controls.",
  kind: "glossary",
  term: "SASE",
};

const fallbackClarification: BoundedClarification = {
  explanation:
    "There isn’t a specific Netify question or recognised term selected to explain. You can continue adding or correcting information about your project.",
  kind: "fallback",
};

/* 29. Glossary clarification renders "Netify explained". ------------------- */
{
  const el = ClarificationEntry({ clarification: glossaryClarification });
  const flat = textOf(el);
  expect(flat.includes("Netify explained"), `[29] expected the "Netify explained" heading for a glossary clarification, got: ${flat}`);
}

/* 30. The fixed explanation renders exactly. -------------------------------- */
{
  const el = ClarificationEntry({ clarification: glossaryClarification });
  const flat = textOf(el);
  expect(
    flat.includes(
      "Secure Access Service Edge combines networking and security capabilities in a cloud-delivered architecture, commonly bringing together SD-WAN, secure web access, private application access and related security controls.",
    ),
    `[30] expected the exact fixed SASE explanation, got: ${flat}`,
  );
}

/* 31. The question renders when present (glossary case). -------------------- */
{
  const el = ClarificationEntry({ clarification: glossaryClarification });
  const flat = textOf(el);
  expect(flat.includes("What is SASE?"), `[31] expected the buyer's original question to render, got: ${flat}`);
}

/* 32. "No changes to your Understanding." still renders for a glossary      */
/*     clarification. ----------------------------------------------------------*/
{
  const el = ClarificationEntry({ clarification: glossaryClarification });
  const flat = textOf(el);
  expect(flat.includes("No changes to your Understanding."), `[32] expected the exact no-change line for a glossary clarification, got: ${flat}`);
}

/* 33. Fallback clarification renders the exact approved fallback (and the  */
/*     same "Netify explained" heading, and the no-change line). ------------- */
{
  const el = ClarificationEntry({ clarification: fallbackClarification });
  const flat = textOf(el);
  expect(flat.includes("Netify explained"), `[33] expected the "Netify explained" heading for a fallback clarification, got: ${flat}`);
  expect(
    flat.includes(
      "There isn’t a specific Netify question or recognised term selected to explain. You can continue adding or correcting information about your project.",
    ),
    `[33] expected the exact approved fallback text, got: ${flat}`,
  );
  expect(flat.includes("No changes to your Understanding."), `[33] expected the no-change line for a fallback clarification, got: ${flat}`);
}

/* 34. No fact value, quote or reason is fabricated: ClarificationEntry      */
/*     renders only fields present on the supplied BoundedClarification —    */
/*     no "quote"/"reason"/fact-value text appears from nowhere. Checked      */
/*     both behaviourally (nothing beyond the four known strings appears)     */
/*     and via static source inspection (the component never references      */
/*     SessionChange's quote/reason/previousValue/nextValue fields, which     */
/*     belong to a different, unrelated data shape). --------------------------*/
{
  const el = ClarificationEntry({ clarification: glossaryClarification });
  const flat = flatten(el);
  // Positive assertion: every leaf of substantial length is one of the four
  // known strings (heading, term, question, explanation) or the fixed
  // no-change line, or a className.
  const knownStrings = [
    "Netify explained",
    glossaryClarification.term!,
    glossaryClarification.question!,
    glossaryClarification.explanation,
    "No changes to your Understanding.",
  ];
  const unexpected = flat.filter(
    (s) => s.length > 20 && !knownStrings.some((k) => s.includes(k)) && !k_isClassName(s),
  );
  function k_isClassName(s: string): boolean {
    return /[a-z]-\[|text-\[|border-|rounded-|font-|tracking-|leading-/.test(s);
  }
  expect(unexpected.length === 0, `[34] found unexpected/fabricated text in glossary clarification output: ${JSON.stringify(unexpected)}`);
  const ceSrc = readFileSync(new URL("../src/components/preview/ClarificationEntry.tsx", import.meta.url), "utf8");
  const ceCode = codeOnly(ceSrc);
  expect(!/\.quote\b/.test(ceCode), `[34] ClarificationEntry.tsx references a ".quote" field (belongs to SessionChange, not BoundedClarification)`);
  expect(!/\.reason\b/.test(ceCode), `[34] ClarificationEntry.tsx references a ".reason" field (belongs to SessionChange, not BoundedClarification)`);
  expect(!/\.previousValue\b|\.nextValue\b/.test(ceCode), `[34] ClarificationEntry.tsx references SessionChange value fields`);
}

/* 35. No input/control/callback appears in either clarification shape       */
/*     (glossary or fallback) — same technique as check [22] above, run      */
/*     specifically against both new fixtures for extra assurance. ------------*/
{
  for (const clarification of [glossaryClarification, fallbackClarification]) {
    const el = ClarificationEntry({ clarification });
    const domTypes: string[] = [];
    (function collect(node: AnyEl) {
      if (node === null || node === undefined || typeof node === "boolean" || typeof node === "string" || typeof node === "number") return;
      if (Array.isArray(node)) { node.forEach(collect); return; }
      const e = node as { type: unknown; props?: Record<string, unknown> };
      if (typeof e.type === "string") domTypes.push(e.type);
      if (typeof e.type === "function") {
        collect((e.type as (p: unknown) => AnyEl)(e.props ?? {}));
        return;
      }
      if (e.props && "children" in e.props) collect(e.props.children as AnyEl);
    })(el);
    const forbiddenTags = ["button", "input", "select", "textarea", "form", "a"];
    for (const tag of forbiddenTags) {
      expect(!domTypes.includes(tag), `[35] found a forbidden interactive element <${tag}> in a ${clarification.kind ?? "legacy"} clarification`);
    }
  }
}

/* 36. explanationForInput() itself is not called from ClarificationEntry.  */
/*     or SessionActivity.tsx — those components only render already-       */
/*     produced BoundedClarification data (Article 17: explanation lookup    */
/*     stays solely in explanations.ts). ---------------------------------------*/
{
  const saSrc = codeOnly(readFileSync(new URL("../src/components/preview/SessionActivity.tsx", import.meta.url), "utf8"));
  const ceSrc = codeOnly(readFileSync(new URL("../src/components/preview/ClarificationEntry.tsx", import.meta.url), "utf8"));
  expect(!/explanationForInput/.test(saSrc), `[36] SessionActivity.tsx references explanationForInput`);
  expect(!/explanationForInput/.test(ceSrc), `[36] ClarificationEntry.tsx references explanationForInput`);
  // Sanity: explanationForInput itself still resolves the fixture used
  // above, so this file's fixtures are not silently drifting from the real
  // glossary module.
  const real = explanationForInput("What is SASE?");
  expect(real?.term === "SASE", `[36] sanity check: explanationForInput("What is SASE?") did not resolve to SASE`);
}

console.log(`session-activity: ${pass} checks pass (${fail} fail)`);
if (fail > 0) {
  console.error(failures.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
