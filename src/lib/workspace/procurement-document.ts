/**
 * Living Procurement Canvas -- Phase 1: the pure compiler (Netify Living
 * Procurement Canvas brief, Version 2.0, Sections 6, 7 and 14).
 *
 * WHAT THIS FILE IS. The fact ledger (WorkspaceFact[], requirementFrom,
 * mergeUpdates -- all unchanged, all from draft.ts/extract.ts) answers
 * "what does Netify know about the buyer". This file answers a different
 * question: "what must a supplier answer and prove". It is a PURE
 * projection -- compileProcurementDocument() takes the ledger's current
 * state and returns one typed LivingProcurementDocument. Every future view
 * (Living Document, Supplier Pack, Evaluation) renders a slice of THIS
 * object; none of them may invent a clause, count, question, gate, section
 * or weight of its own (Section 14.2, "one truth, three projections").
 *
 * WHAT THIS FILE IS NOT. It does not replace WorkspaceFact[],
 * requirementFrom(facts), source_ledger, coreFive, signLocked or the
 * save/publish chain (Section 13.4's explicit exclusion). It never calls a
 * model and never performs I/O (Section 8.5): every input arrives already
 * computed by the caller (ProjectDesk, in Phase 2; a fixture, in Phase 1),
 * and the function is a straight, synchronous, deterministic reduction of
 * those inputs to a document.
 *
 * THE ONE DEVIATION FROM SECTION 6.1'S ILLUSTRATIVE SIGNATURE. Section 6.1
 * shows compileProcurementDocument({ facts, requirement, verdict, noted,
 * rfiSet, instrument, previousDocument }). This implementation adds one
 * more field: `receipts` -- the buyer's own unplaced wording, kept
 * verbatim (ProjectDesk.tsx's own `receipts` state; today rendered only
 * under "Your notes"). Section 15.2 itself lists "retained wording" among
 * the inputs compiledDocument's useMemo must read, and Section 14.4's own
 * defect prompt is UNSATISFIABLE without it: the point-to-point Ethernet
 * dependency never becomes a WorkspaceFact at all (see
 * procurement-templates.ts's own comment on why), so the only place its
 * words exist is the receipt. Omitting `receipts` from the compiler's
 * input would make the brief's own non-negotiable acceptance case
 * impossible to pass. Every other field matches Section 6.1 exactly.
 */

import { z } from "zod";
import type { SecurityRequirementInput, SecurityScopeVerdict } from "@/lib/security/rulebook";
import { buyingOf, operatingModelOf, standing, type WorkspaceFact } from "@/lib/workspace/draft";
import type { RfiQuestionSet, EarnedInstrument } from "@/lib/workspace/instrument";
import type { SourceLedgerEntry } from "@/lib/workspace/source-ledger";
import type { BankCanonicalQuestion } from "@/lib/rfp-question-bank";
import { activeFlavours, activePack } from "@/lib/sector/derive";
import {
  buildArchitecture,
  buildCandidateClauses,
  resolveReceiptRemovals,
  mergeReceiptsWithSourceLedger,
  chronologicalHistory,
  operatingModelFromHistory,
  resolveSupportCoverage,
  type ReceiptLike,
  type ClauseDraft,
} from "@/lib/workspace/procurement-templates";
import {
  balanceCategoriesTo100,
  buildOpenDecisions,
  buildReadiness,
  clauseWeight,
  CATEGORY_FOR_SECTION,
  DEFAULT_CATEGORY_WEIGHTS,
  type EvaluationCategoryKey,
} from "@/lib/workspace/procurement-readiness";

/* ------------------------------------------------------------------ */
/* Public types (Section 6, extended where Section 14 requires it --   */
/* every extension is additive and documented at its own declaration)  */
/* ------------------------------------------------------------------ */

/** Section 14.3 supersedes Section 6's illustrative eight-value union:
 *  "Unknown but concrete requirements compile into Additional
 *  requirements" is a NINTH section, created only when at least one
 *  clause needs it (Section 14.3's "render a section only when it
 *  contains a clause" rule -- see sectionsPresent() below). */
export type ProcurementSectionKey =
  | "network"
  | "security"
  | "identity"
  | "application"
  | "operations"
  | "project"
  | "commercial"
  | "supplier"
  | "additional";

export const SECTION_TITLES: Record<ProcurementSectionKey, string> = {
  network: "Network",
  security: "Security",
  identity: "Identity",
  application: "Application",
  operations: "Operations",
  project: "Project",
  commercial: "Commercial",
  supplier: "Supplier",
  additional: "Additional requirements",
};

/** The clause-code prefix Section 6's own examples use (NET-04, SEC-03,
 *  OPS-02); ADD is this document's own extension for the ninth section. */
export const SECTION_CODES: Record<ProcurementSectionKey, string> = {
  network: "NET",
  security: "SEC",
  identity: "ID",
  application: "APP",
  operations: "OPS",
  project: "PRJ",
  commercial: "COM",
  supplier: "SUP",
  additional: "ADD",
};

export type ClauseOrigin = "buyer" | "netify" | "sector" | "buyer_override";

export interface ProcurementClause {
  /** Phase 1 checkpoint round 2, item 1 (13 Aug 2026), Robert's own
   *  finding: an id derived by RENUMBERING the current clause set (the
   *  first checkpoint correction's `idRegistry` scheme) is only stable
   *  when a caller can thread `previousDocument` from compile to compile
   *  -- a real browser reload cannot supply that object, so a fresh
   *  `previousDocument=null` recompile from the durable source ledger
   *  alone would renumber every surviving clause. `id` is therefore now
   *  IMMUTABLE and HISTORY-FREE: `stableClauseId()` (below) derives it
   *  deterministically from the clause's own `templateKey` alone (a
   *  SHA-256 digest, truncated, section-prefixed for legibility) --
   *  nothing about ANY other clause, this compile or a prior one, changes
   *  it. The same templateKey always yields the same id, forever,
   *  whether this is the first compile of a session or a recompile after
   *  a genuine reload with no history available at all. There is no
   *  separate "display" id/code: this IS the id, and it is safe to show
   *  to a person. Collision handling: see assignStableIds() below. */
  id: string;
  section: ProcurementSectionKey;
  statement: string;
  supplierResponse: string[];
  evidence: string[];
  acceptanceTest: string | null;
  mandatory: boolean;
  weight: number;
  sourceFactIds: string[];
  origin: ClauseOrigin;
  reason: string;
  /** The buyer's own words this clause traces to, when origin is "buyer"
   *  or "buyer_override" -- Section 14.3's "original wording remains
   *  attached as provenance" and Section 14.5's "buyer wording remains
   *  available" invariant. Null for a pure netify/sector template with no
   *  single buyer sentence to quote (e.g. a platform-default clause). */
  quote: string | null;
  /** Phase 1 checkpoint round 2, item 3 (13 Aug 2026): the durable
   *  source-turn id(s) this clause traces to, in addition to (never
   *  instead of) `quote`'s copied text -- Robert: "Clause provenance
   *  should include the relevant source-turn ID(s), not only copied
   *  quote text." Carried straight through from `ClauseDraft` (procure-
   *  ment-templates.ts) by `numberClauses()`'s own spread; empty for a
   *  pure fact-driven or netify/sector template with no single source
   *  turn to cite (the same cases `quote` is already null for). */
  sourceTurnIds: string[];
  /** Phase 1 checkpoint round 4, item 1 (14 Aug 2026): the stable noted
   *  id(s) (NotedItem.id) this clause traces to -- Robert: "A selected
   *  noted item must retain a machine-readable link to its stable noted
   *  id, such as sourceNotedIds, rather than relying only on an internal
   *  templateKey." Populated two ways: (1) `notedClauses()`'s own clause
   *  for a noted item cites its OWN id here; (2) a producer template that
   *  CONSUMES a noted signal (e.g. `managedServiceClause()` reading an
   *  explicit "24x7 support" selection) cites the noted id(s) it actually
   *  used, which is also the mechanism `notedClauses()`'s own duplicate
   *  suppression checks FIRST, before falling back to generic word
   *  overlap -- "explicit template coverage", not "incidental generic-
   *  word overlap" (see `notedClauses()`'s own comment). Empty for a
   *  clause with no noted-item provenance at all (the common case,
   *  unchanged from round 3). */
  sourceNotedIds: string[];
  /** STABLE identity key, independent of `id`'s display numbering and of
   *  array position -- what the change set and carry-forward removal
   *  (Section 14.6, Section 17 hook #2) actually diff against. Content-
   *  derived: the same template firing on the same source produces the
   *  same key on every compile. */
  templateKey: string;
  /** The named deterministic template that produced this clause (Section
   *  14.5's "traceable" invariant: "a named deterministic template"). */
  templateId: string;
}

export type AnswerFormat =
  | "narrative"
  | "metric"
  | "diagram"
  | "compliance_matrix"
  | "dated_plan"
  | "live_demonstration"
  | "documentary_evidence";

