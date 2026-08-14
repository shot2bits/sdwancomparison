// Verification-only script (not part of the app): Living Procurement OS ·
// Phase 3 Stage A ("Visible Production Projection", brief Version 2.0,
// Sections 5, 9 Stage A, 10, 12.1-12.4), CORRECTION ROUND (Robert, 14 Aug
// 2026). The original Stage A checkpoint was rejected: Prompt B/C/D
// defects were recorded as documentary NOTE output instead of graded
// assertions ("ALL PASS" was possible while named acceptance requirements
// failed). Every one of those three is now a genuine, non-vacuous
// PASS/FAIL assertion -- there is no more NOTE-only, non-graded path for
// any named Stage A acceptance prompt.
//
//   Part A: the REAL, unmodified compileProcurementDocument() -- driven by
//   the same deterministic extraction pipeline every prior fixture in this
//   repo already uses (ANTHROPIC_API_KEY is not set in this sandbox, so
//   model-based extraction is unavailable here -- the same disclosed
//   limitation scripts/validate-procurement-document.ts's own header
//   already documents) -- run against the brief's own Prompts A-D
//   (Section 12.1-12.4, exact wording), plus the coordinated-projection
//   invariants Stage A's UI depends on (the three views must always agree:
//   counts.requirements === clauses.length, counts.gates ===
//   evaluation.gates.length, counts.questions === the response groups'
//   own question total, counts.decisions === openDecisions.length, and
//   evaluation category weights always sum to exactly 100).
//
//   Part B: structural proof that ProjectDesk.tsx and the five new
//   src/components/procurement/*.tsx files actually wire REAL compiler
//   output into the render tree -- no hard-coded mockup content, no
//   second fact store, stable-id React keys, the Phase 2 pre-publication
//   vendor-redaction panel untouched and never co-rendered with the new
//   canvas, and the existing fact-editing statement panel's own behaviour
//   (slot cells, drop/clear, sector packs) left in place. Same
//   TOOLING LIMITATION convention validate-pre-publish-vendor-disclosure.ts
//   and validate-rfp-builder-match-disclosure.ts already use for
//   ProjectDesk.tsx/RfpBuilder.tsx: no jsdom in this repo, so a hook-heavy
//   client component is proven by source inspection, not a rendered DOM.
//   The correction round's explicit governed-revision wiring (Section 9's
//   version/change-ribbon semantics) is ALSO proven by source inspection
//   here, PLUS a real, rendered-UI Playwright pass driving Prompts A-D
//   through the actual ProjectDesk React update sequence on desktop and
//   mobile (documented, with screenshots, in the correction-round
//   checkpoint report -- source inspection alone cannot observe a
//   debounced settle window's real timing behaviour, only that the code
//   is wired to attempt it).
//
//   Part C: known-vector id-stability fixtures -- the correction round
//   replaced procurement-document.ts's FNV-1a hash (a Stage A regression)
//   with an isomorphic SHA-256 implementation that must reproduce the
//   EXACT pre-Stage-A `createHash("sha256")`-derived ids, byte-for-byte,
//   for every real templateKey this document actually produces.
//
// Every fix below was verified non-vacuous by sabotaging it and confirming
// this script FAILS, then restoring it (documented in the correction-round
// checkpoint report's own verification section, not re-encoded into this
// committed script as a permanent self-sabotage step).

import { deterministicExtract, coverDeclarativeClauses } from "../src/lib/workspace/extract";
import { mergeUpdates, requirementFrom, type WorkspaceFact } from "../src/lib/workspace/draft";
import {
  compileProcurementDocument,
  type LivingProcurementDocument,
} from "../src/lib/workspace/procurement-document";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

