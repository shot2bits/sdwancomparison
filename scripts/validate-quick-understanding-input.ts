/**
 * Build gate for Milestone 1, Commit 11A: first-load input hierarchy in the
 * isolated Quick Understanding preview. Composition and hierarchy only —
 * no extraction change, no WorkspaceFact ledger change, no mergeUpdates()/
 * earnedQuestions() change, no Session Activity/clarification change, no
 * persistence/auth/publication/MCP change, no route change.
 *
 * TOOLING LIMITATION, same one Commit 10's validation script already
 * documented and still true here: PersistentAssistantInput.tsx uses
 * useRef and QuickSorWorkspace.tsx uses useState/useRef, so neither can be
 * invoked directly as a plain function outside a real React render (hooks
 * throw outside render), and per this repository's established convention
 * no jsdom/Playwright/Testing-Library dependency is added to work around
 * that. Every check below is either (a) a static source assertion against
 * the real file contents (comments stripped via the same codeOnly() helper
 * Commits 8/9B/10 already use, so a check can't be satisfied by a comment
 * describing the behaviour rather than code implementing it), or (b) a
 * structural/positional assertion about the real JSX text (e.g. "does X's
 * opening tag appear before or after the `{started && (` gate").
 *
 * SCOPE NOTE on naming checks (3): PersistentAssistantInput.tsx and
 * QuickSorWorkspace.tsx both contain PRE-EXISTING text this commit did not
 * introduce and is not permitted to touch — specifically the
 * `journey !== "quick_sor"` placeholder's "Quick Statement of
 * Requirements" mention (approved in Commit 10, unrelated to this commit's
 * allowed-file list) and JourneySelector.tsx's own card copy (a file this
 * commit does not modify at all). Scanning either file's ENTIRE contents
 * for the forbidden terms would therefore false-fail on already-approved,
 * out-of-scope text. This script instead extracts only the specific new
 * strings Commit 11A introduced (the first-load label/supporting-text and
 * the quiet mode-indicator line) and checks those.
 *
 * Not yet wired into `npm run validate` — consistent with every other
 * validation script in this repository so far, and explicitly requested
 * for this commit.
 */

import { readFileSync } from "node:fs";

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

const inputSrc = readFileSync(new URL("../src/components/preview/PersistentAssistantInput.tsx", import.meta.url), "utf8");
const inputCode = codeOnly(inputSrc);
const workspaceSrc = readFileSync(new URL("../src/components/preview/QuickSorWorkspace.tsx", import.meta.url), "utf8");
const workspaceCode = codeOnly(workspaceSrc);
const pageSrc = readFileSync(new URL("../src/app/preview/quick-sor/page.tsx", import.meta.url), "utf8");
const pageCode = codeOnly(pageSrc);

const FORBIDDEN_TERMS = [
  "Quick Statement of Requirements",
  "Statement of Requirements",
  "SoR",
  "RFI",
  "RFP",
];

function containsForbiddenTerm(text: string): string | null {
  for (const term of FORBIDDEN_TERMS) {
    // Whole-word/phrase match; SoR/RFI/RFP as bare acronyms need a word
    // boundary so they can't false-match inside an unrelated longer word.
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    if (re.test(text)) return term;
  }
  return null;
}

/* 1. First-load heading says exactly "Tell Netify about your project."    */
{
  expect(
    inputCode.includes('"Tell Netify about your project."'),
    `[1] first-load label does not contain the exact required heading text`,
  );
}

/* 2. Active mode uses "Quick Understanding".                              */
{
  expect(
    /Netify\s*&middot;\s*Quick Understanding/.test(workspaceCode),
    `[2] quiet mode-indicator line does not read "Netify · Quick Understanding"`,
  );
}

