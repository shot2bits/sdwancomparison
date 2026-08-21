// Verification-only script (not part of the app).
//
// Robert, 20 Aug 2026, on a competing mockup: "right now, it is 100% not
// clear how the user is progressing. We need to think really hard about
// the UI from a user perspective." And, minutes later, the deeper form of
// the same complaint: "this cannot be an everlasting AI conversation in
// the sense of Claude or ChatGPT, it has to end with a built RFP."
//
// Two defects, one root cause -- the product could not state progress
// because it had no single measure of it, and it could not end because
// its question stream is generative by design.
//
// FOUR NUMBERS BEFORE THIS PASS, none of which agreed:
//   · a 0-100 readiness dial (opaque, actionable by nobody)
//   · a "3 of 5" publish checklist (real, but only on the publish panel)
//   · an "N open decisions" rail badge (advisory; gates nothing)
//   · a raw "Document gaps" tile (a superset of the above, labelled as a
//     deficit)
// ONE AFTER: `outlineProgress(sectionOutline)` -- derived, never stored,
// read by the rail, the document header and every question card.
//
// This fixture guards, behaviourally where it can:
//   A. the denominator is reachable (`later` rows excluded) and derived;
//   B. the competing numbers are actually gone from the canvas;
//   C. every surface reads the SAME projection;
//   D. a question card can state where it lands, and never guesses;
//   E. the conversation has a terminal state, gated on the REAL publish
//      gate and not on the advisory decision count.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { outlineProgress, outlineProgressLine, sectionPosition, type OutlineRow } from "../src/lib/workspace/procurement-outline";

const ROOT = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const src = (...parts: string[]) => readFileSync(path.join(ROOT, ...parts), "utf8");

