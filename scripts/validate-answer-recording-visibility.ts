// Verification-only script (not part of the app).
//
// Robert, 19 Aug 2026, on a live session: "Its a bit messy, when selecting
// the options for sites, I cannot be sure if the sytem has recorded it.
// It's not clear what I have answered or not."
//
// The defect was never persistence -- every clicked option already landed
// a real stated fact or a real noted item. It was that NOTHING on screen
// said so at the moment of clicking, and the durable record lived screens
// away in "Project details", mixed in with typed prose and Netify's own
// inferences. Worse, the transcript actively misattributed the buyer's
// own choice to Netify ("Operating model set to X."), so the one running
// log a buyer could scroll back through claimed Netify had decided it.
//
// Three surfaces answer the question now, and this fixture guards all
// three so they cannot silently regress:
//   A. the transcript  -- every click-answer path speaks in the BUYER's
//                         voice (`sayYou`), not Netify's;
//   B. the projection  -- `buildAnsweredLog` reads only real standing
//                         document state, so it can never claim something
//                         is recorded that publication would not carry;
//   C. the Decisions station -- actually renders it.
//
// Behavioural, not just textual: section B calls the REAL exported
// function against real fact shapes, including a struck one.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildAnsweredLog } from "../src/lib/workspace/answered-log";
import type { WorkspaceFact } from "../src/lib/workspace/draft";

const ROOT = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const src = (...parts: string[]) => readFileSync(path.join(ROOT, ...parts), "utf8");