/* 3. Buyer-facing output this commit introduced does not use the         */
/*    forbidden legacy names (see the SCOPE NOTE above for why this is    */
/*    checked against the new strings specifically, not the whole file). */
{
  const newLabelMatch = inputCode.match(/started\s*\n?\s*\?\s*"([^"]*)"\s*\n?\s*:\s*"([^"]*)"/);
  expect(!!newLabelMatch, `[3] could not locate the started ? ... : ... label ternary to check`);
  const firstLoadLabel = newLabelMatch?.[2] ?? "";
  const supportingTextMatch = inputCode.match(/Describe what you are buying, changing or trying to solve\. One sentence is enough to start\./);
  const quietLineMatch = workspaceCode.match(/Netify\s*&middot;\s*Quick Understanding/);
  const otherWaysMatch = workspaceCode.match(/Other ways to work/);

  expect(containsForbiddenTerm(firstLoadLabel) === null, `[3] first-load label uses a forbidden name: "${containsForbiddenTerm(firstLoadLabel)}"`);
  expect(!!supportingTextMatch && containsForbiddenTerm(supportingTextMatch[0]) === null, `[3] supporting text uses a forbidden name or is missing`);
  expect(!!quietLineMatch && containsForbiddenTerm(quietLineMatch[0]) === null, `[3] quiet mode-indicator line uses a forbidden name or is missing`);
  expect(!!otherWaysMatch, `[3] "Other ways to work" disclosure text is missing`);
}

/* 4. Textarea is multi-line on first render (started === false).          */
{
  expect(
    /rows=\{started \? 1 : 4\}/.test(inputCode),
    `[4] textarea rows are not conditioned on started (expected rows={started ? 1 : 4})`,
  );
}

/* Positional helpers: index of each surface's opening tag relative to the */
/* `{started && (` gate that wraps Understanding/Questions/SessionActivity. */
const gateIdx = workspaceCode.indexOf("{started && (");
const inputTagIdx = workspaceCode.indexOf("<PersistentAssistantInput");
const understandingTagIdx = workspaceCode.indexOf("<UnderstandingDocument");
const questionsTagIdx = workspaceCode.indexOf("<EarnedQuestionsList");
const sessionActivityTagMatch = workspaceCode.match(/<SessionActivity[\s>]/);
const sessionActivityTagIdx = sessionActivityTagMatch ? (sessionActivityTagMatch.index ?? -1) : -1;

/* 5. Input is present before facts exist (rendered outside/before the     */
/*    started-only gate).                                                  */
{
  expect(gateIdx > -1, `[5] could not locate the "{started && (" gate at all`);
  expect(inputTagIdx > -1 && inputTagIdx < gateIdx, `[5] <PersistentAssistantInput> is not rendered before the started-only gate`);
}

/* 6. Empty Understanding placeholder is not rendered on first load        */
/*    (UnderstandingDocument only mounts inside the started-only gate).    */
{
  expect(understandingTagIdx > gateIdx, `[6] <UnderstandingDocument> is not gated behind started`);
}

/* 7. Empty Questions surface is not rendered on first load.               */
{
  expect(questionsTagIdx > gateIdx, `[7] <EarnedQuestionsList> is not gated behind started`);
}

/* 8. Empty Session Activity surface is not rendered on first load.        */
{
  expect(sessionActivityTagIdx > gateIdx, `[8] <SessionActivity> is not gated behind started`);
}

/* 9. No fictional example chips or example requirement sentences were     */
/*    added by this commit (no new suggestion-chip UI in either file).     */
{
  expect(!/\bchip\b/i.test(inputCode), `[9] PersistentAssistantInput.tsx contains a "chip" reference`);
  expect(!/\bchip\b/i.test(workspaceCode), `[9] QuickSorWorkspace.tsx contains a "chip" reference`);
}

/* 10. Inactive Coming Soon journey cards do not render by default:        */
/*     journeyExpanded defaults to false and JourneySelector only mounts   */
/*     when it is true.                                                    */
{
  expect(
    /journeyExpanded,\s*setJourneyExpanded\]\s*=\s*useState\(false\)/.test(workspaceCode) ||
      /const \[journeyExpanded, setJourneyExpanded\] = useState<boolean>\(false\)/.test(workspaceCode) ||
      /const \[journeyExpanded, setJourneyExpanded\] = useState\(false\)/.test(workspaceCode),
    `[10] journeyExpanded does not default to false`,
  );
  expect(
    /journeyExpanded \? \(\s*<JourneySelector/.test(workspaceCode),
    `[10] <JourneySelector> is not gated behind journeyExpanded`,
  );
}

/* 11. Input remains present after facts/activity exist — i.e. it is NOT   */
/*     itself wrapped inside the started-only gate (same fact as [5],      */
/*     asserted from the other direction for the continuing-workspace      */
/*     requirement specifically).                                          */
{
  expect(inputTagIdx > -1 && gateIdx > -1 && inputTagIdx < gateIdx, `[11] <PersistentAssistantInput> is inside the started-only gate and would disappear once started`);
}