let failures = 0;
const record = (pass: boolean, label: string, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${detail}`);
};

const row = (title: string, state: OutlineRow["state"]): OutlineRow => ({ key: title, title, state, detail: "" });

function main() {
  const desk = src("src/components/ProjectDesk.tsx");
  const canvas = src("src/components/procurement/LivingProcurementCanvas.tsx");
  /* 2030 UI rebuild (20 Aug 2026): WizardRail.tsx is retired -- the
     section outline is now the primary navigation itself (SectionNav.tsx),
     not a read-only list a separate five-station rail summarised. Every
     assertion this file made against the old rail now checks the SAME
     property on its replacement. */
  const nav = src("src/components/procurement/SectionNav.tsx");
  const answerNext = src("src/components/procurement/AnswerNext.tsx");
  const ready = src("src/components/procurement/RfpReady.tsx");

  /* ================================================================ */
  /* A. THE DENOMINATOR IS REACHABLE.                                  */
  /* ================================================================ */
  const rows: OutlineRow[] = [
    row("Organisation and scale", "confirmed"),
    row("Solution scope", "confirmed"),
    row("Current estate", "needs_input"),
    row("Resilience and availability", "needs_decision"),
    row("Security, identity and data", "netify_suggested"),
    row("Commercial and contractual", "later"),
    row("Success and evaluation", "later"),
  ];
  const p = outlineProgress(rows);
  record(p.total === 5, "A: `later` rows are excluded from the denominator -- the target is hittable, not permanently short", `total=${p.total} of ${rows.length} rows`);
  record(p.laterCount === 2, "A: deferred rows are reported separately, never silently dropped", `laterCount=${p.laterCount}`);
  record(p.ready === 2, "A: only `confirmed` required rows count as ready", `ready=${p.ready}`);
  record(p.next?.title === "Current estate" && p.nextPosition === 3, "A: `next` is the first unconfirmed REQUIRED row, with its position", `${p.next?.title} @ ${p.nextPosition}`);
  record(outlineProgressLine(p) === "2 of 5 sections ready", "A: one wording, shared -- a fraction, never a percentage", outlineProgressLine(p));

  const done = outlineProgress(rows.map((r) => (r.state === "later" ? r : row(r.title, "confirmed"))));
  record(
    done.ready === done.total && done.next === null && done.nextPosition === 0,
    "A: THE END IS REACHABLE -- confirming every required row yields N of N with no `next`",
    `${done.ready}/${done.total}`,
  );

  record(sectionPosition(rows, "Commercial and contractual") === null, "A: a `later` section is given NO position inside the fraction (card and fraction cannot disagree)");
  record(sectionPosition(rows, "Nonexistent") === null, "A: an unmapped title yields null, never a guessed position");
  record(sectionPosition(rows, "Resilience and availability")?.position === 4, "A: a required section resolves to its 1-based position", JSON.stringify(sectionPosition(rows, "Resilience and availability")));

  /* ================================================================ */
  /* B. THE COMPETING NUMBERS ARE GONE.                                */
  /* ================================================================ */
  record(!/document\.readiness\.score/.test(canvas), "B: the 0-100 readiness DIAL is no longer rendered on the canvas");
  record(!/<StatTile label="[^"]*" value=\{document\.counts\.decisions\}/.test(canvas), "B: the raw \"Document gaps\" tile is gone");
  record(
    /buildReadiness\(/.test(desk),
    "B: `buildReadiness` itself is UNTOUCHED -- the compiler, exports and API still carry the score; only the competing DISPLAY was removed",
  );
  record(
    !/before suppliers can price consistently/.test(canvas),
    "B: the canvas no longer describes advisory decisions as a barrier to pricing (they gate nothing -- publish-checklist.ts does)",
  );

  /* ================================================================ */
  /* C. EVERY SURFACE READS THE SAME PROJECTION.                       */
  /* ================================================================ */
  record(/const sectionProgress = useMemo\(\(\) => outlineProgress\(sectionOutline\)/.test(desk), "C: ProjectDesk derives it from `sectionOutline` -- the same array the canvas renders as a list");
  /* The primary nav renders only inside ProjectDesk's own `started`
     branch (the whole workspace shell, rail included, is unreachable
     pre-start) -- so, unlike the retired rail's own belt-and-braces
     ternary, SectionNav's `progress` prop is passed unconditionally; the
     surrounding JSX branch is the real gate. */
  record(/<SectionNav[\s\S]{0,400}progress=\{sectionProgress\}/.test(desk), "C: the primary navigation reads it (only rendered once a project has started)");
  record(/outlineProgress\(outline\)/.test(canvas), "C: the document header derives it from the outline it is about to render");
  record(/outlineProgressLine\(progress\)/.test(canvas), "C: the header uses the shared wording function, not its own sentence");
  record(/progress\.ready\}\/\{progress\.total/.test(nav), "C: the primary nav reads ready and total directly from the SAME shared progress object");

  /* ================================================================ */
  /* D. A QUESTION KNOWS WHERE IT LANDS.                               */
  /* ================================================================ */
  record(/const pos = sectionPosition\(sectionOutline, title\)/.test(desk), "D: `resolveQuestionCard` resolves each card's section from the same outline");
  record(/fills = title && pos \? \{ title, position: pos\.position, total: pos\.total \} : null/.test(desk), "D: null rather than a guess when a question maps to no required section");
  record(/Fills section \$\{fills\.position\} of \$\{fills\.total\}/.test(answerNext), "D: the chat card states section N of M -- the same M as the rail");
  record(/Why this matters/.test(answerNext), "D: the card says why it is being asked (existing `nq.reason`, newly labelled)");

  /* ================================================================ */
  /* E. THE CONVERSATION ENDS.                                         */
  /* ================================================================ */
  record(
    /const rfpIsBuilt = started && !published && publishChecklist\.ready/.test(desk),
    "E: the terminal state is gated on the REAL publish gate (`publishChecklist.ready`, the same object `signLocked` reads)",
  );
  record(
    !/rfpIsBuilt = .*materialDecisionsRemaining/.test(desk),
    "E: it is NOT gated on the advisory decision count -- that count is generative and would never reach zero",
  );
  record(/Your RFP is built/.test(ready) && /Your RFP can be published/.test(ready), "E: the end state says the document is publishable, in the chat column where the conversation lives");
  record(
    /const complete = sectionsTotal > 0 && sectionsReady >= sectionsTotal/.test(ready) && /complete\n?\s*\?/.test(ready),
    "E: its headline TRACKS the fraction -- a live check caught it announcing \"everything suppliers need is in the document\" over \"2 of 8 sections ready\"",
  );
  record(/onPublish/.test(ready) && /onReview/.test(ready), "E: it hands over the two real next actions rather than another question");
  record(/holds publishing up/.test(ready), "E: remaining decisions are named optional out loud, not hidden");
  record(/demoted \? "Optional/.test(answerNext), "E: the retained secondary AnswerNext component still supports honest optional framing");
  record(/const rfpReadyBlock = rfpIsBuilt \?/.test(desk) && /\{rfpReadyBlock\}/.test(desk), "E: the publishable handoff shown in activity is driven by the same real gate");

  console.log(failures === 0 ? "\nALL PASS" : `\nFAILs: ${failures}`);
  if (failures) process.exit(1);
}

main();
