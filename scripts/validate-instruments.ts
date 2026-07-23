/**
 * Build gate for the instrument ladder (the consolidation, waves one and
 * two). Chained into `npm run validate`, so no build ships with a ladder
 * that derives where it must not, claims what a position does not hold,
 * or summons questions the bank does not carry.
 */
import {
  deriveInstrumentLadder,
  deriveRfiQuestionSet,
  earnedInstrument,
  instrumentNotesLine,
} from "../src/lib/workspace/instrument";
import { QUESTION_BANK } from "../src/lib/rfp-question-bank";

let pass = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean) {
  if (cond) pass += 1;
  else failures.push(name);
}

/* ---- The ladder: null law and honest horizons ---- */
ok("a desk that has not started derives no ladder at all",
  deriveInstrumentLadder({ started: false, claims: 0, openQuestions: 0, rfiQuestions: 0, prioritiesSet: 0, commercialClaims: 0 }) === null);
ok("a started desk with zero claims still derives nothing",
  deriveInstrumentLadder({ started: true, claims: 0, openQuestions: 2, rfiQuestions: 0, prioritiesSet: 0, commercialClaims: 0 }) === null);

const early = deriveInstrumentLadder({ started: true, claims: 3, openQuestions: 2, rfiQuestions: 16, prioritiesSet: 0, commercialClaims: 0 })!;
ok("open questions keep the RFI a horizon whatever the bank holds",
  early.sor.state === "live" && early.rfi.state === "horizon" && early.rfi.note === "ready when your open questions land");
ok("the RFP horizon names both needs before the RFI is ready",
  early.rfp.state === "horizon" && early.rfp.note === "needs scoring priorities and commercials");

const rfiReady = deriveInstrumentLadder({ started: true, claims: 9, openQuestions: 0, rfiQuestions: 16, prioritiesSet: 0, commercialClaims: 0 })!;
ok("landed questions plus a summoned set make the RFI ready, count named",
  rfiReady.rfi.state === "ready" && rfiReady.rfi.note === "ready · 16 questions from your position");
ok("the RFP then names exactly what is missing",
  rfiReady.rfp.state === "horizon" && rfiReady.rfp.note === "needs scoring priorities and a commercial claim (budget, term or timeline)");

const noSet = deriveInstrumentLadder({ started: true, claims: 2, openQuestions: 0, rfiQuestions: 0, prioritiesSet: 0, commercialClaims: 0 })!;
ok("no summoned questions, no ready RFI", noSet.rfi.state === "horizon" && noSet.rfi.note === "your areas summon their questions as you describe");

const rfpReady = deriveInstrumentLadder({ started: true, claims: 12, openQuestions: 0, rfiQuestions: 46, prioritiesSet: 2, commercialClaims: 1 })!;
ok("priorities plus a commercial claim earn the full RFP",
  rfpReady.rfp.state === "ready" && rfpReady.rfp.note === "weighted on 2 priorities");
ok("the earned instrument escalates truthfully",
  earnedInstrument(null) === "sor" && earnedInstrument(early) === "sor" && earnedInstrument(rfiReady) === "rfi" && earnedInstrument(rfpReady) === "rfp");
ok("no note promises the roadmap",
  ![early.rfi.note, early.rfp.note, rfiReady.rfp.note, noSet.rfi.note].some((n) => /soon|coming|next release/i.test(n)));

/* ---- The question set: the bank is the source, sections earn ---- */
const secOnly = deriveRfiQuestionSet({ coveredSections: ["security"], sector: null });
ok("security coverage summons the security categories plus evidence",
  secOnly !== null &&
  secOnly.canonical.some((c) => c.category === "Identity / ZTNA") &&
  secOnly.canonical.some((c) => c.category === "Vendor Evidence") &&
  !secOnly.canonical.some((c) => c.category === "Commercials"));
ok("nothing covered, nothing summoned", deriveRfiQuestionSet({ coveredSections: [], sector: "healthcare" }) === null);
const withPack = deriveRfiQuestionSet({ coveredSections: ["estate", "security", "commercial"], sector: "Healthcare" });
ok("a stated healthcare sector joins the healthcare pack, counts real",
  withPack !== null && withPack.sectorPack?.key === "healthcare" &&
  withPack.sectorPack.count === QUESTION_BANK.sector_packs.healthcare.count &&
  withPack.total === withPack.canonicalCount + withPack.sectorPack.count);
ok("an unmapped sector joins no pack, never a guess",
  deriveRfiQuestionSet({ coveredSections: ["estate"], sector: "space logistics" })?.sectorPack === null);
ok("every summoned question is the bank's verbatim",
  secOnly !== null && secOnly.canonical.every((c) => c.questions.every((q) => QUESTION_BANK.canonical.some((b) => b.id === q.id && b.text === q.text))));

/* ---- The notes declaration: rides only when earned ---- */
ok("a plain SoR declares nothing",
  instrumentNotesLine({ instrument: "sor", set: withPack, weightedHigh: [], commercialClaims: 0 }) === null);
const rfiLine = instrumentNotesLine({ instrument: "rfi", set: withPack, weightedHigh: [], commercialClaims: 0 });
ok("the RFI declaration names the set and the bank version",
  rfiLine !== null && rfiLine.startsWith("Instrument: RFI.") && rfiLine.includes("bank v2026.1") && rfiLine.includes("Healthcare"));
const rfpLine = instrumentNotesLine({ instrument: "rfp", set: withPack, weightedHigh: ["security", "compliance"], commercialClaims: 1 });
ok("the RFP declaration adds priorities and the commercial position",
  rfpLine !== null && rfpLine.includes("Instrument: RFP.") && rfpLine.includes("Priorities weighted high: security, compliance") && rfpLine.includes("1 claim"));

if (failures.length > 0) {
  console.error(`instruments: ${failures.length} fixture(s) failing`);
  for (const f of failures) console.error(`  ✘ ${f}`);
  process.exit(1);
}
console.log(`instruments: ${pass} fixtures pass (0 fail)`);
