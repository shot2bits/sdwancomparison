// Verification-only script (not part of the app): proves the 2030
// blueprint's full-unification phase (17 Aug 2026) -- making
// LivingProcurementDocument the real persisted/versioned envelope -- against
// the REAL, unmodified code: LivingProcurementDocumentSchema/
// parseIncomingProcurementDocument (procurement-document.ts),
// ProjectDetailsSchema's new `procurement_document` field (rfp-types.ts),
// rfpContentSnapshot()'s deliberate exclusion of it (published-snapshot.ts),
// and livingDocumentToRfpSections() (rfp-document.ts), the export adapter
// every gated download route now uses when a snapshot has a frozen living
// document.
//
// Reuses the SAME real extraction/compile pipeline
// validate-procurement-document.ts already drives (deterministicExtract +
// mergeUpdates + compileProcurementDocument) to build a genuine document,
// never a hand-typed stand-in.

import { deterministicExtract, coverDeclarativeClauses } from "../src/lib/workspace/extract";
import { mergeUpdates, requirementFrom, type WorkspaceFact } from "../src/lib/workspace/draft";
import {
  compileProcurementDocument,
  LivingProcurementDocumentSchema,
  parseIncomingProcurementDocument,
  type LivingProcurementDocument,
} from "../src/lib/workspace/procurement-document";
import { ProjectDetailsSchema } from "../src/lib/rfp-types";
import { rfpContentSnapshot } from "../src/lib/published-snapshot";
import { livingDocumentToRfpSections } from "../src/lib/rfp-document";

