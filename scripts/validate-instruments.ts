/**
 * Build gate for the instrument ladder (the consolidation, wave one).
 * Chained into `npm run validate`, so no build ships with a ladder that
 * derives where it must not or claims what a position does not hold.
 */
import { deriveInstrumentLadder } from "../src/lib/workspace/instrument";

let pass = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean) {
  if (cond) pass += 1;
  else failures.push(name);
}

const pristine = deriveInstrumentLadder({ started: false, claims: 0, openQuestions: 0 });
ok("a desk that has not started derives no ladder at all", pristine === null);
ok("a started desk with zero claims still derives nothing", deriveInstrumentLadder({ started: true, claims: 0, openQuestions: 2 }) === null);

const early = deriveInstrumentLadder({ started: true, claims: 3, openQuestions: 2 })!;
ok("a live position holds a live SoR", early !== null && early.sor.state === "live");
ok("open questions keep the RFI a horizon", early.rfi.state === "horizon" && early.rfi.note === "ready when your open questions land");
ok("the full RFP is a horizon naming what it needs", early.rfp.state === "horizon" && early.rfp.note === "needs scoring priorities and commercials");

const landed = deriveInstrumentLadder({ started: true, claims: 9, openQuestions: 0 })!;
ok("answered questions flip the RFI note, a fact about this position", landed.rfi.state === "questions_landed" && landed.rfi.note === "your open questions have landed");
ok("no note promises the roadmap", ![early.rfi.note, early.rfp.note, landed.rfi.note].some((n) => /soon|coming|next release/i.test(n)));

if (failures.length > 0) {
  console.error(`instruments: ${failures.length} fixture(s) failing`);
  for (const f of failures) console.error(`  ✘ ${f}`);
  process.exit(1);
}
console.log(`instruments: ${pass} fixtures pass (0 fail)`);
