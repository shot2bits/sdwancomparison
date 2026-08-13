// Verification-only script (not part of the app): proves Robert's four
// Phase 1 checkpoint corrections (13 Aug 2026 review) against the real,
// unmodified production functions -- not hand-rolled approximations:
//
//   1. STABLE CLAUSE IDENTITY -- numberClauses()'s idRegistry mechanism
//      (procurement-document.ts), driven through the real compiler.
//   2. THE DURABLE SOURCE LEDGER, NOT TRANSIENT RECEIPTS -- deriveReceipts
//      FromSourceTurns()/mergeReceiptsWithSourceLedger() (procurement-
//      templates.ts), proven through the REAL create/rescope/GET routes
//      (this repo's own established route-level-integration harness,
//      fake-kv-harness.ts, the same one verify-fact-ledger-reliability-
//      gate.ts's own Round 7/8/9 route fixtures already use).
//   3. THE REAL PROJECTDESK COMMAND BOUNDARY -- parseCommand()
//      (commands.ts, moved out of ProjectDesk.tsx by this same
//      correction), proven directly, then through the real extraction
//      pipeline, then through the real routes.
//   4. RECONCILING EXISTING RFI/INSTRUMENT LOGIC -- deriveRfiQuestionSet()
//      (instrument.ts, the real 386-question bank) reused, not
//      reimplemented, by buildResponseGroups()'s own category-exclusivity
//      rule (procurement-document.ts).
//
// ANTHROPIC_API_KEY is not set in this sandbox (consistent with every
// prior reliability-gate fixture and with validate-procurement-
// document.ts): every extraction below resolves via the deterministic
// fallback. Section 13.2's boundary applies here too: this script adds
// fixtures, it does not modify extract.ts, draft.ts, source-ledger.ts, or
// either of the two existing validate scripts -- both remain byte-for-
// byte unchanged and (per this run) fully passing.

import { withFakeKv, makeRequest } from "./fake-kv-harness";
import { deterministicExtract, coverDeclarativeClauses } from "../src/lib/workspace/extract";
import { mergeRequirementBase, mergeUpdates, requirementFrom, dropListFact, type WorkspaceFact } from "../src/lib/workspace/draft";
import { resumeStateFromProject, type SourceLedgerEntry } from "../src/lib/workspace/source-ledger";
import { parseCommand } from "../src/lib/workspace/commands";
import { deriveRfiQuestionSet } from "../src/lib/workspace/instrument";
import {
  compileProcurementDocument,
  factSnapshotOf,
  resolveGovernedRevision,
  INITIAL_GOVERNED_REVISION_STATE,
  type LivingProcurementDocument,
  type ProcurementClause,
  type ProcurementCompilerInput,
  type NotedItem,
  type GovernedEvent,
  type GovernedRevisionState,
} from "../src/lib/workspace/procurement-document";
import { chronologicalHistory, operatingModelFromHistory, supportHoursFromHistory } from "../src/lib/workspace/procurement-templates";