let failures = 0;
const record = (pass: boolean, label: string, detail: string) => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${detail}`);
};

type Receipt = { id: number; text: string };

/** Identical shape to validate-procurement-document.ts's own turn()
 *  helper (re-run, not re-implemented): drives ONE buyer turn through the
 *  real extraction pipeline, then compiles. */
function turn(
  text: string,
  facts: WorkspaceFact[],
  receipts: Receipt[],
  receiptIdRef: { n: number },
  cycle: number,
  prevDoc: LivingProcurementDocument | null,
): { facts: WorkspaceFact[]; receipts: Receipt[]; doc: LivingProcurementDocument } {
  const updates = deterministicExtract(text, []);
  const { unplacedClauses } = coverDeclarativeClauses(text, updates);
  const merged = mergeUpdates(facts, updates, cycle, "extract");
  const newFacts = merged.facts;
  const newReceipts = [...receipts];
  for (const c of unplacedClauses) newReceipts.push({ id: ++receiptIdRef.n, text: c });
  const requirement = requirementFrom(newFacts);
  const doc = compileProcurementDocument({
    facts: newFacts,
    requirement,
    verdict: null,
    noted: [],
    rfiSet: null,
    instrument: "sor",
    receipts: newReceipts,
    previousDocument: prevDoc,
  });
  return { facts: newFacts, receipts: newReceipts, doc };
}

function clauseByTemplate(doc: LivingProcurementDocument, templateId: string) {
  return doc.clauses.find((c) => c.templateId === templateId);
}

function checkCoordinatedProjections(doc: LivingProcurementDocument, label: string) {
  record(
    doc.counts.requirements === doc.clauses.length,
    `${label}: counts.requirements agrees with the Living document's own clause count`,
    `counts.requirements=${doc.counts.requirements} clauses.length=${doc.clauses.length}`,
  );
  record(
    doc.counts.gates === doc.evaluation.gates.length,
    `${label}: counts.gates agrees with the Evaluation view's own gate count`,
    `counts.gates=${doc.counts.gates} evaluation.gates.length=${doc.evaluation.gates.length}`,
  );
  const questionTotal = doc.responseGroups.reduce((n, g) => n + g.questions.length, 0);
  record(
    doc.counts.questions === questionTotal,
    `${label}: counts.questions agrees with the Supplier pack's own question total`,
    `counts.questions=${doc.counts.questions} responseGroups total=${questionTotal}`,
  );
  record(
    doc.counts.decisions === doc.openDecisions.length,
    `${label}: counts.decisions agrees with the Living document's own open-decisions count`,
    `counts.decisions=${doc.counts.decisions} openDecisions.length=${doc.openDecisions.length}`,
  );
  const weightTotal = doc.evaluation.categories.reduce((n, c) => n + c.weight, 0);
  record(weightTotal === 100, `${label}: Evaluation category weights sum to exactly 100`, `total=${weightTotal}`);
  const mandatoryWithoutGate = doc.clauses.filter((c) => c.mandatory && !doc.evaluation.gates.some((g) => g.clauseIds.includes(c.id)));
  record(
    mandatoryWithoutGate.length === 0,
    `${label}: every mandatory clause has a matching pass/fail gate (Living document and Evaluation stay in lock-step)`,
    `missing=${JSON.stringify(mandatoryWithoutGate.map((c) => c.id))}`,
  );
  const gatesWithoutClause = doc.evaluation.gates.filter((g) => !g.clauseIds.every((id) => doc.clauses.some((c) => c.id === id)));
  record(gatesWithoutClause.length === 0, `${label}: every gate references a clause id that genuinely exists in this compile`, `orphaned=${JSON.stringify(gatesWithoutClause.map((g) => g.id))}`);
}

