/**
 * Verification-only script (not part of the app).
 *
 * Robert, 20 Aug 2026, on a live screenshot: clicking "Single-vendor
 * platform" on the "One platform or best-of-breed" question showed a
 * green "Recorded" confirmation -- and then, once the confirmation
 * faded, the SAME question card was still sitting in the "answer next"
 * list, unanswered. "When you select an option, the system says
 * 'recorded' but then this message vanishes. The question remains?
 * Highly confusing."
 *
 * ROOT CAUSE. Most taxonomy items (taxonomy.ts) carry `path: null` --
 * they resolve to the NOTED tier, not a structured fact path (see that
 * field's own doc comment: "Items with `path: null` are conversations
 * whose structured field..."). But ProjectDesk.tsx's answerNextQuestion,
 * in its "items"-kind branch, pushed EVERY itemId into applyMerge()
 * unconditionally -- landing a meaningless `{path: null, value:
 * undefined}` "fact" and never touching `noted`. q-sase-shape's own
 * earnedBy (questions.ts) reads `notedIds`
 * (`!c.notedIds.includes("obj-unified")`); since `noted` never changed,
 * the question kept being re-earned on the very next render and the card
 * never actually left the "answer next" list, even though the click had
 * already "succeeded" by every visible signal (the transcript line, the
 * confirmation strip).
 *
 * THE FIX splits `answer.itemIds` by `e.item.path`: a real-path item
 * still lands as a fact through applyMerge (unchanged); a null-path item
 * now lands through setNoted, mirroring the SAME shape and bookkeeping
 * (beginOrExtendSubmission/scheduleSettle) the "note"-kind branch right
 * below it, and the free-text statedObjectivesIn() path above it, both
 * already use for a note-only answer.
 *
 * This fixture guards two things, one behavioural (against the real,
 * exported earnedQuestions()) and one structural (that
 * answerNextQuestion's source actually performs the split -- the click
 * handler is a closure inside a client component with no route to drive
 * it through, so this codebase's own established convention for that
 * case -- see validate-2030-constitution-corrections.ts,
 * validate-lifecycle-consistency-closure.ts -- is a source-level
 * assertion on the real file, not a hand-rolled stand-in).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { earnedQuestions } from "../src/lib/workspace/questions";
import { TAXONOMY } from "../src/lib/workspace/taxonomy";
import type { SecurityRequirementInput } from "../src/lib/security/rulebook";

const ROOT = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const src = (...parts: string[]) => readFileSync(path.join(ROOT, ...parts), "utf8");

let failures = 0;
const record = (pass: boolean, label: string, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${detail}`);
};

const EMPTY_REQ = {} as SecurityRequirementInput;

/* ================================================================ */
/* A. The taxonomy premise this fixture (and the real bug) rests on:  */
/*    obj-unified/obj-bob genuinely have path: null. If a future edit  */
/*    ever gave them a real path, the bug this fixture guards against  */
/*    would no longer be reachable through THIS question -- worth      */
/*    knowing, not worth breaking the build over, so this is recorded  */
/*    as information rather than gated on its own.                     */
/* ================================================================ */
{
  const objectivesSection = TAXONOMY.find((s) => s.key === "objectives");
  const unified = objectivesSection?.items.find((i) => i.id === "obj-unified");
  const bob = objectivesSection?.items.find((i) => i.id === "obj-bob");
  record(!!unified && unified.path === null, "A: obj-unified (\"Single-vendor SASE platform\") has path: null -- it is a NOTED item, not a fact path", String(unified?.path));
  record(!!bob && bob.path === null, "A: obj-bob (\"Best-of-breed stack\") has path: null -- also a NOTED item", String(bob?.path));

  /* Scope check: how many taxonomy items across the WHOLE app have
     path: null -- this is not a one-question edge case, it's most of
     the taxonomy, so the bug this fixture guards against was reachable
     from nearly every "items"-kind next-question, not just this one. */
  const allItems = TAXONOMY.flatMap((s) => s.items);
  const nullPathCount = allItems.filter((i) => i.path === null).length;
  record(nullPathCount > allItems.length / 2, "A: more than half of all taxonomy items have path: null -- this was a broad defect, not a single-question one", `${nullPathCount}/${allItems.length}`);
}

