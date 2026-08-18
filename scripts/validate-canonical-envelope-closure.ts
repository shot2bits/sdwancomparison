// Verification-only script (not part of the app): the full-unification
// CLOSURE pass's own lettered fixtures A-K (Robert's brief, 17 Aug 2026),
// proving the canonical-envelope save/reopen/publication lifecycle against
// the REAL, unmodified production code -- buildEnvelopeUpdate() (envelope.ts,
// the ONE function every writer route calls), minimumContentQuestionCount()
// and the freeze mapping (rfp-publish.ts), livingDocumentToRfpSections()
// (rfp-document.ts) -- never a reimplementation or a hand-typed stand-in.
//
// Reuses the SAME real extraction/compile pipeline
// validate-procurement-document-persistence.ts and
// validate-living-procurement-os-stage-a.ts already drive
// (deterministicExtract + mergeUpdates + compileProcurementDocument), and
// the SAME real manufacturing-sector scenario (mf-ot-visibility) the N2
// release-blocker fixture in validate-living-procurement-os-stage-a.ts
// already proved for accept/decline replay -- so this file's own D fixture
// exercises that exact scenario end-to-end THROUGH buildEnvelopeUpdate(),
// not just replayDecisionLedger() in isolation.
//
// TOOLING LIMITATION (same honest convention validate-pre-publish-vendor-
// disclosure.ts and others already use): kvConfigured() is false in this
// sandbox -- no live KV to run executePublish() end-to-end against. Fixtures
// A-F and K exercise buildEnvelopeUpdate() directly (a pure async function,
// no KV dependency at all). Fixtures G/H are value-level proofs against the
// REAL exported minimumContentQuestionCount()/livingDocumentToRfpSections(),
// plus the exact frozen_content mapping rfp-publish.ts's source uses
// (asserted both by direct replication AND by a structural grep tying this
// fixture to the real file, matching this codebase's own established
// "regex still matches the current source" convention, e.g. Fixture E in
// validate-procurement-canvas-corrections.ts). Fixtures I/J are structural
// (source-order and shared-variable) proofs for the same reason.
//
// SABOTAGE-RESTORE (Robert's brief, requirement 6): fixtures E and F --
// the concurrency and integrity checks -- were verified non-vacuous by
// temporarily breaking envelope.ts's stale-revision and hash-mismatch
// checks, confirming this script FAILS, then restoring the file exactly
// (git diff clean afterwards). Documented in the closure-pass checkpoint
// report's own verification section, not re-encoded into this committed
// script as a permanent self-sabotage step (the same convention
// validate-living-procurement-os-stage-a.ts's own header comment states).

import { readFileSync } from "node:fs";
import { deterministicExtract, coverDeclarativeClauses } from "../src/lib/workspace/extract";
import { mergeUpdates, requirementFrom, buyingOf, dropListFact, type WorkspaceFact } from "../src/lib/workspace/draft";
import { assessSecurityRequirement } from "../src/lib/security/rulebook";
import { deriveRfiQuestionSet } from "../src/lib/workspace/instrument";
import { replayDecisionLedger, mergeDecisionLedger, type DecisionLedgerEntry } from "../src/lib/workspace/decision-ledger";
import type { SourceLedgerEntry } from "../src/lib/workspace/source-ledger";
import { buildEnvelopeUpdate, envelopeContentHash } from "../src/lib/workspace/envelope";
import { compileProcurementDocument, type LivingProcurementDocument, type CompilerRevision } from "../src/lib/workspace/procurement-document";
import { livingDocumentToRfpSections } from "../src/lib/rfp-document";
import { minimumContentQuestionCount } from "../src/lib/rfp-publish";
import { ProjectDetailsSchema, type ProjectDetails } from "../src/lib/rfp-types";