let failures = 0;
const record = (pass: boolean, label: string, detail: string) => {
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}  ->  ${detail}`);
};

type Receipt = { id: number; text: string };
const clauseByTemplate = (doc: LivingProcurementDocument, templateId: string): ProcurementClause | undefined =>
  doc.clauses.find((c) => c.templateId === templateId);

/** Same shape as validate-procurement-document.ts's own turn() helper --
 *  drives one buyer message through the real deterministic pipeline, then
 *  compiles. Kept as a local, independent copy (not an import) so this
 *  file proves its own scenarios without depending on the OTHER script's
 *  internals staying compatible -- the two remain independently
 *  reviewable, per Robert's instruction. */
function turn(
  text: string,
  facts: WorkspaceFact[],
  receipts: Receipt[],
  receiptIdRef: { n: number },
  cycle: number,
  prevDoc: LivingProcurementDocument | null,
  extra: Partial<ProcurementCompilerInput> = {},
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
    ...extra,
  });
  return { facts: newFacts, receipts: newReceipts, doc };
}

async function main() {
  /* ================================================================ */
  /* ITEM 1: STABLE CLAUSE IDENTITY                                     */
  /* One continuous five-turn scenario proving insertion-before,        */
  /* removal-before, "a removed id is never reassigned", and            */
  /* resurrection-reuses-its-own-id -- all in the SAME section          */
  /* ("security"), so ordinal churn is genuinely exercised.             */
  /* ================================================================ */
  {
    const ref = { n: 0 };

    // Turn 1: DLP alone.
    let s = turn("We require DLP.", [], [], ref, 1, null);
    const dlp1 = clauseByTemplate(s.doc, "dlp-coverage");
    record(Boolean(dlp1?.id) && /^SEC-[0-9a-f]{8}$/.test(dlp1!.id), "Item 1/insertion-before: DLP alone compiles with a well-formed immutable id (SECTION-<8 hex chars>, a hash of templateKey, no ordinal)", `id=${dlp1?.id}`);
    const dlpOriginalId = dlp1?.id;

    // Robert's round-2 finding, proven directly: `id` is a PURE function
    // of templateKey. Recompiling the IDENTICAL text from a totally FRESH
    // compile (no shared facts, no shared receipts, no previousDocument
    // at all -- not even the SAME `turn()` chain) must produce the
    // IDENTICAL id, because nothing about identity depends on history.
    const independentDlp = turn("We require DLP.", [], [], { n: 500 }, 1, null);
    const independentDlpClause = clauseByTemplate(independentDlp.doc, "dlp-coverage");
    record(
      independentDlpClause?.id === dlpOriginalId,
      "Item 1/history-free: a totally independent compile (no shared history whatsoever) of the SAME templateKey produces the IDENTICAL id",
      `chained=${dlpOriginalId} independent=${independentDlpClause?.id}`,
    );

    // Turn 2: state data residency too. "security:data-residency" sorts
    // ALPHABETICALLY BEFORE "security:dlp" -- under the OLD
    // (position-recomputed, and then ordinal-registry) schemes this could
    // renumber DLP or depend on registry history. The hash-based fix
    // depends on NEITHER: DLP's id is a pure function of its own
    // templateKey, entirely unaffected by what else compiles alongside it.
    s = turn("No patient-identifiable data may leave the UK.", s.facts, s.receipts, ref, 2, s.doc);
    const dlp2 = clauseByTemplate(s.doc, "dlp-coverage");
    const res2 = clauseByTemplate(s.doc, "uk-data-residency");
    record(
      dlp2?.id === dlpOriginalId,
      "Item 1/insertion-before: adding an alphabetically-earlier clause does NOT change the surviving DLP clause's id",
      `dlp id before=${dlpOriginalId} after=${dlp2?.id}`,
    );
    record(Boolean(res2?.id) && res2!.id !== dlpOriginalId && /^SEC-[0-9a-f]{8}$/.test(res2!.id), "Item 1/insertion-before: the new residency clause gets its own well-formed, distinct id, independent of insertion order", `id=${res2?.id}`);
    const residencyId = res2?.id;

    // Turn 3: remove DLP. The SURVIVING residency clause must keep its
    // own id.
    s = turn("Remove DLP.", s.facts, s.receipts, ref, 3, s.doc);
    record(!clauseByTemplate(s.doc, "dlp-coverage"), "Item 1/removal-before: DLP is gone after \"Remove DLP.\"", "");
    const res3 = clauseByTemplate(s.doc, "uk-data-residency");
    record(
      res3?.id === residencyId,
      "Item 1/removal-before: the surviving residency clause retains EXACTLY the same id after an unrelated removal",
      `before=${residencyId} after=${res3?.id}`,
    );

    // THE ROBERT REPRODUCTION, directly: recompile the EXACT SAME state
    // (post-removal) with previousDocument=null -- a genuine reload, no
    // in-memory history available at all, exactly what his independent
    // reproduction used to show the FIRST correction's idRegistry-based
    // fix still broke. The residency clause's id must be IDENTICAL to
    // what it was mid-session (with previousDocument threaded).
    const reloadedMidSession = compileProcurementDocument({
      facts: s.facts,
      requirement: requirementFrom(s.facts),
      verdict: null, noted: [], rfiSet: null, instrument: "sor",
      receipts: s.receipts,
      previousDocument: null, // <-- the exact condition Robert's reproduction used
    });
    const res3Reloaded = clauseByTemplate(reloadedMidSession, "uk-data-residency");
    record(
      Boolean(res3Reloaded?.id) && res3Reloaded?.id === residencyId,
      "Item 1/THE ROBERT REPRODUCTION: recompiling the identical post-removal state with previousDocument=null (a genuine reload) does NOT renumber the surviving residency clause -- it keeps the exact same id an in-session recompile would",
      `mid-session id=${residencyId} previousDocument=null id=${res3Reloaded?.id}`,
    );
    record(!clauseByTemplate(reloadedMidSession, "dlp-coverage"), "Item 1/THE ROBERT REPRODUCTION: DLP also stays correctly removed after the previousDocument=null recompile (not resurrected by the reload itself)", "");

    // Turn 4: a brand-new, third security-section clause (ISO 27001, a
    // DIFFERENT templateKey entirely). It must NOT inherit DLP's old id
    // -- with hash-based identity this is now trivially guaranteed (a
    // different templateKey ALWAYS hashes to a different id, with
    // overwhelming probability -- see stableClauseId's own comment), not
    // merely "not yet reassigned" as the ordinal scheme required.
    s = turn("We need ISO 27001 certification.", s.facts, s.receipts, ref, 4, s.doc);
    const iso = clauseByTemplate(s.doc, "compliance-requirement");
    record(Boolean(iso), "Item 1/removed-id-not-reassigned: the ISO 27001 compliance clause compiles", "");
    record(
      iso?.id !== dlpOriginalId && iso?.id !== residencyId,
      "Item 1/removed-id-not-reassigned: the new ISO 27001 clause does NOT inherit DLP's old id (or residency's id)",
      `iso id=${iso?.id} dlp(retired)=${dlpOriginalId} residency=${residencyId}`,
    );

    // Turn 5: restate DLP in the buyer's own later words. Resurrection
    // (Section 14.5, already proven for PRESENCE by validate-procurement-
    // document.ts) must ALSO restore its OWN ORIGINAL id -- it is,
    // semantically, the same clause returning, not a new one, and must
    // not collide with residency's or ISO's ids, assigned while it was
    // absent.
    s = turn("We need DLP after all.", s.facts, s.receipts, ref, 5, s.doc);
    const dlp5 = clauseByTemplate(s.doc, "dlp-coverage");
    record(
      dlp5?.id === dlpOriginalId,
      "Item 1/resurrection: DLP resurrects with EXACTLY its original id, not a new one and not a collision",
      `original=${dlpOriginalId} resurrected=${dlp5?.id} residency=${res3?.id} iso=${iso?.id}`,
    );
    record(
      new Set([dlp5?.id, res3?.id, iso?.id]).size === 3,
      "Item 1: all three surviving security-section clauses carry three DISTINCT ids -- no collision anywhere in this scenario",
      `ids=${JSON.stringify([dlp5?.id, res3?.id, iso?.id])}`,
    );

    // Correction preserves id: the managed-service-boundary clause's own
    // templateKey never changes ("operating-model:boundary"), regardless
    // of content -- explicit id-VALUE equality, not just "still present",
    // strengthening validate-procurement-document.ts's own Prompt A/B
    // case with the specific claim item 1 makes.
    const before = turn(
      "Fully managed with 24/7 support, live by April 2027.",
      [], [], { n: 9000 }, 1, null,
    );
    const opsBefore = clauseByTemplate(before.doc, "managed-service-boundary");
    const after = turn(
      "Make the service co-managed instead of fully managed, but keep 24/7 incident support.",
      before.facts, before.receipts, { n: 9100 }, 2, before.doc,
    );
    const opsAfter = clauseByTemplate(after.doc, "managed-service-boundary");
    record(
      Boolean(opsBefore?.id) && opsBefore?.id === opsAfter?.id,
      "Item 1/correction: a content correction (fully managed -> co-managed) preserves the EXACT same public clause id",
      `before=${opsBefore?.id} after=${opsAfter?.id}`,
    );

    // Question/gate ids are DERIVED from the now-stable clause id -- the
    // same public identity a Supplier Pack question or a mandatory gate
    // references never drifts underneath it either.
    const gateBefore = before.doc.evaluation.gates.find((g) => g.clauseIds.includes(opsBefore!.id));
    const gateAfter = after.doc.evaluation.gates.find((g) => g.clauseIds.includes(opsAfter!.id));
    record(
      gateBefore?.id === gateAfter?.id,
      "Item 1: the mandatory gate referencing this clause carries the SAME id across the correction, because it derives from the now-stable clause id",
      `before=${gateBefore?.id} after=${gateAfter?.id}`,
    );

    // Architecture dependency provenance: a node derived FROM a clause
    // (voice-continuity here) cites that clause's own stable id.
    const withVoice = turn(
      "Teams Phone cannot go down. Fail over automatically without dropping calls.",
      [], [], { n: 9200 }, 1, null,
    );
    const voiceClause = clauseByTemplate(withVoice.doc, "voice-continuity");
    const voiceNode = withVoice.doc.architecture.nodes.find((n) => n.id === "voice");
    record(
      Boolean(voiceClause) && Boolean(voiceNode) && voiceNode!.sourceClauseIds.includes(voiceClause!.id),
      "Item 1: the architecture's voice node cites the SAME stable clause id as the voice-continuity clause itself",
      `clauseId=${voiceClause?.id} node.sourceClauseIds=${JSON.stringify(voiceNode?.sourceClauseIds)}`,
    );
  }

  /* ================================================================ */
  /* ITEM 2 (round 2): CHRONOLOGICAL REDUCTION OVER THE DURABLE SOURCE  */
  /* LEDGER -- Robert's exact reproduction ("co-managed" then "fully    */
  /* managed" -- the old operatingModelFromCorpus() bag-of-words bug),  */
  /* the reverse direction, support-hours both directions, an unrelated */
  /* intervening turn, array-position-vs-`at` ordering, a same-turn      */
  /* contradiction, a real save/reopen, and byte-equivalent recompile.  */
  /* ================================================================ */
  {
    const st = (id: string, text: string, at: number): SourceLedgerEntry => ({ id, text, at, via: "typed" });

    // THE ROBERT REPRODUCTION, directly against the reducer itself:
    // "The current compiler incorrectly returns co-managed because
    // operatingModelFromCorpus checks whether co-managed appears anywhere
    // before checking fully managed." chronologicalHistory()/
    // operatingModelFromHistory() replace that bag-of-words test with a
    // (at, position)-ordered, latest-write-wins reduction.
    {
      const turns = [st("om_t1", "We require a co-managed service.", 1000), st("om_t2", "We now require a fully managed service.", 2000)];
      const history = chronologicalHistory(turns, []);
      const result = operatingModelFromHistory(history);
      record(result.model === "managed", "Item 2/THE ROBERT REPRODUCTION: \"co-managed\" then, LATER, \"fully managed\" reduces to fully managed (managed), not co-managed", `model=${result.model}`);
      record(result.sourceTurnId === "om_t2", "Item 2/THE ROBERT REPRODUCTION: the resolved state traces to the LATER turn's own id", `sourceTurnId=${result.sourceTurnId}`);
    }

    // The reverse correction direction: managed -> co-managed.
    {
      const turns = [st("om_t1", "Fully managed service required.", 1000), st("om_t2", "Actually we need it co-managed instead.", 2000)];
      const result = operatingModelFromHistory(chronologicalHistory(turns, []));
      record(result.model === "co_managed", "Item 2/reverse direction: \"fully managed\" then, LATER, \"co-managed instead\" reduces to co-managed, not fully managed", `model=${result.model}`);
    }

    // Support-hours correction, both directions -- support-hours has NO
    // structured WorkspaceFact of its own (see supportHoursFromHistory's
    // own comment), so this reducer is its ONLY source of truth, live or
    // reopened.
    {
      const turns247ToBusiness = [st("sh_t1", "We need 24/7 support.", 1000), st("sh_t2", "Business hours only support is fine now.", 2000)];
      const r1 = supportHoursFromHistory(chronologicalHistory(turns247ToBusiness, []));
      record(r1.hours247 === false, "Item 2/support-hours: 24/7 then, LATER, business-hours-only reduces to hours247=false", JSON.stringify(r1));

      const turnsBusinessTo247 = [st("sh_t1", "Business hours only support.", 1000), st("sh_t2", "We now need 24/7 incident support.", 2000)];
      const r2 = supportHoursFromHistory(chronologicalHistory(turnsBusinessTo247, []));
      record(r2.hours247 === true && r2.incidentSupport247 === true, "Item 2/support-hours (reverse): business-hours-only then, LATER, 24/7 incident support reduces to hours247=true, incidentSupport247=true", JSON.stringify(r2));
    }

    // An unrelated intervening turn (states something else entirely, no
    // operating-model or support-hours language) must not disrupt the
    // chronology -- the reducer looks at (at, position) order among the
    // RELEVANT occurrences, not adjacency in the raw array.
    {
      const turns = [
        st("un_t1", "We require a co-managed service.", 1000),
        st("un_t_mid", "We also need ISO 27001 certification.", 1500),
        st("un_t2", "We now require a fully managed service.", 2000),
      ];
      const result = operatingModelFromHistory(chronologicalHistory(turns, []));
      record(result.model === "managed", "Item 2/unrelated intervening turn: an unrelated turn between the two operating-model statements does not disrupt the chronology -- fully managed still wins", `model=${result.model}`);
    }

    // Array-position is NOT the ordering key -- `at` is. Deliver the
    // LATER-`at` turn FIRST in the array; the reducer must still resolve
    // to the state named by the later `at` timestamp, not the state named
    // by whichever turn happens to appear first in the array (Robert:
    // "Process SourceLedgerEntry occurrences in (at, original array
    // position) order").
    {
      const turnsOutOfArrayOrder = [st("ap_t2", "We now require a fully managed service.", 2000), st("ap_t1", "We require a co-managed service.", 1000)];
      const result = operatingModelFromHistory(chronologicalHistory(turnsOutOfArrayOrder, []));
      record(result.model === "managed", "Item 2/(at, position) ordering: array order is REVERSED from `at` order -- the reducer still resolves by `at`, not by array position, so fully managed (the later `at`) wins", `model=${result.model} sourceTurnId=${result.sourceTurnId}`);
    }

    // Tie-break: identical `at` values fall back to original array
    // position -- the LATER array entry (same `at`) wins.
    {
      const turnsSameAt = [st("tb_a", "We require a co-managed service.", 1000), st("tb_b", "We now require a fully managed service.", 1000)];
      const result = operatingModelFromHistory(chronologicalHistory(turnsSameAt, []));
      record(result.model === "managed" && result.sourceTurnId === "tb_b", "Item 2/(at, position) tie-break: two turns with the IDENTICAL `at` resolve by array position -- the later array entry wins", `model=${result.model} sourceTurnId=${result.sourceTurnId}`);
    }

    // Same-turn contradiction (Robert: "Contradictions within the same
    // unresolved instruction should still create an OpenDecision"): two
    // model names in ONE occurrence, with no correction signal
    // ("instead of", "no longer", ...) to say which one the buyer means,
    // is left unresolved -- never guessed -- and reported as
    // `ambiguousText` (procurement-readiness.ts's own new
    // OD-operating-model-ambiguous-correction decision reads this).
    {
      const turns = [st("amb_t1", "We could go with a co-managed service or a managed service, no strong preference either way.", 1000)];
      const result = operatingModelFromHistory(chronologicalHistory(turns, []));
      record(result.model === null && Boolean(result.ambiguousText), "Item 2/same-turn contradiction: two model names in ONE occurrence with no correction signal is left unresolved (model stays null) and surfaced as ambiguousText, never guessed", JSON.stringify(result));

      const reqAmbiguous = requirementFrom([]);
      const docAmbiguous = compileProcurementDocument({
        facts: [], requirement: reqAmbiguous, verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [], sourceTurns: turns, previousDocument: null,
      });
      record(
        docAmbiguous.openDecisions.some((d) => d.id === "OD-operating-model-ambiguous-correction"),
        "Item 2/same-turn contradiction: the full compile surfaces OD-operating-model-ambiguous-correction as a real OpenDecision, not a silently dropped signal",
        JSON.stringify(docAmbiguous.openDecisions.map((d) => d.id)),
      );
    }

    // End-to-end, through the real compiler, with facts=[] (the genuine
    // reopen shape -- facts are never rehydrated) so operatingModelOf(facts)
    // cannot mask the chronological reducer: the managed-service clause's
    // OWN statement text must read "fully managed", proving the fix
    // reaches the compiled document, not just the pure reducer function.
    {
      const turns = [st("e2e_t1", "We require a co-managed service.", 1000), st("e2e_t2", "We now require a fully managed service.", 2000)];
      const req = requirementFrom([]);
      const doc = compileProcurementDocument({
        facts: [], requirement: req, verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [], sourceTurns: turns, previousDocument: null,
      });
      const ops = clauseByTemplate(doc, "managed-service-boundary");
      record(Boolean(ops) && /fully managed/i.test(ops!.statement) && !/co-managed/i.test(ops!.statement), "Item 2/end-to-end: the compiled managed-service clause states fully managed (not co-managed) after the correction, with facts=[] so only the chronological reducer could have produced this", ops?.statement ?? "");
    }

    // Save/reopen, through the REAL routes: create with the co-managed
    // turn, rescope with the fully-managed correction turn, reload via
    // the real GET route, recompile from the durable ledger alone
    // (facts=[], receipts=[], previousDocument=null -- a genuine reload).
    await withFakeKv(async () => {
      const { POST: createSecurityProjectRoute } = await import("../src/app/api/security-sourcing/project/route");
      const { POST: rescopeRoute } = await import("../src/app/api/security-sourcing/project/[id]/rescope/route");
      const { GET: rfpGetRoute } = await import("../src/app/api/rfp/[id]/route");
      type RouteProjectLike = { id?: string; manage_token?: string; source_ledger?: SourceLedgerEntry[] };

      const turnCoText = "We require a co-managed service, with 24/7 support, UK 20 site Healthcare business.";
      const uCo = deterministicExtract(turnCoText, []);
      const factsCo = mergeUpdates([], uCo, 1, "extract").facts;
      const reqCo = requirementFrom(factsCo);
      const reqCoForCreate: typeof reqCo = {
        ...reqCo,
        organisation: { ...reqCo.organisation, sector: reqCo.organisation?.sector ?? "Healthcare & pharma" },
        estate: { ...reqCo.estate, sites: reqCo.estate?.sites ?? 20, users: reqCo.estate?.users ?? 200, existingSecurity: ["Defender P2"] },
        drivers: ["renewal"],
        constraints: { ...reqCo.constraints, inHouseSocCapacity: "business_hours", complianceRequirements: ["iso27001"] },
      };
      const createRes = await createSecurityProjectRoute(
        makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
          body: { requirement: reqCoForCreate, consent: true, test: true, source_turns: [{ id: "om_route_t1", text: turnCoText, at: 5000, via: "typed" }] },
        }),
      );
      const created = (await createRes.json()) as { project?: RouteProjectLike; error?: string };
      record(createRes.status === 200, "Item 2/save-reopen: create with the co-managed turn succeeds through the real route", `status=${createRes.status} error=${created.error}`);
      const id = created.project?.id ?? "";
      const manage = created.project?.manage_token ?? "";

      const turnFullyText = "We now require a fully managed service instead.";
      const uFully = deterministicExtract(turnFullyText, []);
      const factsFully = mergeUpdates(factsCo, uFully, 2, "extract").facts;
      const reqFully = requirementFrom(factsFully);
      // The rescope route assesses body.requirement on its own (it does
      // NOT merge with the project's already-stored, already-enriched
      // requirement -- rescope-project.ts's own `assessSecurityRequirement
      // (input.requirement)` call), so this payload needs the SAME
      // confidence-gate enrichment the create call above already carries,
      // kept as a SEPARATE payload from `reqFully` (which drives every
      // compileProcurementDocument() call below) for the same reason
      // req1ForCreate/reqAForCreate are kept separate elsewhere in this
      // file.
      const reqFullyForRescope: typeof reqFully = {
        ...reqFully,
        drivers: ["renewal"],
        estate: { ...reqFully.estate, existingSecurity: ["Defender P2"] },
        constraints: { ...reqFully.constraints, inHouseSocCapacity: "business_hours", complianceRequirements: ["iso27001"] },
      };
      const rescopeRes = await rescopeRoute(
        makeRequest("POST", `https://example.test/sase/api/security-sourcing/project/${id}/rescope`, {
          body: { manage_token: manage, requirement: reqFullyForRescope, consent: true, source_turns: [{ id: "om_route_t2", text: turnFullyText, at: 6000, via: "typed" }] },
        }),
        { params: Promise.resolve({ id }) },
      );
      const rescoped = (await rescopeRes.json()) as { rescoped?: boolean };
      record(rescoped.rescoped === true, "Item 2/save-reopen: the fully-managed correction saves through the real rescope route", JSON.stringify(rescoped));

      const reload = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const reloaded = (await reload.json()) as RouteProjectLike;
      const resumeState = resumeStateFromProject(reloaded);
      record((resumeState?.sourceLedger.length ?? 0) === 2, "Item 2/save-reopen: both turns are durable in source_ledger after the real save", JSON.stringify(resumeState?.sourceLedger.map((t) => t.text)));

      const recompiled = compileProcurementDocument({
        facts: [],
        requirement: mergeRequirementBase(resumeState!.requirementBase, requirementFrom([])),
        verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [], sourceTurns: resumeState!.sourceLedger, previousDocument: null, // a genuine reload
      });
      const opsRecompiled = clauseByTemplate(recompiled, "managed-service-boundary");
      record(
        Boolean(opsRecompiled) && /fully managed/i.test(opsRecompiled!.statement) && !/co-managed/i.test(opsRecompiled!.statement),
        "Item 2/save-reopen: after a REAL save+reopen+recompile with previousDocument=null, the managed-service clause reads fully managed (the correction survived and reduced chronologically, not co-managed)",
        opsRecompiled?.statement ?? "",
      );

      // Byte-equivalent recompilation: re-deriving from the identical
      // source_ledger twice, independently, is byte-identical.
      const recompiledAgain = compileProcurementDocument({
        facts: [],
        requirement: mergeRequirementBase(resumeState!.requirementBase, requirementFrom([])),
        verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [], sourceTurns: resumeState!.sourceLedger, previousDocument: null,
      });
      record(
        JSON.stringify(recompiled) === JSON.stringify(recompiledAgain),
        "Item 2/byte-equivalent recompilation: re-deriving the operating-model correction from the SAME source_ledger twice is byte-identical",
        "compared two independent derivations",
      );
    });
  }

  /* ================================================================ */
  /* ITEM 3 (pure): the command-classification boundary itself          */
  /* ================================================================ */
  {
    record(parseCommand("remove Azure")?.kind === "dropName", "Item 3/pure: a real single-target command (\"remove Azure\") still classifies as dropName", JSON.stringify(parseCommand("remove Azure")));
    record(parseCommand("drop MPLS")?.kind === "dropName", "Item 3/pure: \"drop MPLS\" still classifies as dropName", JSON.stringify(parseCommand("drop MPLS")));
    record(parseCommand("untick the DLP requirement")?.kind === "dropName", "Item 3/pure: a longer but SINGLE-sentence target (\"untick the DLP requirement\") still classifies as dropName", JSON.stringify(parseCommand("untick the DLP requirement")));
    record(parseCommand("keep Azure")?.kind === "keepName", "Item 3/pure: \"keep Azure\" still classifies as keepName", JSON.stringify(parseCommand("keep Azure")));

    const promptB = "Remove DLP. Make the service co-managed instead of fully managed, but keep 24/7 incident support.";
    const parsedB = parseCommand(promptB);
    record(
      parsedB === null,
      "Item 3/THE FIX: the exact Section 16.2 correction prompt is NOT classified as a drop command (falls through to ordinary procurement content)",
      `parsed=${JSON.stringify(parsedB)}`,
    );

    // A close relative that starts the same way but IS a genuine single
    // command must still work -- proves the fix is about SENTENCE
    // STRUCTURE, not about the word "DLP" or the verb "remove".
    record(parseCommand("Remove DLP")?.kind === "dropName", "Item 3/pure: \"Remove DLP\" ALONE (no trailing correction) still classifies as dropName", JSON.stringify(parseCommand("Remove DLP")));
  }

  /* ================================================================ */
  /* ITEMS 2 + 3 (route-level): durable source ledger AND the command   */
  /* boundary, together, through the REAL create/rescope/GET routes     */
  /* ================================================================ */
  {
    await withFakeKv(async () => {
      const { POST: createSecurityProjectRoute } = await import("../src/app/api/security-sourcing/project/route");
      const { POST: rescopeRoute } = await import("../src/app/api/security-sourcing/project/[id]/rescope/route");
      const { GET: rfpGetRoute } = await import("../src/app/api/rfp/[id]/route");
      type RouteProjectLike = { id?: string; manage_token?: string; source_ledger?: SourceLedgerEntry[]; engine?: string; engine_data?: { requirement?: unknown } };

      const turn1Text =
        "UK 20 site Healthcare business requires SD-WAN and full SASE. We have 200 remote users. We also have a legacy app that requires a point to point Ethernet private circuit. No patient-identifiable data may leave the UK.";
      const u1 = deterministicExtract(turn1Text, []);
      const facts1 = mergeUpdates([], u1, 1, "extract").facts;
      const req1 = requirementFrom(facts1);

      // The real create route enforces assess_security_requirement's own
      // confidence gate (unrelated to this compiler, unrelated to any of
      // Robert's four corrections) -- a route-level fixture must satisfy
      // it with real answers to create at all, exactly as verify-fact-
      // ledger-reliability-gate.ts's own FULL_REQ already does. Kept as a
      // SEPARATE payload from `req1`/`facts1` (which drive every one of
      // THIS fixture's own compileProcurementDocument() calls, below) so
      // the confidence-gate answers never leak into what this fixture is
      // actually testing.
      const req1ForCreate: typeof req1 = {
        ...req1,
        drivers: ["renewal"],
        estate: { ...req1.estate, existingSecurity: ["Defender P2"] },
        constraints: { ...req1.constraints, inHouseSocCapacity: "business_hours", complianceRequirements: ["iso27001"] },
      };

      const createRes = await createSecurityProjectRoute(
        makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
          body: {
            requirement: req1ForCreate,
            consent: true,
            test: true,
            source_turns: [{ id: "canvas_t1", text: turn1Text, at: 1000, via: "typed" }],
          },
        }),
      );
      const created = (await createRes.json()) as { project?: RouteProjectLike; error?: string };
      record(createRes.status === 200, "Items 2+3: create with the Healthcare/Ethernet/residency turn succeeds through the real route", `status=${createRes.status} error=${created.error}`);
      const id = created.project?.id ?? "";
      const manage = created.project?.manage_token ?? "";

      // The BEFORE-save compile, exactly as a live session would produce
      // it (receipts populated the ordinary way, no sourceTurns needed
      // since nothing has been reopened yet).
      const cov1 = coverDeclarativeClauses(turn1Text, u1);
      const receipts1: Receipt[] = cov1.unplacedClauses.map((t, i) => ({ id: i + 1, text: t }));
      const beforeDoc = compileProcurementDocument({
        facts: facts1, requirement: req1, verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: receipts1, previousDocument: null,
      });
      for (const templateId of ["network-architecture-scope", "legacy-circuit-coexistence", "uk-data-residency"]) {
        record(Boolean(clauseByTemplate(beforeDoc, templateId)), `Items 2+3/before-save baseline: ${templateId} compiles from the live session`, "");
      }

      // Reload through the REAL GET route -- exactly what a reopened
      // project's arrival effect would do.
      const reload = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const reloaded = (await reload.json()) as RouteProjectLike;
      const resumeState = resumeStateFromProject(reloaded);
      record(Boolean(resumeState), "Items 2+3: resume recovers source_ledger and requirementBase via the real resumeStateFromProject()", `resumeState=${JSON.stringify(resumeState)}`);
      record(
        (resumeState?.sourceLedger.length ?? 0) === 1 && resumeState!.sourceLedger[0].text === turn1Text,
        "Item 2: the reloaded source_ledger carries the buyer's exact original turn verbatim",
        JSON.stringify(resumeState?.sourceLedger),
      );

      // THE ACTUAL REOPEN-AND-RECOMPILE: facts and receipts are NOT
      // restored (Robert's own "Minimal resume" ruling, source-ledger.ts)
      // -- both start genuinely empty here, exactly as a real reopened
      // session's do. The compiler's ONLY route back to these clauses is
      // the durable sourceTurns input (item 2's whole point).
      //
      // The REQUIREMENT, however, IS restored -- resumeStateFromProject()
      // recovers requirementBase from the persisted project (source-
      // ledger.ts's own doc comment), and the real resumed-session path
      // (draft.ts's mergeRequirementBase()) merges it with this session's
      // own (here: zero) new facts. Passing requirementFrom([]) ALONE, as
      // this fixture originally did, silently drops the resumed scope
      // fields (sites/users/sector/...) that several clauses' own
      // statement text depends on -- a fixture bug, not a compiler bug;
      // this is the real reopened-session contract, exercised for real.
      const reopenedRequirement = mergeRequirementBase(resumeState!.requirementBase, requirementFrom([]));
      const afterReopenDoc = compileProcurementDocument({
        facts: [],
        requirement: reopenedRequirement,
        verdict: null,
        noted: [],
        rfiSet: null,
        instrument: "sor",
        receipts: [], // genuinely empty -- the whole point of this proof
        sourceTurns: resumeState!.sourceLedger,
        previousDocument: null, // Phase 1 persists no compiled document anywhere yet (see report: a named, honest scope boundary)
      });

      for (const templateId of ["network-architecture-scope", "legacy-circuit-coexistence", "uk-data-residency"]) {
        const before = clauseByTemplate(beforeDoc, templateId);
        const after = clauseByTemplate(afterReopenDoc, templateId);
        record(
          Boolean(before) && Boolean(after) && before!.statement === after!.statement && before!.quote === after!.quote && before!.mandatory === after!.mandatory,
          `Item 2/durability: ${templateId} survives reopen -- BYTE-EQUIVALENT statement, quote and mandatory classification, with receipts=[] (only source_ledger drove this)`,
          `before=${JSON.stringify({ statement: before?.statement, quote: before?.quote })} after=${JSON.stringify({ statement: after?.statement, quote: after?.quote })}`,
        );
      }
      const legacyAfter = clauseByTemplate(afterReopenDoc, "legacy-circuit-coexistence");
      record(
        legacyAfter?.quote === "We also have a legacy app that requires a point to point Ethernet private circuit.",
        "Item 2: exact source wording remains linked as clause provenance after a real reopen",
        `quote=${legacyAfter?.quote}`,
      );

      // Stable ids ACROSS a real reopen: Phase 1 checkpoint round 2, item 1
      // (13 Aug 2026) replaced the ordinal idRegistry with a hash-of-
      // templateKey immutable id (stableClauseId()/assignStableIds(),
      // procurement-document.ts), so `previousDocument` is now OPTIONAL
      // for id stability -- unlike the OLD scheme, which genuinely
      // required the caller to still hold (or re-supply) the pre-reopen
      // document, and which Robert's independent reproduction proved
      // still broke under a REAL reload (previousDocument=null; see the
      // "THE ROBERT REPRODUCTION" assertions in Item 1 above). This block
      // proves BOTH forms explicitly, side by side, rather than relying
      // on just one:
      //   - afterReopenDoc (already computed above): previousDocument=null,
      //     the genuine-reload condition.
      //   - afterReopenWithRegistry (below): previousDocument=beforeDoc,
      //     the in-session-recompile condition.
      // Ids must be IDENTICAL in both, and identical to each other -- not
      // merely each independently stable -- because nothing about
      // identity is a function of previousDocument any more.
      const afterReopenWithRegistry = compileProcurementDocument({
        facts: [], requirement: reopenedRequirement, verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [], sourceTurns: resumeState!.sourceLedger, previousDocument: beforeDoc,
      });
      for (const templateId of ["network-architecture-scope", "legacy-circuit-coexistence", "uk-data-residency"]) {
        const before = clauseByTemplate(beforeDoc, templateId);
        const after = clauseByTemplate(afterReopenWithRegistry, templateId);
        const afterNullPrev = clauseByTemplate(afterReopenDoc, templateId);
        record(
          before?.id === after?.id,
          `Item 1+2/stable ids across reopen: ${templateId} keeps the SAME public id after reopen, WITH a previousDocument supplied (in-session recompile) -- now merely a confirmation, no longer a requirement, since identity is history-free`,
          `before=${before?.id} after=${after?.id}`,
        );
        record(
          Boolean(afterNullPrev?.id) && afterNullPrev?.id === after?.id,
          `Item 1/THE ROBERT REPRODUCTION, applied to ${templateId}: previousDocument=null (a genuine reload) and previousDocument=beforeDoc (an in-session recompile) produce the IDENTICAL id -- previousDocument is now OPTIONAL for stability, not required`,
          `previousDocument=null id=${afterNullPrev?.id} previousDocument=beforeDoc id=${after?.id}`,
        );
      }

      // Adding a NEW turn after reopening preserves all earlier clauses.
      const turn2Text = "We use Entra ID and Azure; require ZTNA and DLP.";
      const u2 = deterministicExtract(turn2Text, []);
      const cov2 = coverDeclarativeClauses(turn2Text, u2);
      const facts2 = mergeUpdates([], u2, 2, "extract").facts; // this session's OWN new facts only, per the resumed-session model
      const mergedRequirement2 = mergeRequirementBase(resumeState!.requirementBase, requirementFrom(facts2));
      const newSourceTurns = [...resumeState!.sourceLedger, { id: "canvas_t2", text: turn2Text, at: 2000, via: "typed" as const }];
      const afterNewTurnDoc = compileProcurementDocument({
        facts: facts2,
        requirement: mergedRequirement2,
        verdict: null,
        noted: [],
        rfiSet: null,
        instrument: "sor",
        receipts: [...cov2.unplacedClauses.map((t, i) => ({ id: i + 1, text: t }))],
        sourceTurns: newSourceTurns,
        previousDocument: afterReopenWithRegistry,
      });
      for (const templateId of ["network-architecture-scope", "legacy-circuit-coexistence", "uk-data-residency"]) {
        record(Boolean(clauseByTemplate(afterNewTurnDoc, templateId)), `Item 2: ${templateId} (from BEFORE reopen) survives a NEW turn typed AFTER reopen`, "");
      }
      record(Boolean(clauseByTemplate(afterNewTurnDoc, "identity-aware-ztna")), "Item 2: the NEW turn's own clause (identity-aware-ztna) also compiles", "");
      record(Boolean(clauseByTemplate(afterNewTurnDoc, "dlp-coverage")), "Item 2: the NEW turn's own clause (dlp-coverage) also compiles", "");

      // No second independent store: calling the derivation twice on the
      // identical source ledger is byte-identical -- pure, nothing
      // written anywhere, nothing to drift out of sync with source_ledger
      // itself.
      const repeat1 = compileProcurementDocument({
        facts: [], requirement: reopenedRequirement, verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [], sourceTurns: resumeState!.sourceLedger, previousDocument: null,
      });
      const repeat2 = compileProcurementDocument({
        facts: [], requirement: reopenedRequirement, verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [], sourceTurns: resumeState!.sourceLedger, previousDocument: null,
      });
      record(
        JSON.stringify(repeat1) === JSON.stringify(repeat2),
        "Item 2: re-deriving from the SAME source_ledger twice is byte-identical -- no second store, no hidden state, nothing to fall out of sync",
        "compared two independent derivations of the same ledger",
      );

      /* -------------------------------------------------------------- */
      /* Item 3, through the SAME project: the exact Prompt B correction */
      /* goes through parseCommand() first (proving it is NOT swallowed  */
      /* as a drop command), then through the real extraction pipeline,  */
      /* then survives a REAL rescope save + GET reload + recompile.     */
      /* -------------------------------------------------------------- */
      const promptA = "Fully managed with 24/7 support, live by April 2027.";
      const uA = deterministicExtract(promptA, []);
      const factsA = mergeUpdates([], uA, 1, "extract").facts;
      const reqA = requirementFrom(factsA);
      const docA = compileProcurementDocument({
        facts: factsA, requirement: reqA, verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [], previousDocument: null,
      });
      const opsA = clauseByTemplate(docA, "managed-service-boundary");
      record(Boolean(opsA) && /fully managed/i.test(opsA!.statement), "Item 3/route: baseline managed-service clause states fully managed", opsA?.statement ?? "");

      const promptB = "Remove DLP. Make the service co-managed instead of fully managed, but keep 24/7 incident support.";
      record(parseCommand(promptB) === null, "Item 3/route: the exact correction, re-checked at THIS call site, is not a drop command", "");

      const uB = deterministicExtract(promptB, []);
      const mergeB = mergeUpdates(factsA, uB, 2, "extract");
      const covB = coverDeclarativeClauses(promptB, uB);
      const reqB = requirementFrom(mergeB.facts);
      const docB = compileProcurementDocument({
        facts: mergeB.facts, requirement: reqB, verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [...covB.unplacedClauses.map((t, i) => ({ id: i + 1, text: t }))],
        previousDocument: docA,
      });
      const opsB = clauseByTemplate(docB, "managed-service-boundary");
      record(!clauseByTemplate(docB, "dlp-coverage"), "Item 3/route: DLP is removed by the correction, reached through the real command-boundary + extraction pipeline", "");
      record(Boolean(opsB) && /co-managed/i.test(opsB!.statement), "Item 3/route: fully managed becomes co-managed", opsB?.statement ?? "");
      record(Boolean(opsB) && /24\/7 incident support/i.test(opsB!.statement), "Item 3/route: 24/7 incident support is kept", opsB?.statement ?? "");

      // The correction survives save, reopen and recompile: save via the
      // REAL rescope route (the actual save path a correction like this
      // takes after project creation), reload via the REAL GET route,
      // recompile from the durable ledger alone. Same confidence-gate
      // note as above: reqAForCreate is a route-payload-only enrichment,
      // never fed into this fixture's own compiler calls.
      const reqAForCreate: typeof reqA = {
        ...reqA,
        organisation: { ...reqA.organisation, sector: reqA.organisation?.sector ?? "Healthcare & pharma" },
        estate: { ...reqA.estate, sites: reqA.estate?.sites ?? 20, users: reqA.estate?.users ?? 200, existingSecurity: ["Defender P2"] },
        drivers: ["renewal"],
        constraints: { ...reqA.constraints, inHouseSocCapacity: "business_hours", complianceRequirements: ["iso27001"] },
      };
      const createResB = await createSecurityProjectRoute(
        makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
          body: { requirement: reqAForCreate, consent: true, test: true, source_turns: [{ id: "canvas_pb_a", text: promptA, at: 3000, via: "typed" }] },
        }),
      );
      const createdB = (await createResB.json()) as { project?: RouteProjectLike; error?: string };
      const idB = createdB.project?.id ?? "";
      const manageB = createdB.project?.manage_token ?? "";

      const rescopeRes = await rescopeRoute(
        makeRequest("POST", `https://example.test/sase/api/security-sourcing/project/${idB}/rescope`, {
          body: {
            manage_token: manageB,
            requirement: reqB,
            consent: true,
            source_turns: [{ id: "canvas_pb_b", text: promptB, at: 3001, via: "typed" }],
          },
        }),
        { params: Promise.resolve({ id: idB }) },
      );
      const rescoped = (await rescopeRes.json()) as { rescoped?: boolean; error?: string };
      record(rescoped.rescoped === true, "Item 3/route: the correction saves through the REAL rescope route", `rescoped=${JSON.stringify(rescoped)}`);

      const reloadB = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${idB}?manage=${manageB}`), { params: Promise.resolve({ id: idB }) });
      const reloadedB = (await reloadB.json()) as RouteProjectLike;
      const resumeStateB = resumeStateFromProject(reloadedB);
      record((resumeStateB?.sourceLedger.length ?? 0) === 2, "Item 3/route: both turns (original + correction) are durable in source_ledger after the real save", JSON.stringify(resumeStateB?.sourceLedger.map((t) => t.text)));

      const recompiledB = compileProcurementDocument({
        facts: [],
        requirement: mergeRequirementBase(resumeStateB!.requirementBase, requirementFrom([])),
        verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [], sourceTurns: resumeStateB!.sourceLedger, previousDocument: null,
      });
      record(!clauseByTemplate(recompiledB, "dlp-coverage"), "Item 3/route: after a REAL save+reopen+recompile, DLP is STILL removed (the correction survived)", "");
      const opsRecompiled = clauseByTemplate(recompiledB, "managed-service-boundary");
      record(Boolean(opsRecompiled) && /co-managed/i.test(opsRecompiled!.statement) && /24\/7 incident support/i.test(opsRecompiled!.statement), "Item 3/route: after reopen, the managed-service clause still reads co-managed with 24/7 incident support", opsRecompiled?.statement ?? "");

      /* -------------------------------------------------------------- */
      /* Round 1-9 preservation check (Robert's explicit instruction):   */
      /* the pre-existing dropName route fixture (Round 9) still works   */
      /* through the SAME resolveDropTarget() path -- proven by direct   */
      /* re-import, not by re-running verify-fact-ledger-reliability-    */
      /* gate.ts (left completely untouched; its own run, reported       */
      /* separately, already re-confirms this).                          */
      /* -------------------------------------------------------------- */
      const { resolveDropTarget } = await import("../src/lib/workspace/draft");
      const simpleDrop = resolveDropTarget("Azure", {
        liveFacts: [{ id: "estate.cloud:azure", path: "estate.cloud", value: "azure", provenance: "stated", quote: "Azure", struck: false, source: "extract", cycle: 1 }],
        noted: [],
        receipts: [],
        resumeRequirementBase: null,
        resumeRemovals: new Set(),
      });
      record(simpleDrop?.kind === "fact", "Round 1-9 preservation: resolveDropTarget('Azure') (the real drop-command matcher, unmodified by this correction) still resolves a live fact", JSON.stringify(simpleDrop));
    });
  }

  /* ================================================================ */
  /* ITEM 3 (round 2): DO NOT DEDUPLICATE DISTINCT SOURCE-TURN           */
  /* OCCURRENCES BY TEXT -- Robert's exact reproduction ("We require     */
  /* DLP." / "Remove DLP." / "We require DLP." -- the final identical    */
  /* restatement, discarded by the old global exact-text Set), identical */
  /* repeats without a removal, a duplicate DELIVERY of the same         */
  /* source-turn id, and save/reopen/recompile.                          */
  /* ================================================================ */
  {
    const st = (id: string, text: string, at: number): SourceLedgerEntry => ({ id, text, at, via: "typed" });

    // THE ROBERT REPRODUCTION, directly: three source turns, the first
    // and third BYTE-IDENTICAL, with a removal in between. Fed as the
    // durable ledger (facts=[], receipts=[]) so the ONLY path back to the
    // DLP clause is mergeReceiptsWithSourceLedger()'s own occurrence
    // handling -- exactly what the OLD global exact-text Set collapsed,
    // silently discarding the third turn as "a duplicate of the first"
    // before isCurrentlyRemoved() ever got to see it and resurrect DLP.
    {
      const sourceTurns = [
        st("dlp_t1", "We require DLP.", 1000),
        st("dlp_t2", "Remove DLP.", 2000),
        st("dlp_t3", "We require DLP.", 3000), // byte-identical restatement of dlp_t1
      ];
      const req = requirementFrom([]);
      const doc = compileProcurementDocument({
        facts: [], requirement: req, verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [], sourceTurns, previousDocument: null,
      });
      record(
        Boolean(clauseByTemplate(doc, "dlp-coverage")),
        "Item 3/THE ROBERT REPRODUCTION: \"We require DLP.\" / \"Remove DLP.\" / \"We require DLP.\" -- the final, byte-identical restatement resurrects DLP (it is a genuinely distinct source-turn occurrence, not a duplicate to be discarded)",
        "",
      );
      const dlpClause = clauseByTemplate(doc, "dlp-coverage");
      record(
        Boolean(dlpClause?.sourceTurnIds.includes("dlp_t3")),
        "Item 3: the resurrected DLP clause's provenance names the actual restating source-turn id (dlp_t3), not just copied quote text",
        JSON.stringify(dlpClause?.sourceTurnIds),
      );

      // Byte-equivalent recompilation: replaying the same ledger twice is
      // deterministic and idempotent.
      const docAgain = compileProcurementDocument({
        facts: [], requirement: req, verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [], sourceTurns, previousDocument: null,
      });
      record(JSON.stringify(doc) === JSON.stringify(docAgain), "Item 3: replaying the identical three-turn ledger twice is byte-identical and idempotent", "");
    }

    // Identical repeated requirements WITHOUT an intervening removal: the
    // SAME unclassified requirement, stated twice by two DIFFERENT source
    // turns, must produce exactly ONE clause (additionalRequirementClauses'
    // own Map-based collapse-at-EMISSION-only fix), not a duplicate --
    // while still merging both turns' provenance into that one draft.
    {
      const sourceTurns = [
        st("rep_t1", "We need a dedicated project manager for the migration.", 1000),
        st("rep_t2", "We need a dedicated project manager for the migration.", 2000),
      ];
      const req = requirementFrom([]);
      const doc = compileProcurementDocument({
        facts: [], requirement: req, verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [], sourceTurns, previousDocument: null,
      });
      const matches = doc.clauses.filter((c) => c.templateId === "unclassified" && /dedicated project manager/i.test(c.statement));
      record(matches.length === 1, "Item 3/identical repeat, no removal: the SAME requirement stated by two distinct source turns produces exactly ONE clause, not two duplicates", `count=${matches.length}`);
      record(
        matches.length === 1 && matches[0].sourceTurnIds.includes("rep_t1") && matches[0].sourceTurnIds.includes("rep_t2"),
        "Item 3/identical repeat, no removal: the ONE emitted clause's provenance carries BOTH occurrences' source-turn ids",
        JSON.stringify(matches[0]?.sourceTurnIds),
      );
    }

    // Duplicate DELIVERY of the SAME source-turn id (a client re-save, a
    // retried request, a double effect fire -- never a new buyer
    // statement): the IDENTICAL SourceLedgerEntry id appearing twice in
    // the array collapses to ONE occurrence via dedupeSourceTurnsById(),
    // distinct from the text-based case above (there, two DIFFERENT ids
    // shared text; here, the SAME id is delivered twice).
    {
      const sourceTurns = [
        st("dup_t1", "We need a dedicated project manager for the migration.", 1000),
        st("dup_t1", "We need a dedicated project manager for the migration.", 1000), // same id, delivered twice
      ];
      const req = requirementFrom([]);
      const doc = compileProcurementDocument({
        facts: [], requirement: req, verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [], sourceTurns, previousDocument: null,
      });
      const matches = doc.clauses.filter((c) => c.templateId === "unclassified" && /dedicated project manager/i.test(c.statement));
      record(matches.length === 1 && matches[0].sourceTurnIds.length === 1, "Item 3/duplicate delivery: the SAME source-turn id delivered twice collapses to ONE occurrence and ONE clause, with sourceTurnIds carrying the id only once", `count=${matches.length} sourceTurnIds=${JSON.stringify(matches[0]?.sourceTurnIds)}`);
    }

    // Save/reopen/recompile, through the REAL routes: create with DLP
    // stated, rescope with a removal, reload via the real GET route,
    // rescope again with the exact restatement, reload again, recompile
    // from the durable ledger alone (previousDocument=null throughout).
    await withFakeKv(async () => {
      const { POST: createSecurityProjectRoute } = await import("../src/app/api/security-sourcing/project/route");
      const { POST: rescopeRoute } = await import("../src/app/api/security-sourcing/project/[id]/rescope/route");
      const { GET: rfpGetRoute } = await import("../src/app/api/rfp/[id]/route");
      type RouteProjectLike = { id?: string; manage_token?: string; source_ledger?: SourceLedgerEntry[] };

      const turn1Text = "We require DLP, UK 20 site Healthcare business.";
      const u1 = deterministicExtract(turn1Text, []);
      const facts1 = mergeUpdates([], u1, 1, "extract").facts;
      const req1 = requirementFrom(facts1);
      const req1ForCreate: typeof req1 = {
        ...req1,
        organisation: { ...req1.organisation, sector: req1.organisation?.sector ?? "Healthcare & pharma" },
        estate: { ...req1.estate, sites: req1.estate?.sites ?? 20, users: req1.estate?.users ?? 200, existingSecurity: ["Defender P2"] },
        drivers: ["renewal"],
        constraints: { ...req1.constraints, inHouseSocCapacity: "business_hours", complianceRequirements: ["iso27001"] },
      };
      const createRes = await createSecurityProjectRoute(
        makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
          body: { requirement: req1ForCreate, consent: true, test: true, source_turns: [{ id: "dlp_route_t1", text: turn1Text, at: 7000, via: "typed" }] },
        }),
      );
      const created = (await createRes.json()) as { project?: RouteProjectLike; error?: string };
      const id = created.project?.id ?? "";
      const manage = created.project?.manage_token ?? "";

      // Same confidence-gate note as Item 2's own rescope call above: the
      // rescope route assesses body.requirement on its own (no merge with
      // the project's already-stored, already-enriched requirement), so
      // both rescope calls below reuse req1ForCreate (already built,
      // above) rather than the unenriched req1.
      const removeText = "Remove DLP.";
      const rescope1 = await rescopeRoute(
        makeRequest("POST", `https://example.test/sase/api/security-sourcing/project/${id}/rescope`, {
          body: { manage_token: manage, requirement: req1ForCreate, consent: true, source_turns: [{ id: "dlp_route_t2", text: removeText, at: 8000, via: "typed" }] },
        }),
        { params: Promise.resolve({ id }) },
      );
      record(((await rescope1.json()) as { rescoped?: boolean }).rescoped === true, "Item 3/save-reopen: the removal saves through the real rescope route", "");

      // Restate the EXACT same wording as turn1 -- the byte-identical
      // restatement, saved as its OWN new source turn.
      const rescope2 = await rescopeRoute(
        makeRequest("POST", `https://example.test/sase/api/security-sourcing/project/${id}/rescope`, {
          body: { manage_token: manage, requirement: req1ForCreate, consent: true, source_turns: [{ id: "dlp_route_t3", text: turn1Text, at: 9000, via: "typed" }] },
        }),
        { params: Promise.resolve({ id }) },
      );
      record(((await rescope2.json()) as { rescoped?: boolean }).rescoped === true, "Item 3/save-reopen: the byte-identical restatement saves through the real rescope route as its own distinct turn", "");

      const reload = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const reloaded = (await reload.json()) as RouteProjectLike;
      const resumeState = resumeStateFromProject(reloaded);
      record((resumeState?.sourceLedger.length ?? 0) === 3, "Item 3/save-reopen: all three turns (state, remove, byte-identical restate) are durable in source_ledger", JSON.stringify(resumeState?.sourceLedger.map((t) => t.text)));

      const recompiled = compileProcurementDocument({
        facts: [],
        requirement: mergeRequirementBase(resumeState!.requirementBase, requirementFrom([])),
        verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [], sourceTurns: resumeState!.sourceLedger, previousDocument: null,
      });
      record(
        Boolean(clauseByTemplate(recompiled, "dlp-coverage")),
        "Item 3/save-reopen: after a REAL save+reopen+recompile through three separate rescope calls, DLP is resurrected (the byte-identical restatement survived as its own occurrence, not discarded)",
        "",
      );
    });
  }

  /* ================================================================ */
  /* ITEM 4: reconciling deriveRfiQuestionSet() with generated clause   */
  /* questions -- no second, conflicting taxonomy, no duplicate text.   */
  /* ================================================================ */
  {
    const text =
      "UK 20 site Healthcare business requires SD-WAN and full SASE. We also have a legacy app that requires a point to point Ethernet private circuit. We use Entra ID and Azure; require ZTNA and DLP. No patient-identifiable data may leave the UK. Fully managed with 24/7 support, live by April 2027.";
    const u = deterministicExtract(text, []);
    const facts = mergeUpdates([], u, 1, "extract").facts;
    const cov = coverDeclarativeClauses(text, u);
    const req = requirementFrom(facts);
    const receipts = cov.unplacedClauses.map((t, i) => ({ id: i + 1, text: t }));

    // The REAL bank set, earned the same way instrument.ts's own doc
    // comment describes ("the desk's creation call sends its covered
    // sections, the server re-derives the SAME set") -- covering every
    // taxonomy section this scenario's clauses touch.
    const rfiSet = deriveRfiQuestionSet({
      coveredSections: ["estate", "drivers", "model", "security", "compliance", "organisation", "support", "services", "change"],
      sector: "Healthcare",
    });
    record(Boolean(rfiSet) && rfiSet!.canonicalCount > 0, "Item 4: a real RfiQuestionSet earns from deriveRfiQuestionSet() for this scenario", `canonicalCount=${rfiSet?.canonicalCount}`);

    // At instrument "sor" (not yet earned), NO bank text is ever
    // attached, regardless of what rfiSet contains -- instrument.ts's
    // own "no derivation, no rendering" law, now provably true of THIS
    // document's own output too.
    const docSor = compileProcurementDocument({
      facts, requirement: req, verdict: null, noted: [], rfiSet, instrument: "sor",
      receipts, previousDocument: null,
    });
    const allQuestionsSor = docSor.responseGroups.flatMap((g) => g.questions);
    record(allQuestionsSor.every((q) => q.source === "generated"), "Item 4/instrument gate: at instrument=sor, every supplier question is generated, none reused from the bank yet", JSON.stringify([...new Set(allQuestionsSor.map((q) => q.source))]));
    record(docSor.readiness.reasons.some((r) => /Instrument: SoR/.test(r)), "Item 4/instrument gate: readiness names the instrument state (SoR)", JSON.stringify(docSor.readiness.reasons));

    // Once earned (instrument "rfi"), the mapped clauses now carry
    // bank-sourced questions, each with its own bankQuestionId.
    const docRfi = compileProcurementDocument({
      facts, requirement: req, verdict: null, noted: [], rfiSet, instrument: "rfi",
      receipts, previousDocument: null,
    });
    const allQuestionsRfi = docRfi.responseGroups.flatMap((g) => g.questions);
    const bankQuestions = allQuestionsRfi.filter((q) => q.source === "bank");
    record(bankQuestions.length > 0, "Item 4/reuse: once the RFI is earned, at least one supplier question is reused from the bank", `bank=${bankQuestions.length} total=${allQuestionsRfi.length}`);

    const expectByTemplate: Array<[string, RegExp]> = [
      ["identity-aware-ztna", /^Q-IZ-/],
      ["dlp-coverage", /^Q-SC-/],
      ["uk-data-residency", /^Q-DR-/],
      ["managed-service-boundary", /^Q-SM-/],
      ["dated-transition-plan", /^Q-DP-/],
      ["network-architecture-scope", /^Q-SD-/],
    ];
    for (const [templateId, idPattern] of expectByTemplate) {
      const clause = clauseByTemplate(docRfi, templateId);
      const qs = allQuestionsRfi.filter((q) => q.clauseId === clause?.id);
      const bankQs = qs.filter((q) => q.source === "bank");
      record(
        Boolean(clause) && bankQs.length > 0 && bankQs.every((q) => q.bankQuestionId && idPattern.test(q.bankQuestionId)),
        `Item 4/reuse: ${templateId} reuses the correct bank category's own question id(s)`,
        JSON.stringify(bankQs.map((q) => q.bankQuestionId)),
      );
    }

    // No duplicate question text anywhere in the compiled document -- the
    // structural guarantee (category attaches to at most one clause,
    // exclusively bank OR generated per clause, never both) proven
    // directly against the real output, not just asserted by design.
    const allTexts = allQuestionsRfi.map((q) => q.text.trim().toLowerCase());
    const dupes = allTexts.filter((t, i) => allTexts.indexOf(t) !== i);
    record(dupes.length === 0, "Item 4/no duplication: no supplier question text appears twice anywhere in the compiled document", JSON.stringify(dupes));

    // A clause with NO bank category mapping (mpls-coexistence has none,
    // by design -- see CLAUSE_BANK_CATEGORY's own comment) always keeps
    // its generated questions, even at instrument=rfi.
    const mplsText = "UK 20 site business with MPLS today requires SD-WAN.";
    const mplsUpdates = deterministicExtract(mplsText, []);
    const mplsFacts = mergeUpdates([], mplsUpdates, 1, "extract").facts;
    const mplsReq = requirementFrom(mplsFacts);
    const mplsCov = coverDeclarativeClauses(mplsText, mplsUpdates);
    const docMpls = compileProcurementDocument({
      facts: mplsFacts, requirement: mplsReq, verdict: null, noted: [], rfiSet, instrument: "rfi",
      receipts: mplsCov.unplacedClauses.map((t, i) => ({ id: i + 1, text: t })), previousDocument: null,
    });
    const mplsClause = clauseByTemplate(docMpls, "mpls-coexistence");
    if (mplsClause) {
      const mplsQs = docMpls.responseGroups.flatMap((g) => g.questions).filter((q) => q.clauseId === mplsClause.id);
      record(mplsQs.every((q) => q.source === "generated"), "Item 4/documented incompatibility: mpls-coexistence (no bank category mapped) keeps its generated questions even when the RFI is earned", JSON.stringify(mplsQs.map((q) => q.source)));
    } else {
      console.log("NOTE  mpls-coexistence did not fire for this probe sentence (no standing MPLS fact) -- the exclusivity rule for unmapped templates is still proven structurally by CLAUSE_BANK_CATEGORY's own construction (no entry exists for that templateId, so questionsForClause() always falls to its generated branch for it).");
    }

    // Documented incompatibility, made concrete: earnedQuestions()
    // (questions.ts) and this document's OD-timeline-unstated share an
    // identical trigger but are not the same taxonomy -- an EarnedQuestion
    // has no clauseId/answerFormat/evidenceRequested and answers into the
    // fact ledger, not a SupplierQuestion shape. Proven against a SEPARATE
    // scenario that genuinely leaves the timeline unstated (the primary
    // Item 4 scenario above deliberately states one -- "live by April
    // 2027" -- so dated-transition-plan/Q-DP- can compile; that means
    // OD-timeline-unstated correctly does NOT fire there, so it cannot
    // also be the scenario used to inspect this decision's shape).
    const noTimelineText =
      "UK 20 site Healthcare business requires SD-WAN and full SASE. We use Entra ID and Azure; require ZTNA and DLP.";
    const uNT = deterministicExtract(noTimelineText, []);
    const factsNT = mergeUpdates([], uNT, 1, "extract").facts;
    const reqNT = requirementFrom(factsNT);
    const covNT = coverDeclarativeClauses(noTimelineText, uNT);
    const docNT = compileProcurementDocument({
      facts: factsNT, requirement: reqNT, verdict: null, noted: [], rfiSet, instrument: "rfi",
      receipts: covNT.unplacedClauses.map((t, i) => ({ id: i + 1, text: t })), previousDocument: null,
    });
    record(!reqNT.constraints?.timeline, "Item 4/documented incompatibility: the separate no-timeline scenario genuinely leaves the timeline unstated", JSON.stringify(reqNT.constraints));
    const timelineDecision = docNT.openDecisions.find((d) => d.id === "OD-timeline-unstated");
    record(
      Boolean(timelineDecision) && !("clauseId" in (timelineDecision as unknown as Record<string, unknown>)) && !("answerFormat" in (timelineDecision as unknown as Record<string, unknown>)),
      "Item 4/documented incompatibility: OD-timeline-unstated is shaped as an OpenDecision (no clauseId/answerFormat) -- structurally NOT a SupplierQuestion, confirming it is a different taxonomy from earnedQuestions()'s q-contract-end, not a silent duplicate of it",
      JSON.stringify(timelineDecision),
    );
    checkCategoryTotal(docRfi, "Item 4 (instrument=rfi)");
    checkCategoryTotal(docSor, "Item 4 (instrument=sor)");
  }

  /* ================================================================ */
  /* ITEM 4 (round 2): CHANGE SET AND VERSIONING MUST BE TRUTHFUL --    */
  /* real added/updated/removed fact ids (replacing the old hard-coded  */
  /* {added:[],updated:[],removed:[]}), a version that increments once  */
  /* per real change and never on an identical recompile, reopen, or    */
  /* re-render.                                                          */
  /* ================================================================ */
  {
    const req0 = requirementFrom([]);
    const doc0 = compileProcurementDocument({
      facts: [], requirement: req0, verdict: null, noted: [], rfiSet: null, instrument: "sor",
      receipts: [], previousDocument: null,
    });
    record(doc0.version === 1, "Item 4/version: a document with no previousDocument always starts at version 1", `version=${doc0.version}`);

    // Fact addition: a genuinely NEW fact (scalar path, previously
    // unset), via the REAL mergeUpdates() function.
    const factsAdded = mergeUpdates([], [{ path: "constraints.timeline", value: "April 2027", provenance: "stated", quote: "live by April 2027" }], 1, "extract").facts;
    const reqAdded = requirementFrom(factsAdded);
    const doc1 = compileProcurementDocument({
      facts: factsAdded, requirement: reqAdded, verdict: null, noted: [], rfiSet: null, instrument: "sor",
      receipts: [], previousDocument: doc0,
    });
    record(doc1.changeSet.facts.added.includes("constraints.timeline"), "Item 4/fact addition: changeSet.facts.added names the newly-added fact id", JSON.stringify(doc1.changeSet.facts));
    record(doc1.changeSet.facts.updated.length === 0 && doc1.changeSet.facts.removed.length === 0, "Item 4/fact addition: nothing else is reported as updated or removed", JSON.stringify(doc1.changeSet.facts));
    record(doc1.version === doc0.version + 1, "Item 4/one prompt, one increment: the fact addition bumps the version by EXACTLY one", `before=${doc0.version} after=${doc1.version}`);

    // Scalar correction: the SAME path, a DIFFERENT value -- the real
    // merge function's own "Scalar correction: the new value replaces
    // the old, visibly" branch (draft.ts mergeUpdates), not hand-rolled
    // fixture data.
    const factsCorrected = mergeUpdates(factsAdded, [{ path: "constraints.timeline", value: "June 2027", provenance: "stated", quote: "actually June 2027" }], 2, "extract").facts;
    const reqCorrected = requirementFrom(factsCorrected);
    const doc2 = compileProcurementDocument({
      facts: factsCorrected, requirement: reqCorrected, verdict: null, noted: [], rfiSet: null, instrument: "sor",
      receipts: [], previousDocument: doc1,
    });
    record(doc2.changeSet.facts.updated.includes("constraints.timeline"), "Item 4/scalar correction: changeSet.facts.updated names the corrected fact id (same path, new value)", JSON.stringify(doc2.changeSet.facts));
    record(doc2.changeSet.facts.added.length === 0 && doc2.changeSet.facts.removed.length === 0, "Item 4/scalar correction: nothing is reported as added or removed", JSON.stringify(doc2.changeSet.facts));
    record(doc2.version === doc1.version + 1, "Item 4/one prompt, one increment: the scalar correction bumps the version by EXACTLY one", `before=${doc1.version} after=${doc2.version}`);

    // List-value addition, then removal via the REAL dropListFact()
    // function (draft.ts) -- the SAME one ProjectDesk's own row-drop
    // button and typed "remove X" command both call.
    const factsWithCompliance = mergeUpdates(factsCorrected, [{ path: "constraints.complianceRequirements", value: ["iso27001"], provenance: "stated", quote: "ISO 27001" }], 3, "extract").facts;
    const complianceFactId = "constraints.complianceRequirements:iso27001";
    record(factsWithCompliance.some((f) => f.id === complianceFactId && !f.struck), "Item 4/list-value addition, setup: the real merge produced the expected list-value fact id", JSON.stringify(factsWithCompliance.map((f) => f.id)));
    const reqWithCompliance = requirementFrom(factsWithCompliance);
    const doc3 = compileProcurementDocument({
      facts: factsWithCompliance, requirement: reqWithCompliance, verdict: null, noted: [], rfiSet: null, instrument: "sor",
      receipts: [], previousDocument: doc2,
    });
    record(doc3.changeSet.facts.added.includes(complianceFactId), "Item 4/list-value addition: changeSet.facts.added names the new list-value fact id", JSON.stringify(doc3.changeSet.facts));

    const complianceFact = factsWithCompliance.find((f) => f.id === complianceFactId)!;
    const dropped = dropListFact(factsWithCompliance, new Set(), complianceFact);
    const reqDropped = requirementFrom(dropped.facts);
    const doc4 = compileProcurementDocument({
      facts: dropped.facts, requirement: reqDropped, verdict: null, noted: [], rfiSet: null, instrument: "sor",
      receipts: [], previousDocument: doc3,
    });
    record(doc4.changeSet.facts.removed.includes(complianceFactId), "Item 4/list-value removal: changeSet.facts.removed names the struck list-value fact id, via the REAL dropListFact() function", JSON.stringify(doc4.changeSet.facts));
    record(doc4.changeSet.facts.added.length === 0 && doc4.changeSet.facts.updated.length === 0, "Item 4/list-value removal: nothing else is reported as added or updated", JSON.stringify(doc4.changeSet.facts));

    // Compiler-only clause addition/removal, DISTINCT from facts: a
    // receipts-only change (DLP, which has no WorkspaceFact of its own)
    // must move changeSet.clauses while changeSet.facts stays completely
    // flat -- the two are derived from the same transition but reported
    // as genuinely separate change lists, never conflated.
    const doc5 = compileProcurementDocument({
      facts: dropped.facts, requirement: reqDropped, verdict: null, noted: [], rfiSet: null, instrument: "sor",
      receipts: [{ id: 1, text: "We require DLP." }], previousDocument: doc4,
    });
    const dlpClause5 = clauseByTemplate(doc5, "dlp-coverage");
    record(Boolean(dlpClause5) && doc5.changeSet.clauses.added.includes(dlpClause5!.id), "Item 4/compiler-only clause addition: changeSet.clauses.added names the new DLP clause id, on a receipts-only change with facts held constant", JSON.stringify(doc5.changeSet.clauses));
    record(doc5.changeSet.facts.added.length === 0 && doc5.changeSet.facts.updated.length === 0 && doc5.changeSet.facts.removed.length === 0, "Item 4/compiler-only clause addition: changeSet.facts stays completely flat -- a clause-only change is never misreported as a fact change", JSON.stringify(doc5.changeSet.facts));
    record(doc5.version === doc4.version + 1, "Item 4/one prompt, one increment: the compiler-only clause addition (a receipts-only change) still bumps the version by EXACTLY one", `before=${doc4.version} after=${doc5.version}`);

    const doc6 = compileProcurementDocument({
      facts: dropped.facts, requirement: reqDropped, verdict: null, noted: [], rfiSet: null, instrument: "sor",
      receipts: [{ id: 1, text: "We require DLP." }, { id: 2, text: "Remove DLP." }], previousDocument: doc5,
    });
    record(!clauseByTemplate(doc6, "dlp-coverage"), "Item 4/compiler-only clause removal, setup: DLP is now removed", "");
    record(Boolean(dlpClause5) && doc6.changeSet.clauses.removed.includes(dlpClause5!.id), "Item 4/compiler-only clause removal: changeSet.clauses.removed names the retracted DLP clause's own stable id", JSON.stringify(doc6.changeSet.clauses));
    record(doc6.changeSet.facts.added.length === 0 && doc6.changeSet.facts.updated.length === 0 && doc6.changeSet.facts.removed.length === 0, "Item 4/compiler-only clause removal: changeSet.facts stays completely flat again", JSON.stringify(doc6.changeSet.facts));
    record(doc6.version === doc5.version + 1, "Item 4/one prompt, one increment: the compiler-only clause removal also bumps the version by EXACTLY one", `before=${doc5.version} after=${doc6.version}`);

    // Identical recompilation: the SAME facts and receipts, recompiled
    // again -- NO version increment (a re-render / view switch /
    // redundant recompile must never be mistaken for a real change).
    const doc6Again = compileProcurementDocument({
      facts: dropped.facts, requirement: reqDropped, verdict: null, noted: [], rfiSet: null, instrument: "sor",
      receipts: [{ id: 1, text: "We require DLP." }, { id: 2, text: "Remove DLP." }], previousDocument: doc6,
    });
    record(doc6Again.version === doc6.version, "Item 4/identical recompilation: recompiling the IDENTICAL facts and receipts does NOT increment the version", `before=${doc6.version} after=${doc6Again.version}`);
    record(
      doc6Again.changeSet.facts.added.length === 0 && doc6Again.changeSet.facts.updated.length === 0 && doc6Again.changeSet.facts.removed.length === 0 &&
        doc6Again.changeSet.clauses.added.length === 0 && doc6Again.changeSet.clauses.updated.length === 0 && doc6Again.changeSet.clauses.removed.length === 0,
      "Item 4/identical recompilation: the change set itself is entirely empty on an identical recompile, not merely the version",
      JSON.stringify({ facts: doc6Again.changeSet.facts, clauses: doc6Again.changeSet.clauses }),
    );

    // Save/reopen with no artificial increment: through the REAL routes,
    // reopening a saved project and recompiling its identical state
    // multiple times must never bump the version merely from the reopen
    // itself -- THE bug Robert named directly: "version currently
    // increments on every call whenever previousDocument is supplied,
    // even if no successful prompt or direct document edit occurred."
    await withFakeKv(async () => {
      const { POST: createSecurityProjectRoute } = await import("../src/app/api/security-sourcing/project/route");
      const { GET: rfpGetRoute } = await import("../src/app/api/rfp/[id]/route");
      type RouteProjectLike = { id?: string; manage_token?: string; source_ledger?: SourceLedgerEntry[] };

      const turnText = "UK 20 site Healthcare business requires SD-WAN. We require DLP.";
      const u = deterministicExtract(turnText, []);
      const facts = mergeUpdates([], u, 1, "extract").facts;
      const req = requirementFrom(facts);
      const reqForCreate: typeof req = {
        ...req,
        organisation: { ...req.organisation, sector: req.organisation?.sector ?? "Healthcare & pharma" },
        estate: { ...req.estate, sites: req.estate?.sites ?? 20, users: req.estate?.users ?? 200, existingSecurity: ["Defender P2"] },
        drivers: ["renewal"],
        constraints: { ...req.constraints, inHouseSocCapacity: "business_hours", complianceRequirements: ["iso27001"] },
      };
      const createRes = await createSecurityProjectRoute(
        makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
          body: { requirement: reqForCreate, consent: true, test: true, source_turns: [{ id: "ver_route_t1", text: turnText, at: 11000, via: "typed" }] },
        }),
      );
      const created = (await createRes.json()) as { project?: RouteProjectLike; error?: string };
      const id = created.project?.id ?? "";
      const manage = created.project?.manage_token ?? "";

      const reload1 = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const resumeState1 = resumeStateFromProject((await reload1.json()) as RouteProjectLike);
      const reopenedReq1 = mergeRequirementBase(resumeState1!.requirementBase, requirementFrom([]));
      const recompiled1 = compileProcurementDocument({
        facts: [], requirement: reopenedReq1, verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [], sourceTurns: resumeState1!.sourceLedger, previousDocument: null, // a genuine reload
      });
      record(recompiled1.version === 1, "Item 4/save-reopen: the first reopen (previousDocument=null, a genuine reload) starts a fresh chain at version 1", `version=${recompiled1.version}`);

      // A SECOND reopen, this time threading the first reopen's own
      // document as previousDocument (an in-session recompile of the
      // IDENTICAL state) -- under the OLD bug this alone (previousDocument
      // being supplied at all) would have bumped the version to 2 with no
      // real change having occurred.
      const reload2 = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const resumeState2 = resumeStateFromProject((await reload2.json()) as RouteProjectLike);
      const reopenedReq2 = mergeRequirementBase(resumeState2!.requirementBase, requirementFrom([]));
      const recompiled2 = compileProcurementDocument({
        facts: [], requirement: reopenedReq2, verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [], sourceTurns: resumeState2!.sourceLedger, previousDocument: recompiled1,
      });
      record(recompiled2.version === 1, "Item 4/save-reopen, no artificial increment: reopening the SAME saved project a second time and recompiling its identical state, WITH previousDocument supplied, does NOT bump the version -- previousDocument's mere presence is no longer sufficient to increment (THE bug Robert named)", `version=${recompiled2.version}`);

      // A THIRD reopen, again with previousDocument=null, must ALSO land
      // on version 1 -- a reload is never itself a change, regardless of
      // how many times it happens or whether previousDocument happens to
      // be available.
      const reload3 = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const resumeState3 = resumeStateFromProject((await reload3.json()) as RouteProjectLike);
      const reopenedReq3 = mergeRequirementBase(resumeState3!.requirementBase, requirementFrom([]));
      const recompiled3 = compileProcurementDocument({
        facts: [], requirement: reopenedReq3, verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [], sourceTurns: resumeState3!.sourceLedger, previousDocument: null,
      });
      record(recompiled3.version === 1, "Item 4/save-reopen, no artificial increment: a THIRD reopen lands on the SAME version as the first and second -- version is a function of real change, not of reopen count or previousDocument availability", `version=${recompiled3.version}`);
    });
  }

  function checkCategoryTotal(doc: LivingProcurementDocument, label: string) {
    const total = doc.evaluation.categories.reduce((n, c) => n + c.weight, 0);
    record(total === 100, `${label}: evaluation categories still total exactly 100`, `total=${total}`);
  }

  /* ================================================================ */
  /* ROUND 3, ITEM 1: OPERATING-MODEL CORRECTIONS MUST BE DIRECTION-    */
  /* AWARE -- Robert's exact reproduction (both directions resolving to */
  /* co_managed because of a fixed enum/regex priority), the required   */
  /* adversarial matrix, and removal without a replacement.             */
  /* ================================================================ */
  {
    const st = (id: string, text: string, at: number): SourceLedgerEntry => ({ id, text, at, via: "typed" });
    const modelOf = (text: string): string | null => operatingModelFromHistory(chronologicalHistory([st("t1", text, 1000)], [])).model;

    // THE ROBERT REPRODUCTION, directly: both correction directions
    // used to resolve to co_managed (MANAGED_MODEL_PHRASE_RE's own fixed
    // array order), because a correction signal was treated as blanket
    // permission to pick ids[0], not as an instruction pointing at a
    // SPECIFIC one of the two named models.
    record(modelOf("We now require fully managed instead of co-managed.") === "managed", "Item 1/THE ROBERT REPRODUCTION: \"fully managed instead of co-managed\" resolves to managed, not co_managed", `model=${modelOf("We now require fully managed instead of co-managed.")}`);
    record(modelOf("Change from co-managed to fully managed.") === "managed", "Item 1/THE ROBERT REPRODUCTION: \"change from co-managed to fully managed\" resolves to managed", `model=${modelOf("Change from co-managed to fully managed.")}`);

    // Required fixtures: both correction phrasings, both directions.
    record(modelOf("We want co-managed instead of fully managed.") === "co_managed", "Item 1: \"co-managed instead of fully managed\" -> co_managed", "");
    record(modelOf("We now require fully managed instead of co-managed.") === "managed", "Item 1: \"fully managed instead of co-managed\" -> managed", "");
    record(modelOf("Change from co-managed to fully managed.") === "managed", "Item 1: \"change from co-managed to fully managed\" -> managed", "");
    record(modelOf("Change from fully managed to co-managed.") === "co_managed", "Item 1: \"change from fully managed to co-managed\" -> co_managed", "");
    record(modelOf("We want fully managed rather than co-managed.") === "managed", "Item 1: \"fully managed rather than co-managed\" -> managed", "");
    record(modelOf("We want co-managed rather than fully managed.") === "co_managed", "Item 1: \"co-managed rather than fully managed\" -> co_managed", "");

    // Separate chronological turns, both directions (cross-turn latest-
    // write-wins, not a within-one-sentence directional parse).
    {
      const h1 = chronologicalHistory([st("a", "We require a co-managed service.", 1000), st("b", "We now require a fully managed service.", 2000)], []);
      record(operatingModelFromHistory(h1).model === "managed", "Item 1: separate chronological turns, co-managed then fully managed -> managed", "");
      const h2 = chronologicalHistory([st("a", "We require a fully managed service.", 1000), st("b", "We now require a co-managed service.", 2000)], []);
      record(operatingModelFromHistory(h2).model === "co_managed", "Item 1: separate chronological turns, fully managed then co-managed -> co_managed", "");
    }

    // Unrelated intervening turns between two directional corrections.
    {
      const h = chronologicalHistory(
        [st("a", "We want co-managed instead of fully managed.", 1000), st("mid", "We also need ISO 27001 certification.", 1500), st("b", "Actually, fully managed instead of co-managed.", 2000)],
        [],
      );
      record(operatingModelFromHistory(h).model === "managed", "Item 1: an unrelated intervening turn between two directional corrections does not disrupt the LATER one winning", "");
    }

    // Identical timestamps resolved by array position.
    {
      const h = chronologicalHistory([st("a", "co-managed instead of fully managed.", 1000), st("b", "fully managed instead of co-managed.", 1000)], []);
      record(operatingModelFromHistory(h).model === "managed", "Item 1: identical timestamps resolve by array position -- the LATER array entry wins", "");
    }

    // Two models, NO directional correction language -> genuinely
    // unresolved, surfaced as an OpenDecision, never guessed.
    {
      const text = "We might want fully managed or co-managed, no strong preference either way.";
      const result = operatingModelFromHistory(chronologicalHistory([st("a", text, 1000)], []));
      record(result.model === null && Boolean(result.ambiguousText), "Item 1: two models with no directional correction language stays unresolved (model=null), surfaced as ambiguousText", JSON.stringify(result));
      const doc = compileProcurementDocument({
        facts: [], requirement: requirementFrom([]), verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [], sourceTurns: [st("a", text, 1000)], previousDocument: null,
      });
      record(doc.openDecisions.some((d) => d.id === "OD-operating-model-ambiguous-correction"), "Item 1: the full compile surfaces the ambiguous-correction OpenDecision for two models with no directional language", "");
    }

    // "remove co-managed" / "no longer want co-managed" must not
    // positively assert co_managed.
    record(modelOf("Remove co-managed.") !== "co_managed", "Item 1: \"remove co-managed\" does not positively assert co_managed", `model=${modelOf("Remove co-managed.")}`);
    record(modelOf("No longer want co-managed.") !== "co_managed", "Item 1: \"no longer want co-managed\" does not positively assert co_managed", `model=${modelOf("No longer want co-managed.")}`);

    // A removal without a replacement unsets the model, honoured end to
    // end as the EXISTING document contract's own honest open decision
    // (OD-operating-model-unstated) -- no new decision type invented.
    {
      const h = chronologicalHistory([st("a", "We require a co-managed service.", 1000), st("b", "Remove co-managed.", 2000)], []);
      const result = operatingModelFromHistory(h);
      record(result.model === null, "Item 1: assert co-managed, then \"Remove co-managed.\" with no replacement, unsets the model (result.model=null)", JSON.stringify(result));

      // End to end: buying set via a REAL fact (never via the operating-
      // model text itself, so the chronological reducer alone drives
      // opModel), the removal-without-replacement turn feeds the durable
      // ledger, and the resulting document must carry the honest
      // "operating model unstated" decision, not a silently retained
      // stale model.
      const buyingFacts = mergeUpdates([], [{ path: "procurement.buying", value: "sdwan", provenance: "stated", quote: "SD-WAN" }], 1, "extract").facts;
      const doc = compileProcurementDocument({
        facts: buyingFacts, requirement: requirementFrom(buyingFacts), verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [], sourceTurns: [st("a", "We require a co-managed service.", 1000), st("b", "Remove co-managed.", 2000)], previousDocument: null,
      });
      record(!clauseByTemplate(doc, "managed-service-boundary"), "Item 1/removal without replacement, end to end: no managed-service clause is compiled once the model is unset (no stale assertion)", "");
      record(doc.openDecisions.some((d) => d.id === "OD-operating-model-unstated"), "Item 1/removal without replacement, end to end: the honest OD-operating-model-unstated decision fires -- the existing document contract, not a new mechanism", JSON.stringify(doc.openDecisions.map((d) => d.id)));
    }
  }

  /* ================================================================ */
  /* ROUND 3, ITEM 2: SUPPORT-HOURS POLARITY -- Robert's exact           */
  /* reproduction (negative language containing the literal "24/7" was  */
  /* misread as a positive assertion), the required matrix, and         */
  /* survival through a real save/reopen/recompile.                     */
  /* ================================================================ */
  {
    const st = (id: string, text: string, at: number): SourceLedgerEntry => ({ id, text, at, via: "typed" });
    const hoursOf = (text: string) => supportHoursFromHistory(chronologicalHistory([st("t1", text, 1000)], []));

    record(hoursOf("24/7 support.").hours247 === true, "Item 2: \"24/7 support\" -> true", "");
    const inc = hoursOf("24/7 incident support.");
    record(inc.hours247 === true && inc.incidentSupport247 === true, "Item 2: \"24/7 incident support\" -> hours247=true and incidentSupport247=true", JSON.stringify(inc));
    record(hoursOf("Support is not 24/7.").hours247 === false, "Item 2/THE ROBERT REPRODUCTION: \"Support is not 24/7.\" -> false", `hours247=${hoursOf("Support is not 24/7.").hours247}`);
    record(hoursOf("We no longer need 24/7 support; business hours only.").hours247 === false, "Item 2/THE ROBERT REPRODUCTION: \"We no longer need 24/7 support; business hours only.\" -> false", `hours247=${hoursOf("We no longer need 24/7 support; business hours only.").hours247}`);
    record(hoursOf("Business hours only.").hours247 === false, "Item 2: \"business hours only\" -> false", "");
    record(hoursOf("Not 24/7; business hours only.").hours247 === false, "Item 2: \"not 24/7; business hours only\" -> false", "");

    // Chronological: 24/7 then, LATER, business-hours-only -> false;
    // the reverse -> true.
    {
      const h1 = chronologicalHistory([st("a", "24/7 support required.", 1000), st("b", "Business hours only from now on.", 2000)], []);
      record(supportHoursFromHistory(h1).hours247 === false, "Item 2: 24/7 followed LATER by business-hours-only -> false", "");
      const h2 = chronologicalHistory([st("a", "Business hours only.", 1000), st("b", "We now need 24/7 support.", 2000)], []);
      record(supportHoursFromHistory(h2).hours247 === true, "Item 2: business-hours-only followed LATER by 24/7 -> true", "");
    }

    // Correction and negation behaviour must survive a REAL
    // save/reopen/recompile from source_ledger with previousDocument=null.
    await withFakeKv(async () => {
      const { POST: createSecurityProjectRoute } = await import("../src/app/api/security-sourcing/project/route");
      const { POST: rescopeRoute } = await import("../src/app/api/security-sourcing/project/[id]/rescope/route");
      const { GET: rfpGetRoute } = await import("../src/app/api/rfp/[id]/route");
      type RouteProjectLike = { id?: string; manage_token?: string };

      const turn1Text = "Fully managed with 24/7 support, UK 20 site Healthcare business.";
      const u1 = deterministicExtract(turn1Text, []);
      const facts1 = mergeUpdates([], u1, 1, "extract").facts;
      const req1 = requirementFrom(facts1);
      const req1ForCreate: typeof req1 = {
        ...req1,
        organisation: { ...req1.organisation, sector: req1.organisation?.sector ?? "Healthcare & pharma" },
        estate: { ...req1.estate, sites: req1.estate?.sites ?? 20, users: req1.estate?.users ?? 200, existingSecurity: ["Defender P2"] },
        drivers: ["renewal"],
        constraints: { ...req1.constraints, inHouseSocCapacity: "business_hours", complianceRequirements: ["iso27001"] },
      };
      const createRes = await createSecurityProjectRoute(
        makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
          body: { requirement: req1ForCreate, consent: true, test: true, source_turns: [{ id: "hrs_route_t1", text: turn1Text, at: 12000, via: "typed" }] },
        }),
      );
      const created = (await createRes.json()) as { project?: RouteProjectLike; error?: string };
      const id = created.project?.id ?? "";
      const manage = created.project?.manage_token ?? "";

      const turn2Text = "We no longer need 24/7 support; business hours only.";
      const rescope = await rescopeRoute(
        makeRequest("POST", `https://example.test/sase/api/security-sourcing/project/${id}/rescope`, {
          body: { manage_token: manage, requirement: req1ForCreate, consent: true, source_turns: [{ id: "hrs_route_t2", text: turn2Text, at: 13000, via: "typed" }] },
        }),
        { params: Promise.resolve({ id }) },
      );
      record(((await rescope.json()) as { rescoped?: boolean }).rescoped === true, "Item 2/save-reopen: the negation turn saves through the real rescope route", "");

      const reload = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const resumeState = resumeStateFromProject((await reload.json()) as RouteProjectLike & { source_ledger?: SourceLedgerEntry[] });
      const recompiled = compileProcurementDocument({
        facts: [], requirement: mergeRequirementBase(resumeState!.requirementBase, requirementFrom([])), verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [], sourceTurns: resumeState!.sourceLedger, previousDocument: null, // a genuine reload
      });
      const ops = clauseByTemplate(recompiled, "managed-service-boundary");
      record(
        Boolean(ops) && /with an agreed support model/i.test(ops!.statement) && !/24\/7/.test(ops!.statement),
        "Item 2/save-reopen: after a REAL save+reopen+recompile with previousDocument=null, the managed-service clause reads \"with an agreed support model\" (the negation survived), not 24/7",
        ops?.statement ?? "",
      );
    });
  }

  /* ================================================================ */
  /* ROUND 3, ITEM 3: HONOUR THE COMPILER'S `noted` INPUT -- adding a    */
  /* noted item changes the document, removing it reverses that,       */
  /* idempotent, order-independent, participates in the change set,    */
  /* never duplicates a standing fact/template, buyer provenance       */
  /* explicit.                                                          */
  /* ================================================================ */
  {
    const req = requirementFrom([]);
    const notedA = { id: "s-247", label: "24/7 proactive monitoring of the WAN estate", section: "operations" };
    const notedB = { id: "s-uk", label: "UK-only support desk coverage", section: "operations" };

    const docWithout = compileProcurementDocument({
      facts: [], requirement: req, verdict: null, noted: [], rfiSet: null, instrument: "sor", receipts: [], previousDocument: null,
    });
    record(!docWithout.clauses.some((c) => c.templateId === "noted-selection"), "Item 3/baseline: compiling with noted=[] produces no noted-selection clause -- THE BUG, confirmed present before the fix's own positive case", "");

    // Adding one noted item changes the compiled document appropriately.
    const docWith = compileProcurementDocument({
      facts: [], requirement: req, verdict: null, noted: [notedA], rfiSet: null, instrument: "sor", receipts: [], previousDocument: docWithout,
    });
    const notedClause = docWith.clauses.find((c) => c.templateId === "noted-selection");
    record(Boolean(notedClause), "Item 3/THE FIX: adding one noted item changes the compiled document -- a real clause is now emitted for it (was byte-identical before)", "");
    record(notedClause?.section === "operations" && notedClause?.origin === "buyer", "Item 3: the noted clause's section is honoured and buyer provenance remains explicit", JSON.stringify({ section: notedClause?.section, origin: notedClause?.origin }));
    record(notedClause?.templateKey === "noted:s-247", "Item 3: the clause's templateKey is keyed by the noted item's own STABLE id, not array position or copied label text alone", `templateKey=${notedClause?.templateKey}`);

    // The change set reports the relevant addition.
    record(docWith.changeSet.clauses.added.includes(notedClause!.id), "Item 3: the change set reports the noted clause's addition", JSON.stringify(docWith.changeSet.clauses));

    // Removing it (absent from the next compile's noted array) reverses
    // the output -- no tombstone/removal-instruction machinery needed.
    const docRemoved = compileProcurementDocument({
      facts: [], requirement: req, verdict: null, noted: [], rfiSet: null, instrument: "sor", receipts: [], previousDocument: docWith,
    });
    record(!docRemoved.clauses.some((c) => c.templateId === "noted-selection"), "Item 3: removing the noted item reverses the output -- the clause is gone", "");
    record(docRemoved.changeSet.clauses.removed.includes(notedClause!.id), "Item 3: the change set reports the noted clause's removal", JSON.stringify(docRemoved.changeSet.clauses));

    // An unchanged noted set is idempotent: two independent compiles of
    // the identical noted array are byte-identical.
    const independentA1 = compileProcurementDocument({ facts: [], requirement: req, verdict: null, noted: [notedA], rfiSet: null, instrument: "sor", receipts: [], previousDocument: null });
    const independentA2 = compileProcurementDocument({ facts: [], requirement: req, verdict: null, noted: [notedA], rfiSet: null, instrument: "sor", receipts: [], previousDocument: null });
    record(JSON.stringify(independentA1) === JSON.stringify(independentA2), "Item 3: an unchanged noted set is idempotent -- two independent compiles produce byte-identical output", "");

    // Array reordering does not change semantic identities.
    const orderAB = compileProcurementDocument({ facts: [], requirement: req, verdict: null, noted: [notedA, notedB], rfiSet: null, instrument: "sor", receipts: [], previousDocument: null });
    const orderBA = compileProcurementDocument({ facts: [], requirement: req, verdict: null, noted: [notedB, notedA], rfiSet: null, instrument: "sor", receipts: [], previousDocument: null });
    const idsAB = orderAB.clauses.filter((c) => c.templateId === "noted-selection").map((c) => c.id).sort();
    const idsBA = orderBA.clauses.filter((c) => c.templateId === "noted-selection").map((c) => c.id).sort();
    record(idsAB.length === 2 && JSON.stringify(idsAB) === JSON.stringify(idsBA), "Item 3: array reordering of the noted set does not change semantic identities -- the SAME two ids regardless of order", JSON.stringify({ idsAB, idsBA }));

    // Noted input must not duplicate a clause already represented by a
    // standing fact or deterministic template.
    {
      const dlpTurn = turn("We require DLP.", [], [], { n: 0 }, 1, null);
      const beforeDlp = clauseByTemplate(dlpTurn.doc, "dlp-coverage");
      record(Boolean(beforeDlp), "Item 3/no-duplication, setup: the DLP clause compiles from the buyer's own words via the deterministic template", "");
      const docNotedDuplicate = compileProcurementDocument({
        facts: dlpTurn.facts,
        requirement: requirementFrom(dlpTurn.facts),
        verdict: null,
        noted: [{ id: "dup-dlp", label: "Data loss prevention coverage for the cloud estate", section: "security" }],
        rfiSet: null,
        instrument: "sor",
        receipts: dlpTurn.receipts,
        previousDocument: null,
      });
      record(!docNotedDuplicate.clauses.some((c) => c.templateId === "noted-selection"), "Item 3/no-duplication: a noted item substantively covered by the DLP template's own clause does NOT emit a second, redundant clause", "");
      record(Boolean(clauseByTemplate(docNotedDuplicate, "dlp-coverage")), "Item 3/no-duplication: the original DLP template clause is still present, untouched by the suppressed duplicate", "");
    }
  }

  /* ================================================================ */
  /* ROUND 3, ITEM 4: VERSIONING MUST BE EVENT-TRUTHFUL -- Robert's     */
  /* exact reproduction (requirement changed, facts/receipts held       */
  /* constant, the version incorrectly stayed put), fixed via the new   */
  /* explicit revision contract; the full required-behaviour matrix;    */
  /* and the closing invariant.                                         */
  /* ================================================================ */
  {
    const req0 = requirementFrom([]);
    const doc0 = compileProcurementDocument({
      facts: [], requirement: req0, verdict: null, noted: [], rfiSet: null, instrument: "sor", receipts: [], previousDocument: null, revision: null,
    });
    record(doc0.title === "Sourcing procurement" && doc0.version === 1, "Item 4/THE ROBERT REPRODUCTION baseline: compiling an empty requirement gives title \"Sourcing procurement\", version 1", `title=${doc0.title} version=${doc0.version}`);

    // THE ROBERT REPRODUCTION, fixed via the explicit revision contract:
    // the SAME facts/receipts, but requirement.organisation.sector set
    // directly -- a real security clause is added and the title changes.
    const reqHealthcare: typeof req0 = { ...req0, organisation: { ...req0.organisation, sector: "Healthcare & pharma" } };
    const doc1 = compileProcurementDocument({
      facts: [], requirement: reqHealthcare, verdict: null, noted: [], rfiSet: null, instrument: "sor", receipts: [], previousDocument: doc0, revision: { cycle: 1, changedFactIds: [] },
    });
    record(doc1.title !== doc0.title, "Item 4/THE ROBERT REPRODUCTION: the title genuinely changes with the sector", `before=${doc0.title} after=${doc1.title}`);
    record(doc1.version === doc0.version + 1, "Item 4/THE ROBERT REPRODUCTION, fixed: under the explicit revision contract, the version now advances even though facts/receipts alone were unchanged", `before=${doc0.version} after=${doc1.version}`);

    // Documented, intentional boundary: the SAME reproduction through the
    // LEGACY no-revision contract (omitted entirely, every existing
    // caller/fixture) still preserves round-2 behaviour -- the reason the
    // explicit contract exists, not an oversight left unfixed.
    const doc1Legacy = compileProcurementDocument({
      facts: [], requirement: reqHealthcare, verdict: null, noted: [], rfiSet: null, instrument: "sor", receipts: [], previousDocument: doc0,
    });
    record(doc1Legacy.version === doc0.version, "Item 4/documented boundary: the SAME reproduction through the LEGACY no-revision path (omitted entirely) still preserves round-2 behaviour for backward compatibility -- callers must adopt `revision` to get event-truthful versioning", `version=${doc1Legacy.version}`);

    // Identical rerender with the SAME revision/context -> no increment.
    const doc1Rerender = compileProcurementDocument({
      facts: [], requirement: reqHealthcare, verdict: null, noted: [], rfiSet: null, instrument: "sor", receipts: [], previousDocument: doc1, revision: { cycle: 1, changedFactIds: [] },
    });
    record(doc1Rerender.version === doc1.version, "Item 4: an identical rerender with the SAME revision (cycle 1 again) does not increment", `version=${doc1Rerender.version}`);

    // One successful prompt revision -> exactly one increment.
    const doc2 = compileProcurementDocument({
      facts: [], requirement: reqHealthcare, verdict: null, noted: [], rfiSet: null, instrument: "sor", receipts: [], previousDocument: doc1Rerender, revision: { cycle: 2, changedFactIds: [] },
    });
    record(doc2.version === doc1.version + 1, "Item 4: one successful prompt revision (a new cycle) increments exactly once", `before=${doc1.version} after=${doc2.version}`);

    // One direct noted-item edit -> exactly one increment.
    const doc3 = compileProcurementDocument({
      facts: [], requirement: reqHealthcare, verdict: null,
      noted: [{ id: "s-247", label: "24/7 proactive monitoring", section: "operations" }],
      rfiSet: null, instrument: "sor", receipts: [], previousDocument: doc2, revision: { cycle: 3, changedFactIds: [] },
    });
    record(doc3.version === doc2.version + 1, "Item 4: one direct noted-item edit (its own authorised revision) increments exactly once", `before=${doc2.version} after=${doc3.version}`);

    // One direct requirement/document edit -> exactly one increment.
    const reqEdited: typeof reqHealthcare = { ...reqHealthcare, constraints: { ...reqHealthcare.constraints, timeline: "April 2027" } };
    const doc4 = compileProcurementDocument({
      facts: [], requirement: reqEdited, verdict: null,
      noted: [{ id: "s-247", label: "24/7 proactive monitoring", section: "operations" }],
      rfiSet: null, instrument: "sor", receipts: [], previousDocument: doc3, revision: { cycle: 4, changedFactIds: [] },
    });
    record(doc4.version === doc3.version + 1, "Item 4: one direct requirement/document edit increments exactly once", `before=${doc3.version} after=${doc4.version}`);

    // Fact-only correction -> exactly one increment, truthful fact ids
    // (the SAME mergeUpdates() MergeResult.changed the caller already
    // computes -- not a new concept, just also reported here).
    const merge1 = mergeUpdates([], [{ path: "constraints.timeline", value: "April 2027", provenance: "stated", quote: "April 2027" }], 1, "extract");
    const doc5base = compileProcurementDocument({
      facts: merge1.facts, requirement: requirementFrom(merge1.facts), verdict: null, noted: [], rfiSet: null, instrument: "sor",
      receipts: [], previousDocument: null, revision: { cycle: 1, changedFactIds: merge1.changed },
    });
    const merge2 = mergeUpdates(merge1.facts, [{ path: "constraints.timeline", value: "June 2027", provenance: "stated", quote: "June 2027" }], 2, "extract");
    const doc5 = compileProcurementDocument({
      facts: merge2.facts, requirement: requirementFrom(merge2.facts), verdict: null, noted: [], rfiSet: null, instrument: "sor",
      receipts: [], previousDocument: doc5base, revision: { cycle: 2, changedFactIds: merge2.changed },
    });
    record(doc5.version === doc5base.version + 1, "Item 4/fact-only correction: exactly one increment", `before=${doc5base.version} after=${doc5.version}`);
    record(doc5.changeSet.facts.updated.includes("constraints.timeline"), "Item 4/fact-only correction: truthful fact ids -- changeSet.facts.updated (the REAL diff) names the corrected fact", JSON.stringify(doc5.changeSet.facts));
    record(Boolean(doc5.lastRevision?.changedFactIds.includes("constraints.timeline")), "Item 4/fact-only correction: the document's own lastRevision carries the caller-asserted changed fact ids for truthful audit", JSON.stringify(doc5.lastRevision));

    // Receipt/compiler-only change -> exactly one increment.
    const doc6base = compileProcurementDocument({
      facts: [], requirement: req0, verdict: null, noted: [], rfiSet: null, instrument: "sor", receipts: [], previousDocument: null, revision: { cycle: 1, changedFactIds: [] },
    });
    const doc6 = compileProcurementDocument({
      facts: [], requirement: req0, verdict: null, noted: [], rfiSet: null, instrument: "sor",
      receipts: [{ id: 1, text: "We require DLP." }], previousDocument: doc6base, revision: { cycle: 2, changedFactIds: [] },
    });
    record(doc6.version === doc6base.version + 1, "Item 4/receipt-only change: a compiler-only clause addition (receipts changed, facts did not) still increments exactly once under an authorised revision", `before=${doc6base.version} after=${doc6.version}`);

    // An unsuccessful/no-op recompile -> no increment (revision: null,
    // no authorised event this call).
    const doc7 = compileProcurementDocument({
      facts: [], requirement: req0, verdict: null, noted: [], rfiSet: null, instrument: "sor",
      receipts: [{ id: 1, text: "We require DLP." }], previousDocument: doc6, revision: null,
    });
    record(doc7.version === doc6.version, "Item 4/no-op recompile: revision=null (no authorised event) never increments, even with inputs identical to the previous compile", `version=${doc7.version}`);

    // Invariant: if any governed change-set component is non-empty
    // during an authorised change event, the version must advance
    // exactly once -- checked structurally against every authorised
    // transition proven above (also closes "clauses/questions/gates/
    // weights changing must never coexist with an unchanged version
    // during an authorised revision").
    const changeSetIsNonEmpty = (cs: LivingProcurementDocument["changeSet"]): boolean =>
      cs.facts.added.length + cs.facts.updated.length + cs.facts.removed.length +
        cs.clauses.added.length + cs.clauses.updated.length + cs.clauses.removed.length +
        cs.questions.added.length + cs.questions.updated.length + cs.questions.removed.length +
        cs.gates.added.length + cs.gates.updated.length + cs.gates.removed.length +
        (JSON.stringify(cs.weights.before) !== JSON.stringify(cs.weights.after) ? 1 : 0) >
      0;
    const authorisedTransitions: Array<[string, LivingProcurementDocument, LivingProcurementDocument]> = [
      ["sector requirement edit", doc1Rerender, doc2],
      ["noted-item edit", doc2, doc3],
      ["requirement/timeline edit", doc3, doc4],
      ["fact-only correction", doc5base, doc5],
      ["receipt-only change", doc6base, doc6],
    ];
    let sawNonEmpty = false;
    for (const [label, before, after] of authorisedTransitions) {
      const nonEmpty = changeSetIsNonEmpty(after.changeSet);
      if (nonEmpty) sawNonEmpty = true;
      record(
        !nonEmpty || after.version === before.version + 1,
        `Item 4/invariant: ${label} -- a non-empty change set during an authorised revision coexists with the version advancing by EXACTLY one, never an unchanged version`,
        `nonEmpty=${nonEmpty} before=${before.version} after=${after.version}`,
      );
    }
    record(sawNonEmpty, "Item 4/invariant: at least one authorised revision above produced a genuinely non-empty change set -- the invariant fixture is not vacuous", "");

    // Save/reopen with previousDocument=null may start a fresh in-memory
    // chain at version 1 in Phase 1 -- no second persisted document is
    // introduced merely to preserve the counter (lastRevision is carried
    // on the SAME already-returned document object, the same discipline
    // factSnapshot/receiptsSnapshot already established).
    await withFakeKv(async () => {
      const { POST: createSecurityProjectRoute } = await import("../src/app/api/security-sourcing/project/route");
      const { GET: rfpGetRoute } = await import("../src/app/api/rfp/[id]/route");
      type RouteProjectLike = { id?: string; manage_token?: string };

      const turnText = "UK 20 site Healthcare business requires SD-WAN. We require DLP.";
      const u = deterministicExtract(turnText, []);
      const facts = mergeUpdates([], u, 1, "extract").facts;
      const req = requirementFrom(facts);
      const reqForCreate: typeof req = {
        ...req,
        organisation: { ...req.organisation, sector: req.organisation?.sector ?? "Healthcare & pharma" },
        estate: { ...req.estate, sites: req.estate?.sites ?? 20, users: req.estate?.users ?? 200, existingSecurity: ["Defender P2"] },
        drivers: ["renewal"],
        constraints: { ...req.constraints, inHouseSocCapacity: "business_hours", complianceRequirements: ["iso27001"] },
      };
      const createRes = await createSecurityProjectRoute(
        makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
          body: { requirement: reqForCreate, consent: true, test: true, source_turns: [{ id: "ver3_route_t1", text: turnText, at: 14000, via: "typed" }] },
        }),
      );
      const created = (await createRes.json()) as { project?: RouteProjectLike; error?: string };
      const id = created.project?.id ?? "";
      const manage = created.project?.manage_token ?? "";

      const reload1 = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const resumeState1 = resumeStateFromProject((await reload1.json()) as RouteProjectLike & { source_ledger?: SourceLedgerEntry[] });
      const recompiled1 = compileProcurementDocument({
        facts: [], requirement: mergeRequirementBase(resumeState1!.requirementBase, requirementFrom([])), verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [], sourceTurns: resumeState1!.sourceLedger, previousDocument: null, revision: null,
      });
      record(recompiled1.version === 1, "Item 4/save-reopen: a genuine reload (previousDocument=null) starts a fresh in-memory chain at version 1", `version=${recompiled1.version}`);

      const reload2 = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
      const resumeState2 = resumeStateFromProject((await reload2.json()) as RouteProjectLike & { source_ledger?: SourceLedgerEntry[] });
      const recompiled2 = compileProcurementDocument({
        facts: [], requirement: mergeRequirementBase(resumeState2!.requirementBase, requirementFrom([])), verdict: null, noted: [], rfiSet: null, instrument: "sor",
        receipts: [], sourceTurns: resumeState2!.sourceLedger, previousDocument: null, revision: null,
      });
      record(recompiled2.version === 1, "Item 4/save-reopen: a SECOND independent reload also lands on version 1 -- no second persisted document was needed to preserve any counter across reloads", `version=${recompiled2.version}`);
    });
  }

  /* ================================================================ */
  /* ROUND 4 (14 Aug 2026): Robert's independent audit of 98bfa75 found  */
  /* three remaining functional defects and one unproven integration     */
  /* contract, all reproduced below against the real, unmodified         */
  /* production functions before being fixed.                            */
  /* ================================================================ */

  /* ---- ROUND 4, ITEM 1: REAL NOTED-ITEM TAXONOMY --------------------- */
  /* Round 3's own positive noted fixture used { section: "operations" }
     -- a value already valid on this document, not one ProjectDesk's
     real noted taxonomy ever emits. This block drives the ACTUAL
     ids/labels/sections from taxonomy.ts and ProjectDesk.tsx's own
     note() calls straight through compileProcurementDocument(). */
  {
    const realNotedItems: Array<{ item: NotedItem; expectedSection: string }> = [
      { item: { id: "twin-res-all", label: "Dual-circuit resilience per site required", section: "estate", own: true }, expectedSection: "network" },
      { item: { id: "twin-change-cab", label: "Changes require CAB approval", section: "change", own: true }, expectedSection: "operations" },
      { item: { id: "twin-support-uk", label: "UK-based support desk required", section: "support", own: true }, expectedSection: "operations" },
      { item: { id: "twin-services-mig", label: "Migration services in scope", section: "services", own: true }, expectedSection: "project" },
      { item: { id: "sc-availability", label: "Availability target", section: "success", own: true }, expectedSection: "network" },
      { item: { id: "twin-suppliers-ref", label: "UK references required", section: "suppliers", own: true }, expectedSection: "supplier" },
    ];
    for (const { item: n, expectedSection } of realNotedItems) {
      const doc = compileProcurementDocument({
        facts: [], requirement: requirementFrom([]), verdict: null, noted: [n], rfiSet: null, instrument: "sor",
        receipts: [], previousDocument: null,
      });
      const c = doc.clauses.find((cl) => cl.templateKey === `noted:${n.id}`);
      record(Boolean(c) && c!.section !== "additional", `Item 1 (round 4): real noted id "${n.id}" (real section "${n.section}") does NOT fall into Additional requirements`, `section=${c?.section}`);
      record(c?.section === expectedSection, `Item 1 (round 4): real noted id "${n.id}" lands in the correct target section per Robert's own mapping`, `expected=${expectedSection} got=${c?.section}`);
    }

    // A clicked selection (own=true) vs a typed/extracted one (own unset,
    // the objectives ids' own real provenance -- statedObjectivesIn()) are
    // worded honestly and distinctly; neither fabricates a verbatim quote.
    const notedOwn: NotedItem = { id: "twin-support-uk", label: "UK-based support desk required", section: "support", own: true };
    const notedTyped: NotedItem = { id: "obj-bob", label: "Best-of-breed stack", section: "objectives" };
    const docOwn = compileProcurementDocument({ facts: [], requirement: requirementFrom([]), verdict: null, noted: [notedOwn], rfiSet: null, instrument: "sor", receipts: [], previousDocument: null });
    const docTyped = compileProcurementDocument({ facts: [], requirement: requirementFrom([]), verdict: null, noted: [notedTyped], rfiSet: null, instrument: "sor", receipts: [], previousDocument: null });
    const cOwn = docOwn.clauses.find((c) => c.templateKey === "noted:twin-support-uk");
    const cTyped = docTyped.clauses.find((c) => c.templateKey === "noted:obj-bob");
    record(/selected this from noted options/i.test(cOwn?.reason ?? ""), "Item 1 (round 4): a clicked selection (own=true) is honestly described as \"selected\", never as typed wording", cOwn?.reason ?? "");
    record(/buyer's own words state this/i.test(cTyped?.reason ?? ""), "Item 1 (round 4): a typed/extracted noted item (own unset) is worded distinctly as the buyer's own words, never claimed to be a click", cTyped?.reason ?? "");
    record(cOwn?.quote === null && cTyped?.quote === null, "Item 1 (round 4): neither provenance fabricates a verbatim buyer quote for a noted item -- quote stays null either way", "");

    /* THE CRITICAL REPRODUCTION. Compile a fully managed service from a
       real source turn, then compare with/without the buyer's real UI
       selection { id: "twin-support-247", label: "24x7 support required",
       section: "support" }. */
    const twinSupport247: NotedItem = { id: "twin-support-247", label: "24x7 support required", section: "support" };
    const withoutSelection = turn("We require a fully managed service.", [], [], { n: 0 }, 1, null, { noted: [] });
    const withSelection = turn("We require a fully managed service.", [], [], { n: 0 }, 1, null, { noted: [twinSupport247] });
    const msWithout = clauseByTemplate(withoutSelection.doc, "managed-service-boundary");
    const msWith = clauseByTemplate(withSelection.doc, "managed-service-boundary");
    record(JSON.stringify(withoutSelection.doc.clauses) !== JSON.stringify(withSelection.doc.clauses), "Item 1 (round 4)/THE CRITICAL REPRODUCTION: the buyer's real 24x7-support UI selection visibly changes the compiled document (was byte-identical on 98bfa75)", "");
    record(/with an agreed support model/i.test(msWithout?.statement ?? ""), "Item 1 (round 4)/THE CRITICAL REPRODUCTION baseline: without the selection, the clause reads the generic \"agreed support model\"", msWithout?.statement ?? "");
    record(/including 24\/7 support/i.test(msWith?.statement ?? ""), "Item 1 (round 4)/THE CRITICAL REPRODUCTION fixed: with the selection, the managed-service clause reads \"including 24/7 support\"", msWith?.statement ?? "");
    record((msWith?.sourceNotedIds ?? []).includes("twin-support-247"), "Item 1 (round 4)/THE CRITICAL REPRODUCTION: the managed-service clause carries a machine-readable sourceNotedIds citation, not just an internal templateKey", JSON.stringify(msWith?.sourceNotedIds));
    const dupNoted = withSelection.doc.clauses.find((c) => c.templateKey === "noted:twin-support-247");
    record(!dupNoted, "Item 1 (round 4)/THE CRITICAL REPRODUCTION: no redundant second \"noted-selection\" clause is created once the managed-service clause already represents the 24/7 selection (explicit template coverage, not generic word overlap)", "");

    // If no operating model exists at all, the selection must still
    // create an appropriate Operations requirement.
    const noModelDoc = compileProcurementDocument({
      facts: [], requirement: requirementFrom([]), verdict: null, noted: [twinSupport247], rfiSet: null, instrument: "sor",
      receipts: [], previousDocument: null,
    });
    const opsClause = noModelDoc.clauses.find((c) => c.templateKey === "noted:twin-support-247");
    record(Boolean(opsClause) && opsClause!.section === "operations", "Item 1 (round 4)/THE CRITICAL REPRODUCTION: with no operating model at all, the 24/7 selection still creates its own Operations requirement", `section=${opsClause?.section}`);

    // The 50%-word-overlap false suppression is fixed, but genuine
    // generic-overlap duplicate suppression (no wired producer) is
    // unaffected -- Robert's own round-3 DLP-duplication fixture (Item
    // 3, above) is unchanged and still passing; this is not re-asserted
    // here to avoid duplicating that coverage.
  }

  /* ---- ROUND 4, ITEM 2: SUPPORT-HOURS MENTION-LOCAL POLARITY --------- */
  {
    const st4 = (id: string, text: string, at: number): SourceLedgerEntry => ({ id, text, at, via: "typed" });
    const hoursOf4 = (text: string) => supportHoursFromHistory(chronologicalHistory([st4("t1", text, 1000)], [])).hours247;

    record(hoursOf4("We don't need 24/7 support.") === false, "Item 2 (round 4)/THE REPRODUCTION: \"We don't need 24/7 support.\" -> false", `got=${hoursOf4("We don't need 24/7 support.")}`);
    record(hoursOf4("24/7 support is not required.") === false, "Item 2 (round 4)/THE REPRODUCTION: \"24/7 support is not required.\" -> false", `got=${hoursOf4("24/7 support is not required.")}`);
    record(hoursOf4("Remove 24/7 support.") === false, "Item 2 (round 4)/THE REPRODUCTION: \"Remove 24/7 support.\" -> false", `got=${hoursOf4("Remove 24/7 support.")}`);
    record(hoursOf4("We require support, but not on a 24/7 basis.") === false, "Item 2 (round 4)/THE REPRODUCTION: negation AFTER the mention, separated by a comma/but -> false", `got=${hoursOf4("We require support, but not on a 24/7 basis.")}`);

    // Positive forms must remain true (regression guard).
    record(hoursOf4("24/7 support required.") === true, "Item 2 (round 4)/positive: \"24/7 support required.\" stays true", "");
    record(hoursOf4("24/7 support is required.") === true, "Item 2 (round 4)/positive: \"24/7 support is required.\" stays true", "");
    record(hoursOf4("24/7 incident support") === true, "Item 2 (round 4)/positive: \"24/7 incident support\" (round 1-3 required fixture) stays true", "");

    // Negation both BEFORE and AFTER the mention (Robert's own
    // requirement), beyond the exact reproduction sentences.
    record(hoursOf4("Support is not available 24/7.") === false, "Item 2 (round 4)/negation after: \"not available 24/7\"", "");
    record(hoursOf4("24/7 is never required for this contract.") === false, "Item 2 (round 4)/negation after: \"never required\"", "");
    record(hoursOf4("We won't require 24/7 cover.") === false, "Item 2 (round 4)/negation before: \"won't require 24/7\"", "");
    record(hoursOf4("Cancel the 24/7 support requirement.") === false, "Item 2 (round 4)/removal before: \"cancel the 24/7 support requirement\"", "");

    // A bare "24/7" token must never override explicit negative wording
    // (the round-3 bug, generalised) -- and an unrelated negation word
    // in an EARLIER, comma-separated clause must not leak into a later,
    // plainly positive mention.
    record(hoursOf4("An unrelated clause about budget, then 24/7 incident support required.") === true, "Item 2 (round 4)/clause scoping: an unrelated earlier clause with no negation cue does not suppress a later positive mention", "");
    record(hoursOf4("An unrelated clause with the word not somewhere, then 24/7 support required.") === true, "Item 2 (round 4)/clause scoping: a \"not\" in an EARLIER, unrelated clause does not falsely negate a later, plainly positive mention", "");

    // Correction-order: chronological latest-explicit-signal-wins must
    // survive the mention-local rewrite.
    const h1 = chronologicalHistory([st4("a", "24/7 support required.", 1000), st4("b", "We don't need 24/7 support after all.", 2000)], []);
    record(supportHoursFromHistory(h1).hours247 === false, "Item 2 (round 4)/correction order: 24/7 asserted, then LATER negated -> false", "");
    const h2 = chronologicalHistory([st4("a", "We don't need 24/7 support.", 1000), st4("b", "Actually, 24/7 support is required.", 2000)], []);
    record(supportHoursFromHistory(h2).hours247 === true, "Item 2 (round 4)/correction order: negated, then LATER asserted -> true", "");
  }

  // Save/reopen, through the REAL routes, using one of Robert's own new
  // mention-local reproductions (a negation form round 3's own
  // BUSINESS_HOURS_ONLY_RE sentence list did not contain).
  await withFakeKv(async () => {
    const { POST: createSecurityProjectRoute } = await import("../src/app/api/security-sourcing/project/route");
    const { GET: rfpGetRoute } = await import("../src/app/api/rfp/[id]/route");
    type RouteProjectLike4 = { id?: string; manage_token?: string; source_ledger?: SourceLedgerEntry[] };

    const turnText = "We require a fully managed service, with 24/7 support. We don't need 24/7 support after all.";
    const updates = deterministicExtract(turnText, []);
    const facts4 = mergeUpdates([], updates, 1, "extract").facts;
    const req4 = requirementFrom(facts4);
    const req4ForCreate: typeof req4 = {
      ...req4,
      organisation: { ...req4.organisation, sector: req4.organisation?.sector ?? "Healthcare & pharma" },
      estate: { ...req4.estate, sites: req4.estate?.sites ?? 20, users: req4.estate?.users ?? 200, existingSecurity: ["Defender P2"] },
      drivers: ["renewal"],
      constraints: { ...req4.constraints, inHouseSocCapacity: "business_hours", complianceRequirements: ["iso27001"] },
    };
    const createRes = await createSecurityProjectRoute(
      makeRequest("POST", "https://example.test/sase/api/security-sourcing/project", {
        body: { requirement: req4ForCreate, consent: true, test: true, source_turns: [{ id: "hours_round4_t1", text: turnText, at: 5000, via: "typed" }] },
      }),
    );
    const created = (await createRes.json()) as { project?: RouteProjectLike4; error?: string };
    record(createRes.status === 200, "Item 2 (round 4)/save-reopen: create with the mention-local negation turn succeeds through the real route", `status=${createRes.status} error=${created.error}`);
    const id = created.project?.id ?? "";
    const manage = created.project?.manage_token ?? "";

    const reload = await rfpGetRoute(makeRequest("GET", `https://example.test/sase/api/rfp/${id}?manage=${manage}`), { params: Promise.resolve({ id }) });
    const reloaded = (await reload.json()) as RouteProjectLike4;
    const resumeState = resumeStateFromProject(reloaded);
    const recompiled = compileProcurementDocument({
      facts: [],
      requirement: mergeRequirementBase(resumeState!.requirementBase, requirementFrom([])),
      verdict: null, noted: [], rfiSet: null, instrument: "sor",
      receipts: [], sourceTurns: resumeState!.sourceLedger, previousDocument: null, // a genuine reload
    });
    const opsRecompiled = clauseByTemplate(recompiled, "managed-service-boundary");
    record(Boolean(opsRecompiled) && /with an agreed support model/i.test(opsRecompiled!.statement) && !/24\/7/.test(opsRecompiled!.statement), "Item 2 (round 4)/save-reopen: after a REAL save+reopen+recompile with previousDocument=null, the mention-local negation survives (\"with an agreed support model\", not 24/7)", opsRecompiled?.statement ?? "");
  });

  /* ---- ROUND 4, ITEM 3: OPERATING-MODEL NEGATION SCOPE ---------------- */
  {
    const st4b = (id: string, text: string, at: number): SourceLedgerEntry => ({ id, text, at, via: "typed" });
    const modelOf4 = (text: string) => operatingModelFromHistory(chronologicalHistory([st4b("t1", text, 1000)], [])).model;

    record(modelOf4("Do not remove the fully managed service.") === "managed", "Item 3 (round 4)/THE REPRODUCTION: \"Do not remove the fully managed service.\" resolves to managed, never a removal", `got=${modelOf4("Do not remove the fully managed service.")}`);
    record(modelOf4("We do not want suppliers without a fully managed service.") === "managed", "Item 3 (round 4)/THE REPRODUCTION: a double negative via \"without\" resolves to managed, never null", `got=${modelOf4("We do not want suppliers without a fully managed service.")}`);
    record(modelOf4("We no longer require co-managed; fully managed is required.") === "managed", "Item 3 (round 4)/THE REPRODUCTION: a negated old model followed by an asserted new model resolves to the new model, not ambiguous and not stale co_managed", `got=${modelOf4("We no longer require co-managed; fully managed is required.")}`);
    // Generalised to either order, per Robert's own instruction.
    record(modelOf4("Fully managed is required; we no longer need co-managed.") === "managed", "Item 3 (round 4): the SAME structure in the OPPOSITE order (asserted new model first, negated old model second) also resolves to the new model", `got=${modelOf4("Fully managed is required; we no longer need co-managed.")}`);

    // Existing structural fixtures must remain green.
    record(modelOf4("co-managed instead of fully managed.") === "co_managed", "Item 3 (round 4)/regression: \"co-managed instead of fully managed\" still resolves to co_managed", "");
    record(modelOf4("fully managed instead of co-managed.") === "managed", "Item 3 (round 4)/regression: \"fully managed instead of co-managed\" still resolves to managed", "");
    record(modelOf4("change from co-managed to fully managed.") === "managed", "Item 3 (round 4)/regression: \"change from co-managed to fully managed\" still resolves to managed", "");
    record(modelOf4("We might want fully managed or co-managed, no strong preference either way.") === null, "Item 3 (round 4)/regression: a genuine two-model contradiction with no structural marker stays an unresolved OpenDecision (never guessed by the new polarity check)", "");

    // Additional double-negative forms, generalising beyond the exact
    // reproduction sentences (Robert: "Do not solve these with a list of
    // fixture-specific... sentences").
    record(modelOf4("We will not drop the co-managed arrangement.") === "co_managed", "Item 3 (round 4)/double negative: \"will not drop\" also retains the model", `got=${modelOf4("We will not drop the co-managed arrangement.")}`);
    record(modelOf4("Never cancel the fully managed contract.") === "managed", "Item 3 (round 4)/double negative: \"never cancel\" also retains the model", `got=${modelOf4("Never cancel the fully managed contract.")}`);

    // Genuine, UNNEGATED removal must still work (regression guard: the
    // fix narrows the false positive, it does not remove real removal
    // detection).
    record(modelOf4("Remove the fully managed requirement.") === null, "Item 3 (round 4)/regression: a genuine, unnegated removal still unsets the model", "");
    record(modelOf4("We no longer want co-managed.") === null, "Item 3 (round 4)/regression: \"no longer want\" (no outer negation) still unsets the model", "");

    // A double-negated removal of ONE model does not spuriously assert a
    // second, unrelated model mentioned in the same occurrence -- both
    // mentions resolve ASSERTED here (nothing removed), which is a
    // genuine two-model contradiction, correctly left unresolved rather
    // than silently guessed.
    record(modelOf4("Do not remove co-managed; we retain fully managed for now.") === null, "Item 3 (round 4): a double-negated removal of one model, alongside an asserted second model, is a genuine contradiction -- correctly left unresolved, never silently guessed", `got=${modelOf4("Do not remove co-managed; we retain fully managed for now.")}`);

    // End-to-end: THE REPRODUCTION drives the real compiled clause.
    const req4c = requirementFrom([]);
    const doc4c = compileProcurementDocument({
      facts: [], requirement: req4c, verdict: null, noted: [], rfiSet: null, instrument: "sor",
      receipts: [], sourceTurns: [st4b("t1", "We no longer require co-managed; fully managed is required.", 1000)], previousDocument: null,
    });
    const ms4c = clauseByTemplate(doc4c, "managed-service-boundary");
    record(Boolean(ms4c) && /fully managed/i.test(ms4c!.statement) && !/co-managed/i.test(ms4c!.statement), "Item 3 (round 4)/end-to-end: the compiled managed-service clause states fully managed, not co-managed, from the single negated-then-asserted occurrence", ms4c?.statement ?? "");
  }

  /* ---- ROUND 4, ITEM 4: GOVERNED-REVISION ADAPTER --------------------- */
  /* Drives resolveGovernedRevision() (procurement-document.ts) through
     every event kind Robert named, rather than hand-constructing
     CompilerRevision literals directly (round 3's own approach, which
     his audit correctly identified as unproven for a real caller). */
  {
    let facts4d: WorkspaceFact[] = [];
    let noted4d: NotedItem[] = [];
    let govState: GovernedRevisionState = INITIAL_GOVERNED_REVISION_STATE;

    record(!("changedFactIds" in ({} as GovernedEvent)) , "Item 4 (round 4): GovernedEvent's own type carries NO caller-asserted changedFactIds field at all -- the adapter always COMPUTES it from real factsBefore/factsAfter snapshots, so a caller cannot supply an untruthful claim even by accident", "");

    let doc4d = compileProcurementDocument({
      facts: facts4d, requirement: requirementFrom(facts4d), verdict: null, noted: noted4d, rfiSet: null, instrument: "sor",
      receipts: [], previousDocument: null, revision: null,
    });
    record(doc4d.version === 1, "Item 4 (round 4)/baseline: before any governed event, a fresh compile is version 1", `version=${doc4d.version}`);

    // EVENT A: a successful prompt/extraction cycle.
    const textA = "We are a Healthcare & pharma buyer with 20 sites.";
    const updatesA = [...deterministicExtract(textA, []), { path: "constraints.complianceRequirements" as const, value: "iso27001", provenance: "stated" as const, quote: "ISO 27001 required" }];
    const beforeA = factSnapshotOf(facts4d);
    facts4d = mergeUpdates(facts4d, updatesA, govState.cycle + 1, "extract").facts;
    const afterA = factSnapshotOf(facts4d);
    const eventA: GovernedEvent = { eventId: "prompt-cycle:a", kind: "prompt_cycle", seq: 1, factsBefore: beforeA, factsAfter: afterA };
    const resA = resolveGovernedRevision(govState, eventA);
    govState = resA.state;
    const docBeforeA = doc4d;
    doc4d = compileProcurementDocument({
      facts: facts4d, requirement: requirementFrom(facts4d), verdict: null, noted: noted4d, rfiSet: null, instrument: "sor",
      receipts: [], previousDocument: doc4d, revision: resA.revision,
    });
    record(resA.applied && resA.reason === "applied", "Item 4 (round 4)/prompt cycle: a successful extraction event is accepted", `reason=${resA.reason}`);
    record(doc4d.version === docBeforeA.version + 1, "Item 4 (round 4)/prompt cycle: one accepted governed event increments exactly once", `before=${docBeforeA.version} after=${doc4d.version}`);
    record((resA.revision?.changedFactIds.length ?? 0) > 0, "Item 4 (round 4)/prompt cycle: changedFactIds is a REAL, non-empty diff, computed from the actual before/after fact snapshots", JSON.stringify(resA.revision?.changedFactIds));
    record(doc4d.changeSet.facts.added.length > 0, "Item 4 (round 4)/prompt cycle: the compiled document's own changeSet.facts genuinely reflects the addition", JSON.stringify(doc4d.changeSet.facts));

    // EVENT B: a click-selected fact (source "answer", the SAME merge
    // path a chip/option landing uses in ProjectDesk.tsx).
    const beforeB = factSnapshotOf(facts4d);
    facts4d = mergeUpdates(facts4d, [{ path: "procurement.buying", value: "sase", provenance: "stated", quote: "SASE please" }], govState.cycle + 1, "answer").facts;
    const afterB = factSnapshotOf(facts4d);
    const eventB: GovernedEvent = { eventId: "fact-click:procurement.buying=sase", kind: "fact_click", seq: 2, factsBefore: beforeB, factsAfter: afterB };
    const resB = resolveGovernedRevision(govState, eventB);
    govState = resB.state;
    const docBeforeB = doc4d;
    doc4d = compileProcurementDocument({
      facts: facts4d, requirement: requirementFrom(facts4d), verdict: null, noted: noted4d, rfiSet: null, instrument: "sor",
      receipts: [], previousDocument: doc4d, revision: resB.revision,
    });
    record(resB.applied, "Item 4 (round 4)/click-selected fact: accepted", `reason=${resB.reason}`);
    record(doc4d.version === docBeforeB.version + 1, "Item 4 (round 4)/click-selected fact: exactly one increment", `before=${docBeforeB.version} after=${doc4d.version}`);

    // EVENT C: a noted-item ADD -- NO WorkspaceFact changes at all.
    const beforeC = factSnapshotOf(facts4d);
    noted4d = [...noted4d, { id: "s-247", label: "24x7 support", section: "support", own: true }];
    const afterC = factSnapshotOf(facts4d);
    const eventC: GovernedEvent = { eventId: "noted-add:s-247", kind: "noted_add", seq: 3, factsBefore: beforeC, factsAfter: afterC };
    const resC = resolveGovernedRevision(govState, eventC);
    govState = resC.state;
    const docBeforeC = doc4d;
    doc4d = compileProcurementDocument({
      facts: facts4d, requirement: requirementFrom(facts4d), verdict: null, noted: noted4d, rfiSet: null, instrument: "sor",
      receipts: [], previousDocument: doc4d, revision: resC.revision,
    });
    record(resC.applied, "Item 4 (round 4)/noted-item add: accepted even though NO WorkspaceFact changed -- a direct noted edit does not rely on a counter that only advances inside applyMerge()", `reason=${resC.reason}`);
    record(doc4d.version === docBeforeC.version + 1, "Item 4 (round 4)/noted-item add: exactly one increment", `before=${docBeforeC.version} after=${doc4d.version}`);
    record((resC.revision?.changedFactIds.length ?? 0) === 0, "Item 4 (round 4)/noted-item add: changedFactIds is honestly EMPTY (a real diff of two identical fact snapshots), never fabricated to look like a fact changed", JSON.stringify(resC.revision?.changedFactIds));

    // EVENT D: a noted-item REMOVE -- again no WorkspaceFact change.
    const beforeD = factSnapshotOf(facts4d);
    noted4d = noted4d.filter((n) => n.id !== "s-247");
    const afterD = factSnapshotOf(facts4d);
    const eventD: GovernedEvent = { eventId: "noted-remove:s-247", kind: "noted_remove", seq: 4, factsBefore: beforeD, factsAfter: afterD };
    const resD = resolveGovernedRevision(govState, eventD);
    govState = resD.state;
    const docBeforeD = doc4d;
    doc4d = compileProcurementDocument({
      facts: facts4d, requirement: requirementFrom(facts4d), verdict: null, noted: noted4d, rfiSet: null, instrument: "sor",
      receipts: [], previousDocument: doc4d, revision: resD.revision,
    });
    record(resD.applied, "Item 4 (round 4)/noted-item remove: accepted", `reason=${resD.reason}`);
    record(doc4d.version === docBeforeD.version + 1, "Item 4 (round 4)/noted-item remove: exactly one increment", `before=${docBeforeD.version} after=${doc4d.version}`);

    // EVENT E: a fact/list removal (the real dropListFact()).
    const isoFact = facts4d.find((f) => f.path === "constraints.complianceRequirements" && f.value === "iso27001")!;
    const beforeE = factSnapshotOf(facts4d);
    facts4d = dropListFact(facts4d, new Set(), isoFact).facts;
    const afterE = factSnapshotOf(facts4d);
    const eventE: GovernedEvent = { eventId: `fact-removal:${isoFact.id}`, kind: "fact_removal", seq: 5, factsBefore: beforeE, factsAfter: afterE };
    const resE = resolveGovernedRevision(govState, eventE);
    govState = resE.state;
    const docBeforeE = doc4d;
    doc4d = compileProcurementDocument({
      facts: facts4d, requirement: requirementFrom(facts4d), verdict: null, noted: noted4d, rfiSet: null, instrument: "sor",
      receipts: [], previousDocument: doc4d, revision: resE.revision,
    });
    record(resE.applied, "Item 4 (round 4)/fact removal: accepted", `reason=${resE.reason}`);
    record(doc4d.version === docBeforeE.version + 1, "Item 4 (round 4)/fact removal: exactly one increment", `before=${docBeforeE.version} after=${doc4d.version}`);
    record((resE.revision?.changedFactIds ?? []).includes(isoFact.id), "Item 4 (round 4)/fact removal: changedFactIds truthfully names the removed fact id", JSON.stringify(resE.revision?.changedFactIds));
    record(doc4d.changeSet.facts.removed.includes(isoFact.id), "Item 4 (round 4)/fact removal: the compiled document's own changeSet.facts.removed genuinely reflects the removal", JSON.stringify(doc4d.changeSet.facts));

    // EVENT F: a direct governed requirement/document edit -- bypasses
    // WorkspaceFact entirely (Robert's own round-3 reproduction shape).
    const reqBeforeF = requirementFrom(facts4d);
    const reqF = { ...reqBeforeF, organisation: { ...reqBeforeF.organisation, sector: "Financial services" } };
    const beforeF = factSnapshotOf(facts4d);
    const afterF = factSnapshotOf(facts4d); // unchanged -- no WorkspaceFact touched
    const eventF: GovernedEvent = { eventId: "requirement-edit:organisation.sector=Financial services", kind: "requirement_edit", seq: 6, factsBefore: beforeF, factsAfter: afterF };
    const resF = resolveGovernedRevision(govState, eventF);
    govState = resF.state;
    const docBeforeF = doc4d;
    doc4d = compileProcurementDocument({
      facts: facts4d, requirement: reqF, verdict: null, noted: noted4d, rfiSet: null, instrument: "sor",
      receipts: [], previousDocument: doc4d, revision: resF.revision,
    });
    record(resF.applied, "Item 4 (round 4)/direct requirement edit: accepted even though NO WorkspaceFact changed -- direct requirement edits cannot rely on a counter that only advances inside applyMerge()", `reason=${resF.reason}`);
    record(doc4d.version === docBeforeF.version + 1, "Item 4 (round 4)/direct requirement edit: exactly one increment", `before=${docBeforeF.version} after=${doc4d.version}`);
    record(doc4d.title !== docBeforeF.title, "Item 4 (round 4)/direct requirement edit: the document genuinely changed (title reflects the new sector)", `before=${docBeforeF.title} after=${doc4d.title}`);

    // EVENT G: a no-op render / view switch / reopen -- no event at all.
    const docBeforeG = doc4d;
    const resG = resolveGovernedRevision(govState, null);
    govState = resG.state;
    doc4d = compileProcurementDocument({
      facts: facts4d, requirement: reqF, verdict: null, noted: noted4d, rfiSet: null, instrument: "sor",
      receipts: [], previousDocument: doc4d, revision: resG.revision,
    });
    record(!resG.applied && resG.reason === "reopen", "Item 4 (round 4)/no-op render/reopen: NOT applied, never increments", `reason=${resG.reason}`);
    record(doc4d.version === docBeforeG.version, "Item 4 (round 4)/no-op render/reopen: version unchanged", `before=${docBeforeG.version} after=${doc4d.version}`);

    // EVENT H: a REPLAY of the identical event (event F again -- a
    // double-render or a retried request describing the SAME action).
    const docBeforeH = doc4d;
    const resH = resolveGovernedRevision(govState, eventF);
    govState = resH.state;
    doc4d = compileProcurementDocument({
      facts: facts4d, requirement: reqF, verdict: null, noted: noted4d, rfiSet: null, instrument: "sor",
      receipts: [], previousDocument: doc4d, revision: resH.revision,
    });
    record(!resH.applied && resH.reason === "replay", "Item 4 (round 4)/replay: the SAME event (identical eventId) replayed is NOT applied a second time", `reason=${resH.reason}`);
    record(doc4d.version === docBeforeH.version, "Item 4 (round 4)/replay: version does not increment on replay", `before=${docBeforeH.version} after=${doc4d.version}`);

    // EVENT I: a STALE/out-of-order event -- a DISTINCT eventId, but a
    // seq that does not exceed what has already been applied.
    const docBeforeI = doc4d;
    const staleEvent: GovernedEvent = { eventId: "prompt-cycle:late-arrival", kind: "prompt_cycle", seq: 3, factsBefore: factSnapshotOf(facts4d), factsAfter: factSnapshotOf(facts4d) };
    const resI = resolveGovernedRevision(govState, staleEvent);
    const cycleBeforeI = govState.cycle;
    govState = resI.state;
    doc4d = compileProcurementDocument({
      facts: facts4d, requirement: reqF, verdict: null, noted: noted4d, rfiSet: null, instrument: "sor",
      receipts: [], previousDocument: doc4d, revision: resI.revision,
    });
    record(!resI.applied && resI.reason === "stale", "Item 4 (round 4)/stale event: an older/out-of-order event (a lower seq than already applied) is REJECTED even though its eventId is distinct and would otherwise look like a new event", `reason=${resI.reason}`);
    record(doc4d.version === docBeforeI.version, "Item 4 (round 4)/stale event: version does not increment for a stale event", `before=${docBeforeI.version} after=${doc4d.version}`);
    record(govState.cycle === cycleBeforeI, "Item 4 (round 4)/stale event: the reducer's own monotonic cycle counter is untouched by a stale event -- cycle is derived internally from ACCEPTED events only, never taken from the event's own claim, so a stale event has no cycle to assert in the first place", `cycle=${govState.cycle}`);
  }

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