export interface SupplierQuestion {
  id: string;
  clauseId: string;
  text: string;
  answerFormat: AnswerFormat;
  evidenceRequested: string[];
  /** Phase 1 checkpoint correction, item 4 (13 Aug 2026): "bank" when
   *  `text` is reused VERBATIM from the earned RFI question bank
   *  (deriveRfiQuestionSet(), instrument.ts) instead of this compiler's
   *  own generated per-clause wording -- see buildResponseGroups()'s own
   *  comment for the exclusivity rule that keeps a bank question and a
   *  generated question from ever covering the same clause twice. */
  source: "bank" | "generated";
  /** The bank's own native question id (e.g. "Q-IZ-01"), when `source`
   *  is "bank" -- null for a generated question. Provenance: which
   *  question-bank entry (deriveRfiQuestionSet's own BankCanonicalQuestion)
   *  this text traces to. */
  bankQuestionId: string | null;
}

export type ResponseGroupKey = EvaluationCategoryKey;

export interface SupplierResponseGroup {
  key: ResponseGroupKey;
  title: string;
  questions: SupplierQuestion[];
}

export interface EvaluationGate {
  id: string;
  label: string;
  clauseIds: string[];
  description: string;
}

export type WeightSource = "default" | "sector" | "buyer_priority" | "buyer_override";

export interface EvaluationCategory {
  key: EvaluationCategoryKey;
  label: string;
  weight: number;
  source: WeightSource;
}

export type OpenDecisionImpact = "eligibility" | "price" | "architecture" | "compliance" | "delivery" | "evaluation";

export interface OpenDecision {
  id: string;
  question: string;
  impact: OpenDecisionImpact[];
  /** Section 17.1 hook #5: "OpenDecision supports conflict reason and
   *  affected IDs." Empty for an ordinary gap; populated when two buyer
   *  statements genuinely contradict (Section 16.4). */
  conflict: boolean;
  conflictReason: string | null;
  affectedClauseIds: string[];
}

export interface ArchitectureNode {
  id: string;
  label: string;
  kind: "site" | "user" | "network" | "cloud" | "identity" | "voice" | "application" | "circuit" | "datacentre";
  sourceFactIds: string[];
  /** Phase 1 checkpoint correction, item 1 (13 Aug 2026), amended round 2:
   *  the IMMUTABLE clause id(s) (ProcurementClause.id -- a deterministic
   *  hash of templateKey, never a function of history) that this node
   *  exists because of -- empty for a node derived straight from
   *  requirement fields (sites, users, network, cloud), which no single
   *  clause backs. */
  sourceClauseIds: string[];
}

export interface ArchitectureEdge {
  from: string;
  to: string;
  label: string;
}

export interface ProvenanceSummary {
  buyer: number;
  netify: number;
  sector: number;
  buyer_override: number;
}

export interface ChangeList {
  added: string[];
  updated: string[];
  removed: string[];
}

export interface ProcurementChangeSet {
  facts: ChangeList;
  clauses: ChangeList;
  questions: ChangeList;
  gates: ChangeList;
  weights: { before: Record<string, number>; after: Record<string, number> };
  sections: { added: string[]; removed: string[] };
}

export interface LivingProcurementDocument {
  version: number;
  title: string;
  summary: string;
  readiness: { score: number; label: string; reasons: string[] };
  counts: { requirements: number; questions: number; gates: number; decisions: number };
  architecture: { nodes: ArchitectureNode[]; edges: ArchitectureEdge[]; accessibleSummary: string };
  clauses: ProcurementClause[];
  responseGroups: SupplierResponseGroup[];
  evaluation: { gates: EvaluationGate[]; categories: EvaluationCategory[] };
  openDecisions: OpenDecision[];
  provenance: ProvenanceSummary;
  changeSet: ProcurementChangeSet;
  /** Phase 1 checkpoint round 2, item 4 (13 Aug 2026): the STANDING fact
   *  id -> value map at the moment of THIS compile -- what
   *  buildChangeSet() actually diffs `previousDocument.factSnapshot`
   *  against to compute `changeSet.facts` truthfully (added/updated/
   *  removed), replacing the earlier hard-coded `{added:[],updated:[],
   *  removed:[]}` placeholder. The SAME non-duplicate-persistence
   *  discipline the first checkpoint's `idRegistry` field already
   *  established applies here: this is carried on the ALREADY-returned
   *  document object for the caller's OWN next in-memory compile to diff
   *  against, never a second persisted store. */
  factSnapshot: Record<string, unknown>;
  /** Phase 1 checkpoint round 2, item 4 (13 Aug 2026): the exact merged
   *  receipt text list (mergeReceiptsWithSourceLedger's own output,
   *  post-dedup) THIS compile used, in order -- what version-increment
   *  detection (below) diffs against `previousDocument.receiptsSnapshot`
   *  to tell "the governed source/document history changed" apart from
   *  "an identical recompile" (view switching, a reopen that reproduces
   *  the exact same state, a re-render) -- Robert's own distinction. */
  receiptsSnapshot: string[];
  /** Phase 1 checkpoint round 3, item 4 (14 Aug 2026): the LAST
   *  `ProcurementCompilerInput.revision` a version increment was actually
   *  attributed to, when the caller has adopted the explicit revision
   *  contract -- `null` if no revision-bearing compile has happened yet
   *  in this document's chain. `resolveVersion()` compares the NEXT
   *  compile's `input.revision.cycle` against this to decide "genuinely
   *  new event" versus "the same event replayed" (an idempotent re-render
   *  passing the identical cycle again). Carried on the already-returned
   *  document object -- the same non-duplicate-persistence discipline
   *  `factSnapshot`/`receiptsSnapshot` already established, never a
   *  second persisted store. */
  lastRevision: CompilerRevision | null;
  /** Phase 1 checkpoint correction, item 4 (13 Aug 2026): echoes
   *  ProcurementCompilerInput.instrument -- which supplier questions this
   *  compile drew from the earned RFI bank (source: "bank") versus this
   *  compiler's own generated templates (source: "generated") is a
   *  direct, provable function of this value (see buildResponseGroups()).
   *  Not a decorative passthrough: readiness.reasons names it too. */
  instrument: EarnedInstrument;
}

/* ------------------------------------------------------------------ */
/* Compiler input (Section 6.1 + the documented `receipts` addition)   */
/* ------------------------------------------------------------------ */

/** Phase 1 checkpoint round 3, item 3 (14 Aug 2026): the desk's own
 *  multi-select "wants" tier (ProjectDesk.tsx's own `NotedItem` type,
 *  reused here structurally) -- `id` is a STABLE semantic id assigned
 *  from a fixed taxonomy (e.g. "s-247"), never array position; `section`
 *  is a `ProcurementSectionKey` string when it names one of this
 *  document's own sections, otherwise `notedClauses()` (procurement-
 *  templates.ts) falls back to "additional" rather than producing an
 *  invalid clause section. */
export type NotedItem = {
  id: string;
  label: string;
  section: string;
  /** Phase 1 checkpoint round 4, item 1 (14 Aug 2026): true when this
   *  item arrived through a CLICKED multi-select option (ProjectDesk's
   *  own `own: true` tag on a twin-slot/chip landing); absent/false for
   *  a typed statement the extractor recognised in the buyer's own words
   *  (e.g. `statedObjectivesIn()`'s "objectives" ids). Robert: "Do not
   *  falsely describe a clicked selection as typed wording" -- this is
   *  the machine-readable distinction `notedClauses()` reads to word its
   *  `reason` honestly, and it is never used to fabricate a `quote`
   *  either way (a noted item is never given a verbatim buyer quote --
   *  see `notedClauses()`'s own `quote: null`). */
  own?: boolean;
};

/** Phase 1 checkpoint round 3, item 4 (14 Aug 2026): an explicit, typed
 *  signal that ONE authorised buyer prompt or governed direct edit
 *  occurred -- `cycle` reuses the SAME prompt-cycle counter every
 *  existing caller already threads through `mergeUpdates(prev, updates,
 *  cycle, source)` (draft.ts), so this is not a new concept, only a new
 *  place it is also reported. `changedFactIds` is the caller's own
 *  account of which facts this revision touched (from that same merge
 *  cycle's `MergeResult.changed`) -- carried through onto the returned
 *  document (`LivingProcurementDocument.lastRevision`) for truthful
 *  reporting/audit; the version-increment decision itself (below) keys
 *  ONLY on `cycle` being new relative to `previousDocument.lastRevision`,
 *  never on re-deriving "did something change" from `changedFactIds` --
 *  see `resolveVersion()`'s own comment for why. */
export type CompilerRevision = { cycle: number; changedFactIds: string[] };

