// Verification-only script (not part of the app): proves the Living
// Procurement Canvas Phase 1 compiler (Netify Living Procurement Canvas
// brief, Version 2.0, Sections 6, 7, 14 and 16) against the real,
// unmodified compileProcurementDocument() -- driven by the SAME
// deterministic extraction pipeline (deterministicExtract +
// coverDeclarativeClauses + mergeUpdates) every prior reliability-gate
// fixture already uses, so every acceptance prompt below runs through the
// production code, not a hand-built shortcut.
//
// ANTHROPIC_API_KEY is not set in this sandbox, so extraction always
// resolves via the deterministic fallback -- an honest limitation of this
// script (not of the compiler, which is model-independent by design:
// Section 8.5, "AI extraction occurs in the existing prompt cycle;
// compilation is a pure projection"). Every case below is therefore also
// a live "model unavailable" proof for the compiler layer.
//
// Section 13.2's boundary applies to this script too: it never touches
// extract.ts, draft.ts or source-ledger.ts, and it re-runs (does not
// re-implement) the existing Fact Ledger Reliability Gate fixtures'
// pipeline shape to build its own inputs.

import { deterministicExtract, coverDeclarativeClauses } from "../src/lib/workspace/extract";
import { mergeUpdates, requirementFrom, type WorkspaceFact } from "../src/lib/workspace/draft";
import {
  compileProcurementDocument,
  type LivingProcurementDocument,
  type ProcurementClause,
} from "../src/lib/workspace/procurement-document";