let failures = 0;
const record = (pass: boolean, label: string, detail: string) => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${detail}`);
};

type Receipt = { id: number; text: string };

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

function minimalProjectDetails(overrides: Record<string, unknown> = {}) {
  return {
    id: "rfp_test",
    created: 1700000000000,
    updated: 1700000000000,
    status: "draft",
    title: "Test RFP",
    buyer: {},
    rfp_sections: [],
    invited_vendors: [],
    share_token: "tok_share",
    manage_token: "tok_manage",
    source: "wizard",
    owner_email: "",
    methodology_version: "2026.1",
    ...overrides,
  };
}

function main() {
  const text =
    "UK 20 site Healthcare business requires SD-WAN and full SASE. We have 200 remote users. We also have a legacy app that requires a point to point Ethernet private circuit.";
  const s1 = turn(text, [], [], { n: 0 }, 1, null);

  /* ================================================================ */
  /* 1. A REAL compiled document round-trips through the persistence     */
  /*    schema exactly -- the strict validation this field's own save    */
  /*    path applies is not silently rejecting genuine compiler output.  */
  /* ================================================================ */
  {
    const parsed = LivingProcurementDocumentSchema.safeParse(s1.doc);
    record(parsed.success, "1: a real compiled document validates against LivingProcurementDocumentSchema", parsed.success ? "ok" : JSON.stringify((parsed as { error?: unknown }).error));
    record((parseIncomingProcurementDocument(s1.doc) ?? null) !== null, "1: parseIncomingProcurementDocument accepts the same real document", "");
  }

  /* ================================================================ */
  /* 2. Malformed/incoming JSON is dropped (undefined), never thrown --  */
  /*    a save must never fail outright because of a bad document.      */
  /* ================================================================ */
  {
    record(parseIncomingProcurementDocument(null) === undefined, "2: null input drops cleanly (undefined)", "");
    record(parseIncomingProcurementDocument({}) === undefined, "2: an empty object drops cleanly (undefined)", "");
    record(parseIncomingProcurementDocument({ ...s1.doc, version: "not-a-number" }) === undefined, "2: a type-mismatched real-shaped document drops cleanly (undefined)", "");
    record(parseIncomingProcurementDocument({ ...s1.doc, extra_unexpected_field: "x" }) === undefined, "2: an extra unexpected field drops cleanly (.strict() rejects it)", "");
  }

  /* ================================================================ */
  /* 3. ProjectDetailsSchema: `procurement_document` is optional (every  */
  /*    pre-phase record still validates) and accepts a real document.  */
  /* ================================================================ */
  {
    const withoutField = ProjectDetailsSchema.safeParse(minimalProjectDetails());
    record(withoutField.success, "3: a ProjectDetails record with no procurement_document still validates (backward compatible)", withoutField.success ? "ok" : JSON.stringify((withoutField as { error?: unknown }).error));

    const withField = ProjectDetailsSchema.safeParse(minimalProjectDetails({ procurement_document: s1.doc }));
    record(withField.success, "3: a ProjectDetails record carrying a real procurement_document validates", withField.success ? "ok" : JSON.stringify((withField as { error?: unknown }).error));
  }

  /* ================================================================ */
  /* 4. rfpContentSnapshot() deliberately excludes procurement_document  */
  /*    -- two records identical except for a genuinely different       */
  /*    document (different version) must hash-input IDENTICALLY, so    */
  /*    the idempotent-replay/MarketUnlock machinery this snapshot       */
  /*    feeds never becomes sensitive to a derived recompute.            */
  /* ================================================================ */
  {
    const s2 = turn("We also require 24x7 managed support.", s1.facts, s1.receipts, { n: 100 }, 2, s1.doc);
    record(s2.doc.version !== s1.doc.version, "4 setup: the second compile is genuinely a different document (version advanced)", `v1=${s1.doc.version} v2=${s2.doc.version}`);

    const pA = ProjectDetailsSchema.parse(minimalProjectDetails({ procurement_document: s1.doc }));
    const pB = ProjectDetailsSchema.parse(minimalProjectDetails({ procurement_document: s2.doc }));
    const snapA = JSON.stringify(rfpContentSnapshot(pA));
    const snapB = JSON.stringify(rfpContentSnapshot(pB));
    record(snapA === snapB, "4: rfpContentSnapshot() output is IDENTICAL across two records differing only in procurement_document", snapA === snapB ? "identical, as required" : "DIVERGED -- procurement_document is leaking into the content hash");
  }

  /* ================================================================ */
  /* 5. livingDocumentToRfpSections(): a faithful projection -- every    */
  /*    clause becomes exactly one question, grouped by its own          */
  /*    section, mandatory maps to required priority, weight clamps to   */
  /*    the schema's 1-5 range, and a section with no clauses is never   */
  /*    emitted.                                                         */
  /* ================================================================ */
  {
    const sections = livingDocumentToRfpSections(s1.doc);
    const totalQuestions = sections.reduce((n, sec) => n + sec.questions.length, 0);
    record(totalQuestions === s1.doc.clauses.length, "5: every clause becomes exactly one question (no loss, no duplication)", `clauses=${s1.doc.clauses.length} questions=${totalQuestions}`);
    record(sections.every((sec) => sec.questions.length > 0), "5: no empty section is emitted", `sections=${JSON.stringify(sections.map((s) => s.category))}`);
    const weightsInRange = sections.every((sec) => sec.questions.every((q) => q.weight >= 1 && q.weight <= 5));
    record(weightsInRange, "5: every projected question's weight is clamped into RfpQuestion's 1-5 range", "");
    const mandatoryClauseIds = new Set(s1.doc.clauses.filter((c) => c.mandatory).map((c) => c.id));
    const requiredQuestionIds = new Set(sections.flatMap((sec) => sec.questions).filter((q) => q.priority === "required").map((q) => q.id));
    record(
      mandatoryClauseIds.size === requiredQuestionIds.size && [...mandatoryClauseIds].every((id) => requiredQuestionIds.has(id)),
      "5: a mandatory clause maps to, and only to, a required-priority question",
      `mandatory=${mandatoryClauseIds.size} required=${requiredQuestionIds.size}`,
    );
  }

  /* ================================================================ */
  /* 6. Reopen/resume version continuity: seeding `previousDocument`     */
  /*    from a persisted document with `revision: null` (no edit yet     */
  /*    this session -- exactly ProjectDesk.tsx's own initial            */
  /*    `currentRevision` state on a fresh mount) must NOT bump the      */
  /*    version; a genuinely new revision on the next compile must.      */
  /* ================================================================ */
  {
    const persisted = s1.doc; // simulates what a reopened session reads back from ProjectDetails.procurement_document
    const reopenedNoEditYet = compileProcurementDocument({
      facts: s1.facts, // this session's own live facts (never rehydrated -- see source-ledger.ts); only version/lastRevision are asserted below
      requirement: requirementFrom(s1.facts),
      verdict: null,
      noted: [],
      rfiSet: null,
      instrument: "sor",
      receipts: [],
      previousDocument: persisted,
      revision: null,
    });
    record(reopenedNoEditYet.version === persisted.version, "6: reopening with no new revision this session keeps the SAME persisted version (never resets to 1)", `persisted=${persisted.version} reopened=${reopenedNoEditYet.version}`);

    const afterRealEdit = compileProcurementDocument({
      facts: s1.facts,
      requirement: requirementFrom(s1.facts),
      verdict: null,
      noted: [],
      rfiSet: null,
      instrument: "sor",
      receipts: s1.receipts,
      previousDocument: persisted,
      revision: { cycle: (persisted.lastRevision?.cycle ?? 0) + 1, changedFactIds: [] },
    });
    record(afterRealEdit.version === persisted.version + 1, "6: a genuinely new revision after reopen advances the version by exactly one", `persisted=${persisted.version} afterEdit=${afterRealEdit.version}`);
  }

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  if (failures > 0) process.exit(1);
}

main();