export interface ProcurementCompilerInput {
  facts: WorkspaceFact[];
  requirement: SecurityRequirementInput;
  verdict: SecurityScopeVerdict | null;
  noted: NotedItem[];
  rfiSet: RfiQuestionSet | null;
  instrument: EarnedInstrument;
  receipts: ReceiptLike[];
  /** Phase 1 checkpoint correction, item 2 (13 Aug 2026): the durable
   *  canonical wording input -- source_ledger's own SourceLedgerEntry[]
   *  shape (source-ledger.ts), the SAME shape ProjectDesk.tsx's own
   *  `sourceTurns` state already carries (that state's type, `SourceTurn`,
   *  is a type alias for this one). Optional and defaulted to `[]` so
   *  every EXISTING caller (every Phase 1 fixture, none of which yet
   *  passes this field) is completely unaffected -- see
   *  mergeReceiptsWithSourceLedger()'s own comment (procurement-
   *  templates.ts) for the merge/de-duplication rule against `receipts`
   *  below, which is where the durability actually happens. */
  sourceTurns?: SourceLedgerEntry[];
  /** Phase 1 checkpoint round 3, item 4 (14 Aug 2026): Robert's own
   *  finding on the round-2 version gate -- "a pure compiler cannot
   *  reliably infer a successful prompt event merely from facts and
   *  receipts" (his own reproduction: `requirement.organisation.sector`
   *  changed with facts/receipts held identical, a real clause and title
   *  changed, and the version incorrectly stayed put, because nothing the
   *  round-2 gate diffed had moved). Optional and left UNDEFINED by every
   *  existing caller/fixture, which keeps the round-2 fact/receipts-diff
   *  gate exactly as it was (`resolveVersion()`'s own fallback branch) --
   *  completely backward compatible. A caller that adopts this field
   *  explicitly opts into the truthful, event-driven gate: `null` means
   *  "no authorised event this call" (a re-render, a reopen, a view
   *  switch) and never increments; a `CompilerRevision` whose `cycle` is
   *  new relative to `previousDocument.lastRevision` increments exactly
   *  once, REGARDLESS of whether the resulting change set happens to be
   *  empty or not -- the compiler stays pure (same inputs always produce
   *  the same version), it simply stops GUESSING whether an event
   *  happened and instead takes the caller's own word for it. */
  revision?: CompilerRevision | null;
  previousDocument: LivingProcurementDocument | null;
}

/* ------------------------------------------------------------------ */
/* Numbering: id is IMMUTABLE and HISTORY-FREE (Phase 1 checkpoint       */
/* round 2, item 1, 13 Aug 2026)                                        */
/* ------------------------------------------------------------------ */

/**
 * Robert's own finding on the FIRST checkpoint correction's fix
 * (`idRegistry`, threaded forward via `previousDocument`): "your
 * stable-ID fixture passes previousDocument from the pre-reload session
 * back into the compiler... a real browser reload cannot supply that
 * object." Confirmed by his own independent reproduction: recompiling the
 * SAME durable source ledger with `previousDocument=null` (a genuine
 * reload -- Phase 1 persists no compiled document anywhere, so this is
 * not a hypothetical) renumbers a surviving clause exactly the way the
 * pre-idRegistry bug did.
 *
 * THE FIX. Stop deriving identity from POSITION-among-siblings (an
 * ordinal, however carefully carried forward) and derive it instead from
 * the clause's own SEMANTIC identity: `templateKey`, which is already
 * content-derived and already the same for the same clause on every
 * compile, with or without history (every existing templateKey in this
 * file already satisfies this -- see e.g. `additionalRequirementClauses`'
 * own comment on why ITS templateKey is content-derived, not
 * ordinal-derived). `stableClauseId()` hashes it (SHA-256, truncated to
 * 8 hex chars -- roughly 4.3 billion values, so a COLLISION between two
 * DIFFERENT templateKeys within one document is astronomically unlikely
 * for any realistic clause count) and prefixes it with the clause's own
 * section code purely for legibility (NOT for uniqueness -- the hash
 * alone is already collision-resistant; a given templateKey always
 * belongs to exactly one section by construction, so this prefix can
 * never itself introduce ambiguity). There is no separate "display id":
 * this IS `id`, safe to show to a person, and it requires NOTHING from
 * any other compile, ever -- a fresh session, a genuine reload with
 * `previousDocument=null`, and an in-memory recompile all produce the
 * IDENTICAL id for the identical templateKey.
 *
 * `assignStableIds()` still defends against the (vanishingly unlikely)
 * case of two DIFFERENT templateKeys hashing to the same base id WITHIN
 * one compile: rather than silently letting one clause's id shadow the
 * other's (which would be a real, if extraordinarily rare, identity
 * bug), it disambiguates deterministically -- sorted templateKey order
 * fixes a total order for the suffix, so the SAME (still exceedingly
 * improbable) collision resolves the SAME way every time, never
 * silently, never by discovery order.
 */
/** Phase 3 Stage A correction round (14 Aug 2026), Robert's own audit:
 *  the first Stage A attempt replaced node:crypto's `createHash("sha256")`
 *  with a non-cryptographic FNV-1a hash to fix a real, separate problem --
 *  `compileProcurementDocument()` is now imported directly into a
 *  `"use client"` component (ProjectDesk.tsx), and node:crypto fails the
 *  production build outright the moment this module reaches the client
 *  bundle ("node:crypto ... Unhandled scheme" from webpack's client
 *  bundler). But swapping the ALGORITHM changes every existing clause,
 *  question, gate and decision id (they are all `stableClauseId()`-
 *  derived, directly or via the same section-code + hash pattern) --
 *  Robert's explicit instruction: "Do not ship the FNV-1a migration...
 *  Existing published or persisted documents must not acquire new ids
 *  merely because this UI is deployed."
 *
 *  THE FIX. Keep SHA-256 -- not a different, faster hash -- but stop
 *  depending on node:crypto's Node-only binding for it. `sha256Hex()`
 *  below is a small, dependency-free, synchronous, isomorphic SHA-256
 *  (FIPS 180-4) that runs identically in Node and in the browser (only
 *  TextEncoder and DataView, both universally available; no WebCrypto,
 *  which is asynchronous and would break this function's synchronous
 *  contract that every caller in this file relies on). It is verified
 *  byte-for-byte against node:crypto's own `createHash("sha256")` output
 *  for the empty string, "abc", the NIST two-block test vector, and every
 *  real templateKey this file's own known-vector fixture exercises (see
 *  scripts/validate-living-procurement-os-stage-a.ts's ID-STABILITY
 *  section). `stableClauseId()` itself is otherwise byte-for-byte
 *  unchanged from the pre-Stage-A implementation:
 *  `createHash("sha256").update(templateKey).digest("hex").slice(0, 8)`. */
function sha256Hex(message: string): string {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const bytes = new TextEncoder().encode(message);
  const bitLen = bytes.length * 8;
  // Next multiple of 64 bytes that leaves room for the 0x80 marker byte
  // plus an 8-byte big-endian bit-length field (FIPS 180-4 sec 5.1.1).
  const padLen = ((bytes.length + 8) >> 6) * 64 + 64;
  const buf = new Uint8Array(padLen);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  const dv = new DataView(buf.buffer);
  // 64-bit big-endian bit length split across two 32-bit writes -- every
  // templateKey this file ever hashes is far short of 2^32 bits, so the
  // high word is always the (exact) integer division below, never
  // approximated.
  dv.setUint32(padLen - 4, bitLen >>> 0, false);
  dv.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < padLen; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => x.toString(16).padStart(8, "0")).join("");
}

function stableClauseId(section: ProcurementSectionKey, templateKey: string): string {
  const hash = sha256Hex(templateKey).slice(0, 8);
  return `${SECTION_CODES[section]}-${hash}`;
}

function assignStableIds(drafts: ClauseDraft[]): Map<string, string> {
  const bySection = new Map<string, ProcurementSectionKey>();
  for (const d of drafts) if (!bySection.has(d.templateKey)) bySection.set(d.templateKey, d.section);

  const collisionGroups = new Map<string, string[]>(); // base id -> templateKeys sharing it
  for (const [templateKey, section] of bySection) {
    const base = stableClauseId(section, templateKey);
    const group = collisionGroups.get(base) ?? [];
    group.push(templateKey);
    collisionGroups.set(base, group);
  }

  const idForKey = new Map<string, string>();
  for (const [base, keys] of collisionGroups) {
    if (keys.length === 1) {
      idForKey.set(keys[0], base);
      continue;
    }
    // Extraordinarily unlikely (see stableClauseId's own comment) --
    // resolved deterministically, never silently: a fixed sort order,
    // never discovery order, decides which templateKey keeps the bare
    // base id and which gets a numbered suffix.
    const sorted = [...keys].sort();
    sorted.forEach((k, i) => idForKey.set(k, i === 0 ? base : `${base}-${i + 1}`));
  }
  return idForKey;
}

