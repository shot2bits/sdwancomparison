/**
 * 2030 blueprint, full-unification CLOSURE pass (17 Aug 2026).
 *
 * THE GAP THIS CLOSES. The prior pass (commit c330e03) persisted the
 * client's own already-compiled `LivingProcurementDocument` on save, but
 * never the FACTS/receipts that produced it -- so a reopened session could
 * not resume editing (no facts to correct or remove), and the server had
 * no way to prove a submitted document actually corresponds to the ledgers
 * it claims to be compiled from (it trusted the client's bytes outright).
 * Robert's own review named both gaps precisely.
 *
 * THE DESIGN. Facts (`WorkspaceFact[]`) and receipts now join
 * `source_ledger`/`decision_ledger` as durable, top-level `ProjectDetails`
 * fields (rfp-types.ts) -- REPLACE semantics on save (the client's local
 * `facts`/`receipts` state is always the FULL current array already, never
 * a partial diff -- see draft.ts's own `dropListFact`/`mergeUpdates`
 * discipline), protected against a stale overwrite by `envelope_revision`
 * (optimistic concurrency, checked below).
 *
 * The server no longer trusts a client-submitted compiled document
 * wholesale. On every save that touches the envelope, THIS module
 * independently RECOMPUTES the canonical `LivingProcurementDocument` from
 * validated inputs -- most of them server-DERIVED, not client-trusted:
 *   - `requirement`  <- requirementFrom(facts)                    [derived]
 *   - `verdict`      <- assessSecurityRequirement(requirement)    [derived, security scope only]
 *   - `noted`        <- replayDecisionLedger(decision_ledger)     [derived]
 *   - `rfiSet`       <- deriveRfiQuestionSet(coveredSections, sector) [derived]
 *   - `facts`        <- validated, client-submitted (irreducibly client-session state)
 *   - `receipts`     <- validated, client-submitted (irreducibly client-session state)
 *   - `instrument`   <- validated, client-submitted -- see this file's own
 *                        honesty note below on why this ONE input is not
 *                        also re-derived in this bounded pass
 *   - `sourceTurns`  <- the already-merged, already-canonical source_ledger
 *   - `previousDocument` <- the server's OWN prior stored document, never
 *                        client-submitted
 * The server's own recompute is ALWAYS what gets persisted -- never the
 * client's raw bytes. The client's own `compiled_document` submission is
 * used only as a consistency assertion: if it disagrees with what the
 * server independently derives (readiness excluded -- see below), the save
 * is rejected outright rather than silently persisting a drifted document.
 *
 * HONESTY NOTE ON `instrument`. `earnedInstrument(instrumentLadder)`'s own
 * ladder depends on session-local signals (`live.length`,
 * `unansweredGaps.length`, `commercialClaims`) that are not simple pure
 * functions of `facts` alone -- deriving them server-side too is real,
 * separable follow-on work, not something this bounded closure pass
 * redesigns. `instrument` is therefore accepted as a validated (enum-
 * checked), client-trusted input, exactly the same trust tier `receipts`
 * already has -- the ONE remaining input this pass does not independently
 * re-derive. Six of the compiler's nine inputs now are; three (`facts`,
 * `receipts`, `instrument`) are validated-but-trusted, down from nine of
 * nine before this pass.
 *
 * HONESTY NOTE ON `readiness`. The client's own `canvasDocument` (what it
 * submits as `compiled_document`) substitutes a SECTION-AWARE readiness
 * projection for the compiler's raw one (ProjectDesk.tsx's own
 * `canvasDocument` comment) -- a client-side rendering enhancement, not
 * part of the compiler's own pure contract. The consistency check below
 * strips `readiness` from both sides before comparing for exactly this
 * reason, and the PERSISTED canonical document always carries the
 * compiler's own raw `readiness` (self-describing, reproducible from the
 * envelope's other fields by anyone) -- never the client's UI-specific
 * substitution. The Canvas re-derives its own section-aware readiness at
 * render time from the persisted document, exactly as it already does
 * today.
 *
 * CONCURRENCY. No true KV compare-and-swap exists anywhere in this
 * codebase today (confirmed by direct grep before writing this file; see
 * rfp-governed-revision.ts's own doc comment, which names the identical
 * gap for its unrelated event-idempotency counter). This module implements
 * the strongest SAFE primitive available without one: `envelope_revision`
 * is checked against the caller-submitted `base_revision` immediately
 * before persisting, on the freshest read available to the write request.
 * This closes every realistic staleness case (two tabs, a stale reopen, a
 * double-submit) but -- exactly like rfp-governed-revision.ts's own
 * documented gap -- does not close a true, sub-millisecond simultaneous
 * write race without a server-side Lua/CAS primitive, which is not
 * introduced here (untestable against a live Redis in this sandbox; a
 * hand-written, unverified Lua script would be a worse risk than the
 * documented gap it claims to close). This limitation is stated here
 * plainly, not hidden, and matches this codebase's own existing precedent
 * for the same class of gap.
 */