let failures = 0;
const record = (pass: boolean, label: string, detail: string) => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${detail}`);
};

type Receipt = { id: number; text: string };

/** Drives ONE buyer turn through the real, unmodified extraction pipeline
 *  (identical shape to ProjectDesk.tsx's own send()/runCycle() and to
 *  verify-fact-ledger-reliability-gate.ts's own fixtures), then compiles.
 *  Facts and receipts accumulate exactly as they do in a real session. */
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
    verdict: null, // Section 8.5: the compiler never calls a model itself; a null verdict (network-scope buying, or security assessment not run) must compile cleanly -- proven directly here.
    noted: [],
    rfiSet: null,
    instrument: "sor",
    receipts: newReceipts,
    previousDocument: prevDoc,
  });
  return { facts: newFacts, receipts: newReceipts, doc };
}

const clauseByTemplate = (doc: LivingProcurementDocument, templateId: string): ProcurementClause | undefined =>
  doc.clauses.find((c) => c.templateId === templateId);

function checkCategoryTotal(doc: LivingProcurementDocument, label: string) {
  const total = doc.evaluation.categories.reduce((n, c) => n + c.weight, 0);
  record(total === 100, `${label}: evaluation categories total exactly 100`, `total=${total}`);
}

function checkEveryClauseTraceable(doc: LivingProcurementDocument, label: string) {
  const untraceable = doc.clauses.filter(
    (c) => c.sourceFactIds.length === 0 && !c.quote && c.origin !== "sector",
  );
  record(untraceable.length === 0, `${label}: every clause traces to a fact, a quote or a named sector template`, `untraceable=${JSON.stringify(untraceable.map((c) => c.id))}`);
}

function checkEveryMandatoryHasAcceptanceOrOpenDecision(doc: LivingProcurementDocument, label: string) {
  const bad = doc.clauses.filter((c) => c.mandatory && !c.acceptanceTest);
  record(bad.length === 0, `${label}: every mandatory clause carries an acceptance test`, `bad=${JSON.stringify(bad.map((c) => c.id))}`);
}

function main() {
  /* ================================================================ */
  /* Section 14.4: the original defect prompt (Healthcare/Ethernet)     */
  /* ================================================================ */
  {
    const text =
      "UK 20 site Healthcare business requires SD-WAN and full SASE. We have 200 remote users. We also have a legacy app that requires a point to point Ethernet private circuit.";
    const s = turn(text, [], [], { n: 0 }, 1, null);
    const { doc, facts } = s;

    const sectorFact = facts.find((f) => f.path === "organisation.sector" && !f.struck);
    record(sectorFact?.value === "Healthcare & pharma", "14.4: Healthcare is a stated sector, never a guess", `value=${sectorFact?.value} provenance=${sectorFact?.provenance}`);
    record(sectorFact?.provenance === "stated", "14.4: Healthcare sector fact is provenance=stated", `provenance=${sectorFact?.provenance}`);

    const req = requirementFrom(facts);
    record(req.organisation?.regions?.includes("uk") === true, "14.4: UK remains a structured fact", JSON.stringify(req.organisation?.regions));
    record(req.estate?.sites === 20, "14.4: 20 sites remains a structured fact", `sites=${req.estate?.sites}`);
    record(req.estate?.users === 200, "14.4: 200 remote users remains a structured fact", `users=${req.estate?.users}`);
    record(req.estate?.existingNetwork?.includes("sdwan") === true, "14.4: SD-WAN remains a structured fact", JSON.stringify(req.estate?.existingNetwork));

    const scopeClause = clauseByTemplate(doc, "network-architecture-scope");
    record(Boolean(scopeClause), "14.4: the SASE/SD-WAN scope sentence becomes a real network clause, not just a receipt", `found=${Boolean(scopeClause)}`);
    record(scopeClause?.quote?.includes("full SASE") === true, "14.4: the scope clause quotes the buyer's SASE wording verbatim", `quote=${scopeClause?.quote}`);

    const legacyClause = clauseByTemplate(doc, "legacy-circuit-coexistence");
    record(Boolean(legacyClause), "14.4: the legacy app + retained Ethernet circuit becomes a testable clause", `found=${Boolean(legacyClause)}`);
    record(legacyClause?.section === "network", "14.4: the legacy-circuit clause is classified, not dumped unclassified", `section=${legacyClause?.section}`);
    record(
      legacyClause?.quote === "We also have a legacy app that requires a point to point Ethernet private circuit.",
      "14.4: the exact buyer sentence is attached as provenance verbatim",
      `quote=${legacyClause?.quote}`,
    );
    record(legacyClause?.mandatory === true, "14.4: the legacy-circuit clause is mandatory (buyer said \"requires\")", `mandatory=${legacyClause?.mandatory}`);
    record(
      (legacyClause?.supplierResponse.some((s) => /coexist/i.test(s)) ?? false) &&
        (legacyClause?.supplierResponse.some((s) => /rollback/i.test(s)) ?? false) &&
        (legacyClause?.supplierResponse.some((s) => /migration|sequenc/i.test(s)) ?? false),
      "14.4: supplier response asks for coexistence, migration sequencing and rollback, without prescribing a supplier architecture",
      JSON.stringify(legacyClause?.supplierResponse),
    );

    // The 14.3 dynamic-section rule's own acceptance line: nothing is left
    // ONLY as an unplaced "Your notes" receipt -- every unplaced clause
    // this turn produced became a real, traceable ProcurementClause.
    const stillOnlyAReceipt = s.receipts.filter((r) => !doc.clauses.some((c) => c.quote?.includes(r.text) || c.quote === r.text));
    record(stillOnlyAReceipt.length === 0, "14.4: no unplaced clause remains ONLY under 'Your notes'", `stillUnclassified=${JSON.stringify(stillOnlyAReceipt.map((r) => r.text))}`);

    checkCategoryTotal(doc, "14.4 Healthcare/Ethernet");
    checkEveryClauseTraceable(doc, "14.4 Healthcare/Ethernet");
    checkEveryMandatoryHasAcceptanceOrOpenDecision(doc, "14.4 Healthcare/Ethernet");
  }

  /* ================================================================ */
  /* Section 16.1: primary procurement compilation (Prompt A)           */
  /* ================================================================ */
  let promptAState: ReturnType<typeof turn>;
  {
    const text =
      "Teams Phone and the patient booking platform cannot go down. Fail over automatically without dropping calls. We use Entra ID and Azure; require ZTNA and DLP. Fully managed with 24/7 support, live by April 2027.";
    promptAState = turn(text, [], [], { n: 1000 }, 1, null);
    const { doc } = promptAState;

    const nodeIds = doc.architecture.nodes.map((n) => n.id);
    record(nodeIds.includes("cloud-azure"), "16.1: architecture includes an Azure node", JSON.stringify(nodeIds));
    record(nodeIds.includes("identity"), "16.1: architecture includes an identity (Entra ID) node", JSON.stringify(nodeIds));
    record(nodeIds.includes("voice"), "16.1: architecture includes a voice (Teams Phone) node", JSON.stringify(nodeIds));
    record(
      doc.architecture.edges.some((e) => e.from === "identity" || e.to === "identity"),
      "16.1: architecture has a traceable edge touching the identity node",
      JSON.stringify(doc.architecture.edges),
    );

    record(/teams phone/i.test(doc.summary) || /voice/i.test(doc.summary), "16.1: summary names the voice/Teams Phone requirement", doc.summary);
    record(/patient/i.test(doc.summary), "16.1: summary names the patient-facing application", doc.summary);
    record(/azure/i.test(doc.summary), "16.1: summary names Azure", doc.summary);

    record(Boolean(clauseByTemplate(doc, "voice-continuity")), "16.1: voice continuity clause generated", "");
    record(Boolean(clauseByTemplate(doc, "application-resilience")), "16.1: application resilience clause generated", "");
    record(Boolean(clauseByTemplate(doc, "identity-aware-ztna")), "16.1: Entra-aware ZTNA clause generated", "");
    record(Boolean(clauseByTemplate(doc, "dlp-coverage")), "16.1: DLP clause generated", "");
    record(Boolean(clauseByTemplate(doc, "managed-service-boundary")), "16.1: fully managed / 24/7 service clause generated", "");
    record(Boolean(clauseByTemplate(doc, "dated-transition-plan")), "16.1: April 2027 dated transition clause generated", "");

    for (const templateId of ["voice-continuity", "application-resilience", "identity-aware-ztna", "dlp-coverage", "managed-service-boundary", "dated-transition-plan"]) {
      const c = clauseByTemplate(doc, templateId);
      record(Boolean(c?.evidence.length), `16.1: ${templateId} clause specifies required evidence`, JSON.stringify(c?.evidence));
      record(typeof c?.mandatory === "boolean", `16.1: ${templateId} clause has an explicit mandatory/scored classification`, `mandatory=${c?.mandatory}`);
    }

    record(doc.counts.questions > 0, "16.1: supplier question count is non-zero", `questions=${doc.counts.questions}`);
    record(doc.counts.gates > 0, "16.1: mandatory gate count is non-zero", `gates=${doc.counts.gates}`);

    const catByKey = Object.fromEntries(doc.evaluation.categories.map((c) => [c.key, c.weight]));
    record((catByKey.security_identity_data ?? 0) > 0, "16.1: security/identity weight is non-zero", JSON.stringify(catByKey));
    record((catByKey.managed_service_delivery ?? 0) > 0, "16.1: service/delivery weight is non-zero", JSON.stringify(catByKey));
    checkCategoryTotal(doc, "16.1 Prompt A");

    record(
      doc.changeSet.clauses.added.length === doc.clauses.length,
      "16.1: the change ribbon's added-clause count matches the actual compiled clauses (first compile, no previousDocument)",
      `added=${doc.changeSet.clauses.added.length} clauses=${doc.clauses.length}`,
    );
    checkEveryClauseTraceable(doc, "16.1 Prompt A");
    checkEveryMandatoryHasAcceptanceOrOpenDecision(doc, "16.1 Prompt A");
  }

  /* ================================================================ */
  /* Section 16.2: correction and dependency removal (Prompt B)         */
  /* ================================================================ */
  {
    const text = "Remove DLP. Make the service co-managed instead of fully managed, but keep 24/7 incident support.";
    const before = promptAState.doc;
    const s = turn(text, promptAState.facts, promptAState.receipts, { n: 2000 }, 2, before);
    const { doc } = s;

    record(!clauseByTemplate(doc, "dlp-coverage"), "16.2: the DLP clause is removed or superseded", `stillPresent=${Boolean(clauseByTemplate(doc, "dlp-coverage"))}`);
    record(
      doc.changeSet.clauses.removed.some((id) => before.clauses.find((c) => c.id === id)?.templateId === "dlp-coverage"),
      "16.2: the change set explicitly names the DLP clause as removed",
      JSON.stringify(doc.changeSet.clauses.removed),
    );

    const ops = clauseByTemplate(doc, "managed-service-boundary");
    record(Boolean(ops) && /co-managed/i.test(ops!.statement), "16.2: the operating model changes to co-managed", ops?.statement ?? "");
    record(Boolean(ops) && /24\/7 incident support/i.test(ops!.statement), "16.2: 24/7 incident support is kept", ops?.statement ?? "");
    record(
      doc.changeSet.clauses.updated.includes(ops?.id ?? "__none__"),
      "16.2: the change set records the managed-service clause as updated (not silently replaced)",
      JSON.stringify(doc.changeSet.clauses.updated),
    );

    for (const templateId of ["voice-continuity", "application-resilience", "identity-aware-ztna"]) {
      record(Boolean(clauseByTemplate(doc, templateId)), `16.2: unrelated ${templateId} clause survives the correction`, "");
    }

    record(doc.version === before.version + 1, "16.2: the document version increments exactly once", `before=${before.version} after=${doc.version}`);
    record(
      doc.changeSet.clauses.removed.length > 0 && doc.changeSet.clauses.updated.length > 0,
      "16.2: the change ribbon distinguishes removals from updates in the same compile",
      `removed=${JSON.stringify(doc.changeSet.clauses.removed)} updated=${JSON.stringify(doc.changeSet.clauses.updated)}`,
    );
    checkCategoryTotal(doc, "16.2 Prompt B");
  }

  /* ================================================================ */
  /* Section 16.3: verbatim data-residency constraint (Prompt C)        */
  /* ================================================================ */
  {
    const text = "No patient-identifiable data may leave the UK.";
    const s = turn(text, [], [], { n: 3000 }, 1, null);
    const { doc } = s;
    const clause = clauseByTemplate(doc, "uk-data-residency");
    record(Boolean(clause), "16.3: a data-residency clause is generated", "");
    record(clause?.quote === text, "16.3: the exact buyer wording is retained verbatim", `quote=${clause?.quote}`);
    record(clause?.origin === "buyer", "16.3: the clause is attributed to buyer provenance", `origin=${clause?.origin}`);
    record(Boolean(clause?.evidence.length), "16.3: supplier evidence is requested", JSON.stringify(clause?.evidence));
    const statuteRe = /\b(GDPR|UK GDPR|DPA 2018|NHS DSPT|ISO ?27001)\b/;
    record(!statuteRe.test(clause?.statement ?? ""), "16.3: the compiler does not invent a statute or certification", clause?.statement ?? "");
    record(
      doc.openDecisions.some((d) => d.id === "OD-data-residency-legal-basis"),
      "16.3: the legal interpretation is recorded as an open decision, not asserted as fact",
      JSON.stringify(doc.openDecisions.map((d) => d.id)),
    );
  }

  /* ================================================================ */
  /* Section 16.4: contradiction handling (Prompt D)                    */
  /* ================================================================ */
  {
    const text = "The service must be fully managed, but our team must retain sole operational control over all policy changes.";
    const s = turn(text, [], [], { n: 4000 }, 1, null);
    const { doc } = s;
    record(doc.evaluation.gates.length === 0, "16.4: no mandatory gate is invented while the operating model conflicts", `gates=${JSON.stringify(doc.evaluation.gates)}`);
    const conflictDecision = doc.openDecisions.find((d) => d.conflict);
    record(Boolean(conflictDecision), "16.4: a visible conflict/open decision is generated", "");
    record(Boolean(conflictDecision?.conflictReason?.length), "16.4: the conflict decision names its reason", conflictDecision?.conflictReason ?? "");
    const ops = clauseByTemplate(doc, "managed-service-boundary");
    record(Boolean(ops) && ops!.mandatory === false, "16.4: the conflicted managed-service clause is not silently made mandatory", `mandatory=${ops?.mandatory}`);
    checkCategoryTotal(doc, "16.4 Prompt D");
  }

  /* ================================================================ */
  /* Compiler invariants (Section 14.5)                                  */
  /* ================================================================ */
  {
    const text = "Teams Phone and the patient booking platform cannot go down. Fail over automatically without dropping calls.";
    const facts = mergeUpdates([], deterministicExtract(text, []), 1, "extract").facts;
    const receipts = coverDeclarativeClauses(text, deterministicExtract(text, [])).unplacedClauses.map((t, i) => ({ id: i + 1, text: t }));
    const req = requirementFrom(facts);
    const input = { facts, requirement: req, verdict: null, noted: [], rfiSet: null, instrument: "sor" as const, receipts, previousDocument: null };
    const docA = compileProcurementDocument(input);
    const docB = compileProcurementDocument(input);
    record(JSON.stringify(docA) === JSON.stringify(docB), "14.5: Deterministic -- the same normalized inputs produce byte-identical documents", "compared two independent compiles of the same input");

    // Resurrection: a compiler-only requirement (DLP), removed then
    // restated in the buyer's own later words, returns -- the same
    // resurrection law the fact ledger holds (draft.ts's mergeUpdates),
    // reproduced here for the compiler's own removal layer.
    const idRef = { n: 5000 };
    let s = turn("We use Entra ID and Azure; require ZTNA and DLP.", [], [], idRef, 1, null);
    record(Boolean(clauseByTemplate(s.doc, "dlp-coverage")), "14.5/Reversible: DLP clause present after it is stated", "");
    s = turn("Remove DLP.", s.facts, s.receipts, idRef, 2, s.doc);
    record(!clauseByTemplate(s.doc, "dlp-coverage"), "14.5/Reversible: DLP clause removed after \"Remove DLP.\"", "");
    s = turn("We need DLP after all.", s.facts, s.receipts, idRef, 3, s.doc);
    record(Boolean(clauseByTemplate(s.doc, "dlp-coverage")), "14.5/Reversible: DLP clause resurrects once the buyer restates it in their own words", "");

    // Conservative: "must" is used only for buyer-stated obligation
    // language, an accepted sector rule, or a deterministic platform
    // obligation -- never for a bare mention with no obligation word.
    const bare = turn("We use Entra ID and Azure. ZTNA is available as an option.", [], [], { n: 6000 }, 1, null);
    const bareZtna = bare.doc.clauses.find((c) => /ztna/i.test(c.statement));
    record(!bareZtna || bareZtna.mandatory === false, "14.5/Conservative: a bare, non-obligatory mention is never marked mandatory", JSON.stringify(bareZtna));

    // Empty input still balances to exactly 100 (Section 14.5, Balanced,
    // holds unconditionally -- even before the first prompt).
    const emptyDoc = compileProcurementDocument({
      facts: [], requirement: {}, verdict: null, noted: [], rfiSet: null, instrument: "sor", receipts: [], previousDocument: null,
    });
    checkCategoryTotal(emptyDoc, "14.5/Balanced: an empty document");
    record(emptyDoc.clauses.length === 0, "14.5: an empty document compiles with zero clauses, not an error", `clauses=${emptyDoc.clauses.length}`);
  }

  /* ================================================================ */
  /* Section 14.3: sections render only when they hold a real clause    */
  /* ================================================================ */
  {
    const emptyDoc = compileProcurementDocument({
      facts: [], requirement: {}, verdict: null, noted: [], rfiSet: null, instrument: "sor", receipts: [], previousDocument: null,
    });
    const sectionsPresent = new Set(emptyDoc.clauses.map((c) => c.section));
    record(sectionsPresent.size === 0, "14.3: no section renders when nothing has been said", `sections=${JSON.stringify([...sectionsPresent])}`);
    record(!emptyDoc.responseGroups.length, "14.3: no supplier response group renders when nothing has been said", `groups=${emptyDoc.responseGroups.length}`);
  }

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  if (failures > 0) process.exit(1);
}

main();