/** New templateKeys within the SAME compile are still processed in
 *  templateKey-sorted order (never discovery/array-position order) so
 *  the output `clauses` array itself stays deterministic (Section 14.5,
 *  "Deterministic") -- this no longer affects WHICH id a clause gets
 *  (that is now a pure function of templateKey alone, order-independent),
 *  only the ORDER of the returned array, which downstream code (change
 *  diffing, byte-identical-recompile checks) already expects to be
 *  stable given the same input. */
function numberClauses(drafts: ClauseDraft[]): ProcurementClause[] {
  const idForKey = assignStableIds(drafts);
  const bySection = new Map<ProcurementSectionKey, ClauseDraft[]>();
  for (const d of drafts) {
    const list = bySection.get(d.section) ?? [];
    list.push(d);
    bySection.set(d.section, list);
  }
  const out: ProcurementClause[] = [];
  for (const section of Object.keys(SECTION_CODES) as ProcurementSectionKey[]) {
    const list = bySection.get(section);
    if (!list || !list.length) continue;
    const sorted = [...list].sort((a, b) => a.templateKey.localeCompare(b.templateKey));
    for (const d of sorted) {
      const id = idForKey.get(d.templateKey)!;
      // clauseWeight() is a pure function of {mandatory, origin} only, so
      // it is safe to compute here, alongside numbering -- every
      // ProcurementClause this module ever returns already carries its
      // real weight; nothing downstream reads a placeholder.
      out.push({ ...d, id, weight: clauseWeight(d) });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Supplier response groups (Section 3.5's four fixed groups). Reuses   */
/* CATEGORY_FOR_SECTION (procurement-readiness.ts) rather than keeping  */
/* a second, independently-maintained section->bucket map: the four     */
/* response groups here and the four evaluation categories below are    */
/* the SAME four buckets (Section 3.6's "Resilience, security, service  */
/* and delivery weights" names the same groups Section 3.5 groups       */
/* questions into), so ResponseGroupKey IS EvaluationCategoryKey.       */
/* ------------------------------------------------------------------ */

const GROUP_TITLES: Record<ResponseGroupKey, string> = {
  network_resilience: "Network and resilience",
  security_identity_data: "Security, identity and data",
  managed_service_delivery: "Managed service and delivery",
  commercial: "Commercial response",
};

/** One answer format per clause, chosen deterministically from its
 *  section and mandatory/scored status (Section 3.5: "Every question must
 *  specify an answer format: narrative, metric, diagram, compliance
 *  matrix, dated plan, live demonstration or documentary evidence."). */
function answerFormatFor(clause: ProcurementClause): AnswerFormat {
  if (clause.section === "project") return "dated_plan";
  if (clause.section === "commercial") return "documentary_evidence";
  if (clause.section === "security" && /residency|complian/i.test(clause.statement)) return "compliance_matrix";
  if (clause.acceptanceTest && /(evidence|test|failover|demonstrat)/i.test(clause.acceptanceTest)) return "live_demonstration";
  if (clause.evidence.some((e) => /metric|time|latency|jitter|loss|availability|throughput|sla/i.test(e))) return "metric";
  if (clause.section === "network" || clause.section === "application") return "diagram";
  return "narrative";
}

/**
 * Phase 1 checkpoint correction, item 4 (13 Aug 2026): "the compiler does
 * not create a second, conflicting question taxonomy" against the
 * question bank deriveRfiQuestionSet() already earns (instrument.ts,
 * QUESTION_BANK -- 386 analyst-written, genuinely SUPPLIER-facing
 * questions, e.g. Q-IZ-01 "Describe how your platform enforces zero trust
 * access..."). Every one of these bank categories asks materially the
 * SAME thing one of this compiler's own templates already generates a
 * per-clause question for -- Identity/ZTNA vs identity-aware-ztna,
 * SWG/CASB/DLP vs dlp-coverage, Data Residency vs uk-data-residency,
 * Service Model vs managed-service-boundary, Deployment vs
 * dated-transition-plan, SD-WAN Integration vs network-architecture-
 * scope. Mapped ONLY where that real overlap exists -- FWaaS/Threat,
 * Logging/SIEM and Commercials have no compiler template at all in Phase
 * 1 (no clause exists for the bank category to attach to), and
 * mpls-coexistence is deliberately left unmapped (see the comment below)
 * -- so this map documents an EXACT, checked incompatibility rather than
 * forcing a reuse that doesn't fit, exactly as Robert's instruction
 * allows ("If an existing question cannot be reused, document the exact
 * incompatibility").
 *
 * earnedQuestions() (questions.ts) is NOT in this map at all: it is a
 * different taxonomy serving a different surface -- BUYER-facing
 * gap-filling chips ("Which sector are you in?") that gather a missing
 * FACT, rendered on the desk's own question rail, not a SUPPLIER-facing
 * evidence request rendered in a Supplier Pack. The two are not
 * interchangeable: an EarnedQuestion has no clauseId, no answerFormat, no
 * evidenceRequested, and answers into the FACT LEDGER via QuestionAnswer
 * (items/note/path/dismiss) -- there is no SupplierQuestion shape it
 * could honestly be cast into. One narrow, honest overlap is worth
 * naming even though it is not a reuse case: OD-timeline-unstated
 * (procurement-readiness.ts) and questions.ts's own q-contract-end share
 * an identical trigger ("no constraints.timeline stated") but serve
 * different surfaces (this document's Open Decisions panel vs the desk's
 * question rail) -- a Phase 2 UI-composition concern (not showing BOTH
 * redundantly on the SAME screen), not a compiler taxonomy duplication;
 * flagged here rather than silently left for Phase 2 to discover.
 */
const CLAUSE_BANK_CATEGORY: Partial<Record<string, string>> = {
  "identity-aware-ztna": "Identity / ZTNA",
  "dlp-coverage": "SWG / CASB / DLP",
  "uk-data-residency": "Data Residency",
  "managed-service-boundary": "Service Model",
  "dated-transition-plan": "Deployment",
  "network-architecture-scope": "SD-WAN Integration",
  // mpls-coexistence ALSO conceptually overlaps "SD-WAN Integration", but
  // that bank category carries only 2 questions total (Q-SD-01/02) --
  // deliberately left unmapped rather than splitting an already-small
  // question set across two clauses with no principled rule for WHICH
  // clause gets which question. The category-exclusivity rule below (one
  // category attaches to at most one clause, the lowest-id match) means
  // network-architecture-scope claims "SD-WAN Integration" first when
  // both are present; mpls-coexistence always keeps its own generated
  // questions. Documented here as the exact, checked reason, not left
  // implicit.
};

/**
 * Reuses the earned RFI bank's own question text for a clause, in place
 * of this compiler's generated supplierResponse wording -- NEVER both,
 * which is how "an existing RFI question and a generated clause question
 * do not appear twice" is guaranteed structurally rather than by a
 * separate similarity check:
 *
 *   - `instrument` gates this ENTIRELY: at "sor" (the RFI has not been
 *     earned -- instrument.ts's own "no derivation, no rendering" law),
 *     no bank text is ever attached to any clause, regardless of what
 *     `rfiSet` contains. This is the promised, provable effect of
 *     instrument state on this document's own output, not a decorative
 *     passthrough.
 *   - Once earned ("rfi"/"rfp"), a bank CATEGORY attaches to AT MOST ONE
 *     clause: clauses are walked in ascending `id` order (already
 *     stable, item 1), and the first clause whose CLAUSE_BANK_CATEGORY
 *     maps to a category `rfiSet` actually earned claims that category's
 *     FULL question set, verbatim, each carrying `source: "bank"` and
 *     its own bank `id` as `bankQuestionId`. Every other clause --
 *     including a second clause that would have mapped to the SAME
 *     category -- keeps its own generated questions (`source:
 *     "generated"`, `bankQuestionId: null`). No category's text is ever
 *     attached to two clauses, and no clause ever carries both a bank
 *     and a generated question for the same requirement.
 *
 *  `evidenceRequested` still comes from the CLAUSE's own `evidence` list
 *  even for a bank-sourced question: the bank's own BankCanonicalQuestion
 *  shape carries no evidence field at all (it is a question-text
 *  taxonomy, not an evidence taxonomy) -- reusing the compiler's own,
 *  already-specific evidence list is not a duplication of anything the
 *  bank provides.
 */
function questionsForClause(clause: ProcurementClause, bankQuestions: BankCanonicalQuestion[] | null): SupplierQuestion[] {
  if (bankQuestions && bankQuestions.length) {
    return bankQuestions.map((q, i) => ({
      id: `Q-${clause.id}-${i + 1}`,
      clauseId: clause.id,
      text: q.text,
      answerFormat: answerFormatFor(clause),
      evidenceRequested: clause.evidence,
      source: "bank" as const,
      bankQuestionId: q.id,
    }));
  }
  return clause.supplierResponse.map((text, i) => ({
    id: `Q-${clause.id}-${i + 1}`,
    clauseId: clause.id,
    text,
    answerFormat: answerFormatFor(clause),
    evidenceRequested: clause.evidence,
    source: "generated" as const,
    bankQuestionId: null,
  }));
}

function buildResponseGroups(clauses: ProcurementClause[], rfiSet: RfiQuestionSet | null, instrument: EarnedInstrument): SupplierResponseGroup[] {
  const bankByCategory = new Map<string, BankCanonicalQuestion[]>();
  if (instrument !== "sor" && rfiSet) {
    for (const c of rfiSet.canonical) bankByCategory.set(c.category, c.questions);
  }
  const usedCategories = new Set<string>();
  const byGroup = new Map<ResponseGroupKey, SupplierQuestion[]>();
  const sortedClauses = [...clauses].sort((a, b) => a.id.localeCompare(b.id));
  for (const clause of sortedClauses) {
    const group = CATEGORY_FOR_SECTION[clause.section];
    const bankCategory = CLAUSE_BANK_CATEGORY[clause.templateId];
    let bankQuestions: BankCanonicalQuestion[] | null = null;
    if (bankCategory && !usedCategories.has(bankCategory) && bankByCategory.has(bankCategory)) {
      bankQuestions = bankByCategory.get(bankCategory) ?? null;
      usedCategories.add(bankCategory);
    }
    const qs = byGroup.get(group) ?? [];
    qs.push(...questionsForClause(clause, bankQuestions));
    byGroup.set(group, qs);
  }
  const order: ResponseGroupKey[] = ["network_resilience", "security_identity_data", "managed_service_delivery", "commercial"];
  return order
    .filter((k) => (byGroup.get(k) ?? []).length > 0)
    .map((k) => ({ key: k, title: GROUP_TITLES[k], questions: byGroup.get(k) ?? [] }));
}

/* ------------------------------------------------------------------ */
/* Evaluation gates (Section 5.4: mandatory clauses, pass/fail)        */
/* ------------------------------------------------------------------ */

function buildGates(clauses: ProcurementClause[]): EvaluationGate[] {
  return clauses
    .filter((c) => c.mandatory)
    .map((c) => ({
      id: `GATE-${c.id}`,
      label: c.statement.length > 80 ? `${c.statement.slice(0, 77)}...` : c.statement,
      clauseIds: [c.id],
      description: `Pass/fail: the supplier's response to ${c.id} must satisfy "${c.acceptanceTest ?? c.statement}".`,
    }));
}

/* ------------------------------------------------------------------ */
/* Provenance and summary                                              */
/* ------------------------------------------------------------------ */

function buildProvenance(clauses: ProcurementClause[]): ProvenanceSummary {
  return {
    buyer: clauses.filter((c) => c.origin === "buyer").length,
    netify: clauses.filter((c) => c.origin === "netify").length,
    sector: clauses.filter((c) => c.origin === "sector").length,
    buyer_override: clauses.filter((c) => c.origin === "buyer_override").length,
  };
}

/** Section 9.1/16.1's own acceptance wording ("The document summary
 *  includes patient-facing applications, Teams Phone, Azure...") names
 *  concepts that live only in COMPILER-derived clauses (voice/application/
 *  identity), not in requirement fields -- so the summary reads both:
 *  requirement facts first (sector, region, sites, users, cloud), then
 *  the named subjects of the clauses this compile actually produced,
 *  each still tied to the templateId that named it (never a free
 *  restatement of clause text). */
function buildTitleAndSummary(requirement: SecurityRequirementInput, clauses: ProcurementClause[]): { title: string; summary: string } {
  const sector = requirement.organisation?.sector;
  const sites = requirement.estate?.sites;
  const titleParts = [sector ? String(sector) : "Sourcing", "procurement"];
  if (sites) titleParts.push(`(${sites} sites)`);
  const title = titleParts.join(" ");

  const bits: string[] = [];
  if (sector) bits.push(String(sector));
  if (requirement.organisation?.regions?.length) bits.push(requirement.organisation.regions.join("/").toUpperCase());
  if (sites) bits.push(`${sites} sites`);
  if (requirement.estate?.users) bits.push(`${requirement.estate.users} remote users`);
  const cloud = requirement.estate?.cloud ?? [];
  if (cloud.length) bits.push(cloud.join(", "));

  const has = (templateId: string) => clauses.some((c) => c.templateId === templateId);
  if (has("voice-continuity")) bits.push("Teams Phone");
  if (has("application-resilience")) bits.push("patient-facing application");
  if (has("identity-aware-ztna")) bits.push("Entra ID");
  if (has("legacy-circuit-coexistence")) bits.push("retained private Ethernet circuit");

  const summary = bits.length
    ? `${bits.join(", ")}. ${clauses.length} testable requirement${clauses.length === 1 ? "" : "s"} compiled from the buyer's own words.`
    : `${clauses.length} testable requirement${clauses.length === 1 ? "" : "s"} compiled from the buyer's own words.`;
  return { title, summary };
}

/* ------------------------------------------------------------------ */
/* Change set (Section 14.6: real diff against previousDocument)       */
/* ------------------------------------------------------------------ */

function diffIds<T extends { templateKey: string; id: string }>(prev: T[] | undefined, next: T[]): ChangeList {
  const prevByKey = new Map((prev ?? []).map((x) => [x.templateKey, x]));
  const nextByKey = new Map(next.map((x) => [x.templateKey, x]));
  const added = next.filter((x) => !prevByKey.has(x.templateKey)).map((x) => x.id);
  const removed = (prev ?? []).filter((x) => !nextByKey.has(x.templateKey)).map((x) => x.id);
  const updated = next
    .filter((x) => prevByKey.has(x.templateKey))
    .filter((x) => JSON.stringify(prevByKey.get(x.templateKey)) !== JSON.stringify(x))
    .map((x) => x.id);
  return { added, updated, removed };
}

/** Phase 1 checkpoint round 2, item 4 (13 Aug 2026): the STANDING fact id
 *  -> value map this compile sees -- `factId(path, value)` (draft.ts) is
 *  already the SAME stable scalar/list identity mergeRequirementBase()
 *  and mergeUpdates() rely on (a scalar's id is its path alone; a list
 *  value's id is `path:normalisedValue`), so diffing THIS map against the
 *  previous compile's own snapshot is a real, deterministic fact-level
 *  change, computed self-contained from what the compiler already
 *  receives -- no ProjectDesk.tsx dependency, no second store. */
export function factSnapshotOf(facts: WorkspaceFact[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of standing(facts)) out[f.id] = f.value;
  return out;
}

/** Section 14.6: real fact-level change, replacing the earlier hard-coded
 *  `{added:[],updated:[],removed:[]}` placeholder (Robert's checkpoint
 *  round 2, item 4). `added`: a fact id that stands now but did not
 *  before (a genuinely new fact, OR a list value re-added after removal).
 *  `removed`: stood before, does not now (struck, or a list value
 *  dropped). `updated`: the SAME id stands in both, but its value
 *  differs -- this only meaningfully happens for a SCALAR path (a list
 *  value's own id already encodes its value, so a list "update" is always
 *  an add+remove pair, never a same-id value change). */
export function diffFacts(prevSnapshot: Record<string, unknown> | undefined, nextSnapshot: Record<string, unknown>): ChangeList {
  const prevIds = new Set(Object.keys(prevSnapshot ?? {}));
  const nextIds = new Set(Object.keys(nextSnapshot));
  const added = [...nextIds].filter((id) => !prevIds.has(id));
  const removed = [...prevIds].filter((id) => !nextIds.has(id));
  const updated = [...nextIds].filter((id) => prevIds.has(id) && JSON.stringify((prevSnapshot as Record<string, unknown>)[id]) !== JSON.stringify(nextSnapshot[id]));
  return { added, updated, removed };
}

function buildChangeSet(
  previousDocument: LivingProcurementDocument | null,
  factSnapshot: Record<string, unknown>,
  clauses: ProcurementClause[],
  responseGroups: SupplierResponseGroup[],
  gates: EvaluationGate[],
  categories: EvaluationCategory[],
): ProcurementChangeSet {
  const factChange = diffFacts(previousDocument?.factSnapshot, factSnapshot);

  const prevClauses = previousDocument?.clauses;
  const clauseChange = diffIds(prevClauses, clauses);

  const prevQuestions = (previousDocument?.responseGroups ?? []).flatMap((g) => g.questions).map((q) => ({ ...q, templateKey: q.id }));
  const nextQuestions = responseGroups.flatMap((g) => g.questions).map((q) => ({ ...q, templateKey: q.id }));
  const questionChange = diffIds(prevQuestions, nextQuestions);

  const prevGates = (previousDocument?.evaluation.gates ?? []).map((g) => ({ ...g, templateKey: g.id }));
  const nextGates = gates.map((g) => ({ ...g, templateKey: g.id }));
  const gateChange = diffIds(prevGates, nextGates);

  const before: Record<string, number> = {};
  for (const c of previousDocument?.evaluation.categories ?? []) before[c.key] = c.weight;
  const after: Record<string, number> = {};
  for (const c of categories) after[c.key] = c.weight;

  const prevSections = new Set((previousDocument?.clauses ?? []).map((c) => c.section));
  const nextSections = new Set(clauses.map((c) => c.section));
  const sectionsAdded = [...nextSections].filter((s) => !prevSections.has(s));
  const sectionsRemoved = [...prevSections].filter((s) => !nextSections.has(s));

  return {
    facts: factChange,
    clauses: clauseChange,
    questions: questionChange,
    gates: gateChange,
    weights: { before, after },
    sections: { added: sectionsAdded, removed: sectionsRemoved },
  };
}

/**
 * THE BUG (Phase 1 checkpoint round 3, item 4, 14 Aug 2026). The round-2
 * gate incremented the version when `changeSet.facts` was non-empty OR
 * the merged receipts text differed from `previousDocument.receiptsSnapshot`
 * -- but Robert's own reproduction changed neither: the SAME facts and
 * receipts, recompiled with `requirement.organisation.sector` set
 * directly (never routed through a WorkspaceFact), produced a genuinely
 * different document (a new security clause, a new title) while the
 * version stayed put. A pure compiler cannot reliably tell "an authorised
 * event occurred" from its own facts/receipts snapshots alone -- those
 * are only TWO of the several inputs (`requirement` itself among them)
 * that can change what this document says.
 *
 * THE FIX. `ProcurementCompilerInput.revision`, an explicit signal the
 * CALLER supplies (see its own doc comment) rather than a signal the
 * compiler tries to infer. Two branches:
 *
 *  - `input.revision === undefined` (every existing caller/fixture that
 *    predates this contract): falls back to the round-2 fact/receipts
 *    diff gate, byte-for-byte unchanged -- full backward compatibility,
 *    nothing already shipped needs to adopt the new field to keep working
 *    exactly as it did.
 *  - `input.revision` explicitly provided (`null` or a `CompilerRevision`):
 *    the NEW event-driven gate takes over completely for this document's
 *    chain. `null` means "no authorised event this call" (a re-render, a
 *    reopen, a view switch) -- never increments. A `CompilerRevision`
 *    whose `cycle` differs from `previousDocument.lastRevision?.cycle`
 *    is a genuinely NEW event -- increments EXACTLY once, whether or not
 *    the resulting change set is empty (an authorised prompt/edit still
 *    counts even if it happened to produce no visible difference -- the
 *    brief's own "every successful prompt increments the version," not
 *    "every prompt that changes something"). The SAME `cycle` seen again
 *    (a caller re-invoking with the identical revision -- e.g. a
 *    double-render) is treated as the SAME event replayed, not a new
 *    one -- idempotent, no increment.
 *
 * The compiler remains pure throughout: identical `input` (revision
 * included) always yields the identical `version`. What changed is WHERE
 * the "did an event happen" fact comes from -- an explicit input the
 * caller is positioned to know truthfully, not a guess reconstructed from
 * two derived snapshots that do not cover every input this document
 * depends on.
 */
function resolveVersion(
  previousDocument: LivingProcurementDocument | null,
  revision: CompilerRevision | null | undefined,
  factsChanged: boolean,
  receiptsChanged: boolean,
): { version: number; lastRevision: CompilerRevision | null } {
  if (!previousDocument) return { version: 1, lastRevision: revision ?? null };

  if (revision !== undefined) {
    const prevCycle = previousDocument.lastRevision?.cycle ?? null;
    const isNewEvent = revision !== null && revision.cycle !== prevCycle;
    return isNewEvent
      ? { version: previousDocument.version + 1, lastRevision: revision }
      : { version: previousDocument.version, lastRevision: previousDocument.lastRevision };
  }

  // Legacy fallback (Phase 1 checkpoint round 2, item 4): no revision
  // info supplied at all -- every fixture/caller that predates this
  // round. Unchanged: the version increments once per real fact or
  // receipts-derived change, never merely because previousDocument was
  // supplied.
  const somethingChanged = factsChanged || receiptsChanged;
  return {
    version: somethingChanged ? previousDocument.version + 1 : previousDocument.version,
    lastRevision: previousDocument.lastRevision ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Governed-revision adapter (Phase 1 checkpoint round 4, item 4,       */
/* 14 Aug 2026)                                                         */
/* ------------------------------------------------------------------ */

/**
 * THE GAP. Round 3's `ProcurementCompilerInput.revision` proved the
 * COMPILER can honour an explicit revision honestly (`resolveVersion()`
 * above) -- but Robert's own audit found the round-3 FIXTURE was the only
 * thing constructing a `CompilerRevision`, by hand, once per test case.
 * That is not yet a claim about how a REAL caller obtains one: "cycleRef
 * advances through applyMerge(); noted selections/removals do not
 * necessarily pass through applyMerge(); direct requirement/document
 * edits may not advance it" -- so a real Phase 2 caller has no single,
 * honest counter every governed event already flows through.
 * `changedFactIds` was also merely the caller's own unverified assertion,
 * not a real diff -- "must not be described as truthful audit data when
 * it is merely caller-asserted."
 *
 * THE FIX. A small, pure, production-shaped reducer any Phase 2 caller
 * can adopt UNCHANGED, for every governed event kind Robert named:
 * a successful prompt/extraction cycle, a click-selected fact, a
 * noted-item add, a noted-item remove, a fact/list removal, a direct
 * governed requirement edit, a no-op render/reopen, a replay of the same
 * event, and a stale/out-of-order event. It does NOT wire the Canvas UI
 * (Robert: "Do not wire the full Canvas UI in this round") -- it proves
 * the CONTRACT is honestly implementable, so Phase 2 adopts a tested
 * reducer rather than inventing this arithmetic ad hoc.
 *
 * THE IDENTITY MODEL. Two fields carry the whole design, deliberately NOT
 * a browser render count (Robert: "do not make browser render count the
 * source of truth" -- also suitable, unlike a render count, for later
 * persistence and multi-client collaboration):
 *
 *  - `eventId`: a STABLE, content-addressable identity for the concrete
 *    real-world action (e.g. `noted-add:s-247:42`, `fact-click:
 *    procurement.buying=sase:17`) -- a caller constructs it from the
 *    action's own content plus its own local sequence number, never from
 *    render count. Seeing the SAME `eventId` again is, by construction,
 *    the SAME event replayed (a double-render, a retried request), not a
 *    new one -- REPLAY, never a second increment.
 *  - `seq`: a per-session MONOTONIC sequence the caller assigns as events
 *    occur. Used ONLY to detect an event arriving OUT OF ORDER relative
 *    to what this reducer has ALREADY applied -- an event whose `seq`
 *    does not exceed the last APPLIED `seq` is STALE and never applied,
 *    regardless of what its own `eventId`/would-be `cycle` claims (this
 *    is the fix for Robert's "an older/stale event must not increment
 *    merely because its cycle differs" -- `cycle` here is never taken
 *    from the caller at all; it is this reducer's OWN monotonic count of
 *    events it has itself accepted, so a stale event has no `cycle` to
 *    assert in the first place).
 *
 * `factsBefore`/`factsAfter` are real fact-id -> value snapshots (the
 * SAME shape `factSnapshotOf()` above already produces, exported for
 * exactly this use) -- `changedFactIds` is COMPUTED from `diffFacts()`
 * at resolution time, never taken as the caller's own claim. A noted-only
 * or direct-requirement-only event (no WorkspaceFact touched at all)
 * legitimately passes `factsBefore === factsAfter`; the resulting
 * `changedFactIds` is then honestly empty, not a fabricated list.
 *
 * A "no governed event this call" (a render, a view switch, a reopen) is
 * represented by passing `event: null` -- never a sentinel event object,
 * so there is nothing a caller could get wrong by constructing one.
 */
export type GovernedEventKind =
  | "prompt_cycle"
  | "fact_click"
  | "noted_add"
  | "noted_remove"
  | "fact_removal"
  | "requirement_edit"
  /** Phase 2 (14 Aug 2026): a real production caller -- rfp-publish.ts's
   *  executePublish() -- now applies this reducer to the RFP/project
   *  lifecycle, not only Living Canvas facts. `resolveGovernedRevision()`
   *  itself never branches on `kind` (kind is documentation, not control
   *  flow), so adding this variant is purely additive and changes no
   *  existing behaviour for the five kinds above. */
  | "publish";

export type GovernedEvent = {
  /** Stable, content-addressable identity -- see this section's own
   *  comment. The SAME real action must always produce the SAME
   *  `eventId`; two DIFFERENT actions must never collide. */
  eventId: string;
  kind: GovernedEventKind;
  /** Per-session monotonic sequence -- used only for staleness detection
   *  (never as identity by itself: two callers could coincidentally
   *  reuse a `seq`, but never the same `eventId`). */
  seq: number;
  /** Real fact-id -> value snapshots (factSnapshotOf()'s own shape)
   *  immediately before and after this event -- identical objects for an
   *  event that touched no WorkspaceFact at all (a noted-only or direct
   *  requirement-only edit). */
  factsBefore: Record<string, unknown>;
  factsAfter: Record<string, unknown>;
};

export type GovernedRevisionState = {
  lastAppliedEventId: string | null;
  lastAppliedSeq: number;
  cycle: number;
};

/** The starting state for a fresh document chain -- exported so a caller
 *  (and every fixture below) starts from the SAME zero state this module
 *  itself defines, never a hand-rolled `{cycle: 0, ...}` literal that
 *  could silently drift from what `resolveGovernedRevision()` actually
 *  expects as its own baseline. */
export const INITIAL_GOVERNED_REVISION_STATE: GovernedRevisionState = {
  lastAppliedEventId: null,
  lastAppliedSeq: 0,
  cycle: 0,
};

export type GovernedRevisionResult = {
  state: GovernedRevisionState;
  /** Feed directly into `ProcurementCompilerInput.revision` -- `null`
   *  whenever this call must NOT increment (a reopen, a replay, a stale
   *  event), a real `CompilerRevision` whenever it must (exactly once). */
  revision: CompilerRevision | null;
  applied: boolean;
  reason: "applied" | "reopen" | "replay" | "stale";
};

/**
 * Pure and synchronous, like every function in this file. Deterministic:
 * the SAME `(state, event)` pair always returns the SAME result, so a
 * caller (or a fixture) can replay a whole event log and land on the
 * identical state every time -- itself a property Phase 2 persistence
 * will need.
 */
export function resolveGovernedRevision(state: GovernedRevisionState, event: GovernedEvent | null): GovernedRevisionResult {
  if (!event) return { state, revision: null, applied: false, reason: "reopen" };
  if (event.eventId === state.lastAppliedEventId) return { state, revision: null, applied: false, reason: "replay" };
  if (event.seq <= state.lastAppliedSeq) return { state, revision: null, applied: false, reason: "stale" };

  const factChange = diffFacts(event.factsBefore, event.factsAfter);
  const changedFactIds = [...factChange.added, ...factChange.updated, ...factChange.removed];
  const nextState: GovernedRevisionState = {
    lastAppliedEventId: event.eventId,
    lastAppliedSeq: event.seq,
    cycle: state.cycle + 1,
  };
  return {
    state: nextState,
    revision: { cycle: nextState.cycle, changedFactIds },
    applied: true,
    reason: "applied",
  };
}

/* ------------------------------------------------------------------ */
/* The compiler                                                        */
/* ------------------------------------------------------------------ */

export function compileProcurementDocument(input: ProcurementCompilerInput): LivingProcurementDocument {
  const { facts, requirement, verdict, rfiSet, instrument, previousDocument } = input;
  const buying = buyingOf(facts);
  const sourceTurns = input.sourceTurns ?? [];

  // Phase 1 checkpoint correction, item 2 (13 Aug 2026): the durable
  // canonical wording input. `sourceTurns` defaults to `[]`, so every
  // EXISTING caller that has not been updated to pass it (every Phase 1
  // fixture) degrades to exactly `receipts`, unchanged -- see
  // mergeReceiptsWithSourceLedger()'s own comment for the merge rule.
  const receipts = mergeReceiptsWithSourceLedger(sourceTurns, input.receipts);

  // Widened to include RAW source-turn text, not just unplaced-clause
  // receipts: the extractor's own deterministic rules "structurally
  // explain" a phrase like an operating-model statement during turn
  // replay, so it never survives into `unplacedClauses`/`receipts` -- it
  // would otherwise be entirely absent from this corpus after a reopen,
  // where `facts` is always `[]`.
  const corpus = [...standing(facts).map((f) => f.quote ?? String(f.value)), ...receipts.map((r) => r.text), ...sourceTurns.map((t) => t.text)].join(" ");

  // Phase 1 checkpoint round 2, item 2 (13 Aug 2026): operatingModelOf(facts)
  // alone cannot survive reopen (facts is never rehydrated -- see
  // resumeStateFromProject()); the chronological fallback below only fires
  // when no WorkspaceFact resolved a model, and reduces the durable ledger
  // in ORDER (later explicit statement supersedes earlier), not as an
  // unordered bag of words -- see operatingModelFromHistory's own comment
  // for Robert's exact reproduction this replaces the old corpus-presence
  // test to fix.
  const history = chronologicalHistory(sourceTurns, receipts);
  const historyModel = operatingModelFromHistory(history);
  const opModel = operatingModelOf(facts) ?? historyModel.model;
  // Phase 2 (14 Aug 2026): the canonical support-coverage state (24x7 /
  // business_hours / other_stated / unresolved), converging the buyer's
  // retained wording AND any explicit noted 24x7 selection into ONE
  // resolution -- see resolveSupportCoverage()'s own comment. Computed
  // once here, at the same level `historyModel` is, and threaded down so
  // managedServiceClause() consumes this single result rather than
  // re-deriving it.
  const historyHours = resolveSupportCoverage(history, input.noted ?? []);

  const pack = activePack(requirement);
  const flavours = pack ? activeFlavours(pack, corpus) : [];

  const removalTargets = resolveReceiptRemovals(receipts);
  const candidates: ClauseDraft[] = buildCandidateClauses({
    facts,
    requirement,
    buying,
    opModel,
    receipts,
    removalTargets,
    pack,
    flavours,
    sourceTurns,
    noted: input.noted,
    supportCoverage: historyHours,
  });

  const clauses = numberClauses(candidates);
  const responseGroups = buildResponseGroups(clauses, rfiSet, instrument);
  const gates = buildGates(clauses);

  const rawCategoryTotals: Record<EvaluationCategoryKey, number> = {
    network_resilience: 0,
    security_identity_data: 0,
    managed_service_delivery: 0,
    commercial: 0,
  };
  for (const c of clauses) rawCategoryTotals[CATEGORY_FOR_SECTION[c.section]] += c.weight;
  const balanced = balanceCategoriesTo100(rawCategoryTotals);
  const categories: EvaluationCategory[] = (Object.keys(DEFAULT_CATEGORY_WEIGHTS) as EvaluationCategoryKey[]).map((key) => ({
    key,
    label: GROUP_TITLES[key],
    weight: balanced[key],
    source: clauses.some((c) => CATEGORY_FOR_SECTION[c.section] === key && c.origin === "sector") ? "sector" : "default",
  }));

  const architecture = buildArchitecture({ requirement, clauses, receipts, buying });
  const openDecisions = buildOpenDecisions({
    requirement,
    buying,
    opModel,
    receipts,
    verdict,
    clauses,
    // Phase 1 checkpoint round 2, item 2: a genuinely unresolved same-turn
    // contradiction (two model names, no correction signal to pick one)
    // becomes a visible decision, never a silent guess.
    operatingModelAmbiguousText: historyModel.ambiguousText,
    // Phase 2 (14 Aug 2026): a genuine support-coverage ambiguity (an
    // explicit "no preference" statement, or a clicked 24x7 selection
    // conflicting with explicit textual wording) becomes a visible
    // decision too, never silently resolved either way -- Robert:
    // "prevent the system from publishing an inverted support
    // requirement."
    supportCoverageAmbiguousText: historyHours.ambiguous ? historyHours.ambiguousText : null,
  });
  const bankQuestionCount = responseGroups.reduce((n, g) => n + g.questions.filter((q) => q.source === "bank").length, 0);
  const readiness = buildReadiness({
    requirement,
    buying,
    opModel,
    clauses,
    openDecisions,
    gates,
    instrument,
    bankQuestionCount,
    rfiBankVersion: rfiSet?.version ?? null,
  });
  const { title, summary } = buildTitleAndSummary(requirement, clauses);
  const provenance = buildProvenance(clauses);
  const factSnapshot = factSnapshotOf(facts);
  const receiptsSnapshot = receipts.map((r) => r.text);
  const changeSet = buildChangeSet(previousDocument, factSnapshot, clauses, responseGroups, gates, categories);

  const factsChanged = changeSet.facts.added.length + changeSet.facts.updated.length + changeSet.facts.removed.length > 0;
  const receiptsChanged = previousDocument ? JSON.stringify(previousDocument.receiptsSnapshot) !== JSON.stringify(receiptsSnapshot) : false;
  const { version, lastRevision } = resolveVersion(previousDocument, input.revision, factsChanged, receiptsChanged);

  return {
    version,
    title,
    summary,
    readiness,
    counts: {
      requirements: clauses.length,
      questions: responseGroups.reduce((n, g) => n + g.questions.length, 0),
      gates: gates.length,
      decisions: openDecisions.length,
    },
    architecture,
    clauses,
    responseGroups,
    evaluation: { gates, categories },
    openDecisions,
    provenance,
    changeSet,
    factSnapshot,
    receiptsSnapshot,
    lastRevision,
    instrument,
  };
}

/* ------------------------------------------------------------------ */
/* Persistence (2030 blueprint, full-unification phase, 17 Aug 2026)    */
/* ------------------------------------------------------------------ */

/**
 * WHY THIS EXISTS. The user's own code-review of the prior checkpoint work
 * (17 Aug 2026) found, correctly, that the platform still has THREE related
 * but non-identical canonical objects: the durable ProjectDetails+ledgers,
 * the regenerated (never persisted) LivingProcurementDocument, and the
 * immutable published snapshot (still frozen from the legacy `rfp_sections`
 * pipeline, per published-snapshot.ts's own scope note). Directed to unify
 * them, the obstacle is real and worth stating plainly: `compileProcurement
 * Document()`'s `facts: WorkspaceFact[]` input is NOT reconstructable
 * server-side from anything currently persisted (see source-ledger.ts's own
 * "there is nothing to restore them FROM" comment) -- a server-side
 * recompile-on-read would silently produce a wrong, facts-empty document.
 *
 * THE DESIGN THIS SIDESTEPS THAT OBSTACLE, RATHER THAN SOLVING THE
 * UNSOLVABLE VERSION OF IT: this compiler is pure and 100% deterministic
 * given its inputs (Section 8.5's own "never performs I/O" rule); the
 * client (ProjectDesk.tsx) already holds the live `facts` and already
 * compiles the document on every relevant state change via its
 * `compiledDocument` useMemo. So the server never recomputes -- it durably
 * RECORDS the already-computed result the client submits with every save,
 * exactly the same "client acts, server durably records" shape this
 * codebase already uses for `source_ledger`/`decision_ledger` (a buyer's
 * chat turn or decision is also never re-derived server-side; it is
 * received and stored). No parallel source of truth is created: the
 * document's own content is still 100% a function of the SAME ledgers this
 * compiler always read: it is simply the settled OUTPUT of that reduction
 * that now also gets a durable home, rather than being recomputed from
 * scratch (and silently wrong) on every reopen, room view or export.
 *
 * VALIDATION DEPTH: full and strict on every field this persistence layer's
 * actual downstream readers use (clauses, evaluation, openDecisions,
 * readiness, counts, architecture) -- an untrusted request body must not be
 * able to smuggle an unvalidated shape into a "canonical" record any more
 * than source_ledger/decision_ledger already allow. `factSnapshot` is the
 * one field kept as a permissive `Record<string, unknown>`, matching its
 * own doc comment above (LivingProcurementDocument.factSnapshot): its
 * entire purpose is holding this compile's OWN arbitrary fact values for
 * the NEXT in-memory compile to diff against, never a value any reader
 * outside the compiler itself interprets.
 */
const ProcurementSectionKeySchema = z.enum([
  "network", "security", "identity", "application", "operations", "project", "commercial", "supplier", "additional",
]);

const ClauseOriginSchema = z.enum(["buyer", "netify", "sector", "buyer_override"]);

const ProcurementClauseSchema = z.object({
  id: z.string().min(1),
  section: ProcurementSectionKeySchema,
  statement: z.string(),
  supplierResponse: z.array(z.string()),
  evidence: z.array(z.string()),
  acceptanceTest: z.string().nullable(),
  mandatory: z.boolean(),
  weight: z.number(),
  sourceFactIds: z.array(z.string()),
  origin: ClauseOriginSchema,
  reason: z.string(),
  quote: z.string().nullable(),
  sourceTurnIds: z.array(z.string()),
  sourceNotedIds: z.array(z.string()),
  templateKey: z.string(),
  templateId: z.string(),
}).strict();

const AnswerFormatSchema = z.enum([
  "narrative", "metric", "diagram", "compliance_matrix", "dated_plan", "live_demonstration", "documentary_evidence",
]);

const SupplierQuestionSchema = z.object({
  id: z.string(),
  clauseId: z.string(),
  text: z.string(),
  answerFormat: AnswerFormatSchema,
  evidenceRequested: z.array(z.string()),
  source: z.enum(["bank", "generated"]),
  bankQuestionId: z.string().nullable(),
}).strict();

const EvaluationCategoryKeySchema = z.enum([
  "network_resilience", "security_identity_data", "managed_service_delivery", "commercial",
]);

const SupplierResponseGroupSchema = z.object({
  key: EvaluationCategoryKeySchema,
  title: z.string(),
  questions: z.array(SupplierQuestionSchema),
}).strict();

const EvaluationGateSchema = z.object({
  id: z.string(),
  label: z.string(),
  clauseIds: z.array(z.string()),
  description: z.string(),
}).strict();

const WeightSourceSchema = z.enum(["default", "sector", "buyer_priority", "buyer_override"]);

const EvaluationCategorySchema = z.object({
  key: EvaluationCategoryKeySchema,
  label: z.string(),
  weight: z.number(),
  source: WeightSourceSchema,
}).strict();

const OpenDecisionImpactSchema = z.enum(["eligibility", "price", "architecture", "compliance", "delivery", "evaluation"]);

const OpenDecisionSchema = z.object({
  id: z.string(),
  question: z.string(),
  impact: z.array(OpenDecisionImpactSchema),
  conflict: z.boolean(),
  conflictReason: z.string().nullable(),
  affectedClauseIds: z.array(z.string()),
}).strict();

const ArchitectureNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["site", "user", "network", "cloud", "identity", "voice", "application", "circuit", "datacentre"]),
  sourceFactIds: z.array(z.string()),
  sourceClauseIds: z.array(z.string()),
}).strict();

const ArchitectureEdgeSchema = z.object({ from: z.string(), to: z.string(), label: z.string() }).strict();

const ProvenanceSummarySchema = z.object({
  buyer: z.number(),
  netify: z.number(),
  sector: z.number(),
  buyer_override: z.number(),
}).strict();

const ChangeListSchema = z.object({
  added: z.array(z.string()),
  updated: z.array(z.string()),
  removed: z.array(z.string()),
}).strict();

const ProcurementChangeSetSchema = z.object({
  facts: ChangeListSchema,
  clauses: ChangeListSchema,
  questions: ChangeListSchema,
  gates: ChangeListSchema,
  weights: z.object({
    before: z.record(z.string(), z.number()),
    after: z.record(z.string(), z.number()),
  }).strict(),
  sections: z.object({ added: z.array(z.string()), removed: z.array(z.string()) }).strict(),
}).strict();

const CompilerRevisionSchema = z.object({ cycle: z.number(), changedFactIds: z.array(z.string()) }).strict();

/** The full persisted shape. `.strict()` at every level (matching
 *  SourceLedgerEntrySchema/DecisionLedgerEntrySchema's own rigor): an
 *  incoming save cannot smuggle extra fields into what becomes the
 *  canonical persisted/frozen envelope. */
export const LivingProcurementDocumentSchema = z.object({
  version: z.number(),
  title: z.string(),
  summary: z.string(),
  readiness: z.object({ score: z.number(), label: z.string(), reasons: z.array(z.string()) }).strict(),
  counts: z.object({
    requirements: z.number(),
    questions: z.number(),
    gates: z.number(),
    decisions: z.number(),
  }).strict(),
  architecture: z.object({
    nodes: z.array(ArchitectureNodeSchema),
    edges: z.array(ArchitectureEdgeSchema),
    accessibleSummary: z.string(),
  }).strict(),
  clauses: z.array(ProcurementClauseSchema),
  responseGroups: z.array(SupplierResponseGroupSchema),
  evaluation: z.object({ gates: z.array(EvaluationGateSchema), categories: z.array(EvaluationCategorySchema) }).strict(),
  openDecisions: z.array(OpenDecisionSchema),
  provenance: ProvenanceSummarySchema,
  changeSet: ProcurementChangeSetSchema,
  /** Permissive by design -- see this section's own top-of-block comment. */
  factSnapshot: z.record(z.string(), z.unknown()),
  receiptsSnapshot: z.array(z.string()),
  lastRevision: CompilerRevisionSchema.nullable(),
  instrument: z.enum(["sor", "rfi", "rfp"]),
}).strict();

/**
 * Untrusted request-body JSON -> a validated LivingProcurementDocument, or
 * `undefined` on any validation failure -- mirroring
 * parseIncomingSourceTurns()'s own "duplication is safer than
 * disappearance" ethos inverted for a replace-semantics field: a save whose
 * submitted document fails validation must never destroy a project's
 * EXISTING valid persisted document (the caller keeps the prior value on
 * `undefined`), and must never fail the save outright either -- this field
 * is additive, exactly like `envelope_schema_version` before it, so every
 * existing caller/fixture that has never heard of it is unaffected.
 */
export function parseIncomingProcurementDocument(raw: unknown): LivingProcurementDocument | undefined {
  const parsed = LivingProcurementDocumentSchema.safeParse(raw);
  return parsed.success ? (parsed.data as LivingProcurementDocument) : undefined;
}
