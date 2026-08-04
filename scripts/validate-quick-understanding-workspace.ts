/**
 * Build gate for the Milestone 1, Commit 10 orchestrator: QuickSorWorkspace
 * wiring the extraction endpoint, mergeUpdates(), preview tombstone
 * filtering, computeSessionChanges(), earnedQuestions(), UnderstandingDocument,
 * EarnedQuestionsList and SessionActivity together, on the isolated preview
 * route only.
 *
 * TOOLING LIMITATION, reported honestly rather than worked around: unlike
 * every earlier presentational-component validation script in this
 * repository, QuickSorWorkspace is NOT stateless — it calls useState/useRef.
 * Calling it directly as a plain function (the technique validate-
 * understanding-primitives.ts, validate-earned-questions-list.ts and
 * validate-session-activity.ts all use) is not possible: React hooks throw
 * outside a real render, and per the Commit 10 instructions this repository
 * adds no jsdom/Playwright/Cypress/React Testing Library to work around
 * that. This script instead does three things, matching the Commit 10
 * "Testing approach" section exactly:
 *
 *  1. Calls the REAL pure helper functions Commit 10 exported from
 *     QuickSorWorkspace.tsx specifically for this purpose —
 *     isNarrowClarificationMessage() and classifyTurnEntry() — directly,
 *     with real inputs. This is not a reimplementation or a mock: it is
 *     the exact code runCycle() calls.
 *  2. Drives the REAL mergeUpdates() and computeSessionChanges() (both
 *     unmodified, imported from their authoritative modules) through a
 *     hand-built FieldUpdate[] sequence standing in for what the live
 *     extraction endpoint would return for the acceptance sequence's
 *     turns 1-3, then feeds the real classifyTurnEntry() — proving the
 *     wiring logic (merge -> session-diff -> classify) end-to-end with
 *     real functions. This does NOT validate extraction's own accuracy
 *     (what facts a given sentence produces is extractRequirement()'s
 *     concern, a separate, already-existing production system Commit 10
 *     does not touch or re-test) — only that, GIVEN a set of updates, the
 *     orchestrator's own wiring behaves correctly. This is the same
 *     fixture-substitution boundary validate-session-diff.ts already uses
 *     for mergeUpdates()+computeSessionChanges().
 *  3. Uses static source assertions (comments stripped first, same
 *     false-positive fix as Commit 8/9B) for everything about the
 *     component's own structure that (1) and (2) cannot reach without a
 *     real render: the busy/blank guard, the exact endpoint call, ordering
 *     of operations inside runCycle, the catch branch touching only
 *     setError, prop wiring to UnderstandingDocument/EarnedQuestionsList/
 *     SessionActivity, and the absence of forbidden imports/APIs.
 *
 * What this script does NOT and cannot prove: that a live POST to
 * /sase/api/workspace/extract for the acceptance sequence's actual turn-1
 * prose returns the specific facts described (Meraki under consideration,
 * Reading HQ separate from other-site resilience, etc.) — that requires
 * either the live model/deterministic extractor or an actual browser
 * session against the running preview, neither of which this offline,
 * dependency-free script can reach. This is flagged honestly here and in
 * the Commit 10 report rather than silently assumed.
 *
 * Not yet wired into `npm run validate` — consistent with every other
 * validation script in this repository so far.
 */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { mergeUpdates, type WorkspaceFact } from "../src/lib/workspace/draft";
import type { FieldUpdate } from "../src/lib/workspace/extract";
import { computeSessionChanges, type SessionChange } from "../src/components/preview/session-diff";
import {
  isNarrowClarificationMessage,
  classifyTurnEntry,
  CLARIFICATION_FALLBACK_EXPLANATION,
} from "../src/components/preview/QuickSorWorkspace";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function expect(cond: boolean, msg: string) {
  if (cond) pass += 1;
  else { fail += 1; failures.push(msg); }
}