import { z } from "zod";
import crypto from "node:crypto";
import { requirementFrom, buyingOf, type WorkspaceFact } from "@/lib/workspace/draft";
import { assessSecurityRequirement } from "@/lib/security/rulebook";
import { deriveRfiQuestionSet } from "@/lib/workspace/instrument";
import { replayDecisionLedger, type DecisionLedgerEntry } from "@/lib/workspace/decision-ledger";
import type { SourceLedgerEntry } from "@/lib/workspace/source-ledger";
import type { ReceiptLike } from "@/lib/workspace/procurement-templates";
import {
  compileProcurementDocument,
  LivingProcurementDocumentSchema,
  PROCUREMENT_COMPILER_VERSION,
  type LivingProcurementDocument,
} from "@/lib/workspace/procurement-document";

/* ------------------------------------------------------------------ */
/* Schemas for the two NEWLY-persisted client-session arrays            */
/* ------------------------------------------------------------------ */

/**
 * Re-exported, not defined here (build fix, 17 Aug 2026): these two schemas
 * moved to envelope-schemas.ts, a file with zero Node-only imports, because
 * rfp-types.ts imports them and rfp-types.ts is reachable from
 * RfpBuilder.tsx ("use client"). Defining them in THIS file -- which also
 * does `import crypto from "node:crypto"` below for `envelopeContentHash`
 * -- pulled that Node-only import into the client bundle and broke the
 * Vercel build outright (`UnhandledSchemeError: Reading from "node:crypto"
 * is not handled by plugins`). Every server-side caller below is unaffected
 * -- same symbols, same behaviour, just re-exported instead of declared.
 */
export { WorkspaceFactSchema, ReceiptLikeSchema } from "@/lib/workspace/envelope-schemas";
import { WorkspaceFactSchema, ReceiptLikeSchema } from "@/lib/workspace/envelope-schemas";

const EARNED_INSTRUMENT_VALUES = ["sor", "rfi", "rfp"] as const;

/**
 * Versions the SHAPE of the `envelope` metadata sub-object specifically --
 * deliberately separate from `CURRENT_ENVELOPE_SCHEMA_VERSION` (rfp-
 * types.ts, Checkpoint B), which versions `ProjectDetails`' own top-level
 * shape. They are genuinely different things; giving each its own counter
 * is honest, not duplicative -- and avoids this file importing FROM
 * rfp-types.ts, which imports THIS file (WorkspaceFactSchema) already --
 * that would be a real circular import.
 */
export const ENVELOPE_META_SCHEMA_VERSION = 1;

export type EnvelopeMeta = {
  schema_version: number;
  compiler_version: string;
  base_revision: number;
  source_ledger_hash: string;
  decision_ledger_hash: string;
  facts_hash: string;
  compiled_document_hash: string;
  saved_at: number;
  saved_by: string;
};

/* ------------------------------------------------------------------ */
/* Content hashing -- a deliberate, self-contained duplicate            */
/* ------------------------------------------------------------------ */

/**
 * Deliberately NOT imported from published-snapshot.ts's own
 * `contentHash()`/`stableStringify()` (same algorithm, same purpose): this
 * file is imported BY rfp-types.ts (for WorkspaceFactSchema above), and
 * published-snapshot.ts imports rfp-store.ts, which imports rfp-types.ts --
 * importing published-snapshot.ts from here would close that into a real
 * import cycle. A ~15-line duplicate of a pure, stable algorithm is the
 * honest trade-off, not a design flaw.
 */