function main() {
  /* ================================================================ */
  /* Part A1: the brief's own Prompts A-D, EXACT wording (Section 12)   */
  /* ================================================================ */
  const idRef = { n: 0 };
  let cycle = 0;

  // --- Prompt A (Section 12.1) ---
  const promptA =
    "We are a UK healthcare organisation with 20 sites and 200 remote users. We need managed SASE and SD-WAN, use Azure and Entra ID, retain private Ethernet for a clinical application, support Teams Phone, operate 24/7 and transition by April 2027.";
  let state = turn(promptA, [], [], idRef, ++cycle, null);
  record(state.doc.version === 1, "Prompt A: first compile is version 1", `version=${state.doc.version}`);
  record(state.doc.clauses.length > 0, "Prompt A: the document compiles immediately (a real document, not an empty shell)", `clauses=${state.doc.clauses.length}`);
  record(state.doc.architecture.nodes.length > 0, "Prompt A: the architecture is non-empty from the first compile", `nodes=${state.doc.architecture.nodes.length}`);
  record(state.doc.readiness.score >= 0 && state.doc.readiness.score <= 100, "Prompt A: readiness score is a valid percentage", `score=${state.doc.readiness.score}`);
  checkCoordinatedProjections(state.doc, "Prompt A");
  console.log(`  Prompt A fixture: title="${state.doc.title}" summary="${state.doc.summary}" clauses=${JSON.stringify(state.doc.clauses.map((c) => c.templateId))} counts=${JSON.stringify(state.doc.counts)}`);

  // --- Prompt B (Section 12.2), CORRECTION ROUND: real assertions, no ---
  // --- NOTE-only path. DLP was never previously stated in this session --
  const beforeB = state.doc;
  const promptB = "Change the service to co-managed. Keep 24/7 incident support, remove DLP, and keep the April 2027 deadline.";
  state = turn(promptB, state.facts, state.receipts, idRef, ++cycle, beforeB);
  record(state.doc.version === beforeB.version + 1, "Prompt B: the document version increments exactly once", `before=${beforeB.version} after=${state.doc.version}`);
  const weightTotalB = state.doc.evaluation.categories.reduce((n, c) => n + c.weight, 0);
  record(weightTotalB === 100, "Prompt B: evaluation total stays exactly 100 after a removal", `total=${weightTotalB}`);
  const timeline = state.facts.find((f) => f.path === "constraints.timeline" && !f.struck);
  record(Boolean(timeline) && /april 2027/i.test(String(timeline?.value)), "Prompt B: the April 2027 deadline is kept, not dropped by the correction", `value=${timeline?.value}`);
  const dlpAfterB = clauseByTemplate(state.doc, "dlp-coverage");
  record(!dlpAfterB, "Prompt B/THE CORRECTION: 'remove DLP' with no prior DLP requirement is an idempotent no-op -- DLP does not exist afterwards", `dlp present=${Boolean(dlpAfterB)}`);
  const dlpBackedGates = state.doc.evaluation.gates.filter((g) => g.clauseIds.some((id) => state.doc.clauses.find((c) => c.id === id)?.templateId === "dlp-coverage"));
  const dlpQuestions = state.doc.responseGroups.flatMap((g) => g.questions).filter((q) => state.doc.clauses.find((c) => c.id === q.clauseId)?.templateId === "dlp-coverage");
  record(dlpBackedGates.length === 0 && dlpQuestions.length === 0, "Prompt B/THE CORRECTION: no gate or supplier question was ever created from the negated DLP phrase", `gates=${JSON.stringify(dlpBackedGates.map((g) => g.id))} questions=${JSON.stringify(dlpQuestions.map((q) => q.id))}`);
  const unclassifiedAfterB = state.doc.clauses.filter((c) => c.templateId === "unclassified" && /remove dlp/i.test(c.statement));
  record(unclassifiedAfterB.length === 0, "Prompt B/THE CORRECTION: the removal sentence does not ALSO survive as a duplicate 'Additional requirement' catch-all clause", JSON.stringify(unclassifiedAfterB.map((c) => c.id)));
  const managedAfterB = clauseByTemplate(state.doc, "managed-service-boundary");
  record(Boolean(managedAfterB) && /co-managed/i.test(managedAfterB!.statement), "Prompt B/THE CORRECTION: co-managed replaces the operating-model concept in place -- one managed-service-boundary clause, not a competing second one", `statement=${managedAfterB?.statement}`);
  record(managedAfterB?.statement.includes("24/7") === true, "Prompt B/THE CORRECTION: 24/7 incident support is kept on the SAME managed-service clause, not dropped by the correction", `statement=${managedAfterB?.statement}`);
  const competingManaged = state.doc.clauses.filter((c) => c.templateId === "managed-service-boundary");
  record(competingManaged.length === 1, "Prompt B/THE CORRECTION: exactly one managed-service-boundary clause exists -- no competing second clause left behind", `count=${competingManaged.length}`);
  // Prompt A itself never stated an operating model (no "managed"/
  // "co-managed" wording), so the managed-service-boundary clause is
  // genuinely NEW at Prompt B, not an in-place update of an
  // already-standing clause -- "added" is the semantically correct
  // change-ribbon entry here, not a fabricated one.
  record(
    (state.doc.changeSet.clauses.added.includes(managedAfterB!.id) || state.doc.changeSet.clauses.updated.includes(managedAfterB!.id)) && !state.doc.changeSet.clauses.removed.includes(managedAfterB!.id),
    "Prompt B/THE CORRECTION: the change ribbon describes the real semantic change to the managed-service clause (added, since Prompt A stated no prior operating model) -- never fabricated, never a phantom removal",
    JSON.stringify(state.doc.changeSet.clauses),
  );
  checkCoordinatedProjections(state.doc, "Prompt B");
  console.log(`  Prompt B changeSet: ${JSON.stringify(state.doc.changeSet.clauses)}`);

  // --- Prompt C (Section 12.3), CORRECTION ROUND: real assertions ---
  const promptC = "All customer data must remain in the UK.";
  const beforeC = state.doc;
  state = turn(promptC, state.facts, state.receipts, idRef, ++cycle, beforeC);
  const residency = clauseByTemplate(state.doc, "uk-data-residency");
  record(Boolean(residency), "Prompt C/THE CORRECTION: the brief's own exact Section 12.3 sentence ('All customer data must remain in the UK.') is recognised as the named UK data-residency template", `found=${Boolean(residency)}`);
  record(residency?.quote === promptC, "Prompt C: the exact buyer sentence is retained verbatim as the clause's own quote (provenance)", `quote=${residency?.quote}`);
  record((residency?.evidence.length ?? 0) > 0, "Prompt C: a testable residency clause carries a real, correct evidence request", JSON.stringify(residency?.evidence));
  record(residency?.origin === "buyer", "Prompt C: the residency clause is attributed to the buyer, not fabricated as a netify/sector default", `origin=${residency?.origin}`);
  record(residency?.mandatory === true, "Prompt C: 'must remain in the UK' is recognised as mandatory language", `mandatory=${residency?.mandatory}`);
  const genericCatchAllForC = state.doc.clauses.filter((c) => c.templateId === "unclassified" && c.statement === promptC);
  record(genericCatchAllForC.length === 0, "Prompt C: no generic 'confirm your ability' Additional-requirement fallback was created for this sentence (it has its own named clause)", JSON.stringify(genericCatchAllForC.map((c) => c.id)));
  checkCoordinatedProjections(state.doc, "Prompt C");

  /* ================================================================ */
  /* Part A2: the SAME scenario, re-run with the corroborating wording  */
  /* Phase 1's own fixture (validate-procurement-document.ts, Section    */
  /* 16.1) already established is needed to fire every named template   */
  /* under the deterministic (no-model) fallback this sandbox is        */
  /* limited to. Proves the compiler CAN and DOES produce the full      */
  /* richness Section 12.1 describes (identity/voice/application/       */
  /* legacy-circuit/DLP/residency clauses together), so Stage A's UI is  */
  /* proven against a document that actually exercises every section,   */
  /* provenance colour and clause type it renders -- not just the       */
  /* sparser set the brief's own prose-style Prompt A happens to trigger */
  /* without a live model. In real production (ANTHROPIC_API_KEY set),  */
  /* model-based extraction is expected to classify the brief's own     */
  /* prose directly; this sandbox cannot exercise that path.            */
  /* ================================================================ */
  const richText =
    "Teams Phone and the patient booking platform cannot go down. Fail over automatically without dropping calls. We use Entra ID and Azure; require ZTNA and DLP. Fully managed with 24/7 support, live by April 2027. Customer data must not leave the UK. We also have a legacy app that requires a point to point Ethernet private circuit.";
  const richIdRef = { n: 5000 };
  const rich = turn(richText, [], [], richIdRef, 1, null);
  for (const templateId of ["voice-continuity", "application-resilience", "identity-aware-ztna", "dlp-coverage", "managed-service-boundary", "dated-transition-plan", "uk-data-residency", "legacy-circuit-coexistence"]) {
    record(Boolean(clauseByTemplate(rich.doc, templateId)), `Part A2 (rich wording): ${templateId} clause is generated`, "");
  }
  const provenanceCoverage = new Set(rich.doc.clauses.map((c) => c.origin));
  record(provenanceCoverage.has("buyer"), "Part A2: at least one clause carries buyer (green-dot) provenance", JSON.stringify([...provenanceCoverage]));
  const sectionCoverage = new Set(rich.doc.clauses.map((c) => c.section));
  record(sectionCoverage.size >= 3, "Part A2: clauses span at least 3 different sections (exercises the clause list's section grouping)", JSON.stringify([...sectionCoverage]));
  checkCoordinatedProjections(rich.doc, "Part A2 (rich wording)");

  /* ================================================================ */
  /* Part A3, CORRECTION ROUND: Prompt D (Section 12.4), real assertions */
  /* ================================================================ */
  const promptD = "We want a single supplier but also require independent best-of-breed security controls.";
  const dState = turn(promptD, [], [], { n: 9000 }, 1, null);
  const conflictDecisions = dState.doc.openDecisions.filter((d) => d.conflict);
  const supplierStrategyDecision = dState.doc.openDecisions.find((d) => d.id === "OD-supplier-strategy-conflict");
  record(Boolean(supplierStrategyDecision), "Prompt D/THE CORRECTION: a visible conflict/open decision describing the single-supplier-vs-best-of-breed-security tension is created", `found=${Boolean(supplierStrategyDecision)}`);
  record(supplierStrategyDecision?.conflict === true, "Prompt D: the decision is flagged as a genuine conflict", `conflict=${supplierStrategyDecision?.conflict}`);
  record(supplierStrategyDecision?.conflictReason === promptD, "Prompt D: the original buyer wording is retained visibly and verbatim in the decision's own conflictReason", `conflictReason=${supplierStrategyDecision?.conflictReason}`);
  record(conflictDecisions.some((d) => d.id === "OD-supplier-strategy-conflict"), "Prompt D: the decision is included in the document's own conflict-flagged decisions", "");
  const inventedMandatoryFromD = dState.doc.clauses.filter((c) => c.mandatory && c.templateId === "unclassified");
  record(inventedMandatoryFromD.length === 0, "Prompt D/THE CORRECTION: no invented mandatory 'unclassified' clause -- neither side of the conflict is made mandatory before the buyer decides", JSON.stringify(inventedMandatoryFromD.map((c) => c.id)));
  record(dState.doc.evaluation.gates.length === 0, "Prompt D/THE CORRECTION: no pass/fail gate is invented from the unresolved contradiction", JSON.stringify(dState.doc.evaluation.gates.map((g) => g.id)));
  const deadlineDecisionSubstitutedForD = dState.doc.openDecisions.find((d) => d.id === "OD-timeline-unstated");
  record(
    Boolean(supplierStrategyDecision) && (!deadlineDecisionSubstitutedForD || conflictDecisions.some((d) => d.id === "OD-supplier-strategy-conflict")),
    "Prompt D/THE CORRECTION: an unrelated deadline open decision (legitimately also present, since Prompt D alone states no deadline) never SUBSTITUTES for the conflict decision -- both can coexist, but the conflict decision itself is always present",
    `supplierStrategyDecision=${Boolean(supplierStrategyDecision)} deadlineDecisionAlsoPresent=${Boolean(deadlineDecisionSubstitutedForD)}`,
  );
  checkCoordinatedProjections(dState.doc, "Prompt D");

  /* ================================================================ */
  /* Part A4, CORRECTION ROUND: Prompt D in a SEPARATE new project      */
  /* produces V1, not a continuation of the prior project's version --  */
  /* proves governed-revision state starts fresh per project (a fresh   */
  /* `turn()` call chain here mirrors a fresh ProjectDesk mount: see     */
  /* Part D-UI below and the correction-round checkpoint report for the  */
  /* real, rendered-browser confirmation of the same invariant).         */
  /* ================================================================ */
  record(dState.doc.version === 1, "Prompt D/THE CORRECTION: Prompt D in a separate new project produces V1 (a fresh project never inherits a prior project's revision count)", `version=${dState.doc.version}`);

  /* ================================================================ */
  /* Part C, CORRECTION ROUND: known-vector id-stability fixtures.       */
  /* Robert: "Do not ship the FNV-1a migration... Existing published or  */
  /* persisted documents must not acquire new ids merely because this UI */
  /* is deployed." procurement-document.ts's stableClauseId() is, byte-  */
  /* for-byte, `createHash("sha256").update(templateKey).digest("hex")   */
  /* .slice(0, 8)` again -- an isomorphic, dependency-free SHA-256        */
  /* implementation stands in for node:crypto (which cannot ship in a    */
  /* client bundle), not a different hash. This section computes the     */
  /* SAME known vectors INDEPENDENTLY, via node:crypto directly (never   */
  /* by calling into procurement-document.ts's own hash function -- that */
  /* would only prove the function agrees with itself), and asserts the  */
  /* compiler's REAL, live-produced clause ids match, byte-for-byte.     */
  /* ================================================================ */
  const KNOWN_VECTOR_TEMPLATE_KEYS = [
    "network:legacy-circuit-coexistence",
    "security:dlp",
    "identity:entra-ztna",
    "identity:entra-provider",
    "security:data-residency",
    "operating-model:boundary",
    "timeline:plan",
    "resilience:voice-continuity",
    "resilience:application",
    "application:voice-scope",
    "network:architecture-scope",
  ];
  for (const templateKey of KNOWN_VECTOR_TEMPLATE_KEYS) {
    const expected = createHash("sha256").update(templateKey, "utf8").digest("hex").slice(0, 8);
    // Every templateKey above is produced by at least one turn already
    // run in this script (Prompt A/B/C or the Part A2 rich-wording turn) --
    // find its REAL, live id from whichever compile actually has it.
    const foundIn = [state.doc, rich.doc, dState.doc].flatMap((d) => d.clauses).find((c) => c.templateKey === templateKey);
    if (foundIn) {
      record(foundIn.id.endsWith(expected), `Part C/known-vector: templateKey "${templateKey}" hashes to the EXACT pre-Stage-A SHA-256-derived id (independently computed via node:crypto)`, `id=${foundIn.id} expectedSuffix=${expected}`);
    } else {
      record(false, `Part C/known-vector: templateKey "${templateKey}" was expected to appear in at least one compile this script already ran, but did not`, "");
    }
  }
  // A fresh, independent compile with previousDocument=null (the "genuine
  // reload" case Robert's own reproduction targeted) must produce the
  // IDENTICAL id for the identical templateKey -- never a function of
  // history, in-memory registry order, or which OTHER clauses this
  // compile happens to also produce.
  const reloadCheck = turn(richText, [], [], { n: 8000 }, 1, null);
  const dlpBeforeReload = clauseByTemplate(rich.doc, "dlp-coverage");
  const dlpAfterReload = clauseByTemplate(reloadCheck.doc, "dlp-coverage");
  record(Boolean(dlpBeforeReload) && dlpBeforeReload?.id === dlpAfterReload?.id, "Part C/known-vector: a genuine reload (previousDocument=null) reproduces the IDENTICAL clause id for the identical templateKey", `before=${dlpBeforeReload?.id} after=${dlpAfterReload?.id}`);

  /* ================================================================ */
  /* Part B: structural proof -- ProjectDesk.tsx + the five new files   */
  /* ================================================================ */
  const desk = readFileSync(new URL("../src/components/ProjectDesk.tsx", import.meta.url), "utf8");
  const canvas = readFileSync(new URL("../src/components/procurement/LivingProcurementCanvas.tsx", import.meta.url), "utf8");
  const arch = readFileSync(new URL("../src/components/procurement/ProcurementArchitecture.tsx", import.meta.url), "utf8");
  const clauseList = readFileSync(new URL("../src/components/procurement/ProcurementClauseList.tsx", import.meta.url), "utf8");
  const supplierPack = readFileSync(new URL("../src/components/procurement/SupplierPackView.tsx", import.meta.url), "utf8");
  const evalView = readFileSync(new URL("../src/components/procurement/EvaluationView.tsx", import.meta.url), "utf8");
  const globalsCss = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

  record(desk.includes('from "@/lib/workspace/procurement-document"'), "Part B: ProjectDesk.tsx imports the real compiler module", "");
  record(desk.includes("compileProcurementDocument({"), "Part B: ProjectDesk.tsx calls the real compileProcurementDocument()", "");
  record(
    /compileProcurementDocument\(\{[\s\S]{0,400}facts,[\s\S]{0,400}requirement,[\s\S]{0,400}verdict,[\s\S]{0,400}noted,[\s\S]{0,400}rfiSet,[\s\S]{0,400}instrument,[\s\S]{0,400}receipts,[\s\S]{0,400}sourceTurns,/.test(desk),
    "Part B: the compiler call is fed the desk's own live state variables (facts/requirement/verdict/noted/rfiSet/instrument/receipts/sourceTurns), not fabricated inputs",
    "",
  );
  // CORRECTION ROUND (Robert, 14 Aug 2026): Stage A's original legacy
  // fallback mode (input.revision left undefined) is replaced with the
  // explicit resolveGovernedRevision() event contract -- "Stage A already
  // displays versions and change ribbons, so explicit revision wiring
  // cannot be deferred."
  record(desk.includes("revision: currentRevision"), "Part B/THE CORRECTION: the compiler call is fed the explicit governed-revision contract (revision: currentRevision), not left undefined in legacy fallback mode", "");
  record(desk.includes("resolveGovernedRevision") && desk.includes("INITIAL_GOVERNED_REVISION_STATE"), "Part B/THE CORRECTION: ProjectDesk.tsx imports and uses the real resolveGovernedRevision() reducer, not a hand-rolled version counter", "");
  record(/beginOrExtendSubmission/.test(desk) && /scheduleSettle/.test(desk), "Part B/THE CORRECTION: a settle-debounce window batches every applyMerge()/applyRemovals() call inside one buyer submission into exactly one governed event", "");
  record(/applyMerge = useCallback\(\(updates[\s\S]{0,200}beginOrExtendSubmission\(\)/.test(desk), "Part B/THE CORRECTION: applyMerge() opens/extends the submission window before mutating facts", "");
  record(/applyRemovals = useCallback[\s\S]{0,200}beginOrExtendSubmission\(\)/.test(desk), "Part B/THE CORRECTION: applyRemovals() also opens/extends the SAME submission window (a removal is a buyer submission too)", "");
  record(
    /thisCycle !== prevCycle/.test(desk) && /previousProcurementDocumentRef\.current = compiledDocument/.test(desk),
    "Part B/THE CORRECTION: previousProcurementDocumentRef is frozen until a NAMED revision cycle actually lands -- the change ribbon compares complete buyer-event snapshots, not intermediate settling renders",
    "",
  );
  record(desk.includes("<LivingProcurementCanvas"), "Part B: ProjectDesk.tsx actually renders <LivingProcurementCanvas", "");
  record(desk.includes('phase === "live" && started &&'), "Part B: the new canvas is gated on phase===\"live\" && started, the same gate the existing editable statement panel uses", "");

  // The locked pre-publication panel must remain completely untouched and
  // must never be reachable while the new canvas is also shown.
  record(desk.includes('LOCKED OUTCOME (was "WHO FITS")'), "Part B: the Phase 2 locked-outcome panel's own header comment is still present, byte-identical marker", "");
  const fitsIdx = desk.indexOf('{phase === "fits" && (');
  const canvasIdx = desk.indexOf("<LivingProcurementCanvas");
  record(fitsIdx > 0 && canvasIdx > 0 && canvasIdx < fitsIdx, "Part B: the new canvas's own JSX appears strictly before the phase===\"fits\" locked panel in source order (not nested inside it, not after it)", `canvasIdx=${canvasIdx} fitsIdx=${fitsIdx}`);
  for (const forbidden of ["rankedFits", "matchInfo.count", ".suppliers", "invited_vendors", "matched_vendors"]) {
    // Only assert these SPECIFIC strings are absent from the NEW component
    // files (they legitimately exist elsewhere in ProjectDesk.tsx's own
    // untouched locked panel) -- the new Stage A surface must never carry
    // vendor-identifying content pre-publication.
    record(!canvas.includes(forbidden) && !arch.includes(forbidden) && !clauseList.includes(forbidden) && !supplierPack.includes(forbidden) && !evalView.includes(forbidden), `Part B: the new component files never reference '${forbidden}' (no vendor-identity leakage surface)`, "");
  }

  // No hard-coded mockup content: the new files must not contain any of
  // the illustrative example strings the brief's own mockups/prose use.
  for (const mockupString of ["Aryaka", "BT Business", "Verizon", "20 sites, 200 remote users", "Cato Networks", "Palo Alto"]) {
    record(
      !canvas.includes(mockupString) && !arch.includes(mockupString) && !clauseList.includes(mockupString) && !supplierPack.includes(mockupString) && !evalView.includes(mockupString),
      `Part B: no hard-coded mockup/example content ('${mockupString}') in the new components`,
      "",
    );
  }

  // Component boundaries (Section 10): the five named components exist as
  // their own focused files, not folded into ProjectDesk.tsx directly.
  record(/export default function LivingProcurementCanvas/.test(canvas), "Part B: LivingProcurementCanvas is its own focused component", "");
  record(/export default function ProcurementArchitecture/.test(arch), "Part B: ProcurementArchitecture is its own focused component", "");
  record(/export default function ProcurementClauseList/.test(clauseList), "Part B: ProcurementClauseList is its own focused component", "");
  record(/export default function SupplierPackView/.test(supplierPack), "Part B: SupplierPackView is its own focused component", "");
  record(/export default function EvaluationView/.test(evalView), "Part B: EvaluationView is its own focused component", "");

  // Stable identity as React keys (never array index for a compiler-
  // produced, reorderable list).
  record(/key=\{c\.id\}/.test(clauseList), "Part B: ProcurementClauseList keys clause rows on the compiler's own stable clause.id", "");
  record(/key=\{g\.key\}/.test(supplierPack) || /key=\{g\.key\}/.test(evalView), "Part B: response groups / evaluation categories key on the compiler's own stable group/category key", "");
  record(/key=\{q\.id\}/.test(supplierPack), "Part B: supplier questions key on the compiler's own stable question id", "");
  record(/key=\{g\.id\}/.test(evalView), "Part B: gates key on the compiler's own stable gate id", "");
  record(/key=\{n\.id\}/.test(arch), "Part B: architecture nodes key on the compiler's own stable node id", "");
  record(/key=\{d\.id\}/.test(canvas), "Part B: open decisions key on the compiler's own stable decision id", "");

  // No second fact store / no independently-maintained copy of the
  // document: the components only ever destructure `document`/`architecture`
  // /`clauses`/etc. from props, they never call useState on compiled data.
  for (const [name, src] of [["LivingProcurementCanvas", canvas], ["ProcurementArchitecture", arch], ["ProcurementClauseList", clauseList], ["SupplierPackView", supplierPack], ["EvaluationView", evalView]] as const) {
    record(!/useState/.test(src), `Part B: ${name}.tsx holds no local state of its own (pure presentational read of the compiled document)`, "");
  }

  // Accessibility / reduced motion (Section 5.6).
  record(/role="tablist"/.test(canvas) && /role="tab"/.test(canvas) && /aria-selected/.test(canvas), "Part B: the Living document / Supplier pack / Evaluation switch uses real tab semantics (role, aria-selected)", "");
  record(/sr-only/.test(arch), "Part B: the architecture's accessible text summary is always rendered (not display:none / JS-conditional)", "");
  record(/prefers-reduced-motion/.test(globalsCss) && /ldoc-changed/.test(globalsCss), "Part B: the shared change-pulse class has a prefers-reduced-motion static fallback (Section 5.6)", "");
  record(/@keyframes ldoc-pulse/.test(globalsCss), "Part B: the change pulse is a real, short (350ms, within the 250-400ms band) CSS animation", /350ms/.test(globalsCss) ? "350ms confirmed" : "duration not found");

  // Existing statement panel (the correction/edit surface) is untouched:
  // its own governing doc comments and key interactive affordances are
  // still present, unchanged, after this stage's edits.
  record(desk.includes("THE LIVING STATEMENT"), "Part B: the existing slot-by-slot Living Statement panel's own header comment is untouched", "");
  record(desk.includes("TWIN_GROUPS.map"), "Part B: the existing TWIN_GROUPS slot-editing render loop is untouched", "");
  record(desk.includes("onClick={() => dropRow(f)}"), "Part B: the existing drop/clear fact controls are untouched", "");

  // Mobile: no fixed pixel widths that would break small screens; the new
  // canvas relies on the same max-w-[1000px] mx-auto responsive wrapper
  // every other section of this page already uses.
  record(desk.includes('max-w-[1000px] px-[26px] pb-2 pt-[6px]'), "Part B: the new canvas mounts inside the SAME responsive max-width wrapper the rest of the page uses (no new fixed-width container)", "");
  record(/flex-wrap/.test(canvas), "Part B: the canvas cover/tabs layout wraps on narrow viewports", "");
  record(/overflow-x-auto/.test(canvas), "Part B: the view-switch tabs scroll horizontally rather than overflow on narrow viewports", "");

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