/* 12/13/14. runCycle(), the busy guard, and failure handling are          */
/* unchanged — checked via the original numbered-step comments (kept on    */
/* RAW source, not codeOnly, since the comments themselves are the         */
/* fingerprint here) plus the exact guard/catch/finally lines.             */
{
  const rawRunCycleMatch = workspaceSrc.match(/async function runCycle\(\)[\s\S]*?\n  \}\n/);
  expect(!!rawRunCycleMatch, `[12] could not locate runCycle() at all`);
  const runCycleRaw = rawRunCycleMatch?.[0] ?? "";

  const requiredFragments = [
    "const text = input.trim();",
    "if (!text || busyRef.current) return; // 1. reject blank/whitespace-only, no API call",
    "busyRef.current = true;",
    'setBusy(true); // 2. busy state',
    'fetch("/sase/api/workspace/extract"',
    "// 5. filter through the preview tombstone helper",
    "// 8. mergeUpdates() exactly once, same source value",
    "// 11. append exactly one SessionActivityEntry for this turn",
    "const entry = classifyTurnEntry(newCycle, changes, text);",
    "setFacts(afterFacts);",
    "setCycle(newCycle);",
    "setEntries((prev) => [...prev, entry]);",
    'setInput("");',
    "} catch (e) {",
    "setError(e instanceof Error ? e.message : \"Something went wrong reading that. Try again.\");",
    "} finally {",
    "busyRef.current = false;",
    "setBusy(false);",
  ];
  for (const frag of requiredFragments) {
    expect(runCycleRaw.includes(frag), `[12/13/14] runCycle() is missing an unchanged fragment: ${JSON.stringify(frag)}`);
  }

  // Exactly one fetch() call in the whole file — no new network calls introduced.
  const fetchCount = (workspaceCode.match(/fetch\(/g) ?? []).length;
  expect(fetchCount === 1, `[12] expected exactly 1 fetch() call in QuickSorWorkspace.tsx, found ${fetchCount}`);
}

/* 15. No API, persistence, auth, publication or MCP code introduced.      */
{
  const forbiddenAPIPatterns = [/\bnew Request\(/, /\/api\/(?!.*extract)/, /supabase/i, /auth/i, /publish/i, /\bmcp\b/i];
  for (const re of forbiddenAPIPatterns) {
    expect(!re.test(workspaceCode), `[15] QuickSorWorkspace.tsx matches a forbidden API/persistence/auth/publication/MCP pattern: ${re}`);
    expect(!re.test(inputCode), `[15] PersistentAssistantInput.tsx matches a forbidden API/persistence/auth/publication/MCP pattern: ${re}`);
  }
}

/* 16. No localStorage or sessionStorage.                                  */
{
  expect(!/localStorage|sessionStorage/.test(workspaceCode), `[16] QuickSorWorkspace.tsx references browser storage`);
  expect(!/localStorage|sessionStorage/.test(inputCode), `[16] PersistentAssistantInput.tsx references browser storage`);
}

/* 17. No chat bubbles, transcript or assistant-avatar pattern.            */
{
  const chatPatterns = [/avatar/i, /bubble/i, /transcript/i];
  for (const re of chatPatterns) {
    expect(!re.test(workspaceCode), `[17] QuickSorWorkspace.tsx matches a chatbot-pattern term: ${re}`);
    expect(!re.test(inputCode), `[17] PersistentAssistantInput.tsx matches a chatbot-pattern term: ${re}`);
  }
}

/* 18. Inputs and state are not mutated outside the existing workflow:     */
/*     every pre-existing state setter is called exactly as many times as */
/*     before this commit (all inside runCycle, none new); the one new    */
/*     setter this commit adds (setJourneyExpanded) is presentational-only */
/*     and never touches facts/entries/cycle/input/busy/error.            */
{
  const expectedCounts: Record<string, number> = {
    "setFacts\\(": 1,
    "setCycle\\(": 1,
    "setEntries\\(": 1,
    "setInput\\(": 1,
    "setError\\(": 2,
    "setBusy\\(": 2,
  };
  for (const [pattern, expected] of Object.entries(expectedCounts)) {
    const count = (workspaceCode.match(new RegExp(pattern, "g")) ?? []).length;
    expect(count === expected, `[18] expected ${expected} call(s) matching ${pattern}, found ${count}`);
  }
  // The one new setter this commit adds must never appear inside runCycle.
  const rawRunCycleMatch2 = workspaceSrc.match(/async function runCycle\(\)[\s\S]*?\n  \}\n/);
  expect(
    !!rawRunCycleMatch2 && !rawRunCycleMatch2[0].includes("setJourneyExpanded"),
    `[18] setJourneyExpanded is called from inside runCycle() — it must stay presentational-only`,
  );
  expect(/setJourneyExpanded\(true\)/.test(workspaceCode), `[18] setJourneyExpanded is never called (disclosure toggle missing)`);
}