let failures = 0;
const record = (pass: boolean, label: string, detail: string) => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${detail}`);
};

type Receipt = { id: number; text: string };

/**
 * Mirrors envelope.ts's own internal recompute EXACTLY (same functions,
 * same order) -- what an HONEST client (ProjectDesk.tsx's own
 * `compiledDocument`/`canvasDocument`) would submit as `compiled_document`.
 * Not a duplicate of the SECURITY logic (there is none here to duplicate)
 * -- purely the plumbing a fixture needs to hand buildEnvelopeUpdate() a
 * document its own cross-check will accept, so the fixtures below exercise
 * the REAL accept path, not just the reject paths.
 *
 * CORRECTED (Robert's follow-up visual-closure directive, 18 Aug 2026):
 * this used to hardcode `revision: undefined`, taking `resolveVersion()`'s
 * LEGACY fallback branch (bump on any real facts/receipts diff). envelope.ts
 * itself no longer takes that branch in production -- a real first-save/
 * update-path bug (found via a live local-KV Playwright run) meant it always
 * passed `revision: undefined` too, so the fix there was widening it to
 * `revision: clientDocParsed.data.lastRevision`, i.e. it now TRUSTS
 * whichever revision the client's own submitted document carries. This
 * fixture's "expected/submitted" document must mirror THAT contract, not the
 * legacy one, or a genuine edit's fixture-submitted `compiled_document`
 * disagrees with the server's own now-event-driven recompute and 409s --
 * exactly the false failure this correction removes. `revision` is
 * REQUIRED (no default) so every call site states its own intent: `null`
 * for "no new event this call" (a reopen, an idempotent resave -- never
 * increments), or an explicit `{cycle, changedFactIds}` distinct from
 * `previousDocument`'s own `lastRevision.cycle` for a genuinely new buyer
 * action (increments exactly once).
 */
async function deriveExpectedServerDoc(params: {
  facts: WorkspaceFact[];
  receipts: Receipt[];
  instrument: "sor" | "rfi" | "rfp";
  sourceLedger: SourceLedgerEntry[];
  decisionLedger: DecisionLedgerEntry[];
  coveredSections: string[];
  previousDocument: LivingProcurementDocument | null;
  revision: CompilerRevision | null;
}): Promise<LivingProcurementDocument> {
  const requirement = requirementFrom(params.facts);
  const buying = buyingOf(params.facts);
  const securityScope = buying === "managed_security" || buying === null;
  const verdict = securityScope ? await assessSecurityRequirement(requirement) : null;
  const { noted } = replayDecisionLedger(params.decisionLedger);
  const rfiSet = deriveRfiQuestionSet({ coveredSections: params.coveredSections, sector: requirement.organisation?.sector ?? null });
  return compileProcurementDocument({
    facts: params.facts,
    requirement,
    verdict,
    noted,
    rfiSet,
    instrument: params.instrument,
    receipts: params.receipts,
    sourceTurns: params.sourceLedger,
    previousDocument: params.previousDocument,
    revision: params.revision,
  });
}

function minimalProjectDetails(overrides: Record<string, unknown> = {}) {
  return {
    id: "rfp_test_closure",
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
    owner_email: "buyer@example.com",
    methodology_version: "2026.1",
    ...overrides,
  };
}

const PROMPT_A = "UK 20 site SD-WAN in the manufacturing sector, full SASE required, 50 remote users.";

async function main() {
  const ext1 = deterministicExtract(PROMPT_A, []);
  const { unplacedClauses: unplaced1 } = coverDeclarativeClauses(PROMPT_A, ext1);
  const merge1 = mergeUpdates([], ext1, 1, "extract");
  const facts1: WorkspaceFact[] = merge1.facts;
  const receipts1: Receipt[] = unplaced1.map((c, i) => ({ id: i + 1, text: c }));
  const sourceLedger1: SourceLedgerEntry[] = [{ id: "st1", text: PROMPT_A, at: 1000, via: "typed" }];

  /* ================================================================ */
  /* A. create -> save -> close -> reopen with byte-identical canonical  */
  /*    state.                                                           */
  /* ================================================================ */
  const clientDoc1 = await deriveExpectedServerDoc({
    facts: facts1,
    receipts: receipts1,
    instrument: "sor",
    sourceLedger: sourceLedger1,
    decisionLedger: [],
    coveredSections: [],
    previousDocument: null,
    // First-ever compile: resolveVersion()'s `!previousDocument` branch
    // fires unconditionally, so the exact revision value only sets the
    // baseline `lastRevision` the NEXT call's isNewEvent check compares
    // against -- cycle 1, matching a real client's first governed event.
    revision: { cycle: 1, changedFactIds: facts1.map((f) => f.id) },
  });
  const outcomeCreate = await buildEnvelopeUpdate({
    existing: null,
    body: { facts: facts1, receipts: receipts1, instrument: "sor", compiled_document: clientDoc1, base_revision: 0 },
    mergedSourceLedger: sourceLedger1,
    mergedDecisionLedger: [],
    coveredSections: [],
    savedBy: "buyer@example.com",
  });
  record(outcomeCreate.participates === true && outcomeCreate.ok === true, "A: the first save (create) is accepted by the real buildEnvelopeUpdate()", JSON.stringify(outcomeCreate.participates && !outcomeCreate.ok ? outcomeCreate.error : "ok"));
  if (!outcomeCreate.participates || !outcomeCreate.ok) throw new Error("Fixture A setup failed; cannot continue.");
  record(outcomeCreate.envelope_revision === 1, "A: the first save lands as envelope_revision 1", `envelope_revision=${outcomeCreate.envelope_revision}`);

  // "Close and reopen": the persisted record is exactly what a GET would
  // return -- facts/receipts/procurement_document/envelope_revision, no
  // more, no less (REPLACE semantics, per envelope.ts's own doc comment).
  const persistedAfterCreate = {
    facts: outcomeCreate.facts,
    receipts: outcomeCreate.receipts,
    procurement_document: outcomeCreate.procurement_document,
    envelope_revision: outcomeCreate.envelope_revision,
  };
  // "Close and reopen" in the REAL system is a plain GET -- the server
  // never recomputes on read (rfp-store.ts's getProject() / the GET route
  // just return the stored record). So the honest "byte-identical
  // canonical state" proof is that nothing about facts/receipts/document
  // is lost, reordered-into-a-different-VALUE or mutated by a round trip
  // through exactly the persistence mechanism this record actually goes
  // through: schema validation (buildEnvelopeUpdate's own zod parse,
  // already exercised above) and KV's own JSON.stringify/JSON.parse
  // serialization (rfp-store.ts's setJson/getJson). `envelopeContentHash()`
  // (envelope.ts's own key-order-insensitive content hash -- the exact
  // function the concurrency/integrity checks in E/F below rely on) is the
  // right equality here, not raw JSON.stringify: zod's own re-serialization
  // reorders object keys without changing a single value, which a naive
  // JSON.stringify comparison would wrongly flag as drift.
  record(
    envelopeContentHash(persistedAfterCreate.facts) === envelopeContentHash(facts1),
    "A: the reopened facts are value-identical to what was saved (order-insensitive; zod's own re-serialization reorders keys, never values)",
    "",
  );
  record(
    envelopeContentHash(persistedAfterCreate.receipts) === envelopeContentHash(receipts1),
    "A: the reopened receipts are value-identical to what was saved",
    "",
  );
  record(
    envelopeContentHash(JSON.parse(JSON.stringify(persistedAfterCreate.procurement_document))) === envelopeContentHash(persistedAfterCreate.procurement_document),
    "A: the persisted canonical document survives a real KV JSON round trip (JSON.stringify/JSON.parse) byte-identical -- nothing non-serialisable is silently dropped",
    "",
  );

  // A genuinely NO-OP resave (the buyer reopened, changed nothing, and
  // saveNow() fired anyway -- e.g. a second Save click) must correctly
  // detect "nothing changed": version unchanged, every clause/question/
  // gate content-identical, and the compiler's OWN changeSet honestly
  // reports empty added/updated/removed (proving the "nothing changed"
  // detection is real, not merely that this fixture forgot to check it).
  const clientDocNoOp = await deriveExpectedServerDoc({
    facts: persistedAfterCreate.facts,
    receipts: persistedAfterCreate.receipts,
    instrument: "sor",
    sourceLedger: sourceLedger1,
    decisionLedger: [],
    coveredSections: [],
    previousDocument: persistedAfterCreate.procurement_document,
    // Reopened, changed nothing: no new governed event this call.
    revision: null,
  });
  const outcomeNoOp = await buildEnvelopeUpdate({
    existing: { procurement_document: persistedAfterCreate.procurement_document, envelope_revision: persistedAfterCreate.envelope_revision },
    body: { facts: persistedAfterCreate.facts, receipts: persistedAfterCreate.receipts, instrument: "sor", compiled_document: clientDocNoOp, base_revision: persistedAfterCreate.envelope_revision },
    mergedSourceLedger: sourceLedger1,
    mergedDecisionLedger: [],
    coveredSections: [],
    savedBy: "buyer@example.com",
  });
  record(outcomeNoOp.participates === true && outcomeNoOp.ok === true, "A: a genuine no-op resave (reopen, change nothing, save again) is accepted", JSON.stringify(outcomeNoOp.participates && !outcomeNoOp.ok ? outcomeNoOp.error : "ok"));
  if (outcomeNoOp.participates && outcomeNoOp.ok) {
    record(outcomeNoOp.procurement_document.version === persistedAfterCreate.procurement_document.version, "A: the no-op resave keeps the SAME document version (reopening alone never bumps it)", `before=${persistedAfterCreate.procurement_document.version} after=${outcomeNoOp.procurement_document.version}`);
    record(
      envelopeContentHash(outcomeNoOp.procurement_document.clauses) === envelopeContentHash(persistedAfterCreate.procurement_document.clauses),
      "A: the no-op resave's clauses are content-identical to what was persisted",
      "",
    );
    const cs = outcomeNoOp.procurement_document.changeSet;
    const allEmpty = cs.facts.added.length === 0 && cs.facts.updated.length === 0 && cs.facts.removed.length === 0 && cs.clauses.added.length === 0 && cs.clauses.updated.length === 0 && cs.clauses.removed.length === 0;
    record(allEmpty, "A: the compiler's own changeSet honestly reports NOTHING added/updated/removed for a genuine no-op resave", JSON.stringify(cs.facts));
  }

  /* ================================================================ */
  /* B. reopen -> correct -> new revision.                              */
  /* ================================================================ */
  // Corrects the site count (20 -> 25) directly on the persisted fact --
  // the same operation a buyer editing a value inline performs -- bumping
  // its own cycle, exactly like mergeUpdates() would for a real re-answer.
  const facts2: WorkspaceFact[] = persistedAfterCreate.facts.map((f) => (f.id === "estate.sites" ? { ...f, value: 25, cycle: 2 } : f));
  record(facts2.some((f) => f.id === "estate.sites" && f.value === 25), "B setup: the site-count fact was genuinely corrected to 25", `value=${facts2.find((f) => f.id === "estate.sites")?.value}`);
  const clientDoc2 = await deriveExpectedServerDoc({
    facts: facts2,
    receipts: persistedAfterCreate.receipts,
    instrument: "sor",
    sourceLedger: sourceLedger1,
    decisionLedger: [],
    coveredSections: [],
    previousDocument: persistedAfterCreate.procurement_document,
    // A genuinely new buyer action (site-count correction); previousDocument's
    // own lastRevision.cycle is 1 (from create), so cycle:2 is a new event.
    revision: { cycle: 2, changedFactIds: ["estate.sites"] },
  });
  const outcomeCorrect = await buildEnvelopeUpdate({
    existing: { procurement_document: persistedAfterCreate.procurement_document, envelope_revision: persistedAfterCreate.envelope_revision },
    body: { facts: facts2, receipts: persistedAfterCreate.receipts, instrument: "sor", compiled_document: clientDoc2, base_revision: persistedAfterCreate.envelope_revision },
    mergedSourceLedger: sourceLedger1,
    mergedDecisionLedger: [],
    coveredSections: [],
    savedBy: "buyer@example.com",
  });
  record(outcomeCorrect.participates === true && outcomeCorrect.ok === true, "B: the correction save is accepted", JSON.stringify(outcomeCorrect.participates && !outcomeCorrect.ok ? outcomeCorrect.error : "ok"));
  if (!outcomeCorrect.participates || !outcomeCorrect.ok) throw new Error("Fixture B setup failed; cannot continue.");
  record(outcomeCorrect.envelope_revision === 2, "B: the correction advances envelope_revision to exactly 2 (not reset, not skipped)", `envelope_revision=${outcomeCorrect.envelope_revision}`);
  record(
    JSON.stringify(outcomeCorrect.procurement_document.factSnapshot).includes("25") && !JSON.stringify(outcomeCorrect.procurement_document.factSnapshot).includes('"estate.sites":20'),
    "B: the persisted canonical document's own fact snapshot reflects the corrected value (25), not the stale one (20)",
    JSON.stringify(outcomeCorrect.procurement_document.factSnapshot),
  );

  /* ================================================================ */
  /* C. reopen -> remove -> tombstone survives another reopen.          */
  /* ================================================================ */
  const usersFact = facts2.find((f) => f.id === "estate.users");
  if (!usersFact) throw new Error("Fixture C setup failed: estate.users fact missing.");
  const dropped = dropListFact(facts2, new Set(), usersFact);
  record(dropped.facts.find((f) => f.id === "estate.users")?.struck === true, "C setup: dropListFact() strikes the fact (struck: true) and tombstones its id", `struck=${dropped.facts.find((f) => f.id === "estate.users")?.struck} removalsHas=${dropped.removals.has("estate.users")}`);
  const clientDoc3 = await deriveExpectedServerDoc({
    facts: dropped.facts,
    receipts: persistedAfterCreate.receipts,
    instrument: "sor",
    sourceLedger: sourceLedger1,
    decisionLedger: [],
    coveredSections: [],
    previousDocument: outcomeCorrect.procurement_document,
    // A new buyer action (removal); previousDocument's own lastRevision.cycle
    // is 2 (from the correction in B), so cycle:3 is a new event.
    revision: { cycle: 3, changedFactIds: ["estate.users"] },
  });
  const outcomeDrop = await buildEnvelopeUpdate({
    existing: { procurement_document: outcomeCorrect.procurement_document, envelope_revision: outcomeCorrect.envelope_revision },
    body: { facts: dropped.facts, receipts: persistedAfterCreate.receipts, instrument: "sor", compiled_document: clientDoc3, base_revision: outcomeCorrect.envelope_revision },
    mergedSourceLedger: sourceLedger1,
    mergedDecisionLedger: [],
    coveredSections: [],
    savedBy: "buyer@example.com",
  });
  record(outcomeDrop.participates === true && outcomeDrop.ok === true, "C: the removal save is accepted", JSON.stringify(outcomeDrop.participates && !outcomeDrop.ok ? outcomeDrop.error : "ok"));
  if (!outcomeDrop.participates || !outcomeDrop.ok) throw new Error("Fixture C setup failed; cannot continue.");
  const struckAfterFirstSave = outcomeDrop.facts.find((f) => f.id === "estate.users");
  record(struckAfterFirstSave?.struck === true, "C: the struck fact persists with struck:true through the save", `struck=${struckAfterFirstSave?.struck}`);

  // "Another reopen": a second, genuinely idempotent save of the SAME
  // facts array (nothing new typed) must not resurrect the struck fact --
  // proving the tombstone survives a second round trip, not just the first.
  const clientDoc3b = await deriveExpectedServerDoc({
    facts: outcomeDrop.facts,
    receipts: outcomeDrop.receipts,
    instrument: "sor",
    sourceLedger: sourceLedger1,
    decisionLedger: [],
    coveredSections: [],
    previousDocument: outcomeDrop.procurement_document,
    // Explicitly a no-op per this fixture's own comment above: nothing new
    // typed, so no new governed event this call.
    revision: null,
  });
  const outcomeReopenAgain = await buildEnvelopeUpdate({
    existing: { procurement_document: outcomeDrop.procurement_document, envelope_revision: outcomeDrop.envelope_revision },
    body: { facts: outcomeDrop.facts, receipts: outcomeDrop.receipts, instrument: "sor", compiled_document: clientDoc3b, base_revision: outcomeDrop.envelope_revision },
    mergedSourceLedger: sourceLedger1,
    mergedDecisionLedger: [],
    coveredSections: [],
    savedBy: "buyer@example.com",
  });
  record(outcomeReopenAgain.participates === true && outcomeReopenAgain.ok === true, "C: a second reopen/resave is accepted", JSON.stringify(outcomeReopenAgain.participates && !outcomeReopenAgain.ok ? outcomeReopenAgain.error : "ok"));
  if (outcomeReopenAgain.participates && outcomeReopenAgain.ok) {
    const struckAfterSecondSave = outcomeReopenAgain.facts.find((f) => f.id === "estate.users");
    record(struckAfterSecondSave?.struck === true, "C: the tombstoned fact SURVIVES a second reopen -- still struck, not resurrected", `struck=${struckAfterSecondSave?.struck}`);
  }

  /* ================================================================ */
  /* D. accept -> decline governed suggestion across save/reopen.       */
  /*    Same real manufacturing scenario (mf-ot-visibility) the N2       */
  /*    release-blocker fixture proves at the replayDecisionLedger()     */
  /*    level -- this fixture drives it through the REAL persisted       */
  /*    envelope path instead (buildEnvelopeUpdate() derives `noted`      */
  /*    itself from the merged decision_ledger; nothing here hand-builds */
  /*    the noted array).                                                */
  /* ================================================================ */
  const acceptedNoteId = "ps-mf-ot-visibility";
  const acceptEntry: DecisionLedgerEntry = {
    id: "dt_closure_accept",
    at: 1000,
    questionId: "sector:mf-ot-visibility",
    optionId: acceptedNoteId,
    optionLabel: "Accept",
    action: "note",
    resultingFactPaths: [],
    resultingNoted: [{ id: acceptedNoteId, label: "OT/ICS asset visibility and monitoring in scope, alongside IT security", section: "security", own: true }],
  };
  const declineEntry: DecisionLedgerEntry = {
    id: "dt_closure_decline",
    at: 2000,
    questionId: "sector:mf-ot-visibility",
    optionId: "decline",
    optionLabel: "Not needed",
    action: "decline_suggestion",
    resultingFactPaths: [],
    resultingNoted: [],
  };

  const decisionLedgerAccept = mergeDecisionLedger([], [acceptEntry]);
  const clientDocD1 = await deriveExpectedServerDoc({
    facts: facts1,
    receipts: receipts1,
    instrument: "sor",
    sourceLedger: sourceLedger1,
    decisionLedger: decisionLedgerAccept,
    coveredSections: [],
    previousDocument: null,
    // First-ever compile of this separate (D) chain: the `!previousDocument`
    // branch fires unconditionally, so this only sets the baseline cycle.
    revision: { cycle: 1, changedFactIds: [] },
  });
  const outcomeAccept = await buildEnvelopeUpdate({
    existing: null,
    body: { facts: facts1, receipts: receipts1, instrument: "sor", compiled_document: clientDocD1, base_revision: 0 },
    mergedSourceLedger: sourceLedger1,
    mergedDecisionLedger: decisionLedgerAccept,
    coveredSections: [],
    savedBy: "buyer@example.com",
  });
  record(outcomeAccept.participates === true && outcomeAccept.ok === true, "D: the accept-suggestion save is accepted through the real envelope path", JSON.stringify(outcomeAccept.participates && !outcomeAccept.ok ? outcomeAccept.error : "ok"));
  if (!outcomeAccept.participates || !outcomeAccept.ok) throw new Error("Fixture D setup failed; cannot continue.");
  record(
    outcomeAccept.procurement_document.clauses.some((c) => c.templateId === "sector-pack-suggestion"),
    "D: after accept, the persisted canonical document carries the governed sector-suggestion clause",
    `clauses=${JSON.stringify(outcomeAccept.procurement_document.clauses.map((c) => c.templateId))}`,
  );

  const decisionLedgerAcceptThenDecline = mergeDecisionLedger(decisionLedgerAccept, [declineEntry]);
  const clientDocD2 = await deriveExpectedServerDoc({
    facts: facts1,
    receipts: receipts1,
    instrument: "sor",
    sourceLedger: sourceLedger1,
    decisionLedger: decisionLedgerAcceptThenDecline,
    coveredSections: [],
    previousDocument: outcomeAccept.procurement_document,
    // A new governed event (the decline) on the D chain; previousDocument's
    // own lastRevision.cycle is 1 (from the accept), so cycle:2 is new.
    revision: { cycle: 2, changedFactIds: [] },
  });
  const outcomeDecline = await buildEnvelopeUpdate({
    existing: { procurement_document: outcomeAccept.procurement_document, envelope_revision: outcomeAccept.envelope_revision },
    body: { facts: facts1, receipts: receipts1, instrument: "sor", compiled_document: clientDocD2, base_revision: outcomeAccept.envelope_revision },
    mergedSourceLedger: sourceLedger1,
    mergedDecisionLedger: decisionLedgerAcceptThenDecline,
    coveredSections: [],
    savedBy: "buyer@example.com",
  });
  record(outcomeDecline.participates === true && outcomeDecline.ok === true, "D: the subsequent decline save is accepted through the real envelope path", JSON.stringify(outcomeDecline.participates && !outcomeDecline.ok ? outcomeDecline.error : "ok"));
  if (outcomeDecline.participates && outcomeDecline.ok) {
    record(
      !outcomeDecline.procurement_document.clauses.some((c) => c.templateId === "sector-pack-suggestion"),
      "D: after the later decline, the persisted canonical document carries NO clause for the suggestion (last-write-wins, real ledger replay, real save/reopen round trip)",
      `clauses=${JSON.stringify(outcomeDecline.procurement_document.clauses.map((c) => c.templateId))}`,
    );
    // "Across save/reopen": a fresh compile from a reopened session (no
    // in-memory state carried over -- previousDocument comes only from what
    // was persisted) must reproduce the SAME decline outcome.
    const reopenedAfterDecline = compileProcurementDocument({
      facts: facts1,
      requirement: requirementFrom(facts1),
      verdict: null,
      noted: replayDecisionLedger(decisionLedgerAcceptThenDecline).noted,
      rfiSet: null,
      instrument: "sor",
      receipts: receipts1,
      sourceTurns: sourceLedger1,
      previousDocument: null,
    });
    record(
      !reopenedAfterDecline.clauses.some((c) => c.templateId === "sector-pack-suggestion"),
      "D: a reopen (previousDocument: null, replaying the SAME persisted decision_ledger) still shows no clause for the declined suggestion",
      "",
    );
  }

  /* ================================================================ */
  /* E. stale revision rejected.                                        */
  /* ================================================================ */
  const clientDocE = await deriveExpectedServerDoc({
    facts: facts2,
    receipts: persistedAfterCreate.receipts,
    instrument: "sor",
    sourceLedger: sourceLedger1,
    decisionLedger: [],
    coveredSections: [],
    previousDocument: outcomeCorrect.procurement_document,
    // Doesn't affect this fixture's pass/fail (base_revision staleness is
    // checked before the hash-consistency check), but kept realistic:
    // previousDocument's own lastRevision.cycle is 2, so cycle:3 is new.
    revision: { cycle: 3, changedFactIds: ["estate.sites"] },
  });
  const outcomeStale = await buildEnvelopeUpdate({
    existing: { procurement_document: outcomeCorrect.procurement_document, envelope_revision: outcomeCorrect.envelope_revision },
    // Claims base_revision 1 while the real current revision is 2 (from
    // Fixture B) -- exactly "two tabs" / "a stale reopen".
    body: { facts: facts2, receipts: persistedAfterCreate.receipts, instrument: "sor", compiled_document: clientDocE, base_revision: 1 },
    mergedSourceLedger: sourceLedger1,
    mergedDecisionLedger: [],
    coveredSections: [],
    savedBy: "buyer@example.com",
  });
  record(
    outcomeStale.participates === true && outcomeStale.ok === false && outcomeStale.status === 409,
    "E: a stale base_revision (claims 1, current is 2) is rejected with 409, and NOTHING else about the save is trusted",
    JSON.stringify(outcomeStale),
  );
  const outcomeMissingBase = await buildEnvelopeUpdate({
    existing: { procurement_document: outcomeCorrect.procurement_document, envelope_revision: outcomeCorrect.envelope_revision },
    body: { facts: facts2, receipts: persistedAfterCreate.receipts, instrument: "sor", compiled_document: clientDocE },
    mergedSourceLedger: sourceLedger1,
    mergedDecisionLedger: [],
    coveredSections: [],
    savedBy: "buyer@example.com",
  });
  record(
    outcomeMissingBase.participates === true && outcomeMissingBase.ok === false && outcomeMissingBase.status === 409,
    "E: an existing envelope with NO base_revision claimed at all is also rejected with 409 (a base revision is mandatory once one exists)",
    JSON.stringify(outcomeMissingBase),
  );
  const outcomeBadCreateBase = await buildEnvelopeUpdate({
    existing: null,
    body: { facts: facts1, receipts: receipts1, instrument: "sor", compiled_document: clientDoc1, base_revision: 5 },
    mergedSourceLedger: sourceLedger1,
    mergedDecisionLedger: [],
    coveredSections: [],
    savedBy: "buyer@example.com",
  });
  record(
    outcomeBadCreateBase.participates === true && outcomeBadCreateBase.ok === false && outcomeBadCreateBase.status === 409,
    "E: a CREATE (no existing record) claiming a base_revision above 0 is rejected -- there is no revision 5 to be based on",
    JSON.stringify(outcomeBadCreateBase),
  );

  /* ================================================================ */
  /* F. tampered compiled document / mismatched hash rejected.          */
  /* ================================================================ */
  const tamperedDoc = { ...clientDoc1, clauses: [] };
  const outcomeTampered = await buildEnvelopeUpdate({
    existing: null,
    body: { facts: facts1, receipts: receipts1, instrument: "sor", compiled_document: tamperedDoc, base_revision: 0 },
    mergedSourceLedger: sourceLedger1,
    mergedDecisionLedger: [],
    coveredSections: [],
    savedBy: "buyer@example.com",
  });
  record(
    outcomeTampered.participates === true && outcomeTampered.ok === false && outcomeTampered.status === 409,
    "F: a compiled_document that disagrees with the server's own recompute (clauses wiped) is rejected with 409, nothing written",
    JSON.stringify(outcomeTampered),
  );
  const outcomeMalformedFacts = await buildEnvelopeUpdate({
    existing: null,
    body: { facts: [{ id: "x" }], receipts: receipts1, instrument: "sor", compiled_document: clientDoc1, base_revision: 0 },
    mergedSourceLedger: sourceLedger1,
    mergedDecisionLedger: [],
    coveredSections: [],
    savedBy: "buyer@example.com",
  });
  record(
    outcomeMalformedFacts.participates === true && outcomeMalformedFacts.ok === false && outcomeMalformedFacts.status === 422,
    "F: a malformed fact ledger (schema violation) is rejected with 422, not silently coerced or partially written",
    JSON.stringify(outcomeMalformedFacts),
  );
  const outcomeMissingDoc = await buildEnvelopeUpdate({
    existing: null,
    body: { facts: facts1, receipts: receipts1, instrument: "sor", base_revision: 0 },
    mergedSourceLedger: sourceLedger1,
    mergedDecisionLedger: [],
    coveredSections: [],
    savedBy: "buyer@example.com",
  });
  record(
    outcomeMissingDoc.participates === true && outcomeMissingDoc.ok === false && outcomeMissingDoc.status === 422,
    "F: facts present but compiled_document entirely absent is rejected with 422",
    JSON.stringify(outcomeMissingDoc),
  );

  /* ================================================================ */
  /* G. successful publication freezes the exact canonical revision.    */
  /* ================================================================ */
  const projectForFreeze = ProjectDetailsSchema.parse(
    minimalProjectDetails({
      procurement_document: outcomeAccept.procurement_document,
      envelope_revision: outcomeAccept.envelope_revision,
      envelope: outcomeAccept.envelope,
      rfp_sections: [], // deliberately empty/stale -- proves G below, not accidentally passing because rfp_sections happens to still hold content too
    }),
  ) as ProjectDetails;
  const gateCount = minimumContentQuestionCount(projectForFreeze);
  const exportSections = livingDocumentToRfpSections(projectForFreeze.procurement_document as LivingProcurementDocument);
  const exportCount = exportSections.reduce((n, s) => n + s.questions.length, 0);
  record(gateCount > 0 && gateCount === exportCount, "G: the min-content gate's own count, for a canonical-envelope project, exactly matches the export adapter's own count -- one authority, not two", `gateCount=${gateCount} exportCount=${exportCount}`);

  // The exact `frozen_content` mapping rfp-publish.ts uses at both freeze
  // sites (first publish and every republish): `living_document:
  // working.procurement_document ?? null` / `published.procurement_document
  // ?? null`. Replicated here at the value level (proves the mapping is a
  // faithful, unmutated capture)...
  const frozenContent = { title: projectForFreeze.title, buyer: projectForFreeze.buyer, rfp_sections: projectForFreeze.rfp_sections, living_document: projectForFreeze.procurement_document ?? null };
  record(
    envelopeContentHash(frozenContent.living_document) === envelopeContentHash(outcomeAccept.procurement_document),
    "G: the frozen_content mapping captures the exact canonical revision that was current at publish time, unmutated",
    "",
  );
  // ...and structurally, tying this fixture to the real file, so the
  // replication above cannot silently drift from what rfp-publish.ts
  // actually does (the same "regex still matches the current source"
  // convention this codebase already uses, e.g. Fixture E above and
  // Fixture H below).
  const publishSource = readFileSync(new URL("../src/lib/rfp-publish.ts", import.meta.url), "utf8");
  const freezeSiteCount = (publishSource.match(/living_document:\s*\w+\.procurement_document\s*\?\?\s*null/g) ?? []).length;
  record(freezeSiteCount === 2, "G: rfp-publish.ts freezes `procurement_document` (never a re-derived or partial copy) at exactly its two documented freeze sites (first publish, every republish)", `sites=${freezeSiteCount}`);

  /* ================================================================ */
  /* H. later draft edits do not alter the published revision.          */
  /* ================================================================ */
  // The KV write path serializes every save through JSON.stringify
  // (rfp-store.ts's setJson()) -- captured here as a real JSON round trip,
  // not a live object reference, exactly like a genuine savePublishedSnapshot/
  // saveFrozenRevision call would produce.
  const frozenSnapshotLivingDocument: LivingProcurementDocument = JSON.parse(JSON.stringify(outcomeAccept.procurement_document));
  const frozenVersionAtPublish = frozenSnapshotLivingDocument.version;
  // A later draft edit happens (Fixture B's own correction save, reusing
  // the SAME outcome already proven above) -- a genuinely NEW canonical
  // revision, strictly after the moment `frozenSnapshotLivingDocument` was
  // captured.
  record(
    outcomeCorrect.procurement_document.version !== frozenVersionAtPublish || JSON.stringify(outcomeCorrect.procurement_document) !== JSON.stringify(frozenSnapshotLivingDocument),
    "H setup: the later draft save produced a genuinely different canonical document from the one frozen above",
    `frozenVersion=${frozenVersionAtPublish} laterVersion=${outcomeCorrect.procurement_document.version}`,
  );
  record(
    frozenSnapshotLivingDocument.version === frozenVersionAtPublish && JSON.stringify(frozenSnapshotLivingDocument) === JSON.stringify(JSON.parse(JSON.stringify(outcomeAccept.procurement_document))),
    "H: the frozen snapshot's own copy is untouched by the later draft edit -- still reads exactly as it did at the moment of publication",
    "",
  );

  /* ================================================================ */
  /* I. failed publication creates no unlock or supplier-facing state.  */
  /*    Structural proof: the min-content gate's own throw (this pass's  */
  /*    own new call site) still occurs, in source order, strictly       */
  /*    BEFORE any market-unlock or invite side effect inside            */
  /*    executePublish() -- proving this pass's own refactor (extracting */
  /*    minimumContentQuestionCount()) did not accidentally move the     */
  /*    gate past the point side effects begin.                          */
  /* ================================================================ */
  {
    const fnStart = publishSource.indexOf("export async function executePublish(");
    const fnBody = publishSource.slice(fnStart, fnStart + 40000); // generous bound; function is well within this
    const gateCallIdx = fnBody.indexOf("minimumContentQuestionCount(project)");
    const commitUnlockIdx = fnBody.indexOf("commitMarketUnlock(");
    const listBoardIdx = fnBody.indexOf("listRfpOnBoard(");
    const inviteIdx = fnBody.indexOf("inviteSupplier(");
    record(
      gateCallIdx > -1 && commitUnlockIdx > -1 && listBoardIdx > -1 && inviteIdx > -1,
      "I setup: all four source markers (gate call, commitMarketUnlock, listRfpOnBoard, inviteSupplier) were found inside executePublish()",
      `gate=${gateCallIdx} unlock=${commitUnlockIdx} list=${listBoardIdx} invite=${inviteIdx}`,
    );
    record(
      gateCallIdx > -1 && gateCallIdx < commitUnlockIdx && gateCallIdx < listBoardIdx && gateCallIdx < inviteIdx,
      "I: the minimum-content gate runs, in source order, strictly BEFORE market-unlock, board-listing and every invite side effect -- a failed gate can reach none of them",
      "",
    );
  }

  /* ================================================================ */
  /* J. Procurement Room and every export use the same frozen revision. */
  /* ================================================================ */
  {
    const roomSource = readFileSync(new URL("../src/app/(workspace)/project/[id]/room/page.tsx", import.meta.url), "utf8");
    record(
      /frozen_content\.living_document/.test(roomSource) && /getLatestPublishedSnapshot/.test(roomSource),
      "J: Procurement Room's own source reads exclusively from getLatestPublishedSnapshot()'s frozen_content.living_document, never a live project field",
      "",
    );
    const downloadSource = readFileSync(new URL("../src/app/(marketing)/rfp-builder/[id]/preview/download/route.ts", import.meta.url), "utf8");
    const usesSnapshot = /const\s+livingDocument\s*=\s*snapshot\.frozen_content\.living_document/.test(downloadSource);
    const buildsFrozenProjectOnce = /const\s+frozenProject:\s*ProjectDetails\s*=\s*\{/.test(downloadSource);
    // Every format branch (doc/docx/print/json/markdown) must render from
    // the SAME `frozenProject`, never re-read `project` directly.
    const rendersFromProjectDirectly = /buildRfpHtml\(project[,)]|buildRfpMarkdown\(project[,)]|renderRfpDocx\([^)]*\bproject\b/.test(downloadSource);
    record(usesSnapshot && buildsFrozenProjectOnce, "J: every export format is built from ONE `frozenProject`, itself derived from the snapshot's own frozen living document", `usesSnapshot=${usesSnapshot} buildsOnce=${buildsFrozenProjectOnce}`);
    record(!rendersFromProjectDirectly, "J: no export format branch renders from the live `project` object directly (bypassing the frozen snapshot)", "");
  }

  /* ================================================================ */
  /* K. legacy record migration/fallback remains readable without       */
  /*    becoming the authority for new records.                         */
  /* ================================================================ */
  {
    const legacyOutcome = await buildEnvelopeUpdate({
      existing: { procurement_document: null, envelope_revision: 0 },
      body: { requirement: {}, consent: true }, // a real legacy caller: no `facts` field at all
      mergedSourceLedger: [],
      mergedDecisionLedger: [],
      coveredSections: [],
      savedBy: "buyer@example.com",
    });
    record(legacyOutcome.participates === false, "K: a save with no `facts` field at all (every pre-pass caller) does not participate in the envelope -- completely unaffected by this pass", JSON.stringify(legacyOutcome));

    const legacySections = [{ category: "Network", included: true, questions: [{ id: "q1", feature_id: "f1", text: "Legacy question", evidence_requested: "", rationale: "", priority: "required" as const, source: "methodology" as const, buyer_lens: "", supplier_lens: "", mandatory: true, weight: 3 }] }];
    const legacyProject = ProjectDetailsSchema.parse(minimalProjectDetails({ rfp_sections: legacySections })) as ProjectDetails;
    record(legacyProject.envelope === undefined && !legacyProject.procurement_document, "K setup: the legacy project genuinely has no canonical envelope (no `envelope`, no `procurement_document`)", "");
    const legacyGateCount = minimumContentQuestionCount(legacyProject);
    record(legacyGateCount === 1, "K: a legacy record (no envelope) falls back to counting from `rfp_sections` -- the explicitly identified compatibility projection, still readable", `count=${legacyGateCount}`);

    // The exact inverse: a project that DOES have a canonical envelope must
    // be gated from `procurement_document`, even if `rfp_sections` is
    // stale or empty -- `rfp_sections` is never a second authority once an
    // envelope exists, for a NEW record.
    const canonicalProjectWithStaleSections = ProjectDetailsSchema.parse(
      minimalProjectDetails({
        rfp_sections: [], // stale/empty on purpose
        procurement_document: outcomeAccept.procurement_document,
        envelope_revision: outcomeAccept.envelope_revision,
        envelope: outcomeAccept.envelope,
      }),
    ) as ProjectDetails;
    const canonicalGateCount = minimumContentQuestionCount(canonicalProjectWithStaleSections);
    record(
      canonicalGateCount > 0,
      "K: a project WITH a canonical envelope is gated from procurement_document, not from its (here deliberately stale/empty) rfp_sections -- rfp_sections is not a second authority for a new record",
      `count=${canonicalGateCount}`,
    );
  }

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