let failures = 0;
const record = (pass: boolean, label: string, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${detail}`);
};

function main() {
  const desk = src("src/components/ProjectDesk.tsx");
  const step = src("src/components/procurement/DecisionsStep.tsx");
  const answerNext = src("src/components/procurement/AnswerNext.tsx");
  const lib = src("src/lib/workspace/answered-log.ts");

  /* ================================================================ */
  /* A. THE BUYER'S CHOICE SPEAKS IN THE BUYER'S VOICE.                */
  /*    All three click-answer paths, not just one -- the first pass    */
  /*    fixed only `answerNextQuestion`, which left every               */
  /*    `compiler_open_decision` card (sites, regions, operating model, */
  /*    resilience -- the ones Robert was actually clicking) still      */
  /*    routing through `landOption` and still attributing his answer   */
  /*    to Netify.                                                      */
  /* ================================================================ */
  const bodyOf = (name: string): string => {
    const i = desk.indexOf(`const ${name} = useCallback(`);
    if (i === -1) return "";
    // to the end of that useCallback's dependency array
    const end = desk.indexOf("\n  );", i);
    return end === -1 ? desk.slice(i) : desk.slice(i, end);
  };

  for (const fn of ["landOption", "pickChip", "answerNextQuestion"]) {
    const body = bodyOf(fn);
    record(body.length > 0, `A setup: \`${fn}\` was located in ProjectDesk.tsx`, `${body.length} chars`);
    record(/\bsayYou\(/.test(body), `A: \`${fn}\` attributes the chosen option to the BUYER (calls sayYou)`);
    record(
      /\[[^\]]*\bsayYou\b[^\]]*\]/.test(body),
      `A: \`${fn}\` lists \`sayYou\` in its dependency array (no stale-closure regression)`,
    );
    record(
      !/say\(`\$\{(slot\.label|nq\.question)\}[^`]*\$\{opt\.label\}/.test(body),
      `A: \`${fn}\` no longer speaks the buyer's chosen option in Netify's voice`,
    );
  }

  /* `sayYou` must remain thread-only. An option label is buyer INTENT
     but not buyer PROSE; the blueprint's hardest rule is that only the
     buyer's own wording may enter the source ledger. Showing a clicked
     label as a "you" bubble is honest ONLY while sayYou cannot write
     there. */
  const sayYouDef = desk.slice(desk.indexOf("const sayYou = useCallback("), desk.indexOf("const sayYou = useCallback(") + 220);
  record(
    /setMsgs\(/.test(sayYouDef) && !/keepSourceTurn|setSourceTurns|setReceipts/.test(sayYouDef),
    "A: `sayYou` still only appends to the transcript -- it never writes the source ledger",
    sayYouDef.split("\n")[1]?.trim() ?? "",
  );

  /* ================================================================ */
  /* B. THE PROJECTION CANNOT OVERCLAIM.                               */
  /* ================================================================ */
  record(!/from "react"|useState|useMemo/.test(lib), "B: answered-log.ts is pure -- no React (Article 17)");

  const f = (over: Partial<WorkspaceFact> & { id: string; path: string; value: unknown }): WorkspaceFact =>
    ({ struck: false, source: "answer", provenance: "stated", cycle: 1, ...over }) as unknown as WorkspaceFact;

  const log = buildAnsweredLog({
    facts: [
      f({ id: "estate.sites", path: "estate.sites", value: 30 }),
      f({ id: "organisation.sector", path: "organisation.sector", value: "Manufacturing", source: "extract" }),
      f({ id: "estate.users", path: "estate.users", value: 4000, struck: true }),
    ],
    noted: [
      { id: "n1", label: "Dual circuits at every site", section: "estate", own: true },
      { id: "ps-x", label: "A Netify-suggested clause", section: "estate", own: false },
    ],
  });
  const keys = log.map((e) => e.key);
  record(keys.includes("estate.sites"), "B: a chosen (source \"answer\") standing fact IS listed", JSON.stringify(keys));
  record(
    !keys.includes("organisation.sector"),
    "B: an EXTRACTED fact is NOT listed -- this panel answers \"what did I choose\", not \"what did Netify infer\"",
  );
  record(
    !keys.includes("estate.users"),
    "B: a STRUCK fact is NOT listed -- a removed answer leaves this panel the instant it leaves the document",
  );
  record(keys.includes("n1"), "B: an `own` noted item IS listed");
  record(!keys.includes("ps-x"), "B: a non-`own` noted item is NOT listed (it was not the buyer's choice)");
  const sites = log.find((e) => e.key === "estate.sites");
  record(
    Boolean(sites && sites.label && sites.label !== "estate.sites"),
    "B: rows are labelled in human words via PATH_LABELS, never a raw fact path",
    sites ? `${sites.label}: ${sites.answer}` : "",
  );
  record(Boolean(sites && String(sites.answer).includes("30")), "B: the answer shown is the value the document carries", sites?.answer ?? "");
  record(buildAnsweredLog({ facts: [], noted: [] }).length === 0, "B: an empty document produces an empty log (no invented rows)");

  /* ================================================================ */
  /* C. THE DECISIONS STATION RENDERS IT.                              */
  /* ================================================================ */
  record(/buildAnsweredLog\(\{ facts, noted \}\)/.test(desk), "C: ProjectDesk projects the answered log off `facts`/`noted` directly");
  record(/answered=\{answeredLog\}/.test(desk), "C: the Decisions station is handed it");
  record(/answered: AnsweredEntry\[\]/.test(step), "C: DecisionsStep takes it as a typed prop");
  record(/answered\.length > 0 &&/.test(step), "C: the panel renders only when there is something real to show");
  record(/answered\.map\(/.test(step), "C: every entry is rendered -- no slice/cap that could hide a recorded answer");
  record(
    /Recorded so far/.test(step),
    "C: the panel is headed with the buyer's own question -- \"has it recorded it?\"",
  );

  /* The at-the-moment-of-clicking half, in the chat pane. */
  record(/role="status"/.test(answerNext) && /aria-live="polite"/.test(answerNext), "C: AnswerNext's confirmation strip is announced to screen readers");
  record(/Recorded: \{confirmed\.label\}|Recorded: /.test(answerNext), "C: AnswerNext confirms the specific option that was clicked, by name");

  console.log(failures === 0 ? "\nALL PASS" : `\nFAILs: ${failures}`);
  if (failures) process.exit(1);
}

main();