function stableStringify(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) out[k] = sort((v as Record<string, unknown>)[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(sort(value));
}

export function envelopeContentHash(value: unknown): string {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

/** Strips the client-substituted, non-canonical `readiness` field before a
 *  cross-check comparison -- see this file's own top-of-file "HONESTY NOTE
 *  ON `readiness`". */
function withoutReadiness(doc: unknown): unknown {
  if (!doc || typeof doc !== "object") return doc;
  const { readiness: _readiness, ...rest } = doc as Record<string, unknown>;
  return rest;
}

/* ------------------------------------------------------------------ */
/* The orchestrator every writer route shares                          */
/* ------------------------------------------------------------------ */

export type EnvelopeExisting = { procurement_document?: LivingProcurementDocument | null; envelope_revision?: number | null } | null;

export type EnvelopeSaveOutcome =
  | { participates: false }
  | {
      participates: true;
      ok: true;
      facts: WorkspaceFact[];
      receipts: ReceiptLike[];
      instrument: (typeof EARNED_INSTRUMENT_VALUES)[number];
      procurement_document: LivingProcurementDocument;
      envelope_revision: number;
      envelope: EnvelopeMeta;
    }
  | { participates: true; ok: false; status: 409 | 422; error: string };

/**
 * ONE function every writer route (wizard create/update, security-sourcing
 * create/rescope) calls -- so there is exactly one place that validates,
 * derives, recomputes, cross-checks and revision-gates a canonical
 * envelope save, never four divergent copies. Returns `{participates:
 * false}` untouched when the incoming body carries no `facts` at all (a
 * request that does not touch the envelope -- a signoff decision, a claim,
 * an old client build) -- those callers proceed exactly as before this
 * pass, unaffected.
 */
export async function buildEnvelopeUpdate(params: {
  existing: EnvelopeExisting;
  body: Record<string, unknown>;
  mergedSourceLedger: SourceLedgerEntry[];
  mergedDecisionLedger: DecisionLedgerEntry[];
  coveredSections: string[];
  savedBy: string;
}): Promise<EnvelopeSaveOutcome> {
  const { existing, body, mergedSourceLedger, mergedDecisionLedger, coveredSections, savedBy } = params;

  if (body.facts === undefined) return { participates: false };

  const factsParsed = z.array(WorkspaceFactSchema).safeParse(body.facts);
  if (!factsParsed.success) {
    return { participates: true, ok: false, status: 422, error: "This save's fact ledger is malformed; nothing was written. Reload and try again." };
  }
  const facts = factsParsed.data as WorkspaceFact[];

  const receiptsParsed = z.array(ReceiptLikeSchema).safeParse(body.receipts ?? []);
  if (!receiptsParsed.success) {
    return { participates: true, ok: false, status: 422, error: "This save's retained wording is malformed; nothing was written. Reload and try again." };
  }
  const receipts = receiptsParsed.data as ReceiptLike[];

  const instrumentParsed = z.enum(EARNED_INSTRUMENT_VALUES).safeParse(body.instrument);
  if (!instrumentParsed.success) {
    return { participates: true, ok: false, status: 422, error: "This save is missing which formality tier is earned (instrument); nothing was written. Reload and try again." };
  }
  const instrument = instrumentParsed.data;

  if (body.compiled_document === undefined) {
    return { participates: true, ok: false, status: 422, error: "This save is missing its compiled document; nothing was written. Reload and try again." };
  }
  const clientDocParsed = LivingProcurementDocumentSchema.safeParse(body.compiled_document);
  if (!clientDocParsed.success) {
    return { participates: true, ok: false, status: 422, error: "This save's compiled document is malformed; nothing was written. Reload and try again." };
  }

  /* ---- Optimistic concurrency: reject a stale base revision ---- */
  const currentRevision = existing?.envelope_revision ?? 0;
  const claimedBase = typeof body.base_revision === "number" ? body.base_revision : undefined;
  if (!existing) {
    if (claimedBase !== undefined && claimedBase !== 0) {
      return { participates: true, ok: false, status: 409, error: "This project does not exist yet, so a base revision above 0 cannot be current; nothing was written." };
    }
  } else if (currentRevision > 0) {
    if (claimedBase === undefined) {
      return { participates: true, ok: false, status: 409, error: "This project already has a saved canonical envelope; a base revision is required to save again. Reload and try again." };
    }
    if (claimedBase !== currentRevision) {
      return { participates: true, ok: false, status: 409, error: `This project has been saved since you loaded it (your base revision ${claimedBase}, current ${currentRevision}); reload and try again so your edits apply on top of the latest version.` };
    }
  }
  // currentRevision === 0 with an existing record and no claimedBase: a
  // pre-unification (legacy) record's FIRST canonical-envelope save --
  // allowed through, exactly the migration path fixture K exercises.

  /* ---- Server-derived inputs (never trusted from the client) ---- */
  const requirement = requirementFrom(facts);
  // `buying` is its own fact-derived value, NOT part of SecurityRequirementInput
  // (extract.ts's own comment: "procurement.buying/operatingModel...
  // applyUpdates() never writes them into SecurityRequirementInput" -- they
  // are workspace-level facts read directly off the ledger). `buyingOf()`
  // (draft.ts) is the same pure function ProjectDesk.tsx's own `securityScope`
  // (line ~1183: `buying === "managed_security" || buying === null`) and
  // compileProcurementDocument()'s own internals already use -- mirrored
  // here exactly, not reinvented.
  const buying = buyingOf(facts);
  const securityScope = buying === "managed_security" || buying === null;
  const verdict = securityScope ? await assessSecurityRequirement(requirement) : null;
  const { noted } = replayDecisionLedger(mergedDecisionLedger);
  const rfiSet = deriveRfiQuestionSet({ coveredSections, sector: requirement.organisation?.sector ?? null });

  const previousDocument = existing?.procurement_document ?? null;
  /* Bug fix (verification pass, 18 Aug 2026, widened after a second live
   *  failure): this call originally always passed `revision: undefined`,
   *  intending resolveVersion()'s "legacy fallback" (a real server-derived
   *  facts/receipts diff) to govern every save. Two separate end-to-end
   *  Playwright runs against a real local KV store (this sandbox had never
   *  had KV credentials before, so NEITHER path had ever actually been
   *  exercised until this pass) proved that intent wrong on both branches:
   *
   *  1. FIRST save (no previousDocument): resolveVersion's own
   *     `!previousDocument` branch is unconditionally
   *     `{ version: 1, lastRevision: revision ?? null }` -- it never
   *     reaches the legacy-fallback code at all. `revision: undefined`
   *     there just meant `lastRevision: null`, while the client's first
   *     compile already carried a real, non-null `lastRevision`
   *     (`currentRevision`, ProjectDesk.tsx -- the buyer's first submitted
   *     prompt is a genuine governed event, "V1" per that file's own
   *     "Prompt A -> V1, B -> V2, C -> V3" contract) -- a guaranteed
   *     mismatch on every project's very first save.
   *
   *  2. UPDATE (previousDocument exists): the legacy-fallback branch
   *     carries `previousDocument.lastRevision` forward UNCHANGED
   *     regardless of new edits, while the client always recomputes its
   *     own `lastRevision` from its live `currentRevision` -- so the very
   *     next edit-then-save/publish after the first one failed exactly the
   *     same way (confirmed live: publish's own refreshRecord() call hit
   *     this branch and got the identical 409).
   *
   *  Both branches share one root cause: the server was deriving its own,
   *  DIFFERENT belief about "was this a new governed event" instead of
   *  trusting the one truthful source ProjectDesk.tsx's own docs already
   *  name for exactly this class of input -- `currentRevision` is
   *  session-local and not purely fact-derivable, the SAME validated-but-
   *  trusted tier `instrument` already has here (see this file's own
   *  "HONESTY NOTE ON `instrument`" above). The fix: always pass the
   *  client's own `lastRevision` -- already schema-validated as part of
   *  `clientDocParsed` (`LivingProcurementDocumentSchema`,
   *  procurement-document.ts) -- on every save, first or subsequent. This
   *  does not weaken the envelope's own core guarantee: the server still
   *  independently recomputes `requirement`/`verdict`/`noted`/`rfiSet` and
   *  still rejects the save outright if the recompute disagrees with the
   *  client's claimed document on anything else (the consistency check
   *  immediately below, unchanged). */
  const serverDoc = compileProcurementDocument({
    facts,
    requirement,
    verdict,
    noted,
    rfiSet,
    instrument,
    receipts,
    sourceTurns: mergedSourceLedger,
    previousDocument,
    revision: clientDocParsed.data.lastRevision,
  });

  /* ---- Consistency check: the client's own belief must correspond ---- */
  const serverHashForCompare = envelopeContentHash(withoutReadiness(serverDoc));
  const clientHashForCompare = envelopeContentHash(withoutReadiness(clientDocParsed.data));
  if (serverHashForCompare !== clientHashForCompare) {
    return {
      participates: true,
      ok: false,
      status: 409,
      error: "The document you're saving does not correspond to the canonical inputs you're saving it with (facts, decisions, source ledger); nothing was written. Reload and try again.",
    };
  }

  const envelope_revision = currentRevision + 1;
  const envelope: EnvelopeMeta = {
    schema_version: ENVELOPE_META_SCHEMA_VERSION,
    compiler_version: PROCUREMENT_COMPILER_VERSION,
    base_revision: envelope_revision,
    source_ledger_hash: envelopeContentHash(mergedSourceLedger),
    decision_ledger_hash: envelopeContentHash(mergedDecisionLedger),
    facts_hash: envelopeContentHash(facts),
    compiled_document_hash: envelopeContentHash(serverDoc),
    saved_at: Date.now(),
    saved_by: savedBy,
  };

  return { participates: true, ok: true, facts, receipts, instrument, procurement_document: serverDoc, envelope_revision, envelope };
}