/* ------------------------------------------------------------------------ */
/* Corrections to Commit 11A (post-approval, pre-commit): remove the        */
/* fictional first-load placeholder and finish the Quick Understanding      */
/* rename in page.tsx. Checks 19-25 below cover the 7 items required for    */
/* these two corrections; checks 1-18 above are re-run unchanged as the     */
/* verification that nothing else in the already-approved Commit 11A        */
/* behaviour regressed (items 6 and 7 of the correction brief).             */
/* ------------------------------------------------------------------------ */

/* 19. First-load placeholder is exactly the approved replacement text.    */
{
  expect(
    inputCode.includes('"Describe what your organisation is trying to buy, change or solve…"'),
    `[19] first-load placeholder does not contain the exact required replacement text`,
  );
}

/* 20. No fictional example opener remains anywhere in                     */
/*     PersistentAssistantInput.tsx (site counts, named standards, named   */
/*     products, example companies, or the specific retired sentence).     */
{
  const fictionalPatterns = [
    /UK retail business/i,
    /50 sites/i,
    /200 remote users/i,
    /ISO ?27001/i,
    /PCI ?DSS/i,
    /\bWe are a\b/i,
  ];
  for (const re of fictionalPatterns) {
    expect(!re.test(inputCode), `[20] PersistentAssistantInput.tsx still contains a fictional example fragment matching ${re}`);
  }
}

/* 21. page.tsx contains both "Quick Understanding" and "living            */
/*     Understanding".                                                     */
{
  expect(pageCode.includes("Quick Understanding"), `[21] page.tsx does not contain "Quick Understanding"`);
  expect(pageCode.includes("living Understanding"), `[21] page.tsx does not contain "living Understanding"`);
}

/* 22. Buyer-facing page.tsx and the input source contain none of the      */
/*     forbidden legacy/adjacent names — full-file scope this time (not    */
/*     just new strings), since Correction 2's brief is a rename sweep     */
/*     across these two specific files.                                   */
{
  const pageForbidden = containsForbiddenTerm(pageCode);
  expect(pageForbidden === null, `[22] page.tsx uses a forbidden name: "${pageForbidden}"`);
  const inputForbidden = containsForbiddenTerm(inputCode);
  expect(inputForbidden === null, `[22] PersistentAssistantInput.tsx uses a forbidden name: "${inputForbidden}"`);
}

/* 23. Route remains noindex.                                              */
{
  expect(
    /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/.test(pageCode),
    `[23] page.tsx metadata.robots no longer specifies index: false, follow: false`,
  );
}

/* 24. Existing first-load hierarchy checks still pass (Commit 11A         */
/*     checks 1 and 4, re-affirmed explicitly here as the correction       */
/*     brief's item 6 — checks 1-18 above already re-ran unchanged).       */
{
  expect(
    inputCode.includes('"Tell Netify about your project."'),
    `[24] first-load heading regressed away from the exact required text`,
  );
  expect(
    /rows=\{started \? 1 : 4\}/.test(inputCode),
    `[24] textarea rows are no longer conditioned on started`,
  );
}

/* 25. Existing runCycle/extraction/busy/error behaviour is unchanged      */
/*     (correction brief item 7 — re-affirmed explicitly; the full         */
/*     fragment-presence assertions already ran unchanged in checks        */
/*     12-14 above, since QuickSorWorkspace.tsx was not touched by either  */
/*     correction).                                                        */
{
  expect(
    workspaceSrc.includes("async function runCycle()"),
    `[25] runCycle() is no longer present in QuickSorWorkspace.tsx`,
  );
  const fetchCount2 = (workspaceCode.match(/fetch\(/g) ?? []).length;
  expect(fetchCount2 === 1, `[25] expected exactly 1 fetch() call in QuickSorWorkspace.tsx, found ${fetchCount2}`);
}

console.log(`quick-understanding-input: ${pass} checks pass (${fail} fail)`);
if (fail > 0) {
  console.error(failures.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