/* ================================================================ */
/* B. Behavioural: the REAL earnedQuestions(), proving the contract    */
/*    the fix depends on actually holds -- once "obj-unified" is in    */
/*    notedIds, q-sase-shape stops being earned. This is the SAME      */
/*    contract draft.fixtures.ts:542 already proves for earnedQuestions */
/*    directly; repeated here because it's the exact mechanism the     */
/*    click-handler fix now relies on, not incidental to it.           */
/* ================================================================ */
{
  const beforeAnswer = earnedQuestions(EMPTY_REQ, "sase", null, [], []);
  record(beforeAnswer.some((q) => q.id === "q-sase-shape"), "B: with no noted platform-shape choice, q-sase-shape IS earned (reproduces the pre-click state in the screenshot)", beforeAnswer.map((q) => q.id).join(","));

  const afterAnswer = earnedQuestions(EMPTY_REQ, "sase", null, ["obj-unified"], []);
  record(!afterAnswer.some((q) => q.id === "q-sase-shape"), "B: once \"obj-unified\" is a noted id, q-sase-shape is NO LONGER earned -- the exact recompute the fixed click handler must trigger", afterAnswer.map((q) => q.id).join(","));

  const afterOtherAnswer = earnedQuestions(EMPTY_REQ, "sase", null, ["obj-bob"], []);
  record(!afterOtherAnswer.some((q) => q.id === "q-sase-shape"), "B: the other option (\"obj-bob\") also clears it -- either answer resolves the same question", afterOtherAnswer.map((q) => q.id).join(","));
}

/* ================================================================ */
/* C. Structural: ProjectDesk.tsx's answerNextQuestion actually        */
/*    performs the fact/noted split for "items"-kind answers, and no   */
/*    longer force-feeds every itemId into applyMerge regardless of    */
/*    its path.                                                        */
/* ================================================================ */
{
  const desk = src("src/components/ProjectDesk.tsx");
  // Isolate the "items" branch of answerNextQuestion specifically, not
  // the whole file, so this assertion can't accidentally pass by
  // matching an unrelated setNoted call elsewhere in the component.
  const branchStart = desk.indexOf('if (answer.kind === "items") {');
  const branchEnd = desk.indexOf('} else if (answer.kind === "note") {', branchStart);
  record(branchStart !== -1 && branchEnd !== -1 && branchEnd > branchStart, "C setup: the \"items\" branch of answerNextQuestion was located in ProjectDesk.tsx", `${branchEnd - branchStart} chars`);
  const branch = desk.slice(branchStart, branchEnd);

  record(/if\s*\(\s*e\.item\.path\s*\)/.test(branch), "C: the items branch now branches on e.item.path (real path vs. null) instead of treating every itemId identically", "");
  record(/notedAdds/.test(branch) && /setNoted\(/.test(branch), "C: a null-path item is now routed through setNoted (not silently dropped into applyMerge as a bogus fact)", "");
  record(!/updates\.push\(\{[^}]*path:\s*e\.item\.path as AllowedPath[^}]*\}\);\s*\}\s*if\s*\(updates\.length\)/.test(branch.replace(/\n\s*/g, " ")), "C: the OLD unconditional push (every itemId -> applyMerge, regardless of path) is gone", "");
  record(/resultingNoted:\s*notedAdds/.test(branch), "C: recordDecision's resultingNoted now carries the real noted adds, not a hardcoded []", "");
  record(/section:\s*e\.section/.test(branch), "C: a noted item's section comes from ITEM_BY_ID's own taxonomy section (e.section) -- structurally correct, not guessed from nq.target", "");
  record(/own:\s*true/.test(branch), "C: a null-path item lands with own: true, same as every other buyer-clicked answer (landOption/pickChip/the note branch) -- so it counts as \"stated\" in answered-log.ts", "");
}

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
if (failures > 0) process.exit(1);