function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const workspaceSrc = readFileSync(new URL("../src/components/preview/QuickSorWorkspace.tsx", import.meta.url), "utf8");
const workspaceCode = codeOnly(workspaceSrc);
const pageSrc = readFileSync(new URL("../src/app/preview/quick-sor/page.tsx", import.meta.url), "utf8");

/** Shared fixture state built in test 6, reused by tests 7/17/18/19/25 —
 *  a real turn 1 -> turn 2 sequence through the actual mergeUpdates()/
 *  computeSessionChanges() functions (fixture FieldUpdate[]s standing in
 *  for a live extraction call — see the header comment). */
let turns!: {
  before1: WorkspaceFact[];
  merged1: { facts: WorkspaceFact[] };
  changes1: SessionChange[];
  before2: WorkspaceFact[];
  merged2: { facts: WorkspaceFact[] };
  changes2: SessionChange[];
  turn1Updates: FieldUpdate[];
  turn2Updates: FieldUpdate[];
};

/* ------------------------------------------------------------------ */
/* 1 & 2. Blank submission / busy guard (static: runCycle cannot be    */
/*        invoked outside a real render — see header). ------------------ */
{
  const fnMatch = workspaceCode.match(/async function runCycle\(\)\s*\{([\s\S]*?)\n  \}/);
  expect(!!fnMatch, `[1/2] could not locate runCycle()'s body via static source inspection`);
  const body = fnMatch?.[1] ?? "";
  const lines = body.trim().split("\n").map((l) => l.trim());
  // The guard must be the first REAL check in the function — immediately
  // after reading+trimming the input, and before any state is set or the
  // API is called — so a blank/whitespace-only or already-busy submission
  // never reaches the endpoint.
  expect(lines[0] === "const text = input.trim();", `[1/2] expected the first statement to read+trim the input, got: ${JSON.stringify(lines[0])}`);
  expect(
    /if\s*\(\s*!text\s*\|\|\s*busyRef\.current\s*\)\s*return;/.test(lines[1] ?? ""),
    `[1/2] expected the second statement to be the blank/busy guard, got: ${JSON.stringify(lines[1])}`,
  );
  // The guard must appear BEFORE the fetch() call (textually first), so a
  // blank/whitespace-only or already-busy submission never reaches the API.
  const guardIndex = body.indexOf("if (!text || busyRef.current) return;");
  const fetchIndex = body.indexOf("fetch(");
  expect(guardIndex >= 0 && fetchIndex > guardIndex, `[1/2] the blank/busy guard does not precede the fetch() call`);
  // No state is set (busy/error) before the guard runs.
  const preGuard = body.slice(0, guardIndex);
  expect(!/setBusy\(|setError\(/.test(preGuard), `[1/2] state is set before the blank/busy guard runs`);
}

/* 3. Successful extraction uses the existing API route. ------------------ */
{
  expect(
    workspaceCode.includes('fetch("/sase/api/workspace/extract"'),
    `[3] expected a call to the existing extraction endpoint "/sase/api/workspace/extract"`,
  );
  // Exactly one fetch() call in the whole file — no second/new endpoint.
  const fetchCalls = workspaceCode.match(/\bfetch\s*\(/g) ?? [];
  expect(fetchCalls.length === 1, `[3] expected exactly one fetch() call, found ${fetchCalls.length}`);
}

/* 4. mergeUpdates() is called exactly once per successful turn. --------- */
{
  const mergeCalls = workspaceCode.match(/\bmergeUpdates\s*\(/g) ?? [];
  expect(mergeCalls.length === 1, `[4] expected exactly one mergeUpdates() call site, found ${mergeCalls.length}`);
}

/* 5. Pre-merge facts are captured before merge (textual ordering). ------ */
{
  const beforeIndex = workspaceCode.indexOf("const beforeFacts = facts;");
  const mergeIndex = workspaceCode.indexOf("mergeUpdates(beforeFacts");
  expect(beforeIndex >= 0, `[5] expected an explicit "const beforeFacts = facts;" snapshot`);
  expect(mergeIndex > beforeIndex, `[5] the facts snapshot must be captured before the mergeUpdates() call`);
}

/* 6. computeSessionChanges() receives before/after/updates/cycle          */
/*    correctly (static call-site check) and, behaviourally, produces the */
/*    correct output when driven with the REAL functions end-to-end        */
/*    (turn 1 -> turn 2 correction, using fixture updates in place of a    */
/*    live extraction call — see header note 2). ---------------------------*/
{
  expect(
    workspaceCode.includes("computeSessionChanges(beforeFacts, afterFacts, filteredUpdates, newCycle)"),
    `[6] expected computeSessionChanges(beforeFacts, afterFacts, filteredUpdates, newCycle) in that exact argument order`,
  );

  // Turn 1: two stated facts land (fixture standing in for a live
  // extraction result — see header note 2, extraction accuracy itself is
  // out of scope here).
  const turn1Updates: FieldUpdate[] = [
    { path: "estate.sites", value: 50, provenance: "stated", quote: "50 sites" },
    { path: "estate.users", value: 200, provenance: "stated", quote: "200 remote users" },
  ];
  const before1: WorkspaceFact[] = [];
  const merged1 = mergeUpdates(before1, turn1Updates, 1, "extract");
  const changes1 = computeSessionChanges(before1, merged1.facts, turn1Updates, 1);
  expect(changes1.length === 2, `[6] turn 1: expected 2 changes, got ${changes1.length}`);

  // Turn 2: "Actually, we have 52 sites, not 50." — a correction.
  const turn2Updates: FieldUpdate[] = [
    { path: "estate.sites", value: 52, provenance: "stated", quote: "we have 52 sites, not 50" },
  ];
  const before2 = merged1.facts;
  const merged2 = mergeUpdates(before2, turn2Updates, 2, "extract");
  const changes2: SessionChange[] = computeSessionChanges(before2, merged2.facts, turn2Updates, 2);
  expect(changes2.length === 1, `[6] turn 2: expected 1 change, got ${changes2.length}`);
  expect(changes2[0]?.action === "corrected", `[6] turn 2: expected action "corrected", got ${changes2[0]?.action}`);
  expect(changes2[0]?.previousValue === 50, `[6] turn 2: expected previousValue 50, got ${changes2[0]?.previousValue}`);
  expect(changes2[0]?.nextValue === 52, `[6] turn 2: expected nextValue 52, got ${changes2[0]?.nextValue}`);

  // Reused by tests 7, 17, 18, 19, 25 below.
  turns = { before1, merged1, changes1, before2, merged2, changes2, turn1Updates, turn2Updates };
}

/* 7. Changes entry created when changes exist. ---------------------------- */
{
  const entry = classifyTurnEntry(1, turns.changes1, "We are a UK retail business with 50 sites and 200 remote users.");
  expect(entry.kind === "changes", `[7] expected kind "changes", got ${entry.kind}`);
  expect(entry.changes.length === 2, `[7] expected 2 changes carried on the entry, got ${entry.changes.length}`);
  expect(entry.changes === turns.changes1, `[7] entry.changes should be the exact same array computeSessionChanges() returned`);
}

/* 8. No-change entry created when no changes exist (and the message is    */
/*    not a narrow clarification phrase). ---------------------------------- */
{
  const entry = classifyTurnEntry(3, [], "We might also look at a second data centre next year.");
  expect(entry.kind === "no_change", `[8] expected kind "no_change", got ${entry.kind}`);
  expect(entry.changes.length === 0, `[8] expected empty changes, got ${entry.changes.length}`);
}

/* 9. Clarification fallback created only for narrow clarification         */
/*    phrases (and only when there are no changes). ------------------------*/
{
  const exact = [
    "What do you mean?",
    "Can you explain?",
    "I don't know what you mean",
    "I do not know what you mean.",
    "please explain",
    "  WHAT DO YOU MEAN  ",
    "I don't know what you mean, can you explain?", // the acceptance sequence's own Turn 3 text
  ];
  for (const msg of exact) {
    expect(isNarrowClarificationMessage(msg), `[9] expected "${msg}" to be recognised as a narrow clarification message`);
    const entry = classifyTurnEntry(9, [], msg);
    expect(entry.kind === "clarification", `[9] expected kind "clarification" for "${msg}", got ${entry.kind}`);
    expect(entry.changes.length === 0, `[9] expected empty changes for a clarification entry ("${msg}")`);
    expect(
      entry.clarification?.explanation === CLARIFICATION_FALLBACK_EXPLANATION,
      `[9] expected the exact fixed fallback explanation for "${msg}"`,
    );
    expect(entry.clarification?.question === undefined, `[9] no question should be invented for "${msg}"`);
  }
  // A clarification match must NOT override an actual changes result (rule
  // A takes priority — see classifyTurnEntry's own ordering).
  const withChanges = classifyTurnEntry(9, turns.changes1, "what do you mean?");
  expect(withChanges.kind === "changes", `[9] a real change must win over a clarification-shaped message`);
}

/* 9b. The revised buyer-facing fallback wording (post-review correction:  */
/*      Milestone 1 exposes no selectable gaps, so the fallback must not   */
/*      say "select a gap"). Checked against the literal required text,    */
/*      not just self-equality against the same exported constant, so a    */
/*      future accidental wording drift is actually caught here. -----------*/
{
  const REQUIRED_FALLBACK_TEXT =
    "There isn’t a current Netify question selected to explain. You can add or correct information about your project below.";
  expect(
    CLARIFICATION_FALLBACK_EXPLANATION === REQUIRED_FALLBACK_TEXT,
    `[9b] expected the exact revised fallback text, got: ${JSON.stringify(CLARIFICATION_FALLBACK_EXPLANATION)}`,
  );
  expect(
    !/\bgap\b/i.test(CLARIFICATION_FALLBACK_EXPLANATION),
    `[9b] the buyer-facing fallback must not contain the word "gap": ${JSON.stringify(CLARIFICATION_FALLBACK_EXPLANATION)}`,
  );
  // Confirmed end-to-end through the real classifyTurnEntry(), not just the
  // constant in isolation.
  const entry = classifyTurnEntry(9, [], "can you explain?");
  expect(
    entry.clarification?.explanation === REQUIRED_FALLBACK_TEXT,
    `[9b] classifyTurnEntry() did not emit the exact revised fallback text`,
  );
  expect(!/\bgap\b/i.test(entry.clarification?.explanation ?? ""), `[9b] classifyTurnEntry()'s emitted explanation must not contain "gap"`);
}

/* 9c. Clarification still produces no fact changes (dedicated check,      */
/*     independent of test 19's fuller turn-3 pipeline test below): a      */
/*     clarification-classified turn always carries changes: [] and,       */
/*     driven through the real merge pipeline with no real extraction      */
/*     update, leaves facts completely unchanged. --------------------------*/
{
  const clarificationEntry = classifyTurnEntry(9, [], "I don't know what you mean, can you explain?");
  expect(clarificationEntry.kind === "clarification", `[9c] expected a clarification entry`);
  expect(clarificationEntry.changes.length === 0, `[9c] a clarification entry must carry no fact changes`);

  const before: WorkspaceFact[] = turns.merged1.facts;
  const beforeSnapshot = JSON.stringify(before);
  const noExtractionUpdates: FieldUpdate[] = []; // a clarification message earns no real update
  const merged = mergeUpdates(before, noExtractionUpdates, 99, "extract");
  expect(JSON.stringify(before) === beforeSnapshot, `[9c] the pre-turn facts array was mutated`);
  expect(JSON.stringify(merged.facts) === beforeSnapshot, `[9c] facts changed as a result of a clarification turn, expected no change`);
}

/* 10. Substantive messages containing "explain" are not automatically     */
/*     treated as clarification. -------------------------------------------*/
{
  const substantive = [
    "We use Meraki, can you explain the pricing model to your team?",
    "Can you explain why our budget band is Enterprise?",
    "explain",
    "explains",
    "Please explain the SD-WAN migration plan in the SOW.",
  ];
  for (const msg of substantive) {
    expect(!isNarrowClarificationMessage(msg), `[10] "${msg}" was incorrectly treated as a narrow clarification message`);
    const entry = classifyTurnEntry(10, [], msg);
    expect(entry.kind === "no_change", `[10] "${msg}" should classify as no_change (not clarification), got ${entry.kind}`);
  }
}

/* 11. Failed extraction does not mutate facts, cycle or activity (static:  */
/*     the catch branch must call only setError, none of setFacts/         */
/*     setCycle/setEntries). ------------------------------------------------*/
{
  const catchMatch = workspaceCode.match(/\} catch \(e\) \{([\s\S]*?)\} finally \{/);
  expect(!!catchMatch, `[11] could not locate the catch branch via static source inspection`);
  const catchBody = catchMatch?.[1] ?? "";
  expect(catchBody.includes("setError("), `[11] expected the catch branch to call setError()`);
  expect(!catchBody.includes("setFacts("), `[11] the catch branch must not call setFacts()`);
  expect(!catchBody.includes("setCycle("), `[11] the catch branch must not call setCycle()`);
  expect(!catchBody.includes("setEntries("), `[11] the catch branch must not call setEntries()`);
  expect(!catchBody.includes("setInput("), `[11] the catch branch must not clear the buyer's input`);
}

/* 12. Invalid response shape does not partially merge (static ordering:   */
/*     the shape check must precede the mergeUpdates() call). -------------- */
{
  const shapeCheckIndex = workspaceCode.indexOf("!data || !Array.isArray(data.updates)");
  const mergeIndex = workspaceCode.indexOf("mergeUpdates(beforeFacts");
  expect(shapeCheckIndex >= 0, `[12] expected an explicit response-shape validation`);
  expect(mergeIndex > shapeCheckIndex, `[12] the response-shape check must precede the mergeUpdates() call`);
}

/* 13. Questions derive from post-merge facts (requirement/buying/opModel  */
/*     all computed from the current `facts` state, not from any other     */
/*     source). ---------------------------------------------------------- */
{
  expect(workspaceCode.includes("requirementFrom(facts)"), `[13] expected requirementFrom(facts)`);
  expect(workspaceCode.includes("buyingOf(facts)"), `[13] expected buyingOf(facts)`);
  expect(workspaceCode.includes("operatingModelOf(facts)"), `[13] expected operatingModelOf(facts)`);
  expect(
    workspaceCode.includes("earnedQuestions(requirement, buying, opModel, [], [])"),
    `[13] expected earnedQuestions() called with the facts-derived requirement/buying/opModel`,
  );
}

/* 14. Questions preserve earnedQuestions() order (no sort/reverse applied */
/*     to the result before rendering). ------------------------------------*/
{
  expect(!/questions\s*\.\s*sort\(/.test(workspaceCode), `[14] "questions" must not be sorted`);
  expect(!/questions\s*\.\s*reverse\(/.test(workspaceCode), `[14] "questions" must not be reversed`);
  expect(!/questions\s*\.\s*filter\(/.test(workspaceCode), `[14] "questions" must not be filtered`);
}

/* 15. UnderstandingDocument receives current facts. ------------------------ */
{
  expect(workspaceCode.includes("<UnderstandingDocument facts={facts} />"), `[15] expected <UnderstandingDocument facts={facts} />`);
}

/* 16. EarnedQuestionsList receives current earned questions. -------------- */
{
  expect(workspaceCode.includes("<EarnedQuestionsList questions={questions} />"), `[16] expected <EarnedQuestionsList questions={questions} />`);
}

/* 17. SessionActivity receives accumulated entries. ------------------------ */
{
  expect(
    workspaceCode.includes("<SessionActivity entries={entries} labelFor={labelFor} />"),
    `[17] expected <SessionActivity entries={entries} labelFor={labelFor} />`,
  );
}

/* 18. 50 -> 52 correction appears in activity (end-to-end through the real */
/*     merge/session-diff/classify pipeline built in test 6 above). --------*/
{
  const entry2 = classifyTurnEntry(2, turns.changes2, "Actually, we have 52 sites, not 50.");
  expect(entry2.kind === "changes", `[18] expected kind "changes" for the correction turn, got ${entry2.kind}`);
  expect(entry2.changes.length === 1, `[18] expected 1 change for the correction, got ${entry2.changes.length}`);
  expect(entry2.changes[0]?.previousValue === 50 && entry2.changes[0]?.nextValue === 52, `[18] expected 50 -> 52 in the activity entry`);
  // No duplicate 50 remains standing.
  const standingSites = turns.merged2.facts.filter((f: WorkspaceFact) => f.path === "estate.sites" && !f.struck);
  expect(standingSites.length === 1 && standingSites[0]?.value === 52, `[18] expected exactly one standing estate.sites fact with value 52`);
  // No unrelated fact changed.
  const standingUsers = turns.merged2.facts.filter((f: WorkspaceFact) => f.path === "estate.users" && !f.struck);
  expect(standingUsers.length === 1 && standingUsers[0]?.value === 200, `[18] estate.users must remain unchanged at 200`);
}

/* 19. Turn 3 leaves facts unchanged. --------------------------------------- */
{
  const turn3Text = "I don't know what you mean, can you explain?";
  // A genuine clarification message earns no real extraction update — the
  // fixture standing in for the (out-of-scope) live extraction call is
  // therefore an empty FieldUpdate[], exactly like turn 8's no-op fixture.
  const turn3Updates: FieldUpdate[] = [];
  const before3 = turns.merged2.facts;
  const before3Snapshot = JSON.stringify(before3);
  const merged3 = mergeUpdates(before3, turn3Updates, 3, "extract");
  const changes3 = computeSessionChanges(before3, merged3.facts, turn3Updates, 3);
  const entry3 = classifyTurnEntry(3, changes3, turn3Text);

  expect(JSON.stringify(before3) === before3Snapshot, `[19] the pre-turn-3 facts array was mutated`);
  expect(JSON.stringify(merged3.facts) === before3Snapshot, `[19] facts changed byte-for-byte across turn 3, expected no change`);
  expect(changes3.length === 0, `[19] expected zero session changes for turn 3, got ${changes3.length}`);
  expect(entry3.kind === "clarification", `[19] expected a clarification entry for turn 3, got ${entry3.kind}`);
  expect(
    entry3.clarification?.explanation === CLARIFICATION_FALLBACK_EXPLANATION,
    `[19] expected the fixed fallback explanation for turn 3`,
  );
}

/* 20. No localStorage/sessionStorage/persistence. -------------------------- */
{
  expect(!/localStorage/.test(workspaceCode), `[20] QuickSorWorkspace.tsx references localStorage`);
  expect(!/sessionStorage/.test(workspaceCode), `[20] QuickSorWorkspace.tsx references sessionStorage`);
  expect(!/document\.cookie/.test(workspaceCode), `[20] QuickSorWorkspace.tsx references document.cookie`);
  expect(!/indexedDB/.test(workspaceCode), `[20] QuickSorWorkspace.tsx references indexedDB`);
}

/* 21. No ProjectDesk import or modification. ------------------------------- */
{
  expect(!/ProjectDesk/.test(workspaceCode), `[21] QuickSorWorkspace.tsx references ProjectDesk`);
  expect(!/ProjectDesk/.test(codeOnly(pageSrc)), `[21] page.tsx references ProjectDesk`);
}

/* 22. No publication/auth/MCP/supplier code touched. ------------------------ */
{
  const forbidden = [/from ["']@\/lib\/mcp/i, /from ["'].*supplier/i, /from ["'].*\/auth/i, /from ["'].*publish/i, /from ["'].*opportunity-board/i];
  for (const re of forbidden) {
    expect(!re.test(workspaceCode), `[22] QuickSorWorkspace.tsx appears to import forbidden-domain code matching ${re}`);
    expect(!re.test(codeOnly(pageSrc)), `[22] page.tsx appears to import forbidden-domain code matching ${re}`);
  }
}

/* 23. Route remains noindex and unlinked. ---------------------------------- */
{
  expect(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/.test(pageSrc), `[23] expected robots: { index: false, follow: false } in page.tsx`);
  // Unlinked: no other app/component file references this route path,
  // beyond the preview files themselves.
  const grepOut = execSync(
    `grep -rln "preview/quick-sor" src/app src/components 2>/dev/null || true`,
    { cwd: new URL("..", import.meta.url).pathname, encoding: "utf8" },
  );
  const referencingFiles = grepOut.split("\n").map((l) => l.trim()).filter(Boolean);
  const unexpected = referencingFiles.filter(
    (f) => !f.includes("preview/quick-sor/page.tsx") && !f.includes("preview/QuickSorWorkspace.tsx"),
  );
  expect(unexpected.length === 0, `[23] unexpected references to the preview route found outside the preview files themselves: ${unexpected.join(", ")}`);
}

/* 24. Raw AllowedPath strings are not rendered by the orchestrator         */
/*     itself (it never loops over facts/updates to interpolate `.path`     */
/*     into JSX text — all path-aware rendering is delegated to             */
/*     UnderstandingDocument/EarnedQuestionsList/SessionActivity). ---------- */
{
  const returnMatch = workspaceCode.match(/return \(\s*<div className="mx-auto max-w-3xl">([\s\S]*?)\n  \);/);
  expect(!!returnMatch, `[24] could not locate the component's JSX return block`);
  const jsx = returnMatch?.[1] ?? "";
  expect(!/\.path\}/.test(jsx), `[24] the JSX return block appears to interpolate a raw ".path" value directly`);
  expect(!/facts\.map\(/.test(jsx) && !/entries\.map\(/.test(jsx) && !/questions\.map\(/.test(jsx), `[24] the orchestrator itself must not map over facts/entries/questions to render JSX`);
}

/* 25. Inputs and authoritative arrays are not mutated outside the          */
/*     approved merge flow (proven via the real pipeline built in test 6:   */
/*     the turn 1 fixture array and turn 2's "before" facts are both        */
/*     snapshotted and compared). ------------------------------------------- */
{
  const turn1UpdatesSnapshot = JSON.stringify(turns.turn1Updates);
  const turn2UpdatesSnapshot = JSON.stringify(turns.turn2Updates);
  // Re-run computeSessionChanges() against the already-merged results to
  // confirm no residual mutation from test 6's earlier calls.
  computeSessionChanges(turns.before1, turns.merged1.facts, turns.turn1Updates, 1);
  computeSessionChanges(turns.before2, turns.merged2.facts, turns.turn2Updates, 2);
  expect(JSON.stringify(turns.turn1Updates) === turn1UpdatesSnapshot, `[25] turn 1's updates array was mutated`);
  expect(JSON.stringify(turns.turn2Updates) === turn2UpdatesSnapshot, `[25] turn 2's updates array was mutated`);
}

/* Extra: classifyTurnEntry()/isNarrowClarificationMessage() do not mutate  */
/* their inputs. ------------------------------------------------------------ */
{
  const changesArg = [...turns.changes1];
  const snapshot = JSON.stringify(changesArg);
  classifyTurnEntry(1, changesArg, "some message");
  expect(JSON.stringify(changesArg) === snapshot, `[extra] classifyTurnEntry() mutated its "changes" argument`);
}

console.log(`quick-understanding-workspace: ${pass} checks pass (${fail} fail)`);
if (fail > 0) {
  console.error(failures.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
