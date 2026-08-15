/**
 * Living Procurement Canvas -- Phase 1: the deterministic template library
 * (brief Section 5.2, Section 6.2's "deterministic template examples" and
 * Section 14.3's dynamic-section rule). Every function here is pure and
 * synchronous; nothing calls a model (Section 8.5).
 *
 * TWO KINDS OF TEMPLATE, BOTH NAMED AND TRACEABLE:
 *
 *  - FACT-DRIVEN templates read the standing WorkspaceFact[]/requirement
 *    directly (compliance requirements, the stated operating model, the
 *    stated timeline, a retained MPLS circuit, the sector pack). Their
 *    provenance is the fact's own `.quote`/`.id`.
 *
 *  - TEXT-PATTERN templates read the buyer's own RETAINED WORDING --
 *    receipts kept verbatim because no structured field exists for them
 *    (ProjectDesk's own `receipts` state; today rendered only under "Your
 *    notes"). This is how "Teams Phone... cannot go down", "Entra ID...
 *    ZTNA", "DLP", "a legacy app that requires a point to point Ethernet
 *    private circuit" and "No patient-identifiable data may leave the UK"
 *    become clauses: NONE of those five requirements has a structured
 *    ledger path today (ALLOWED_PATHS in extract.ts has no voice/ZTNA/DLP/
 *    retained-circuit/data-residency field), so a fact-only compiler could
 *    never satisfy Section 14.4's own defect prompt. This is Section 5.2's
 *    "compiler... generate procurement-grade clauses" and Section 6.2's
 *    whole table, implemented as one small, auditable pattern library
 *    living entirely in THIS new module -- extract.ts, draft.ts and
 *    source-ledger.ts are untouched (Section 13.2's boundary).
 *
 * EVERY TEMPLATE IS NAMED (`templateId`) so a clause is always traceable
 * to a specific rule, never to "the compiler guessed" (Section 14.5).
 */

import type { SecurityRequirementInput } from "@/lib/security/rulebook";
import { deterministicExtract, coverDeclarativeClauses, type BuyingId, type OperatingModelId } from "@/lib/workspace/extract";
import { BUYING_SHORT, CLOUD_LABELS, NETWORK_LABELS, standing, type WorkspaceFact } from "@/lib/workspace/draft";
import type { SectorPack } from "@/lib/sector/packs";
import type { SourceLedgerEntry } from "@/lib/workspace/source-ledger";
import type { ArchitectureEdge, ArchitectureNode, ClauseOrigin, NotedItem, ProcurementSectionKey } from "@/lib/workspace/procurement-document";
import { SECTION_CODES } from "@/lib/workspace/procurement-document";

/* ------------------------------------------------------------------ */
/* Shared shapes                                                       */
/* ------------------------------------------------------------------ */

/** Structurally identical to ProjectDesk.tsx's own `Receipt` type (kept
 *  independent here so this module has no React/component dependency --
 *  Article 17's "pure, no I/O, no React" discipline this codebase already
 *  holds for every workspace/*.ts module).
 *
 *  `sourceTurnId` (Phase 1 checkpoint round 2, item 3, 13 Aug 2026): the
 *  SourceLedgerEntry.id this occurrence's text was derived from, when
 *  known -- set for every ledger-derived entry (deriveReceiptsFromSourceTurns
 *  below), `null`/absent for a `receipts`-compatibility entry with no
 *  turn identity of its own (every existing Phase 1 fixture; a live
 *  session's own transient working list). This is what lets provenance
 *  (ClauseDraft.sourceTurnIds below) point at the ACTUAL buyer turn a
 *  clause traces to, not just a copy of its text. */
export type ReceiptLike = { id: number; text: string; sourceTurnId?: string | null };

/** Everything a ProcurementClause needs except `id` and its final
 *  `weight` -- `id` is assigned by procurement-document.ts's
 *  numberClauses() (a pure function of the whole clause SET, not of one
 *  template in isolation) and `weight` by procurement-readiness.ts's
 *  clauseWeight() (one formula, applied uniformly, not decided per
 *  template) -- see those files' own comments. */
export type ClauseDraft = {
  section: ProcurementSectionKey;
  statement: string;
  supplierResponse: string[];
  evidence: string[];
  acceptanceTest: string | null;
  mandatory: boolean;
  sourceFactIds: string[];
  origin: ClauseOrigin;
  reason: string;
  quote: string | null;
  /** Phase 1 checkpoint round 2, item 3 (13 Aug 2026): the durable
   *  source-turn id(s) (SourceLedgerEntry.id) this clause's `quote`
   *  actually traces to -- NOT merely a copy of the quote text, a real
   *  pointer into the immutable ledger. Empty for a clause with no
   *  text-pattern quote (a pure fact-driven template with no single buyer
   *  sentence), or when the caller never supplied `sourceTurns` at all
   *  (every existing Phase 1 fixture, which has no turn ids to give). */
  sourceTurnIds: string[];
  /** Phase 1 checkpoint round 4, item 1 (14 Aug 2026): the stable noted
   *  id(s) this clause draws on -- see ProcurementClause.sourceNotedIds'
   *  own comment (procurement-document.ts) for the full rationale. Empty
   *  for every template with no noted-item provenance (unchanged). */
  sourceNotedIds: string[];
  templateKey: string;
  templateId: string;
};

/* ------------------------------------------------------------------ */
/* Durable canonical wording (Phase 1 checkpoint correction, item 2,    */
/* 13 Aug 2026): the source ledger, not transient receipts, is the      */
/* compiler's real durable input.                                       */
/* ------------------------------------------------------------------ */

/**
 * THE BUG THIS SECTION FIXES. Every compiler-only requirement (legacy
 * Ethernet, DLP, ZTNA, data residency -- Section 14.4's own defect
 * prompt among them) is a TEXT-PATTERN clause, sourced entirely from
 * ProjectDesk.tsx's `receipts` state. `receipts` is transient React
 * state: resumeStateFromProject() (source-ledger.ts) deliberately
 * rehydrates only `source_ledger` and the persisted `requirement` base
 * on reopen -- "facts and receipts are NOT restored", by Robert's own
 * "Minimal resume link" ruling. So today, reopening a project and
 * recompiling loses every compiler-only clause: the compiler's own
 * `receipts` input starts empty, even though the buyer's exact words
 * ("We also have a legacy app that requires a point to point Ethernet
 * private circuit.") are sitting, verbatim and durable, in the reloaded
 * source_ledger the whole time.
 *
 * THE FIX. deriveReceiptsFromSourceTurns() below re-derives the SAME
 * unplaced-clause spans a live session's `receipts` would hold, straight
 * from the durable SourceLedgerEntry[]/SourceTurn[] the fourth/fifth
 * amendments already made canonical -- by calling the SAME two pure
 * functions (deterministicExtract, coverDeclarativeClauses) the real
 * extraction pipeline (extract.ts's extractRequirement(), called by both
 * the live /api/workspace/extract route and every reliability-gate
 * fixture) uses for its own deterministic-fallback path. It does not
 * call extractRequirement() itself: that function is `async` (it also
 * awaits an optional model union step, Section 8.5's boundary this
 * compiler must never cross), and every environment this whole
 * engagement has ever run in -- this sandbox included -- has no
 * ANTHROPIC_API_KEY, so extractRequirement()'s own `engine` is always
 * "deterministic_fallback" already: the model union is already a no-op
 * here. Calling the two pure functions directly keeps
 * compileProcurementDocument() itself synchronous and I/O-free (Section
 * 8.5), and reuses (never reimplements) extract.ts's own logic (Section
 * 13.2's boundary). If this repository is ever run with a real
 * ANTHROPIC_API_KEY, a HISTORICAL turn rehydrated this way would not
 * additionally benefit from the model's own union step -- a narrow,
 * honestly named limitation (matching this file's own "Known limitation"
 * precedent elsewhere), not a gap this correction is scoped to close:
 * the compiler was never permitted to call a model at all (Section 8.5).
 *
 * Crucially, coverDeclarativeClauses()'s own unplaced-clause
 * determination is a pure function of ONE turn's own text and the
 * updates extracted from THAT SAME text (see extract.ts's
 * extractRequirement(): `coverDeclarativeClauses(text, unionedUpdates)`,
 * where `unionedUpdates` never depends on any OTHER turn) -- so replaying
 * every source turn independently, in isolation, is not an
 * approximation: it is exactly what the real pipeline already does per
 * message, replayed turn by turn.
 */
function unplacedFromTurnText(text: string): string[] {
  const updates = deterministicExtract(text, []);
  return coverDeclarativeClauses(text, updates).unplacedClauses;
}

/** A duplicate DELIVERY of the identical source-turn id (a client re-save,
 *  a retried request, a double effect fire -- never a new buyer
 *  statement) collapses to the ONE occurrence it actually is. This is
 *  DIFFERENT from two DIFFERENT turn ids that happen to share text (see
 *  mergeReceiptsWithSourceLedger's own comment below, Phase 1 checkpoint
 *  round 2, item 3): here the identity (`id`) is the SAME, so it is
 *  genuinely the same event arriving twice, not a restatement. */
function dedupeSourceTurnsById(sourceTurns: SourceLedgerEntry[]): SourceLedgerEntry[] {
  const seen = new Set<string>();
  const out: SourceLedgerEntry[] = [];
  for (const t of sourceTurns) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}

/** The durable equivalent of ProjectDesk's own `receipts` state, rebuilt
 *  from the canonical source ledger (accepts `SourceLedgerEntry[]`, the
 *  exact persisted/hydrated shape source-ledger.ts already defines --
 *  "including locally captured unsaved turns" holds automatically,
 *  because the CLIENT's in-memory `sourceTurns` state already includes
 *  turns typed since the last Save, exactly like `receipts` always has).
 *  Turns are read in `at` order (chronological, ties broken by array
 *  position) so a LATER turn's unplaced clauses sort after an EARLIER
 *  turn's -- the same "later id = later in time" invariant
 *  isCurrentlyRemoved()/resolveReceiptRemovals() already depend on for
 *  their own recency/resurrection law, preserved here even though these
 *  synthetic ids are freshly assigned every call, never persisted.
 *
 *  Phase 1 checkpoint round 2, item 3 (13 Aug 2026): every occurrence this
 *  produces is kept, even when two DIFFERENT turns produce byte-identical
 *  text ("We require DLP." stated once, then again after an intervening
 *  "Remove DLP.") -- collapsing them here (the earlier bug) silently
 *  discarded the LATER, genuinely distinct restatement before
 *  isCurrentlyRemoved() ever got to see it and resurrect the clause. Each
 *  occurrence still carries its own `sourceTurnId`, so identity survives
 *  even where text does not distinguish two occurrences. */
export function deriveReceiptsFromSourceTurns(sourceTurns: SourceLedgerEntry[]): { text: string; at: number; sourceTurnId: string }[] {
  const ordered = dedupeSourceTurnsById(sourceTurns)
    .map((t, i) => ({ ...t, i }))
    .sort((a, b) => a.at - b.at || a.i - b.i);
  const out: { text: string; at: number; sourceTurnId: string }[] = [];
  for (const turn of ordered) {
    for (const clause of unplacedFromTurnText(turn.text)) out.push({ text: clause, at: turn.at, sourceTurnId: turn.id });
  }
  return out;
}

/**
 * The one merge every caller needs: the durable source ledger is
 * authoritative; a `receipts` compatibility input (a live session's own
 * transient working list, or a fixture that has not yet been updated to
 * pass source turns) contributes only the text it carries that the
 * ledger-derived list does not already reproduce.
 *
 * Phase 1 checkpoint round 2, item 3 (13 Aug 2026), Robert's independent
 * reproduction ("We require DLP." / "Remove DLP." / "We require DLP."):
 * de-duplication now applies ONLY across the two SOURCES (ledger-derived
 * vs the `receipts` compatibility list), to avoid literally double-
 * counting the same underlying data when both happen to describe it --
 * it NEVER collapses two occurrences WITHIN the ledger-derived list
 * itself, even when their text is byte-identical, because those are
 * genuinely distinct source-turn occurrences (the whole point of the
 * fix). The `receipts` compatibility input has no turn identity of its
 * own, so text is the only available signal there -- but even a plain
 * `receipts`-only caller (no `sourceTurns`, every existing Phase 1
 * fixture) now keeps every entry it was given, since there is no
 * ledger-derived list to collide with (`derived` is `[]`) and this
 * function no longer deduplicates a caller's own list against itself.
 *
 * Deterministic and order-stable: ledger-derived entries always sort
 * first (in the ledger's own chronological order), so the "later receipt
 * restates an earlier removal" recency law downstream reads identically
 * whether `receipts` is empty (the ledger alone, e.g. a freshly reopened
 * project), full (an ordinary live session), or a genuine backfill mix of
 * both. Output ids are freshly assigned 1..N in this merged order --
 * never carried over from the caller's own numbering scheme, which is why
 * `additionalRequirementClauses()`'s own templateKey (below) is
 * content-derived rather than id-derived: identity must never depend on a
 * number this function is free to reassign every call. */
export function mergeReceiptsWithSourceLedger(sourceTurns: SourceLedgerEntry[], receipts: ReceiptLike[]): ReceiptLike[] {
  const derived = deriveReceiptsFromSourceTurns(sourceTurns);
  const out: ReceiptLike[] = derived.map((d) => ({ id: 0, text: d.text, sourceTurnId: d.sourceTurnId }));
  const ledgerTexts = new Set(out.map((r) => r.text));
  for (const r of receipts) {
    if (ledgerTexts.has(r.text)) continue; // already reproduced from the durable ledger
    out.push({ id: 0, text: r.text, sourceTurnId: r.sourceTurnId ?? null });
  }
  return out.map((r, i) => ({ ...r, id: i + 1 }));
}

/* ------------------------------------------------------------------ */
/* Shared text analysis (deterministic, no NLP -- same discipline       */
/* extract.ts's own clause-coverage code already holds)                */
/* ------------------------------------------------------------------ */

/** "must"/"require"/"cannot"/a bare prohibition ("No X may leave...", "X
 *  may not..."): the SAME closed, deterministic obligation-language test
 *  applied uniformly to every clause this module derives from buyer text,
 *  so "mandatory" is always a function of the buyer's own words, never a
 *  template author's guess (Section 14.5: "'must' is used only for
 *  buyer-stated... obligations"). */
const MANDATORY_LANGUAGE_RE = /\b(must|shall|cannot|can not|require[sd]?|non-negotiable)\b/i;
const PROHIBITION_RE = /\bmay not\b|^\s*no\b[\s\S]*\bmay\b/i;
export function textImpliesMandatory(text: string): boolean {
  const t = text.trim();
  return MANDATORY_LANGUAGE_RE.test(t) || PROHIBITION_RE.test(t);
}

const STOPWORDS = new Set([
  "this", "that", "these", "those", "with", "from", "have", "having", "will", "would",
  "shall", "must", "cannot", "should", "could", "about", "into", "your", "their", "them",
  "over", "under", "also", "then", "than", "when", "where", "what", "which", "while",
  "here", "there", "some", "such", "each", "only", "very", "just", "does", "being",
]);

/** Words of 4+ letters, lower-cased, minus a small closed stoplist of
 *  grammatical glue -- the same "binary judgement, never a splitting
 *  decision" discipline extract.ts's own clauseIsFullyExplained() uses,
 *  reapplied at the compiler layer so a receipt is never BOTH turned into
 *  a proper clause by a specific template AND duplicated into a generic
 *  Additional-requirements clause for the same requirement. */
function significantWords(text: string): string[] {
  const words = (text.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !STOPWORDS.has(w));
  return [...new Set(words)];
}

/** Whether `receipt` is already substantively covered by the clauses
 *  generated so far -- checked against every clause's statement, reason
 *  and quote. A majority of the receipt's own significant words appearing
 *  somewhere in that text is treated as "this buyer sentence produced a
 *  real clause", so it does not ALSO spawn a duplicate, less specific
 *  Additional-requirements entry. */
export function receiptIsExplainedByClauses(receipt: ReceiptLike, clauses: ClauseDraft[]): boolean {
  const words = significantWords(receipt.text);
  if (words.length === 0) return true; // nothing substantive to place
  const haystack = clauses.map((c) => `${c.statement} ${c.reason} ${c.quote ?? ""} ${c.evidence.join(" ")}`).join(" ").toLowerCase();
  const covered = words.filter((w) => haystack.includes(w));
  return covered.length / words.length >= 0.5;
}

/** Phase 3 Stage A correction round (Robert, 14 Aug 2026), Prompt A
 *  reproduction: "We are a UK healthcare organisation with 20 sites and
 *  200 remote users." already lands every substantive fact it states
 *  (organisation.sector, organisation.regions, estate.sites,
 *  estate.users -- confirmed via deterministicExtract()), yet extract.ts's
 *  own conservative clauseIsFullyExplained() still leaves the SENTENCE
 *  itself "unplaced" (a bare word like "organisation" anchors nothing),
 *  so it reached this file's generic Additional-requirements fallback and
 *  became a scored "confirm your ability to meet this requirement" ask --
 *  asking a supplier to confirm the BUYER's own stated identity and
 *  scale, not a real supplier obligation. Robert: "should populate
 *  architecture/context... not ask a supplier to confirm it can meet the
 *  buyer's own identity and scale."
 *
 *  Deliberately narrow: only checked against the FIVE organisation-
 *  identity/scale fact paths below (never a general-purpose fact/receipt
 *  overlap check), and only suppresses a receipt whose own significant
 *  words are STILL >=60% covered by those specific facts' own quotes --
 *  a sentence that mixes in a genuine, separate requirement alongside the
 *  buyer's identity/scale keeps enough uncovered words to survive and
 *  still reach the ordinary Additional-requirements path. */
const ORG_IDENTITY_SCALE_PATHS = new Set(["organisation.sector", "organisation.regions", "organisation.name", "estate.sites", "estate.users"]);

function receiptIsOrgIdentityAndScale(receipt: ReceiptLike, facts: WorkspaceFact[]): boolean {
  const words = significantWords(receipt.text);
  if (words.length === 0) return false;
  const orgQuotes = standing(facts)
    .filter((f) => ORG_IDENTITY_SCALE_PATHS.has(f.path))
    .map((f) => f.quote ?? String(f.value));
  if (!orgQuotes.length) return false;
  const haystack = orgQuotes.join(" ").toLowerCase();
  const covered = words.filter((w) => haystack.includes(w));
  return covered.length / words.length >= 0.6;
}

/* ------------------------------------------------------------------ */
/* Removal instructions ("Remove DLP.") -- Section 16.2                */
/* ------------------------------------------------------------------ */

export type RemovalInstruction = { receiptId: number; targetNorm: string; targetRaw: string };

const REMOVAL_VERB_RE = /^(remove|drop|delete|cancel|no longer require|stop requiring)\s+(.+?)[.!]?$/i;
const normTarget = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Phase 3 Stage A correction round (Robert, 14 Aug 2026), Prompt B
 *  reproduction: "Change the service to co-managed. Keep 24/7 incident
 *  support, remove DLP, and keep the April 2027 deadline." never matched
 *  REMOVAL_VERB_RE above, because that pattern is anchored ("^...$") to
 *  the WHOLE receipt text -- it only ever recognised a removal expressed
 *  as its OWN entire sentence ("Remove DLP."), never one clause of
 *  several inside a single compound sentence. splitDeclarativeClauseSpans
 *  (extract.ts) only splits buyer text on SENTENCE boundaries, never on
 *  commas, so "Keep 24/7 incident support, remove DLP, and keep the April
 *  2027 deadline." survives as ONE receipt with the removal embedded
 *  inside it -- invisible to an anchored pattern, and (worse)
 *  `identityAndDataClauses()`'s bare `DLP_RE.test(corpus)` still finds
 *  the literal word "DLP" in that same receipt and manufactures a
 *  positive dlp-coverage clause from the buyer's own removal sentence.
 *
 *  THE FIX. `EMBEDDED_REMOVAL_RE` finds the SAME removal-verb vocabulary
 *  as a CLAUSE within a larger sentence -- bounded by the start of text,
 *  a comma/semicolon, or a coordinating "and"/"but", and closed by the
 *  next such boundary or the end of text. `resolveReceiptRemovals()`
 *  below tries the existing whole-receipt anchor FIRST (unchanged
 *  behaviour for every receipt that already matched it -- e.g. every
 *  standalone "Remove DLP." fixture already green); only when that fails
 *  does it fall back to scanning for an embedded clause. Guarded against
 *  a preceding negator ("do not remove", "never cancel", "won't drop" --
 *  the same double-negative shape `modelMentionPolarity()` already
 *  guards for the separate operating-model reducer) so a genuine double
 *  negative is never misread as a removal instruction. */
const EMBEDDED_REMOVAL_RE = /(?:^|[,;]|\band\b|\bbut\b)\s*(remove|drop|delete|cancel|no longer require|stop requiring)\s+([a-z0-9][^,;.!]*?)(?=\s*(?:[,;.!]|\band\b|\bbut\b|$))/gi;
const EMBEDDED_REMOVAL_NEGATOR_RE = /\b(?:do not|don'?t|never|won'?t|will not|shouldn'?t|should not)\s*$/i;

/** A compiler-only clause (DLP, ZTNA, voice continuity...) never becomes
 *  a WorkspaceFact, so removalsIn()'s fact-vocabulary tombstoning (Round 7
 *  of the reliability gate) can never see it retract. This is the
 *  compiler's OWN removal layer, scoped only to clauses this module
 *  itself derives from receipts -- it never touches the fact ledger, its
 *  tombstones, or mergeRequirementBase() (Section 13.4's exclusion). A
 *  receipt matching "remove/drop/delete/cancel X" is (a) never itself
 *  turned into a clause and (b) suppresses any OTHER candidate clause
 *  whose label matches X, this compile and every later one (removal
 *  targets are recomputed from the full, still-accumulating receipts list
 *  every call, so the suppression persists exactly like a fact tombstone
 *  does -- Section 14.5's "Reversible" invariant, mirrored). */
export function resolveReceiptRemovals(receipts: ReceiptLike[]): RemovalInstruction[] {
  const out: RemovalInstruction[] = [];
  for (const r of receipts) {
    const text = r.text.trim();
    const whole = REMOVAL_VERB_RE.exec(text);
    if (whole) {
      out.push({ receiptId: r.id, targetNorm: normTarget(whole[2]), targetRaw: whole[2].trim() });
      continue; // unchanged behaviour: the whole receipt is already one removal instruction
    }
    // Embedded: a removal clause inside a larger, multi-clause sentence
    // (e.g. "Keep 24/7 incident support, remove DLP, and keep the April
    // 2027 deadline.") -- see EMBEDDED_REMOVAL_RE's own comment above.
    const g = new RegExp(EMBEDDED_REMOVAL_RE.source, EMBEDDED_REMOVAL_RE.flags);
    let m: RegExpExecArray | null;
    while ((m = g.exec(text))) {
      const before = text.slice(0, m.index);
      if (!EMBEDDED_REMOVAL_NEGATOR_RE.test(before)) {
        const target = m[2].trim();
        if (target) out.push({ receiptId: r.id, targetNorm: normTarget(target), targetRaw: target });
      }
      if (m[0].length === 0) g.lastIndex += 1; // never loop forever on a zero-width match
    }
  }
  return out;
}

/** Whether `label` is CURRENTLY suppressed by a removal instruction --
 *  recency-aware, so a removal is not permanent the way a fact tombstone
 *  is: a compiler-only requirement (DLP, ZTNA...) has no WorkspaceFact of
 *  its own to resurrect, but the SAME resurrection law the fact ledger
 *  already holds ("a struck fact returns only when the buyer STATES it
 *  again", draft.ts's mergeUpdates) still applies here: if a LATER
 *  receipt (a higher id than the last matching removal instruction)
 *  names the same target again, and is not itself another removal
 *  instruction, the buyer has restated the requirement in their own
 *  words, and it is no longer removed. Without this, "Remove DLP."
 *  followed later by "We need DLP after all." would silently stay
 *  suppressed forever -- exactly the bug the reliability gate's own
 *  seventh amendment fixed for the fact ledger, reproduced here for the
 *  compiler's own removal layer. */
function isCurrentlyRemoved(label: string, removals: RemovalInstruction[], receipts: ReceiptLike[]): boolean {
  const norm = normTarget(label);
  if (!norm) return false;
  const matching = removals.filter((r) => r.targetNorm.length > 0 && (norm.includes(r.targetNorm) || r.targetNorm.includes(norm)));
  if (!matching.length) return false;
  const lastRemovalId = Math.max(...matching.map((m) => m.receiptId));
  const restatedAfter = receipts.some((r) => {
    if (r.id <= lastRemovalId) return false;
    if (REMOVAL_VERB_RE.test(r.text.trim())) return false; // another removal, not a restatement
    const rn = normTarget(r.text);
    return matching.some((m) => rn.includes(m.targetNorm));
  });
  return !restatedAfter;
}

/* ------------------------------------------------------------------ */
/* Fact-driven templates                                               */
/* ------------------------------------------------------------------ */

const COMPLIANCE_CLAUSE_LABEL: Record<string, string> = {
  iso27001: "ISO 27001",
  pci_dss: "PCI DSS",
  cyber_essentials_plus: "Cyber Essentials Plus",
  fca: "FCA obligations",
  nhs_dspt: "NHS DSPT",
  nis2: "NIS2",
  uk_gdpr: "UK GDPR",
};

function complianceClauses(facts: WorkspaceFact[]): ClauseDraft[] {
  const out: ClauseDraft[] = [];
  for (const f of standing(facts).filter((x) => x.path === "constraints.complianceRequirements")) {
    const label = COMPLIANCE_CLAUSE_LABEL[String(f.value)] ?? String(f.value);
    out.push({
      section: "security",
      statement: `Suppliers must evidence current ${label} compliance for the service they deliver.`,
      supplierResponse: [
        `State your current ${label} certification/attestation status.`,
        `Describe the scope covered and the date of the most recent audit or assessment.`,
      ],
      evidence: [`Current ${label} certificate or audit report`, "Scope statement"],
      acceptanceTest: `A valid, in-scope ${label} certificate or attestation is evidenced before contract award.`,
      mandatory: true,
      sourceFactIds: [f.id],
      origin: f.provenance === "stated" ? "buyer" : "netify",
      reason: `The buyer's stated compliance requirements include ${label}.`,
      quote: f.quote ?? null,
      sourceTurnIds: [],
      sourceNotedIds: [],
      templateKey: `compliance:${f.value}`,
      templateId: "compliance-requirement",
    });
  }
  return out;
}

/** Section 6.2 row: "Go live by April 2027 -> Dated implementation plan,
 *  dependencies, rollback and milestone scoring." Fact-driven: the
 *  buyer's timeline is already a structured field (constraints.timeline),
 *  captured by the unmodified extractor -- this template only turns an
 *  already-standing fact into a testable clause; it invents nothing. */
function timelineClause(facts: WorkspaceFact[]): ClauseDraft[] {
  const f = standing(facts).filter((x) => x.path === "constraints.timeline").slice(-1)[0];
  if (!f) return [];
  return [
    {
      section: "project",
      statement: `A dated implementation plan is required, aligned to the buyer's stated timeline: ${f.value}.`,
      supplierResponse: [
        "Provide a dated milestone plan from contract award to go-live, including dependencies.",
        "State the rollback plan if a milestone is missed.",
      ],
      evidence: ["Dated project plan", "Rollback/contingency plan"],
      acceptanceTest: `A milestone plan is submitted that reaches go-live no later than the buyer's stated date (${f.value}), with a named rollback path.`,
      mandatory: true,
      sourceFactIds: [f.id],
      origin: f.provenance === "stated" ? "buyer" : "netify",
      reason: "The buyer stated a delivery timeline.",
      quote: f.quote ?? null,
      sourceTurnIds: [],
      sourceNotedIds: [],
      templateKey: "timeline:plan",
      templateId: "dated-transition-plan",
    },
  ];
}

const OP_MODEL_LABEL: Record<OperatingModelId, string> = { managed: "fully managed", co_managed: "co-managed", diy: "self-managed" };

/* ------------------------------------------------------------------ */
/* Chronological reduction over compiler-only state (Phase 1 checkpoint */
/* round 2, item 2, 13 Aug 2026)                                        */
/* ------------------------------------------------------------------ */

/**
 * THE BUG. `operatingModelOf(facts)` reads exclusively from
 * `WorkspaceFact[]`, which is never rehydrated on resume (only
 * `source_ledger` is -- see `resumeStateFromProject()`). The corpus-text
 * fallback this section provides is necessary for reopen-durability, but
 * Robert's independent reproduction showed the FIRST version of it was
 * wrong in a more basic way: it tested whether a phrase appeared ANYWHERE
 * in a bag-of-words corpus, which cannot represent "the buyer corrected
 * themselves" -- "We require a co-managed service." followed later by
 * "We now require a fully managed service." would incorrectly still
 * report co-managed, because the corpus test found "co-managed" first
 * regardless of which statement came LAST.
 *
 * THE FIX. The durable source ledger is not an unordered bag -- it is an
 * ordered history, and `SourceLedgerEntry.at` already carries the real
 * timestamp needed to reduce it correctly. `chronologicalHistory()` below
 * builds a `(at, position)`-ordered list of raw turn text (falling back
 * to `receipts` in their own given/id order only when no `sourceTurns`
 * were supplied -- every existing Phase 1 fixture, completely
 * unaffected). `operatingModelFromHistory()`/`supportHoursFromHistory()`
 * then walk that ordered list and let the LAST occurrence that states a
 * signal win, exactly the "later explicit correction supersedes earlier
 * state" rule Robert specified -- never a union, never a bag-of-words
 * presence test. Raw turn text is used deliberately (not the
 * already-classified `receipts`/unplaced-clause list): a canonical
 * operating-model or support-hours sentence is very often FULLY explained
 * by extraction (consumed into a fact) and so never appears as an
 * unplaced clause at all -- the raw ledger text is the only place the
 * phrase is guaranteed to still exist after a reopen. */
export type ChronologicalOccurrence = { text: string; sourceTurnId: string | null };

/** Prefers the durable, timestamped ledger; falls back to `receipts` in
 *  their own (id-ordered) sequence only when `sourceTurns` is empty. */
export function chronologicalHistory(sourceTurns: SourceLedgerEntry[], receipts: ReceiptLike[]): ChronologicalOccurrence[] {
  if (sourceTurns.length) {
    return dedupeSourceTurnsById(sourceTurns)
      .map((t, i) => ({ ...t, i }))
      .sort((a, b) => a.at - b.at || a.i - b.i)
      .map((t) => ({ text: t.text, sourceTurnId: t.id }));
  }
  return [...receipts].sort((a, b) => a.id - b.id).map((r) => ({ text: r.text, sourceTurnId: r.sourceTurnId ?? null }));
}

/** Priority ONLY resolves same-position text overlap ("co-managed
 *  service" also matches the looser "managed service" substring) --
 *  co_managed is checked first so that overlap collapses to the single
 *  mention it actually is (see `findModelSignals()` below). It is no
 *  longer used to pick a WINNER between two DIFFERENT, non-overlapping
 *  mentions in one occurrence -- that direction is now resolved by
 *  `resolveOccurrenceModel()`'s own structural parser (Phase 1 checkpoint
 *  round 3, item 1, 14 Aug 2026), not by which pattern happens to appear
 *  first in this array. */
const MANAGED_MODEL_PHRASE_RE: Array<{ id: OperatingModelId; re: RegExp }> = [
  { id: "co_managed", re: /co[\s-]?managed/i },
  { id: "diy", re: /self[\s-]?managed|\bdiy\b/i },
  { id: "managed", re: /fully managed|managed service|manage it for us|outsourced/i },
];

/**
 * THE BUG (Phase 1 checkpoint round 3, item 1, 14 Aug 2026). Robert's own
 * finding on the round-2 fix: a correction phrase ("instead of", "rather
 * than", ...) was treated as blanket PERMISSION to pick `ids[0]` --
 * MANAGED_MODEL_PHRASE_RE's own fixed array order -- rather than as a
 * DIRECTIONAL instruction pointing at a specific one of the two named
 * models. Because co_managed is listed first (needed for the overlap
 * case above), BOTH "co-managed instead of fully managed" AND "fully
 * managed instead of co-managed" resolved to co_managed -- the second
 * one backwards.
 *
 * THE FIX. `findModelSignals()` locates every model mention with its
 * character position (de-overlapping same-span matches, e.g. "co-managed
 * service" -- the co_managed match wins over the "managed service"
 * substring it happens to contain, by MANAGED_MODEL_PHRASE_RE's own
 * priority, exactly the case the comment above still needs it for).
 * `resolveOccurrenceModel()` then reads the STRUCTURE around those
 * positions -- never a fixed sentence list:
 *   - One mention, negated ("remove X", "no longer want X", "don't need
 *     X"): a REMOVAL, not a positive assertion of X.
 *   - One mention, not negated: a plain assertion of that model (as
 *     before).
 *   - Two mentions with "A instead of B" / "A rather than B" between
 *     them: A (the one named BEFORE the marker) is the target -- true
 *     regardless of which model A or B happens to be.
 *   - Two mentions with "from A to B" (a "from" before A, a "to" between
 *     A and B): B (the one named AFTER "to") is the target.
 *   - Two mentions, neither structure found: a genuine, unresolved
 *     contradiction (Robert: "Contradictions within the same unresolved
 *     instruction should still create an OpenDecision") -- never guessed.
 * This is direction-derived-from-wording, not enum/regex priority: it
 * reads the SAME regardless of which model is named first or which
 * pattern sits earlier in MANAGED_MODEL_PHRASE_RE.
 */
type ModelSignal = { id: OperatingModelId; index: number };

function findModelSignals(text: string): ModelSignal[] {
  const raw: Array<{ id: OperatingModelId; start: number; end: number; priority: number }> = [];
  MANAGED_MODEL_PHRASE_RE.forEach(({ id, re }, priority) => {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = g.exec(text))) {
      raw.push({ id, start: m.index, end: m.index + m[0].length, priority });
      if (m[0].length === 0) g.lastIndex += 1; // never loop forever on a zero-width match
    }
  });
  raw.sort((a, b) => a.start - b.start || a.priority - b.priority);
  const out: ModelSignal[] = [];
  let lastEnd = -1;
  for (const r of raw) {
    if (r.start < lastEnd) continue; // overlaps an already-accepted, higher-priority match -- same mention
    out.push({ id: r.id, index: r.start });
    lastEnd = r.end;
  }
  return out;
}

/** Kept for `managedServiceClause`'s own "did this occurrence mention the
 *  resolved model at all" scan (its own fallback-quote lookup) -- a
 *  simple deduped id list, position information discarded. */
function operatingModelSignalsIn(text: string): OperatingModelId[] {
  return [...new Set(findModelSignals(text).map((s) => s.id))];
}

/** "A instead of B" / "A rather than B": A -- the model named BEFORE the
 *  marker -- is the buyer's clearly intended target, regardless of which
 *  model A or B is. Matched only in the span BETWEEN the two mentions, so
 *  a marker elsewhere in the sentence never falsely attaches. */
const INSTEAD_RATHER_RE = /\binstead of\b|\brather than\b/i;

/**
 * THE BUG (Phase 1 checkpoint round 4, item 3, 14 Aug 2026, still present
 * after round 3's own fix). The round-3 `MODEL_REMOVAL_RE` applied
 * OCCURRENCE-WIDE: `.test(text)` on the WHOLE sentence, not scoped to the
 * mention it supposedly negates. Robert's own reproduction: "Do not
 * remove the fully managed service." contains the bare word "remove", so
 * the occurrence-wide test fired and unset the model entirely -- even
 * though the sentence's own grammar (a negated removal, "do not remove")
 * means the OPPOSITE: keep it. "We do not want suppliers without a fully
 * managed service." matched `do not want` directly, when the sentence
 * actually insists ON the model (a double negative via "without"). "We no
 * longer require co-managed; fully managed is required." has TWO
 * mentions, so it never even reached the single-mention removal check --
 * it fell through to the two-mention ambiguous case, when the negated-old
 * -model-then-asserted-new-model structure is exactly resolvable.
 *
 * THE FIX. Mention-SCOPED polarity, not an occurrence-wide test.
 * `modelMentionPolarity()` below asks only about the CLAUSE a specific
 * mention sits in (`clauseBoundsAround()`, shared with the support-hours
 * resolver above) and reads a small, deliberately ordered set of
 * grammatical structures -- never a fixed sentence list:
 *   - an OUTER negation of the removal verb itself ("do not remove",
 *     "never cancel") -- a double negative, so the mention is RETAINED,
 *     not removed;
 *   - an OUTER negation of a want/accept-type verb before a "without X"
 *     span in the SAME clause ("do not want ... without X") -- another
 *     double negative, netting to "X is required";
 *   - a bare removal verb ("remove", "drop", "cancel"), a "no longer
 *     want/need/require", or a "don't/do not want/need/require" -- a
 *     genuine, unnegated removal;
 *   - "not <this exact model's own phrase>" immediately in the clause --
 *     a genuine, unnegated single-mention negation;
 *   - otherwise, asserted.
 * A single mention negated -> a removal (unchanged behaviour). A single
 * mention asserted -> a direct assertion (unchanged). Two mentions still
 * check the EXISTING "instead of"/"rather than"/"from...to" structural
 * markers FIRST (Robert: "Existing instead-of, rather-than and
 * from-A-to-B fixtures must remain green") -- only when NEITHER
 * structural marker is found does the NEW check run: if exactly one of
 * the two mentions is negated and the other asserted, the asserted one is
 * the target (Robert: "An explicitly negated old model followed by an
 * explicitly asserted new model in the same clause must resolve to the
 * new model" -- generalised to either order). Two mentions both asserted
 * (or both negated), with no structural marker either -- a genuine,
 * unresolved contradiction, exactly as before ("fully managed or
 * co-managed, no strong preference" stays an OpenDecision).
 */
function modelMentionPolarity(id: OperatingModelId, clauseText: string): "asserted" | "negated" {
  // Double negative: an outer negation of the removal verb itself
  // cancels the removal -- the mention is RETAINED.
  if (/\b(?:do not|don'?t|never|won'?t|will not|shouldn'?t|should not)\b[\s\S]{0,20}\b(?:remove|drop|cancel)\b/i.test(clauseText)) {
    return "asserted";
  }
  // Double negative via "without": an outer negation of a want/accept
  // verb before "without X" nets to "X is required".
  if (/\b(?:do not|don'?t|never|won'?t|will not|shouldn'?t|should not)\b[\s\S]{0,40}\bwithout\b/i.test(clauseText)) {
    return "asserted";
  }
  if (/\b(remove|drop|cancel)\b/i.test(clauseText)) return "negated";
  if (/\bno longer (?:want|need|require)s?\b/i.test(clauseText)) return "negated";
  if (/\bdon'?t (?:want|need|require)\b|\bdo not (?:want|need|require)\b/i.test(clauseText)) return "negated";
  const phrase = MANAGED_MODEL_PHRASE_RE.find((e) => e.id === id);
  if (phrase && new RegExp(`\\bnot\\s+(?:${phrase.re.source})`, "i").test(clauseText)) return "negated";
  return "asserted";
}

/** Resolves ONE occurrence's own operating-model signal, structurally:
 *  - no mention -> nothing to report.
 *  - one mention, negated -> a removal (unsets the model, never asserts
 *    the negated one).
 *  - one mention, plain -> a direct assertion.
 *  - two mentions, "A instead of/rather than B" -> target = A.
 *  - two mentions, "from A to B" -> target = B.
 *  - two mentions, one negated and one asserted (no structural marker
 *    above) -> target = the ASSERTED one (Phase 1 checkpoint round 4,
 *    item 3).
 *  - two mentions, neither structure -> ambiguous (left unresolved). */
function resolveOccurrenceModel(text: string): { target: OperatingModelId | null; isRemoval: boolean; ambiguous: boolean } {
  const signals = findModelSignals(text);
  if (!signals.length) return { target: null, isRemoval: false, ambiguous: false };
  const polarityOf = (s: ModelSignal) => {
    const { start, end } = clauseBoundsAround(text, s.index);
    return modelMentionPolarity(s.id, text.slice(start, end));
  };
  if (signals.length === 1) {
    if (polarityOf(signals[0]) === "negated") return { target: null, isRemoval: true, ambiguous: false };
    return { target: signals[0].id, isRemoval: false, ambiguous: false };
  }
  const [a, b] = signals; // earliest two mentions, in position order
  const between = text.slice(a.index, b.index);
  if (INSTEAD_RATHER_RE.test(between)) return { target: a.id, isRemoval: false, ambiguous: false }; // "A instead of/rather than B" -> A
  const toMatch = /\bto\b/i.exec(between);
  const fromMatch = /\bfrom\b/i.exec(text.slice(0, a.index));
  if (toMatch && fromMatch) return { target: b.id, isRemoval: false, ambiguous: false }; // "from A to B" -> B
  // Phase 1 checkpoint round 4, item 3: no explicit "instead of"/"rather
  // than"/"from...to" marker -- but if exactly one mention is negated and
  // the other asserted, the asserted one is the buyer's clear intent
  // ("We no longer require co-managed; fully managed is required.").
  const pa = polarityOf(a);
  const pb = polarityOf(b);
  if (pa === "negated" && pb === "asserted") return { target: b.id, isRemoval: false, ambiguous: false };
  if (pb === "negated" && pa === "asserted") return { target: a.id, isRemoval: false, ambiguous: false };
  return { target: null, isRemoval: false, ambiguous: true };
}

/** Latest-write-wins reduction of the operating model over a
 *  chronologically-ordered occurrence list, now direction-aware per
 *  `resolveOccurrenceModel()` above. `sourceTurnId` names which turn the
 *  resolved state traces to (empty text history -> both null); a removal
 *  occurrence unsets both (an honest "no model currently stated", which
 *  `buildOpenDecisions()`'s own `OD-operating-model-unstated` already
 *  surfaces when nothing else resolves one -- no new decision type
 *  needed for this case). `ambiguousText` is non-null only when the LAST
 *  relevant occurrence named two+ models with no resolvable structure --
 *  the prior resolved state is deliberately left untouched rather than
 *  guessed. */
export function operatingModelFromHistory(history: ChronologicalOccurrence[]): { model: OperatingModelId | null; sourceTurnId: string | null; ambiguousText: string | null } {
  let model: OperatingModelId | null = null;
  let sourceTurnId: string | null = null;
  let ambiguousText: string | null = null;
  for (const occ of history) {
    const { target, isRemoval, ambiguous } = resolveOccurrenceModel(occ.text);
    if (ambiguous) {
      ambiguousText = occ.text;
      continue;
    }
    if (isRemoval) {
      model = null;
      sourceTurnId = null;
      ambiguousText = null;
      continue;
    }
    if (target) {
      model = target;
      sourceTurnId = occ.sourceTurnId;
      ambiguousText = null;
    }
  }
  return { model, sourceTurnId, ambiguousText };
}

/** The exact matched phrase for the resolved operating model's own
 *  occurrence -- used as the clause's `quote` when no WorkspaceFact backs
 *  it (the reopen-durability fallback). */
function operatingModelPhraseIn(opModel: OperatingModelId, text: string): string | null {
  const entry = MANAGED_MODEL_PHRASE_RE.find((e) => e.id === opModel);
  if (!entry) return null;
  const match = entry.re.exec(text);
  return match ? match[0] : null;
}

/** Shared by the support-hours and operating-model resolvers below (Phase
 *  1 checkpoint round 4, items 2 and 3, 14 Aug 2026): the CLAUSE of `text`
 *  that contains character position `pos` -- text is split on sentence-
 *  internal punctuation (`.`, `;`, `,`) and the word "but", which is
 *  enough to separate "We require support, but not on a 24/7 basis." into
 *  "We require support" / "not on a 24/7 basis" (Robert's own example of
 *  negation appearing AFTER the mention, separated by a comma) without
 *  any per-sentence fixture-specific pattern. Returns character OFFSETS
 *  into the ORIGINAL `text`, not a copied substring, so a caller can
 *  still report accurate positions if it ever needs to. */
function clauseBoundsAround(text: string, pos: number): { start: number; end: number } {
  const delim = /[.;,]+|\bbut\b/gi;
  let start = 0;
  let end = text.length;
  let m: RegExpExecArray | null;
  while ((m = delim.exec(text))) {
    const mStart = m.index;
    const mEnd = m.index + m[0].length;
    if (mEnd <= pos) start = mEnd;
    if (mStart >= pos) {
      end = mStart;
      break;
    }
  }
  return { start, end };
}

/** Support-hours has no structured field at all (unlike operating model,
 *  which at least has a live-session fact path) -- this reducer is the
 *  ONLY source of truth for it, live or reopened, so getting the
 *  chronology right matters just as much: "24/7 support" then later
 *  "business hours only" must reduce to business-hours-only, not stay
 *  stuck on whichever phrase happens to test true first in a bag of
 *  words. */
const MENTION_247_RE = /24\s*\/?\s*7|24x7|round.the.clock|twenty.four.seven/gi;
/** A plain "business hours only" replacement, with NO 24/7 token of its
 *  own to be locally negated -- inherently a negative statement in its
 *  own right, checked occurrence-wide (there is no mention position to
 *  scope it to). */
const BUSINESS_HOURS_STANDALONE_RE = /business hours only|standard business hours|office hours only|\b9\s*-\s*5\b|\b9\s*to\s*5\b/i;
/** A named, specific alternative coverage scheme that is NOT literally
 *  "business hours" wording and NOT 24/7 -- e.g. "8am to 8pm support",
 *  "extended hours support". Deliberately narrow (a closed set of
 *  grammatical shapes, never a sentence list, matching this file's own
 *  standing rule): anything this does NOT recognise falls through to
 *  `unresolved` rather than being guessed at, per Robert's Phase 2 brief
 *  ("never guess ... from a double-negative sentence" -- generalised here
 *  to "never guess an unnamed coverage scheme"). */
const OTHER_COVERAGE_STATED_RE = /extended (?:support )?hours|\b\d{1,2}\s*(?:am|:00)?\s*(?:to|-)\s*\d{1,2}\s*(?:pm|:00)?\b/i;
/** An explicit statement that the buyer has NOT decided between coverage
 *  options -- a genuine ambiguity, never resolved by guessing (mirrors
 *  the operating-model resolver's own "no strong preference" handling). */
const HOURS_NO_PREFERENCE_RE = /no (?:strong )?preference|either way|not (?:yet )?decided|undecided/i;
/** Negation cues that flip a 24/7 MENTION's own polarity, wherever they
 *  fall in the mention's own clause -- before it ("not on a 24/7 basis"),
 *  after it ("24/7 support is not required"), or wrapping it ("We don't
 *  need 24/7 support"). This is deliberately a small closed set of
 *  grammatical negation words, not a sentence list: any clause containing
 *  BOTH a 24/7 mention and one of these words is read as negative --
 *  UNLESS `hoursMentionPolarity()` below finds a double negative around
 *  it first (checked FIRST, always, never bypassed). */
const HOURS_NEGATION_RE = /\b(not|isn'?t|is not|aren'?t|doesn'?t|don'?t|do not|does not|never|no longer|won'?t|will not|without|excluding|except)\b/i;
const HOURS_REMOVAL_RE = /\b(remove|drop|cancel|stop requiring|no longer (?:want|need|require)s?)\b/i;

/**
 * Phase 2 (14 Aug 2026), Robert's adversarial finding against 0e3e7ac:
 * "24/7 support is not optional.", "We cannot operate without 24/7
 * support.", "We do not accept suppliers without 24/7 support." all
 * incorrectly resolved hours247=FALSE -- each is a DOUBLE negative
 * (negating "optional", or negating a want/accept/operate verb in front
 * of "without X"), which `HOURS_NEGATION_RE`'s single-negation-word test
 * cannot tell apart from a genuine single negative ("We don't need 24/7
 * support."). This mirrors the SAME structural fix Round 4 already
 * applied to operating-model negation (`modelMentionPolarity()` above):
 * check for an OUTER negation wrapping the inner one FIRST, before the
 * bare single-negation test ever runs, so a double negative resolves to
 * asserted rather than being counted twice into a false negative. Never a
 * fixture-specific sentence match -- a small, closed set of grammatical
 * shapes, exactly like every other resolver in this file.
 */
function hoursMentionPolarity(clauseText: string): "asserted" | "negated" {
  // "not optional" / "isn't optional": negating "optional" IS the
  // assertion ("24/7 support is not optional" = 24/7 is required).
  if (/\bnot\s+optional\b/i.test(clauseText)) return "asserted";
  // An outer negation of a want/accept/operate verb before "without X"
  // nets to "X is required" -- the same "without" double-negative shape
  // modelMentionPolarity() already established, widened here with
  // "cannot"/"can't" (both real in this domain: "We cannot operate
  // without 24/7 support.") alongside the existing negation set.
  if (/\b(?:do not|don'?t|does not|doesn'?t|cannot|can'?t|never|won'?t|will not|shouldn'?t|should not)\b[\s\S]{0,40}\bwithout\b/i.test(clauseText)) {
    return "asserted";
  }
  if (HOURS_REMOVAL_RE.test(clauseText) || HOURS_NEGATION_RE.test(clauseText)) return "negated";
  return "asserted";
}

/**
 * THE CANONICAL STATE (Phase 2, Robert's brief: "Create a canonical
 * support-coverage state suitable for publication ... The compiler should
 * consume that canonical state when available. Typed prompts and clicked
 * options must converge on the same canonical state."). Four values,
 * never more inferred than the evidence supports:
 *  - "24x7": an asserted 24/7-style mention, or an explicit noted 24x7
 *    selection (see `resolveSupportCoverage()` below for how the two
 *    converge).
 *  - "business_hours": an explicit "business hours only"/"9-5"-style
 *    statement, or a negated 24/7 mention paired with one in the same
 *    clause.
 *  - "other_stated": a named, specific alternative scheme that is neither
 *    of the above (`OTHER_COVERAGE_STATED_RE`).
 *  - "unresolved": nothing stated yet, OR a 24/7 mention was explicitly
 *    negated with NO named alternative -- "We don't need 24/7 support."
 *    tells us what is NOT wanted, not what IS. Guessing "business_hours"
 *    here would be exactly the kind of invented requirement Robert's
 *    brief prohibits, so this stays honestly unresolved instead.
 */
export type SupportCoverage = "24x7" | "business_hours" | "other_stated" | "unresolved";

export type SupportCoverageResolution = {
  coverage: SupportCoverage;
  sourceTurnId: string | null;
  incidentSupport247: boolean;
  /** True only for a genuine, structurally-detected ambiguity (two
   *  provenances in direct conflict, or an explicit "no preference"
   *  statement) -- never for an ordinary negative or an ordinary
   *  double-negative, both of which resolve deterministically above.
   *  Callers MUST surface an OpenDecision when this is true and MUST NOT
   *  treat `coverage` as a confident requirement (Robert: "prevent the
   *  system from publishing an inverted support requirement"). */
  ambiguous: boolean;
  ambiguousText: string | null;
};

type OccurrenceCoverageResult = {
  hasSignal: boolean;
  coverage: SupportCoverage;
  incidentSupport247: boolean;
  ambiguous: boolean;
  ambiguousText: string | null;
};

/**
 * ONE resolver for one occurrence's own support-coverage signal -- the
 * single source of truth both the legacy boolean (`resolveOccurrenceHours`,
 * kept for `supportHoursFromHistory`'s existing callers) and the new
 * canonical four-value state derive from, per Robert's brief: "Do not
 * continue solving support coverage solely through an endlessly expanding
 * occurrence-wide negation regex" -- consolidated into one mention-scoped
 * resolver rather than two parallel implementations that could drift.
 */
function resolveOccurrenceCoverage(text: string): OccurrenceCoverageResult {
  if (HOURS_NO_PREFERENCE_RE.test(text) && (MENTION_247_RE.test(text) || BUSINESS_HOURS_STANDALONE_RE.test(text))) {
    return { hasSignal: true, coverage: "unresolved", incidentSupport247: false, ambiguous: true, ambiguousText: text };
  }
  const mentionPositions: number[] = [];
  const g = new RegExp(MENTION_247_RE.source, MENTION_247_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = g.exec(text))) {
    mentionPositions.push(m.index);
    if (m[0].length === 0) g.lastIndex += 1; // never loop forever on a zero-width match
  }

  let result: OccurrenceCoverageResult | null = null;
  for (const pos of mentionPositions) {
    const { start, end } = clauseBoundsAround(text, pos);
    const clauseText = text.slice(start, end);
    if (hoursMentionPolarity(clauseText) === "negated") {
      result = { hasSignal: true, coverage: "unresolved", incidentSupport247: false, ambiguous: false, ambiguousText: null };
    } else {
      result = { hasSignal: true, coverage: "24x7", incidentSupport247: /incident/i.test(clauseText), ambiguous: false, ambiguousText: null };
    }
  }
  if (result) return result;
  if (BUSINESS_HOURS_STANDALONE_RE.test(text)) return { hasSignal: true, coverage: "business_hours", incidentSupport247: false, ambiguous: false, ambiguousText: null };
  if (OTHER_COVERAGE_STATED_RE.test(text)) return { hasSignal: true, coverage: "other_stated", incidentSupport247: false, ambiguous: false, ambiguousText: null };
  return { hasSignal: false, coverage: "unresolved", incidentSupport247: false, ambiguous: false, ambiguousText: null };
}

export type SupportHoursState = { hours247: boolean; incidentSupport247: boolean; sourceTurnId: string | null };

/** Legacy boolean projection, kept byte-for-byte call-compatible for every
 *  existing caller (managedServiceClause's own text-only signal, the
 *  fixture matrix) -- now DERIVED from the same canonical resolver above
 *  rather than a second, independently-maintained implementation.
 *  `hours247` is true only for `coverage === "24x7"`; an ambiguous
 *  occurrence never resolves true here either (never guessed positive). */
export function supportHoursFromHistory(history: ChronologicalOccurrence[]): SupportHoursState {
  let state: SupportHoursState = { hours247: false, incidentSupport247: false, sourceTurnId: null };
  for (const occ of history) {
    const r = resolveOccurrenceCoverage(occ.text);
    if (!r.hasSignal) continue;
    state = { hours247: r.coverage === "24x7" && !r.ambiguous, incidentSupport247: r.incidentSupport247, sourceTurnId: occ.sourceTurnId };
  }
  return state;
}

/**
 * THE CANONICAL RESOLVER (Phase 2): chronologically reduces the buyer's
 * retained wording into the four-value `SupportCoverage`, THEN converges
 * an explicit noted 24x7 selection into the SAME state -- "typed prompts
 * and clicked options must converge on the same canonical state" (Robert).
 * A noted selection can only ASSERT 24x7 (mirroring `managedServiceClause`'s
 * existing OR-style convergence, never retracting a positive the buyer
 * typed); when it would contradict an EXPLICIT textual statement of
 * something else (`business_hours`/`other_stated`), that is a genuine
 * conflict between two distinct provenances and is surfaced as an
 * ambiguity rather than silently resolved either way. `retained wording`
 * (the source-turn text itself) remains the provenance callers cite; this
 * function is the STATE, never a replacement for it.
 */
export function resolveSupportCoverage(history: ChronologicalOccurrence[], noted: NotedItem[]): SupportCoverageResolution {
  let textState: SupportCoverageResolution = { coverage: "unresolved", sourceTurnId: null, incidentSupport247: false, ambiguous: false, ambiguousText: null };
  for (const occ of history) {
    const r = resolveOccurrenceCoverage(occ.text);
    if (!r.hasSignal) continue;
    textState = { coverage: r.coverage, sourceTurnId: occ.sourceTurnId, incidentSupport247: r.incidentSupport247, ambiguous: r.ambiguous, ambiguousText: r.ambiguousText };
  }
  if (textState.ambiguous) return textState;

  const notedAsserts247 = notedTwentyFourSevenSupportIds(noted).length > 0;
  if (!notedAsserts247) return textState;
  if (textState.coverage === "business_hours" || textState.coverage === "other_stated") {
    return {
      coverage: "unresolved",
      sourceTurnId: textState.sourceTurnId,
      incidentSupport247: textState.incidentSupport247,
      ambiguous: true,
      ambiguousText: "A 24x7 support selection conflicts with support hours stated in the buyer's own wording.",
    };
  }
  return { coverage: "24x7", sourceTurnId: textState.sourceTurnId, incidentSupport247: textState.incidentSupport247, ambiguous: false, ambiguousText: null };
}

/** Phase 1 checkpoint round 4, item 1 (14 Aug 2026), THE CRITICAL
 *  REPRODUCTION: the stable noted id(s) that represent an explicit
 *  "24x7 support" selection on the desk -- both real surfaces that can
 *  produce this concept (taxonomy.ts's own `s-247`, landed via the
 *  earned-question chip machinery, and ProjectDesk.tsx's own directly
 *  note()-landed `twin-support-247`, a distinct UI surface for the same
 *  real-world requirement). Kept as a small, named, extensible set --
 *  not a fixture-specific sentence list -- so `managedServiceClause()`
 *  below can read an EXPLICIT buyer selection alongside (never instead
 *  of) the chronologically-reduced text signal `supportHoursFromHistory`
 *  already provides. */
const TWENTY_FOUR_SEVEN_SUPPORT_NOTED_IDS = new Set(["s-247", "twin-support-247"]);

function notedTwentyFourSevenSupportIds(noted: NotedItem[]): string[] {
  return noted.filter((n) => TWENTY_FOUR_SEVEN_SUPPORT_NOTED_IDS.has(n.id)).map((n) => n.id);
}

/** Section 6.2 row: "Fully managed + 24/7 -> Managed-service boundary,
 *  SLA, escalation, RACI and customer-visibility requirements." Fact-
 *  driven on the operating model (so it re-labels itself automatically
 *  the moment a correction changes managed -> co-managed, Section 16.2).
 *  The 24/7 support-hours signal now comes from TWO independent sources,
 *  combined (never one overriding the other): the buyer's own
 *  chronologically-reduced retained wording (supportHoursFromHistory,
 *  unchanged) AND an explicit noted-tier selection (THE CRITICAL
 *  REPRODUCTION, Phase 1 checkpoint round 4, item 1, 14 Aug 2026:
 *  Robert's own finding that compiling "We require a fully managed
 *  service." with and without the buyer's real UI selection `{id:
 *  "twin-support-247", label: "24x7 support required", section:
 *  "support"}` produced byte-identical output -- `supportHoursFromHistory
 *  ()` never read noted selections at all). `sourceNotedIds` cites
 *  exactly which noted id(s) actually contributed, which is also the
 *  EXPLICIT coverage signal `notedClauses()` checks first (see its own
 *  comment) before its generic-overlap fallback -- so the noted 24/7
 *  item never ALSO spawns its own redundant clause once this one already
 *  represents it, and (when `opModel` is null, so this whole function
 *  returns before ever reaching the noted signal) the noted item is left
 *  fully uncovered, so `notedClauses()` correctly gives it its own
 *  Operations requirement instead -- Robert's own required behaviour:
 *  "If no operating model exists, the selection must still create an
 *  appropriate Operations requirement." `conflict` (Section 16.4)
 *  downgrades the clause to non-mandatory and records why, rather than
 *  silently picking a side. */
function managedServiceClause(
  facts: WorkspaceFact[],
  opModel: OperatingModelId | null,
  history: ChronologicalOccurrence[],
  conflict: { active: boolean; quote: string } | null,
  noted: NotedItem[],
  coverage: SupportCoverageResolution,
): ClauseDraft[] {
  if (!opModel) return [];
  const f = standing(facts).filter((x) => x.path === "procurement.operatingModel").slice(-1)[0];
  // Reopen-durability fallback (checkpoint correction, item 2): when no
  // WorkspaceFact backs this operating model (post-reopen, facts is always
  // []), but `opModel` was still resolved -- necessarily via
  // operatingModelFromHistory() at the call site -- link the clause back
  // to the buyer's own retained wording (the occurrence that actually
  // resolved it) instead of leaving it unsourced.
  const opModelOccurrence = f ? null : [...history].reverse().find((occ) => operatingModelSignalsIn(occ.text).includes(opModel));
  const fallbackQuote = opModelOccurrence ? operatingModelPhraseIn(opModel, opModelOccurrence.text) : null;
  const fallbackSourceTurnId = opModelOccurrence?.sourceTurnId ?? null;
  const label = OP_MODEL_LABEL[opModel];
  // Phase 2 (14 Aug 2026): the canonical support-coverage resolution,
  // precomputed by the caller (see buildCandidateClauses's own doc
  // comment) -- replaces the old `supportHoursFromHistory(history) ||
  // notedHoursIds.length > 0` OR-only merge with the SAME converged
  // state resolveSupportCoverage() already computed (which itself
  // performs an equivalent-but-principled OR-merge, PLUS genuine-
  // conflict detection the old inline logic never had). An ambiguous
  // resolution never asserts hours247 -- never a guessed positive,
  // matching Robert's "prevent the system from publishing an inverted
  // support requirement".
  const hours247FromText = coverage.coverage === "24x7" && !coverage.ambiguous;
  const incidentSupport247 = coverage.incidentSupport247 && !coverage.ambiguous;
  const hoursSourceTurnId = coverage.sourceTurnId;
  const notedHoursIds = notedTwentyFourSevenSupportIds(noted);
  const hours247 = hours247FromText;
  const supportPhrase = incidentSupport247
    ? "including 24/7 incident support"
    : hours247
      ? "including 24/7 support"
      : "with an agreed support model";
  const conflictNote = conflict?.active
    ? ` The buyer has also stated wanting to retain sole operational control over policy changes, which conflicts with a ${label} service boundary; see the open decision until this is resolved.`
    : "";
  const sourceTurnIds = [...new Set([fallbackSourceTurnId, hours247FromText ? hoursSourceTurnId : null].filter((x): x is string => Boolean(x)))];
  return [
    {
      section: "operations",
      statement: `Managed-service boundary, SLA, escalation and RACI for a ${label} service, ${supportPhrase}.${conflictNote}`,
      supplierResponse: [
        "Define the managed-service boundary: what you operate, what the buyer retains.",
        "State your support SLA (response and resolution times) and escalation path.",
        "Provide a RACI for day-to-day operations, incidents and policy changes.",
      ],
      evidence: ["Service definition/RACI document", "Support SLA"],
      acceptanceTest: conflict?.active
        ? null
        : `A signed SLA and RACI are in place before go-live, meeting the buyer's stated ${label} model${hours247 ? " and 24/7 support" : ""}.`,
      mandatory: !conflict?.active,
      sourceFactIds: f ? [f.id] : [],
      origin: f?.provenance === "stated" ? "buyer" : fallbackQuote ? "buyer" : "netify",
      reason: conflict?.active
        ? "The buyer stated an operating model, but a later statement conflicts with it; see the open decision."
        : "The buyer stated the operating model for the service.",
      quote: f?.quote ?? fallbackQuote,
      sourceTurnIds,
      sourceNotedIds: notedHoursIds,
      templateKey: "operating-model:boundary",
      templateId: "managed-service-boundary",
    },
  ];
}

/** Section 6.2 row: "Private Ethernet + legacy application ->
 *  Coexistence, migration sequencing, rollback and retained-service
 *  architecture edge" -- covered as a TEXT-PATTERN template below
 *  (retainedCircuitClauses), because neither "legacy application" nor "a
 *  point to point Ethernet private circuit" has a structured ledger path
 *  (see this file's header comment). This fact-driven template covers
 *  the SEPARATE, simpler case where MPLS already stands as an existing
 *  network fact (a real ledger path) and a network service is being
 *  bought -- the migration-vs-retain question q-mpls-keep already asks
 *  the buyer earlier in the flow; this clause makes the answer testable
 *  once a network service is genuinely in scope. */
function mplsCoexistenceClause(facts: WorkspaceFact[], buying: BuyingId | null): ClauseDraft[] {
  const networkBuying = buying === "sase" || buying === "sdwan" || buying === "sse";
  if (!networkBuying) return [];
  const f = standing(facts).find((x) => x.path === "estate.existingNetwork" && String(x.value) === "mpls");
  if (!f) return [];
  return [
    {
      section: "network",
      statement: "Migration or coexistence approach for existing MPLS circuits during transition.",
      supplierResponse: [
        "State whether MPLS circuits are retained during migration, and for how long.",
        "Describe the cutover sequencing and rollback plan per site.",
      ],
      evidence: ["Migration/cutover plan", "Per-site rollback plan"],
      acceptanceTest: "A cutover plan is submitted naming which sites retain MPLS during migration and the rollback path if a cutover fails.",
      mandatory: false,
      sourceFactIds: [f.id],
      origin: f.provenance === "stated" ? "buyer" : "netify",
      reason: "MPLS stands in the stated existing network estate and a network service is being bought.",
      quote: f.quote ?? null,
      sourceTurnIds: [],
      sourceNotedIds: [],
      templateKey: "network:mpls-coexistence",
      templateId: "mpls-coexistence",
    },
  ];
}

/** A recommended (never mandatory) clause drawn from the active sector
 *  pack, Section 5.2's "If Netify recommends rather than requires a
 *  capability, label it recommended/scored and show the reason" applied
 *  to the sector layer (Section 8.1: "sector rules remain visibly
 *  inferred and droppable"). The pack's own suggestion/reason/evidence
 *  text is reused verbatim -- this module invents nothing, it only
 *  projects the SAME pack Section 7.1 names ("activePack/activeFlavours/
 *  sector rulebook") into a clause shape. */
function sectorClauses(pack: SectorPack | null, flavours: string[]): ClauseDraft[] {
  if (!pack) return [];
  const out: ClauseDraft[] = [];
  const suggestion = pack.suggestions[0];
  if (suggestion) {
    out.push({
      section: "security",
      statement: suggestion.label,
      supplierResponse: ["State how you meet this sector expectation and provide evidence."],
      evidence: ["Evidence of the stated sector expectation"],
      acceptanceTest: null,
      mandatory: false,
      sourceFactIds: [],
      origin: "sector",
      reason: `${suggestion.reason} (${pack.label} pack, ${pack.version}).`,
      quote: null,
      sourceTurnIds: [],
      sourceNotedIds: [],
      templateKey: `sector:${pack.id}:${suggestion.id}`,
      templateId: "sector-pack-suggestion",
    });
  }
  for (const flavourId of flavours) {
    for (const rn of pack.flavourRiskNotes[flavourId] ?? []) {
      out.push({
        section: "operations",
        statement: rn.text,
        supplierResponse: ["Describe how your delivery approach accounts for this."],
        evidence: ["Delivery/change-management approach"],
        acceptanceTest: null,
        mandatory: false,
        sourceFactIds: [],
        origin: "sector",
        reason: `${pack.label} pack risk note (${pack.version}), ${flavourId} flavour, earned by the buyer's own words.`,
        quote: null,
        sourceTurnIds: [],
        sourceNotedIds: [],
        templateKey: `sector:${pack.id}:${flavourId}:${rn.id}`,
        templateId: "sector-pack-risk-note",
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Text-pattern templates (over the buyer's retained verbatim wording)  */
/* ------------------------------------------------------------------ */

/** Stage A closure pass (Robert, 14 Aug 2026), item 1: `removalTargets`
 *  added so a text-pattern template can filter its OWN generated example
 *  lists against an active removal -- see `networkScopeClauses()`'s own
 *  use of it below. Optional so no other caller of this type breaks;
 *  every existing template that doesn't need it (the other five in
 *  `textPattern`) is unaffected. */
type TextTemplateCtx = { corpus: string; corpusReceipts: ReceiptLike[]; requirement: SecurityRequirementInput; removalTargets?: RemovalInstruction[] };

/** The receipts whose text contains at least one of `res` (case-
 *  insensitive), joined for a multi-sentence quote -- this is how a
 *  requirement split across two adjacent, separately-unplaced sentences
 *  ("...cannot go down." / "Fail over automatically...") still carries
 *  its own real buyer wording as provenance, without merging unrelated
 *  clauses (Section 14.3: "the original wording remains attached as
 *  provenance"). The joined `quote` text itself is de-duplicated (a
 *  presentation-only concern, distinct from occurrence identity in the
 *  receipts array, which mergeReceiptsWithSourceLedger's own comment
 *  explains must NEVER be collapsed) so an identical requirement stated
 *  twice does not read as a doubled sentence. `sourceTurnIds` (Phase 1
 *  checkpoint round 2, item 3) names every durable source turn any
 *  matching occurrence traces to -- real provenance, not just copied
 *  text. */
function quoteFor(receipts: ReceiptLike[], res: RegExp[]): { quote: string | null; sourceTurnIds: string[] } {
  const hits = receipts.filter((r) => res.some((re) => re.test(r.text)));
  if (!hits.length) return { quote: null, sourceTurnIds: [] };
  const seenText = new Set<string>();
  const texts: string[] = [];
  const turnIds = new Set<string>();
  for (const r of hits) {
    if (!seenText.has(r.text)) {
      seenText.add(r.text);
      texts.push(r.text);
    }
    if (r.sourceTurnId) turnIds.add(r.sourceTurnId);
  }
  return { quote: texts.join(" "), sourceTurnIds: [...turnIds] };
}

const CANNOT_GO_DOWN_RE = /cannot go down|must not go down|zero downtime|no downtime/i;
const FAILOVER_RE = /fail ?over|dropping calls|without dropping/i;
const VOICE_SUBJECT_RE = /teams phone|\bvoip\b|voice service/i;
const APP_SUBJECT_RE = /patient booking platform|booking platform|patient[- ]facing application|clinical application/i;

function resilienceClauses(ctx: TextTemplateCtx): ClauseDraft[] {
  const resilienceLanguage = CANNOT_GO_DOWN_RE.test(ctx.corpus) || FAILOVER_RE.test(ctx.corpus);
  if (!resilienceLanguage) return [];
  const out: ClauseDraft[] = [];
  const resQuote = quoteFor(ctx.corpusReceipts, [CANNOT_GO_DOWN_RE, FAILOVER_RE]);
  if (VOICE_SUBJECT_RE.test(ctx.corpus)) {
    const specific = quoteFor(ctx.corpusReceipts, [VOICE_SUBJECT_RE, CANNOT_GO_DOWN_RE, FAILOVER_RE]);
    const { quote: q, sourceTurnIds } = specific.quote ? specific : resQuote;
    out.push({
      section: "application",
      statement: "Voice service must fail over automatically without dropping active calls.",
      supplierResponse: [
        "Describe your automatic failover mechanism for voice and the expected call-survival behaviour.",
        "State the maximum failover time and whether calls in progress are preserved.",
      ],
      evidence: ["Failover time (seconds)", "Call-survival test evidence"],
      acceptanceTest: "A live or recorded failover test demonstrates automatic recovery with no dropped active calls.",
      mandatory: textImpliesMandatory(q ?? ""),
      sourceFactIds: [],
      origin: "buyer",
      reason: "The buyer stated voice continuity as a requirement.",
      quote: q,
      sourceTurnIds,
      sourceNotedIds: [],
      templateKey: "resilience:voice-continuity",
      templateId: "voice-continuity",
    });
  }
  if (APP_SUBJECT_RE.test(ctx.corpus)) {
    const specific = quoteFor(ctx.corpusReceipts, [APP_SUBJECT_RE, CANNOT_GO_DOWN_RE, FAILOVER_RE]);
    const { quote: q, sourceTurnIds } = specific.quote ? specific : resQuote;
    out.push({
      section: "application",
      statement: "The stated patient-facing application must fail over automatically with no service interruption.",
      supplierResponse: [
        "Describe how network/service failover preserves availability of this application.",
        "State the maximum outage window during a failover event.",
      ],
      evidence: ["Application availability target", "Failover test evidence"],
      acceptanceTest: "A live or recorded failover test demonstrates continued application availability within the stated outage window.",
      mandatory: textImpliesMandatory(q ?? ""),
      sourceFactIds: [],
      origin: "buyer",
      reason: "The buyer stated that a named patient-facing application cannot go down.",
      quote: q,
      sourceTurnIds,
      sourceNotedIds: [],
      templateKey: "resilience:application",
      templateId: "application-resilience",
    });
  }
  return out;
}

/** Phase 3 Stage A correction round (Robert, 14 Aug 2026), Prompt A
 *  reproduction: "support Teams Phone" (no continuity/failover language)
 *  named a real, in-scope voice service with no clause of its own --
 *  resilienceClauses() above only produces a voice-continuity clause when
 *  the buyer ALSO uses "cannot go down"/"fail over" wording, so a bare
 *  in-scope mention fell entirely into networkScopeClauses()'s broader
 *  catch-all quote. This is the lighter counterpart: a bare mention still
 *  becomes its own named, testable in-scope clause (never the stronger
 *  automatic-failover acceptance test, which is reserved for when the
 *  buyer actually states that continuity requirement). Deliberately
 *  gated OUT when the stronger resilience wording is present, so this
 *  never duplicates resilienceClauses()'s own voice-continuity clause for
 *  the same buyer sentence. */
function voiceScopeClauses(ctx: TextTemplateCtx): ClauseDraft[] {
  const resilienceLanguage = CANNOT_GO_DOWN_RE.test(ctx.corpus) || FAILOVER_RE.test(ctx.corpus);
  if (resilienceLanguage || !VOICE_SUBJECT_RE.test(ctx.corpus)) return [];
  const { quote: q, sourceTurnIds } = quoteFor(ctx.corpusReceipts, [VOICE_SUBJECT_RE]);
  return [
    {
      section: "application",
      statement: "Voice service (Teams Phone) is in scope and must be supported across the delivered architecture.",
      supplierResponse: [
        "Confirm your support for the buyer's stated voice service (Teams Phone), including call quality (QoS) treatment.",
        "Describe how voice traffic is prioritised across your proposed network.",
      ],
      evidence: ["QoS/traffic-prioritisation design", "Voice service support confirmation"],
      acceptanceTest: "The proposed architecture names how the stated voice service is supported and prioritised.",
      mandatory: textImpliesMandatory(q ?? ""),
      sourceFactIds: [],
      origin: "buyer",
      reason: "The buyer stated a voice service (Teams Phone) as in scope.",
      quote: q,
      sourceTurnIds,
      sourceNotedIds: [],
      templateKey: "application:voice-scope",
      templateId: "voice-scope",
    },
  ];
}

/** Living Procurement UK Decision-Maker Blueprint, correction pass
 *  (Robert, 15 Aug 2026), defect 2: the brief's own exact resilience
 *  answer -- "Yes, dual circuits at our five production-critical sites.
 *  Single circuits are acceptable elsewhere." -- matched none of
 *  `resilienceClauses()`'s own trigger wording (CANNOT_GO_DOWN_RE/
 *  FAILOVER_RE look for "cannot go down"/"fail over"/"zero downtime",
 *  none of which this sentence uses), so it fell entirely into the
 *  generic `unclassified` "Additional requirement" catch-all -- TWO
 *  separate ones, one per sentence, with no per-site resilience state
 *  the compiled document, the section outline or a supplier gate could
 *  ever point to. This is the dedicated per-site resilience template
 *  that was missing: it recognises dual/redundant-circuit language
 *  (with or without a stated single-circuit fallback elsewhere) and
 *  compiles ONE canonical, testable, MANDATORY clause -- a definitive
 *  per-site resilience decision, not a hint -- carrying the buyer's own
 *  wording for both halves of the statement as its `quote`. Once this
 *  clause exists, `receiptIsExplainedByClauses()` (this file, above)
 *  stops the same two sentences from ALSO spawning the generic
 *  catch-all, because a majority of each sentence's own significant
 *  words now appear in this clause's own statement/quote/reason. */
const DUAL_CIRCUIT_RE = /\bdual[- ]circuits?\b|\bredundant circuits?\b|\btwo (?:diverse |separate )?circuits?\b/i;
const SINGLE_CIRCUIT_FALLBACK_RE = /\bsingle[- ]circuits?\b[^.]{0,60}\b(acceptable|fine|sufficient|ok\b|okay)\b/i;

function siteResilienceClauses(ctx: TextTemplateCtx): ClauseDraft[] {
  if (!DUAL_CIRCUIT_RE.test(ctx.corpus)) return [];
  const dualQuote = quoteFor(ctx.corpusReceipts, [DUAL_CIRCUIT_RE]);
  const hasFallback = SINGLE_CIRCUIT_FALLBACK_RE.test(ctx.corpus);
  const fallbackQuote = hasFallback ? quoteFor(ctx.corpusReceipts, [SINGLE_CIRCUIT_FALLBACK_RE]) : { quote: null, sourceTurnIds: [] as string[] };
  const texts = [...new Set([dualQuote.quote, fallbackQuote.quote].filter((x): x is string => Boolean(x)))];
  const quote = texts.length ? texts.join(" ") : null;
  const sourceTurnIds = [...new Set([...dualQuote.sourceTurnIds, ...fallbackQuote.sourceTurnIds])];
  return [
    {
      section: "network",
      statement: hasFallback
        ? "Per-site resilience: dual circuits required at the buyer's stated production-critical sites; single circuits acceptable at all other sites."
        : "Per-site resilience: dual-circuit resilience required at the buyer's stated sites.",
      supplierResponse: [
        "Confirm which named sites receive dual-circuit (diverse-path/diverse-carrier) resilience and which run single-circuit.",
        "Describe your dual-carrier or diverse-path design for the sites requiring resilience.",
      ],
      evidence: ["Per-site resilience design naming which sites carry dual circuits", "Circuit diversity evidence (diverse carriers/paths)"],
      acceptanceTest: "A per-site resilience design is submitted naming which sites carry dual circuits, matching the buyer's own stated split.",
      // A definitive resilience decision, once stated, is a testable
      // gate the same way an operating-model or timeline answer is --
      // not merely hinted language, so this is unconditionally
      // mandatory once detected (matches uk-data-residency's own
      // unconditional-once-detected mandatory rule below), rather than
      // gated on textImpliesMandatory()'s "must/shall/require" keyword
      // scan, which this sentence's own wording ("Yes, dual circuits at
      // our five production-critical sites") would fail.
      mandatory: true,
      sourceFactIds: [],
      origin: "buyer",
      reason: "The buyer stated a definitive per-site resilience decision (dual circuits at named sites, single circuits acceptable elsewhere).",
      quote,
      sourceTurnIds,
      sourceNotedIds: [],
      templateKey: "network:site-resilience",
      templateId: "site-resilience-scope",
    },
  ];
}

// Living Procurement UK Decision-Maker Blueprint, correction pass
// (Robert, 15 Aug 2026), defect 1: a hedged mention of a third-party
// SOC/MDR/MSSP service ("we will consider third-party SOC services")
// must not be silently dropped once extract.ts's tentative-language
// guard stops it from rescoping procurement.buying to
// "managed_security" (see the TENTATIVE_CONSIDERATION_RE guard around
// the managedSecurityHit trigger in extract.ts). This gives that
// mention a real, additive clause of its own -- "It may add a separate
// operational/security-service consideration, but it must never
// destructively rescope the project" -- instead of just vanishing from
// the compiled document. Suppressed only when the buyer's actual
// buying scope IS managed_security, since in that case the standing
// buying-scope clause (network-architecture-scope /
// procurement.buying) already represents it and this would be a
// duplicate.
const THIRD_PARTY_SECURITY_SERVICE_RE =
  /third[- ]party\s+(?:soc|mdr|mssp)\b|third[- ]party\s+security\s+operations|\bsoc\s+services?\b|\bmdr\b|\bmssp\b/i;

function thirdPartySecurityConsiderationClauses(ctx: TextTemplateCtx, buying: BuyingId | null): ClauseDraft[] {
  if (buying === "managed_security") return [];
  if (!THIRD_PARTY_SECURITY_SERVICE_RE.test(ctx.corpus)) return [];
  const { quote, sourceTurnIds } = quoteFor(ctx.corpusReceipts, [THIRD_PARTY_SECURITY_SERVICE_RE]);
  return [
    {
      section: "security",
      statement: "A third-party security operations/MDR-style service is under consideration alongside the core scope.",
      supplierResponse: [
        "State whether you offer, or can integrate with, a third-party SOC/MDR service, and describe the integration model.",
      ],
      evidence: ["SOC/MDR integration approach"],
      acceptanceTest: null,
      mandatory: false,
      sourceFactIds: [],
      origin: "buyer",
      reason: "The buyer mentioned considering a third-party security-operations service alongside the core scope.",
      quote,
      sourceTurnIds,
      sourceNotedIds: [],
      templateKey: "security:third-party-soc-consideration",
      templateId: "third-party-security-consideration",
    },
  ];
}

const ENTRA_RE = /\bentra(\s?id)?\b/i;
const ZTNA_RE = /\bztna\b|zero trust network access/i;
const DLP_RE = /\bdlp\b|data loss prevention/i;

function identityAndDataClauses(ctx: TextTemplateCtx): ClauseDraft[] {
  const out: ClauseDraft[] = [];
  if (ENTRA_RE.test(ctx.corpus) && ZTNA_RE.test(ctx.corpus)) {
    const { quote: q, sourceTurnIds } = quoteFor(ctx.corpusReceipts, [ENTRA_RE, ZTNA_RE]);
    out.push({
      section: "identity",
      statement: "Identity-aware ZTNA using the buyer's stated identity provider (Entra ID) for access decisions.",
      supplierResponse: [
        "Describe your ZTNA integration with Entra ID, including device-posture enforcement.",
        "State how a policy change in Entra ID propagates to network access decisions.",
      ],
      evidence: ["Device-posture evidence", "Entra ID integration test results"],
      acceptanceTest: "Access is denied when device posture fails an Entra-defined compliance policy, evidenced by a live or recorded test.",
      mandatory: textImpliesMandatory(q ?? ""),
      sourceFactIds: [],
      origin: "buyer",
      reason: "The buyer stated Entra ID as the identity provider and required ZTNA.",
      quote: q,
      sourceTurnIds,
      sourceNotedIds: [],
      templateKey: "identity:entra-ztna",
      templateId: "identity-aware-ztna",
    });
  } else if (ENTRA_RE.test(ctx.corpus)) {
    // Phase 3 Stage A correction round (Robert, 14 Aug 2026), Prompt A
    // reproduction: "use Azure and Entra ID" (no ZTNA wording) named a
    // real, structured identity-provider requirement that previously had
    // NO clause of its own -- identity-aware-ztna above only fires when
    // ZTNA is ALSO named, so a bare Entra ID mention fell entirely into
    // networkScopeClauses()'s much broader catch-all quote instead of
    // getting its own testable identity-provider clause. Deliberately a
    // lighter, non-ZTNA-specific supplier ask (integration + SSO/SCIM),
    // never inventing a ZTNA requirement the buyer did not state.
    const { quote: q, sourceTurnIds } = quoteFor(ctx.corpusReceipts, [ENTRA_RE]);
    out.push({
      section: "identity",
      statement: "Identity provider integration with the buyer's stated Entra ID tenant for authentication and access policy.",
      supplierResponse: [
        "Describe your integration with Entra ID (SSO/SAML/OIDC, and SCIM provisioning if supported).",
        "State which access-policy decisions read from Entra ID (group membership, conditional access), if any.",
      ],
      evidence: ["Entra ID integration test evidence", "SSO/provisioning configuration summary"],
      acceptanceTest: "A live or recorded test demonstrates authentication against the buyer's Entra ID tenant.",
      mandatory: textImpliesMandatory(q ?? ""),
      sourceFactIds: [],
      origin: "buyer",
      reason: "The buyer stated Entra ID as the identity provider.",
      quote: q,
      sourceTurnIds,
      sourceNotedIds: [],
      templateKey: "identity:entra-provider",
      templateId: "identity-provider-entra",
    });
  }
  if (DLP_RE.test(ctx.corpus)) {
    const { quote: q, sourceTurnIds } = quoteFor(ctx.corpusReceipts, [DLP_RE]);
    out.push({
      section: "security",
      statement: "Data loss prevention (DLP) coverage across the stated cloud estate.",
      supplierResponse: [
        "State which data types and content patterns your DLP policy detects.",
        "Describe integration with the buyer's data classification/labelling scheme, if any.",
        "Describe the action taken on a policy match (block, quarantine, notify).",
      ],
      evidence: ["Supported data types/classification labels", "Policy enforcement test evidence"],
      acceptanceTest: "A test document matching a defined DLP policy is blocked or quarantined as configured.",
      mandatory: textImpliesMandatory(q ?? ""),
      sourceFactIds: [],
      origin: "buyer",
      reason: "The buyer required DLP.",
      quote: q,
      sourceTurnIds,
      sourceNotedIds: [],
      templateKey: "security:dlp",
      templateId: "dlp-coverage",
    });
  }
  return out;
}

/** A network/security architecture SCOPE mention ("requires SD-WAN and
 *  full SASE") that the extractor's own vocabulary only partially landed
 *  as a fact -- e.g. Section 14.4's own defect prompt lands "sdwan" as an
 *  EXISTING-network fact (estate.existingNetwork, the extractor's own,
 *  unmodified rule) but never captures "full SASE" as a buying-scope fact
 *  at all, because procurement.buying has no bare "full SASE" trigger in
 *  extract.ts. Rather than let that residue fall into the generic
 *  Additional-requirements bucket, this template gives it a proper
 *  network-section clause -- still entirely sourced from the buyer's own
 *  sentence (`quote`), enriched only with already-standing facts (sector,
 *  sites) for readability, never with an invented one. Only fires on
 *  RECEIPT text still awaiting placement -- when SASE/SD-WAN already
 *  landed cleanly with nothing left over, there is no orphan sentence to
 *  classify, and this template correctly produces nothing. */
const NETWORK_SCOPE_RE = /\b(sase|sd-?wan|sse)\b/i;

/** Stage A closure pass (Robert, 14 Aug 2026), item 1: "a removed
 *  capability must disappear from every generated projection," not just
 *  from becoming its own standalone clause. This template's own example
 *  component list is a generated projection like any other -- named
 *  here as `{display, removalLabel}` pairs (removalLabel matching the
 *  SAME vocabulary `isCurrentlyRemoved()`/`clauseRemovalLabel()` already
 *  use elsewhere for the real dlp-coverage clause, so "remove DLP" now
 *  suppresses BOTH: the standalone clause AND this list's own mention of
 *  it) rather than a single hard-coded string. Filtered per-compile
 *  against `ctx.removalTargets`/`ctx.corpusReceipts` so an active removal
 *  strips the item from the example list, and a later restatement (the
 *  same resurrection law `isCurrentlyRemoved()` already documents)
 *  brings it back. Never touches the buyer's own retained verbatim
 *  sentence (`quote` below) -- only this template's own generated
 *  prose. */
const NETWORK_SCOPE_COMPONENTS: Array<{ display: string; removalLabel: string }> = [
  { display: "SD-WAN transport", removalLabel: "sd-wan transport" },
  { display: "SWG", removalLabel: "swg" },
  { display: "CASB", removalLabel: "casb" },
  { display: "ZTNA", removalLabel: "ztna" },
  { display: "FWaaS", removalLabel: "fwaas" },
  { display: "DLP", removalLabel: "dlp-coverage" },
];

function networkScopeClauses(ctx: TextTemplateCtx): ClauseDraft[] {
  const { quote: q, sourceTurnIds } = quoteFor(ctx.corpusReceipts, [NETWORK_SCOPE_RE]);
  if (!q) return [];
  const sector = ctx.requirement.organisation?.sector;
  const sites = ctx.requirement.estate?.sites;
  const scopeBits = [sector, sites ? `${sites} sites` : null].filter(Boolean).join(", ");
  const removals = ctx.removalTargets ?? [];
  const liveComponents = NETWORK_SCOPE_COMPONENTS.filter((c) => !isCurrentlyRemoved(c.removalLabel, removals, ctx.corpusReceipts));
  const componentsLine =
    liveComponents.length > 0
      ? `Confirm which components are included in scope (e.g. ${liveComponents.map((c) => c.display).join(", ")}) versus SD-WAN transport alone.`
      : "Confirm which components are included in scope versus SD-WAN transport alone.";
  return [
    {
      section: "network",
      statement: `Network/security architecture scope stated by the buyer${scopeBits ? ` (${scopeBits})` : ""}: "${q}"`,
      supplierResponse: [
        componentsLine,
        "Describe your architecture for delivering the stated scope across the buyer's estate.",
      ],
      evidence: ["Architecture diagram", "Component coverage matrix"],
      acceptanceTest: "The proposed architecture names every in-scope component from the buyer's stated scope and how each is delivered.",
      mandatory: textImpliesMandatory(q),
      sourceFactIds: [],
      origin: "buyer",
      reason: "The buyer stated the network/security architecture scope.",
      quote: q,
      sourceTurnIds,
      sourceNotedIds: [],
      templateKey: "network:architecture-scope",
      templateId: "network-architecture-scope",
    },
  ];
}

/** Section 14.4's own defect prompt: neither "legacy application" nor "a
 *  point to point Ethernet private circuit" has a structured ledger path
 *  (extract.ts's ALLOWED_PATHS has no such field) -- this is the template
 *  that turns the buyer's exact sentence into a real, classified clause
 *  instead of leaving it only as a receipt under "Your notes" (Section
 *  14.3's whole point). Matches Section 6.2's row: "Private Ethernet +
 *  legacy application -> Coexistence, migration sequencing, rollback and
 *  retained-service architecture edge."
 *
 *  Phase 3 Stage A correction round (Robert, 14 Aug 2026), Prompt A
 *  reproduction: "retain private Ethernet for a clinical application" is
 *  the SAME coexistence requirement stated with a healthcare-specific
 *  application noun, not the word "legacy" -- the original LEGACY_APP_RE
 *  matched neither, so this whole sentence had no structured clause of
 *  its own and was only reachable inside `networkScopeClauses()`'s much
 *  broader (and much less specific) "architecture scope" catch-all.
 *  Broadened to recognise "clinical application" and "patient[- ]facing
 *  application" alongside "legacy application/app/system" -- the SAME
 *  named-application-plus-retained-circuit dependency, just named with
 *  the buyer's own vertical-specific vocabulary instead of "legacy". */
const LEGACY_APP_RE = /legacy (application|app|system)|clinical application|patient[- ]facing application/i;
const RETAINED_CIRCUIT_RE = /point[- ]?to[- ]?point|p2p\b|private (circuit|ethernet|line)/i;

function legacyCircuitClauses(ctx: TextTemplateCtx): ClauseDraft[] {
  if (!LEGACY_APP_RE.test(ctx.corpus) || !RETAINED_CIRCUIT_RE.test(ctx.corpus)) return [];
  const { quote: q, sourceTurnIds } = quoteFor(ctx.corpusReceipts, [LEGACY_APP_RE, RETAINED_CIRCUIT_RE]);
  return [
    {
      section: "network",
      statement: "The named application's retained point-to-point Ethernet private circuit must coexist with the new architecture through migration.",
      supplierResponse: [
        "Describe how the retained circuit coexists with your proposed architecture, and for how long.",
        "State the migration sequencing for the dependent application.",
        "Name the service owner for the retained circuit during transition, and the rollback plan.",
      ],
      evidence: ["Coexistence/migration plan", "Rollback plan", "Named service ownership during transition"],
      acceptanceTest: "The named application remains operational throughout migration; retained-circuit performance is evidenced before and after cutover.",
      mandatory: textImpliesMandatory(q ?? ""),
      sourceFactIds: [],
      origin: "buyer",
      reason: "The buyer stated a named application depends on a retained point-to-point Ethernet private circuit.",
      quote: q,
      sourceTurnIds,
      sourceNotedIds: [],
      templateKey: "network:legacy-circuit-coexistence",
      templateId: "legacy-circuit-coexistence",
    },
  ];
}

/** Section 16.3's verbatim constraint. Section 16.3's own invariant: "The
 *  compiler does not invent a statute, certification or legal
 *  conclusion." This clause is deliberately worded in OPERATIONAL terms
 *  (data location, sub-processors) and names no law; buildOpenDecisions()
 *  (procurement-readiness.ts) adds the matching "confirm which legal
 *  framework applies" open decision whenever this template fires, so the
 *  legal interpretation stays a decision, never a buyer fact. */
/** Phase 3 Stage A correction round (Robert, 14 Aug 2026), Prompt C
 *  reproduction: the brief's own canonical Section 12.3 sentence, "All
 *  customer data must remain in the UK.", matched NEITHER the original
 *  RESIDENCY_RE ("data residency" / "may not leave" / "must not leave" /
 *  "leave the uk" / "cannot leave" -- all phrased around LEAVING, never
 *  REMAINING) nor the dataLeavingRe fallback (also leave-only) -- so no
 *  uk-data-residency clause was produced for the single most common
 *  everyday phrasing of a residency requirement. Broadened to also
 *  recognise "remain"/"stay"/"reside"/"kept"/"stored" (positive
 *  containment wording), alongside the original "leave" (negative,
 *  departure wording) -- both are the SAME requirement stated two
 *  grammatical ways, not two different requirements. */
const RESIDENCY_RE =
  /\bdata residency\b|\bmay not leave\b|\bmust not leave\b|\bleave the uk\b|\bcannot leave\b|\bnot leave the uk\b|\bremain(?:s|ing)?\s+(?:in|within)\s+the uk\b|\bstay(?:s|ing)?\s+(?:in|within)\s+the uk\b|\breside(?:s)?\s+(?:in|within)\s+the uk\b|\bkept\s+(?:in|within)\s+the uk\b|\bstored\s+(?:only\s+|solely\s+)?(?:in|within)\s+the uk\b/i;
const RESIDENCY_PROHIBITION_RE = /may not leave|must not leave|cannot leave|^\s*no\b[\s\S]*\bmay leave\b|must remain|must stay/i;

function dataResidencyClauses(ctx: TextTemplateCtx): ClauseDraft[] {
  if (!RESIDENCY_RE.test(ctx.corpus) && !PROHIBITION_RE.test(ctx.corpus)) return [];
  // Scope to receipts that actually name data leaving/staying/residency,
  // not any bare prohibition sentence elsewhere (avoids a false match on
  // an unrelated "No X may..." sentence). Both directions of the same
  // requirement -- data LEAVING (negative) and data REMAINING (positive)
  // -- are recognised, matching RESIDENCY_RE's own broadened vocabulary.
  const dataLeavingRe = /\bdata\b[\s\S]{0,40}\b(leave|remain|stay|reside|kept|stored)\b|\b(leave|remain|stay|reside|kept|stored)\b[\s\S]{0,40}\bdata\b/i;
  if (!dataLeavingRe.test(ctx.corpus) && !RESIDENCY_RE.test(ctx.corpus)) return [];
  const { quote: q, sourceTurnIds } = quoteFor(ctx.corpusReceipts, [dataLeavingRe, RESIDENCY_RE]);
  if (!q) return [];
  return [
    {
      section: "security",
      statement: `Data residency constraint stated verbatim by the buyer: "${q}"`,
      supplierResponse: [
        "State the countries in which the relevant data is processed and stored, including sub-processors.",
        "Provide a data-flow diagram showing where this data can and cannot travel.",
      ],
      evidence: ["Data-flow diagram", "Sub-processor list and locations"],
      acceptanceTest: "Documented processing/storage locations and sub-processors show no location outside the buyer's stated boundary.",
      mandatory: textImpliesMandatory(q) || RESIDENCY_PROHIBITION_RE.test(q),
      sourceFactIds: [],
      origin: "buyer",
      reason: "The buyer stated a data-residency constraint verbatim.",
      quote: q,
      sourceTurnIds,
      sourceNotedIds: [],
      templateKey: "security:data-residency",
      templateId: "uk-data-residency",
    },
  ];
}

/** Section 16.4's contradiction case: two buyer statements about who
 *  controls the service directly conflict. Detected against a SINGLE
 *  receipt's own text (never the whole corpus) so an unrelated "fully
 *  managed" fact elsewhere is never mistaken for a conflict -- the
 *  conflict is only real when both signals appear in the SAME buyer
 *  sentence, exactly as Section 16.4's own example prompt does. */
const OPMODEL_CONFLICT_RE =
  /(fully managed|co-managed)[\s\S]{0,140}(sole operational control|retain(s)?\s+(sole\s+)?(operational\s+)?control|retain control|keep control|our (own )?team[\s\S]{0,40}control)/i;
const OPMODEL_CONFLICT_REVERSE_RE =
  /(sole operational control|retain(s)?\s+(sole\s+)?(operational\s+)?control|retain control|keep control)[\s\S]{0,140}(fully managed|co-managed)/i;

export function detectOperatingModelConflict(receipts: ReceiptLike[]): { active: boolean; quote: string } | null {
  for (const r of receipts) {
    if (OPMODEL_CONFLICT_RE.test(r.text) || OPMODEL_CONFLICT_REVERSE_RE.test(r.text)) {
      return { active: true, quote: r.text };
    }
  }
  return null;
}

/** Phase 3 Stage A correction round (Robert, 14 Aug 2026), Prompt D
 *  reproduction: "We want a single supplier but also require independent
 *  best-of-breed security controls." is a SECOND, distinct kind of
 *  sourcing-strategy contradiction -- single-supplier consolidation vs. a
 *  wish for independently-selected, best-of-breed security controls --
 *  not the operating-model-vs-sole-control conflict OPMODEL_CONFLICT_RE
 *  above already covers (that pattern only ever matches "fully
 *  managed"/"co-managed" language, neither of which this sentence
 *  contains). Before this fix, the sentence matched no named template at
 *  all, so it fell through to `additionalRequirementClauses()`'s generic
 *  fallback, which read "require" as MANDATORY_LANGUAGE and invented a
 *  pass/fail gate from an unresolved contradiction -- the exact opposite
 *  of Section 12.4/16.4's "a genuine contradiction becomes a visible
 *  decision, never a silent choice, never an invented gate."
 *
 *  Same discipline as `detectOperatingModelConflict()` above: scoped to a
 *  SINGLE receipt's own text (never the whole corpus), so an unrelated
 *  "single supplier" fact and an unrelated "best of breed" fact stated in
 *  two different, unconnected sentences are never mistaken for a
 *  conflict -- the tension is only real when both signals appear
 *  together in the buyer's own sentence. */
const SINGLE_SUPPLIER_RE =
  /\b(?:a\s+)?(?:single|one)\s+(?:supplier|vendor|provider)\b|\bconsolidat(?:e|ed|ing)\s+(?:to|on|with)\s+(?:a\s+)?(?:single|one)\s+(?:supplier|vendor|provider)\b/i;
const BEST_OF_BREED_SECURITY_RE =
  /\bbest[\s-]of[\s-]breed\b|\bindependent(?:ly)?\s+(?:best[\s-]of[\s-]breed\s+)?security\b|\bmulti[\s-]vendor\s+security\b/i;

export function detectSupplierStrategyConflict(receipts: ReceiptLike[]): { active: boolean; quote: string } | null {
  for (const r of receipts) {
    if (SINGLE_SUPPLIER_RE.test(r.text) && BEST_OF_BREED_SECURITY_RE.test(r.text)) {
      return { active: true, quote: r.text };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Additional requirements: the dynamic-section fallback (Section 14.3) */
/* ------------------------------------------------------------------ */

/** Phase 1 checkpoint round 2, item 3 (13 Aug 2026): with occurrence
 *  de-duplication removed upstream (mergeReceiptsWithSourceLedger no
 *  longer collapses two DIFFERENT occurrences that share text), the SAME
 *  unclassified requirement stated more than once (e.g. restated after an
 *  intervening, unrelated correction, or simply repeated for emphasis)
 *  would otherwise produce TWO separate ClauseDraft objects sharing the
 *  SAME content-derived templateKey -- a real duplicate clause in the
 *  output, not merely a duplicate occurrence in the receipts array. This
 *  function still walks every occurrence (so removal/resurrection, which
 *  depends on occurrence recency via `receipts`, is unaffected -- see
 *  isCurrentlyRemoved()'s own comment), but EMITS at most one ClauseDraft
 *  per distinct templateKey, merging every occurrence's `sourceTurnId`
 *  into that one draft's `sourceTurnIds` -- provenance widens, identity
 *  never duplicates. */
function additionalRequirementClauses(receipts: ReceiptLike[], removals: RemovalInstruction[], alreadyCovered: ClauseDraft[], orgIdentityFacts: WorkspaceFact[] = []): ClauseDraft[] {
  const removedIds = new Set(removals.map((r) => r.receiptId));
  const byKey = new Map<string, ClauseDraft>();
  const order: string[] = [];
  for (const r of receipts) {
    if (removedIds.has(r.id)) continue; // a removal instruction, not a requirement itself
    if (!/[a-zA-Z]{3,}/.test(r.text)) continue; // punctuation/number-only fragment
    /* Content-derived, not `r.id`-derived (Phase 1 checkpoint
     * correction, item 1/2, 13 Aug 2026): `r.id` is only ever a
     * within-this-compile ordinal (freshly assigned by
     * mergeReceiptsWithSourceLedger() every call, never itself
     * persisted), so keying identity off it would make a stable public
     * clause id impossible for this section -- the SAME buyer sentence
     * could receive a different internal id on a later compile purely
     * because of unrelated numbering churn elsewhere in the merged
     * receipts list. normTarget() (already used by the removal layer
     * above) gives the same normalised key to the same wording every
     * time, regardless of numbering -- the same discipline every other
     * template's fixed templateKey already holds.
     *
     * Phase 1 checkpoint round 2, item 3 (13 Aug 2026) regression fix:
     * this repeat-occurrence merge check now runs BEFORE
     * receiptIsExplainedByClauses() below, not after. It used to run
     * after, which meant a SECOND byte-identical occurrence of a
     * requirement THIS function had already accepted (e.g. the same
     * unclassified sentence stated twice, no removal in between) was
     * found "already explained" by the draft this very function had
     * just created for the FIRST occurrence -- discarding the second
     * occurrence's own sourceTurnId before the merge branch ever got a
     * chance to run, silently losing provenance the fix was supposed to
     * widen, not narrow. */
    const key = `additional:${normTarget(r.text)}`;
    const existing = byKey.get(key);
    if (existing) {
      if (r.sourceTurnId && !existing.sourceTurnIds.includes(r.sourceTurnId)) existing.sourceTurnIds.push(r.sourceTurnId);
      continue;
    }
    if (receiptIsExplainedByClauses(r, [...alreadyCovered, ...byKey.values()])) continue;
    if (receiptIsOrgIdentityAndScale(r, orgIdentityFacts)) continue; // buyer's own identity/scale, already represented -- never a scored ask
    if (isCurrentlyRemoved(r.text, removals, receipts)) continue; // the requirement itself was later retracted (and not since restated)
    const draft: ClauseDraft = {
      section: "additional",
      statement: r.text,
      supplierResponse: ["Confirm your ability to meet this requirement and describe your approach."],
      evidence: ["Written confirmation and supporting detail"],
      acceptanceTest: null,
      mandatory: textImpliesMandatory(r.text),
      sourceFactIds: [],
      origin: "buyer",
      reason: "No deterministic template classified this requirement; kept as the buyer's exact wording pending classification.",
      quote: r.text,
      sourceTurnIds: r.sourceTurnId ? [r.sourceTurnId] : [],
      sourceNotedIds: [],
      templateKey: key,
      templateId: "unclassified",
    };
    byKey.set(key, draft);
    order.push(key);
  }
  return order.map((k) => byKey.get(k)!);
}

/* ------------------------------------------------------------------ */
/* Noted items (Phase 1 checkpoint round 3, item 3, 14 Aug 2026)        */
/* ------------------------------------------------------------------ */

/**
 * THE BUG. `ProcurementCompilerInput.noted` has always existed (the
 * desk's own multi-select "wants" tier -- a stable id assigned from a
 * fixed taxonomy, e.g. "s-247", NOT array position; see ProjectDesk.tsx's
 * own `NotedItem` state) and the brief itself says facts, noted items and
 * receipts all remain sources of truth -- but `compileProcurementDocument`
 * never read it. Compiling with a noted item present versus absent was
 * byte-identical.
 *
 * THE FIX. Each CURRENTLY-noted item becomes its own testable clause,
 * keyed by the item's own stable `id` (`` `noted:${n.id}` `` --
 * content/identity-derived, never `` `noted:${i}` `` array position,
 * never keyed off `label` alone, so relabelling or reordering the SAME
 * selection never changes its clause id). `noted` already represents the
 * buyer's CURRENT selection -- ProjectDesk's own `noted` state is
 * toggled, not appended-to like a ledger -- so "removing it reverses that
 * output" needs no tombstone/removal-instruction machinery of its own:
 * an id simply absent from THIS compile's `noted` array emits no clause
 * for it, the same way a struck WorkspaceFact drops out of `standing()`.
 * No second fact/history store is introduced.
 *
 * THE ROUND-4 BUG (14 Aug 2026), Robert's own audit: round 3's positive
 * fixture used `{ section: "operations" }` -- a value already valid on
 * THIS document, not a value ProjectDesk's real noted taxonomy actually
 * emits. The real taxonomy (taxonomy.ts's own TAXONOMY, ProjectDesk.tsx's
 * own `note()`-landed TwinLand sections) uses section strings like
 * "estate", "change", "support", "services", "success", "suppliers",
 * "objectives", "commercial", "security", "drivers" -- NONE of which is a
 * ProcurementSectionKey, so every real noted item fell into "Additional
 * requirements", every time.
 *
 * THE FIX. `procurementSectionForNoted()` below is an EXHAUSTIVE, explicit
 * translation from the real desk taxonomy to this document's own
 * sections -- not a single crude cast, and not per-fixture: an item-level
 * override table for the ids Robert named as needing more than their
 * group's default (estate resilience specifically is Network, not every
 * "estate" item; success items split across Network/Operations/Project by
 * their own stable id), then a group-level default per real taxonomy
 * section (Robert's own explicit mapping: estate->Network, change and
 * support->Operations, services->Project, suppliers->Supplier,
 * commercial->Commercial), then -- for full backward compatibility with
 * every caller that already speaks THIS document's own section
 * vocabulary directly (every pre-round-4 fixture) -- honouring `n.section`
 * as-is when it is ALREADY a valid ProcurementSectionKey, and only THEN
 * falling back to Section 14.3's "Additional requirements".
 *
 * THE CRITICAL REPRODUCTION (Robert's own naming): a noted "24x7 support"
 * selection used to be silently dropped whenever a managed-service clause
 * already existed, because `receiptIsExplainedByClauses()`'s generic
 * 50%-word-overlap test found the single word "support" in that clause's
 * own boilerplate ("...with an agreed support model.") -- enough,
 * combined with "required" appearing nowhere, to hit the >=0.5 threshold
 * and erase a stable, explicitly selected requirement. `notedIdExplicitly
 * Covered()` below checks FIRST whether some OTHER clause has already
 * cited this exact noted id in its own `sourceNotedIds` (real, structural,
 * "explicit template coverage" -- see `managedServiceClause()`'s own
 * wiring of the SAME 24/7 signal) -- and only when no such citation exists
 * does the ORIGINAL `receiptIsExplainedByClauses()` generic-overlap check
 * still run, UNCHANGED, for every noted concept with no wired producer
 * (Robert's own DLP-duplication fixture, unaffected). This satisfies
 * "Duplicate suppression for noted selections must use semantic identity
 * or explicit template coverage, not incidental generic-word overlap" for
 * every concept that HAS a named producer, while never silently widening
 * to concepts that do not.
 */

/** Robert: "estate resilience belongs in Network"; "success items may
 *  belong in Network, Operations or Project depending on their stable
 *  noted id." Checked BEFORE the group default below -- these ids carry
 *  more specific meaning than their taxonomy group alone. Both real
 *  surfaces for "success" are covered: taxonomy.ts's own `sc-*` ids
 *  (landed via the earned-question chip machinery) and ProjectDesk.tsx's
 *  own directly note()-landed `twin-success-*` ids -- two UI paths to the
 *  same five real concepts. A headcount band ("500 to 2,000 people") is
 *  an organisation-sizing descriptor, not a testable network requirement
 *  -- kept out of the "estate" group's Network default. */
const NOTED_ITEM_SECTION_OVERRIDE: Record<string, ProcurementSectionKey> = {
  "twin-res-all": "network",
  "twin-res-crit": "network",
  "twin-res-hq": "network",
  "twin-res-none": "network",
  "chip-mid-band": "additional",
  "sc-availability": "network",
  "twin-success-avail": "network",
  "sc-latency": "network",
  "twin-success-lat": "network",
  "sc-sla": "operations",
  "twin-success-sla": "operations",
  "sc-reporting": "operations",
  "twin-success-rpt": "operations",
  "sc-migration": "project",
  "twin-success-mig": "project",
};

/** The real desk taxonomy's own section keys (taxonomy.ts's TAXONOMY,
 *  ProjectDesk.tsx's own `note()` sections -- the same vocabulary both
 *  surfaces use) -> this document's ProcurementSectionKey, per Robert's
 *  own explicit mapping where he gave one, and a reasoned default
 *  elsewhere for exhaustiveness. "organisation" and "drivers" carry no
 *  testable supplier requirement of their own (sizing/rationale, not a
 *  clause) -- Additional requirements, never invented into a section that
 *  would overstate them. */
const NOTED_SECTION_GROUP_DEFAULT: Record<string, ProcurementSectionKey> = {
  organisation: "additional",
  drivers: "additional",
  objectives: "project",
  estate: "network",
  security: "security",
  compliance: "security",
  model: "operations",
  change: "operations",
  support: "operations",
  commercial: "commercial",
  services: "project",
  success: "project",
  suppliers: "supplier",
};

function procurementSectionForNoted(n: NotedItem): ProcurementSectionKey {
  const override = NOTED_ITEM_SECTION_OVERRIDE[n.id];
  if (override) return override;
  const grouped = NOTED_SECTION_GROUP_DEFAULT[n.section];
  if (grouped) return grouped;
  if (Object.prototype.hasOwnProperty.call(SECTION_CODES, n.section)) return n.section as ProcurementSectionKey;
  return "additional";
}

/** Whether SOME other clause in this compile already cites `id` as one of
 *  its OWN `sourceNotedIds` -- real structural provenance, not incidental
 *  word overlap. See this section's own "THE CRITICAL REPRODUCTION"
 *  comment above. */
function notedIdExplicitlyCovered(id: string, clauses: ClauseDraft[]): boolean {
  return clauses.some((c) => c.sourceNotedIds.includes(id));
}

function notedClauses(noted: NotedItem[], alreadyCovered: ClauseDraft[]): ClauseDraft[] {
  const out: ClauseDraft[] = [];
  const seen = new Set<string>();
  for (const n of noted) {
    if (!n.id || !n.label || seen.has(n.id)) continue;
    seen.add(n.id);
    const covered =
      notedIdExplicitlyCovered(n.id, alreadyCovered) ||
      receiptIsExplainedByClauses({ id: 0, text: n.label }, [...alreadyCovered, ...out]);
    if (covered) continue;
    out.push({
      section: procurementSectionForNoted(n),
      statement: n.label,
      supplierResponse: ["Confirm your ability to meet this requirement and describe your approach."],
      evidence: ["Written confirmation and supporting detail"],
      acceptanceTest: null,
      mandatory: textImpliesMandatory(n.label),
      sourceFactIds: [],
      origin: "buyer",
      // Robert: "Do not falsely describe a clicked selection as typed
      // wording" -- `n.own` (ProjectDesk's own tag for a clicked
      // multi-select landing) picks the honest phrasing; a `quote` is
      // NEVER fabricated either way (see `quote: null` below).
      reason: n.own
        ? "The buyer selected this from noted options; a structured field has not yet landed for it."
        : "The buyer's own words state this; a structured field has not yet landed for it.",
      quote: null,
      sourceTurnIds: [],
      sourceNotedIds: [n.id],
      templateKey: `noted:${n.id}`,
      templateId: "noted-selection",
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Orchestration                                                       */
/* ------------------------------------------------------------------ */

export function buildCandidateClauses(input: {
  facts: WorkspaceFact[];
  requirement: SecurityRequirementInput;
  buying: BuyingId | null;
  opModel: OperatingModelId | null;
  receipts: ReceiptLike[];
  removalTargets: RemovalInstruction[];
  pack: SectorPack | null;
  flavours: string[];
  /** Phase 1 checkpoint round 2, item 2 (13 Aug 2026): the durable,
   *  timestamped ledger the CHRONOLOGICAL reducers (managedServiceClause's
   *  own operating-model/support-hours history) need -- distinct from
   *  `receipts`, which carries only what still awaits classification, not
   *  the raw turn text a fully-explained correction (e.g. a canonical
   *  "We now require a fully managed service.") never leaves behind.
   *  Optional and defaulted to `[]` so every existing caller is
   *  unaffected; chronologicalHistory() falls back to `receipts`' own
   *  order in that case, unchanged from before this correction. */
  sourceTurns?: SourceLedgerEntry[];
  /** Phase 1 checkpoint round 3, item 3 (14 Aug 2026): the buyer's
   *  CURRENT noted-tier selections (see `notedClauses()`'s own comment).
   *  Optional and defaulted to `[]` so every existing caller is
   *  unaffected. */
  noted?: NotedItem[];
  /** Phase 2 (14 Aug 2026): the PRECOMPUTED canonical support-coverage
   *  resolution (see resolveSupportCoverage()'s own comment), computed
   *  once by the caller (procurement-document.ts, at the same level
   *  `opModel` itself is resolved) and consumed here rather than
   *  re-derived -- one source of truth, never two independently-computed
   *  copies. Optional: a caller that omits it (every existing fixture)
   *  gets the SAME result computed locally from `sourceTurns`/`receipts`/
   *  `noted` below, byte-for-byte -- full backward compatibility. */
  supportCoverage?: SupportCoverageResolution;
}): ClauseDraft[] {
  const { facts, requirement, buying, opModel, receipts, removalTargets, pack, flavours, sourceTurns, noted } = input;
  const corpus = [...standing(facts).map((f) => f.quote ?? String(f.value)), ...receipts.map((r) => r.text)].join(" ");
  const ctx: TextTemplateCtx = { corpus, corpusReceipts: receipts, requirement, removalTargets };
  const conflict = detectOperatingModelConflict(receipts);
  const history = chronologicalHistory(sourceTurns ?? [], receipts);
  const supportCoverage = input.supportCoverage ?? resolveSupportCoverage(history, noted ?? []);

  const factDriven = [
    ...complianceClauses(facts),
    ...timelineClause(facts),
    ...managedServiceClause(facts, opModel, history, conflict, noted ?? [], supportCoverage),
    ...mplsCoexistenceClause(facts, buying),
    ...sectorClauses(pack, flavours),
  ];
  const textPattern = [
    ...resilienceClauses(ctx),
    ...siteResilienceClauses(ctx),
    ...voiceScopeClauses(ctx),
    ...identityAndDataClauses(ctx),
    ...legacyCircuitClauses(ctx),
    ...dataResidencyClauses(ctx),
    ...networkScopeClauses(ctx),
    ...thirdPartySecurityConsiderationClauses(ctx, buying),
  ];

  const named = [...factDriven, ...textPattern];
  // Phase 3 Stage A correction round (Robert, 14 Aug 2026), Prompt D: a
  // receipt that itself IS the single-supplier/best-of-breed-security
  // contradiction is represented as a visible OpenDecision
  // (buildOpenDecisions(), procurement-readiness.ts), never as an
  // additional-requirements catch-all clause -- the fallback path would
  // otherwise read "require" in the buyer's own sentence as mandatory
  // language and invent a pass/fail gate from an unresolved
  // contradiction (Section 16.4's own prohibition). Computed BEFORE
  // notedClauses() (moved up from its original position after that call)
  // so the noted-objective path below can share the same exclusion --
  // see that filter's own comment for why it is needed too.
  const supplierConflict = detectSupplierStrategyConflict(receipts);
  const conflictReceiptIds = new Set(
    supplierConflict?.active
      ? receipts.filter((r) => SINGLE_SUPPLIER_RE.test(r.text) && BEST_OF_BREED_SECURITY_RE.test(r.text)).map((r) => r.id)
      : [],
  );
  // Correction round, Prompt D reproduction (found via the real-UI
  // Playwright fixture added for defect #1): `statedObjectivesIn()`
  // (extract.ts) independently recognises the bare phrase "best-of-breed"
  // anywhere in the buyer's sentence and lands it in `noted` as its own
  // stated objective ("obj-bob"), a code path entirely separate from
  // `receipts`/`additionalRequirementClauses` above. Without this filter,
  // that objective still reached `notedClauses()` below and became its
  // OWN scored "Confirm your ability to meet this requirement" clause --
  // silently treating one side of an active, unresolved conflict as an
  // accepted requirement, right alongside the OpenDecision naming the
  // SAME tension as unresolved. Suppressed ONLY while the supplier-
  // strategy conflict is active (i.e. only when this exact receipt pairs
  // "best-of-breed" with "single supplier"); a buyer stating "we want
  // best-of-breed security" with no single-supplier language anywhere
  // still gets its own noted-objective clause exactly as before.
  const notedForClauses = supplierConflict?.active ? (noted ?? []).filter((n) => !BEST_OF_BREED_SECURITY_RE.test(n.label ?? "")) : (noted ?? []);
  const notedDrafts = notedClauses(notedForClauses, named);
  const additional = additionalRequirementClauses(
    receipts.filter((r) => !conflictReceiptIds.has(r.id)),
    removalTargets,
    [...named, ...notedDrafts],
    facts,
  );

  const all = [...named, ...notedDrafts, ...additional];
  // Section 16.2's removal law: a clause whose label was explicitly
  // "remove"/"drop"/"delete"/"cancel"ed is excluded from this compile and
  // every later one (removalTargets is recomputed from the FULL
  // accumulating receipts list every call) -- UNLESS a later receipt
  // restates it in the buyer's own words, in which case isCurrentlyRemoved
  // (above) resurrects it, the same law the fact ledger already holds.
  return all.filter((c) => !isCurrentlyRemoved(clauseRemovalLabel(c), removalTargets, receipts));
}

/** The label a removal instruction is matched against: the DLP clause's
 *  own templateId reads as "dlp-coverage", not "DLP" -- match against a
 *  short human label instead (the clause's first few statement words, or
 *  a fixed alias table for the templates a removal instruction is
 *  actually likely to name). Kept deliberately small and explicit rather
 *  than a generic NLP guess, the same "no invented match" discipline
 *  resolveDropTarget() (draft.ts) already holds for the fact ledger's own
 *  drop/remove command. */
const REMOVAL_ALIAS: Record<string, string> = {
  "dlp-coverage": "DLP data loss prevention",
  "identity-aware-ztna": "ZTNA identity",
  "voice-continuity": "voice teams phone",
  "application-resilience": "patient booking platform application",
  "mpls-coexistence": "MPLS",
  "uk-data-residency": "data residency UK",
};
function clauseRemovalLabel(c: ClauseDraft): string {
  return REMOVAL_ALIAS[c.templateId] ?? c.statement;
}

/* ------------------------------------------------------------------ */
/* Architecture (Section 5.5): nodes only from supported facts/clauses  */
/* ------------------------------------------------------------------ */

export function buildArchitecture(input: {
  requirement: SecurityRequirementInput;
  clauses: Array<{ id: string; templateId: string; sourceFactIds: string[] }>;
  receipts: ReceiptLike[];
  /** Stage A closure pass (Robert, 14 Aug 2026), item 2: what the buyer
   *  is BUYING (procurement.buying), not just what they already HAVE
   *  (estate.existingNetwork) -- see the "network" node's own comment
   *  just below for why this was missing before. Optional so a caller
   *  that predates this round (none left, but kept for the same
   *  backward-compatibility discipline every other optional field here
   *  already follows) degrades to the old existing-network-only
   *  behaviour, unchanged. */
  buying?: BuyingId | null;
}): { nodes: ArchitectureNode[]; edges: ArchitectureEdge[]; accessibleSummary: string } {
  const { requirement } = input;
  const nodes: ArchitectureNode[] = [];
  const edges: ArchitectureEdge[] = [];

  if (requirement.estate?.sites) nodes.push({ id: "sites", label: `${requirement.estate.sites} sites`, kind: "site", sourceFactIds: [], sourceClauseIds: [] });
  if (requirement.estate?.users) nodes.push({ id: "remote-users", label: `${requirement.estate.users} remote users`, kind: "user", sourceFactIds: [], sourceClauseIds: [] });

  /** Stage A closure pass, item 2 reproduction: this node used to exist
   *  ONLY when the buyer stated an EXISTING network (estate.
   *  existingNetwork, e.g. "we currently run MPLS") -- so Prompt A's own
   *  recognised clauses (SASE/SD-WAN, Azure, Entra ID, Teams Phone, the
   *  retained circuit) rendered as disconnected chips: every `link()`
   *  call below reaches through this SAME node id, and none of them
   *  could fire with no node to connect through, even though the buyer
   *  had already stated a real TARGET service ("We need managed SASE and
   *  SD-WAN"). Fixed by also creating this node from the buyer's stated
   *  BUYING intent (procurement.buying, resolved the identical way the
   *  rest of the compiler already resolves it -- never invented) or, if
   *  that scalar fact didn't land but the buyer's own sentence was still
   *  recognised as a network/security architecture scope statement (the
   *  `network-architecture-scope` clause, `networkScopeClauses()`
   *  above), from that clause's own presence -- citing it in
   *  `sourceClauseIds` exactly the way every other clause-derived node
   *  below already does. An EXISTING network, when stated, still takes
   *  priority for the label (unchanged behaviour for the already-tested
   *  MPLS-coexistence scenario) -- this only fills in the gap for when
   *  no existing network was ever stated at all. */
  const network = requirement.estate?.existingNetwork ?? [];
  const targetServiceClauseId = input.clauses.find((c) => c.templateId === "network-architecture-scope")?.id;
  if (network.length) {
    nodes.push({ id: "network", label: `Network (${network.map((n) => NETWORK_LABELS[n] ?? n).join(", ")})`, kind: "network", sourceFactIds: [], sourceClauseIds: [] });
  } else if (input.buying || targetServiceClauseId) {
    const label = input.buying ? `Proposed ${BUYING_SHORT[input.buying]} service` : "Proposed network/security service";
    nodes.push({ id: "network", label, kind: "network", sourceFactIds: [], sourceClauseIds: targetServiceClauseId ? [targetServiceClauseId] : [] });
  }
  for (const c of requirement.estate?.cloud ?? []) {
    nodes.push({ id: `cloud-${c}`, label: CLOUD_LABELS[c] ?? c, kind: "cloud", sourceFactIds: [], sourceClauseIds: [] });
  }

  // Phase 1 checkpoint correction, item 1 (13 Aug 2026), amended round 2
  // (13 Aug 2026): a node derived FROM a specific clause carries that
  // clause's own IMMUTABLE id in `sourceClauseIds` -- a deterministic hash
  // of the clause's templateKey (procurement-document.ts's
  // stableClauseId()), never a function of history, array position, or
  // which OTHER clauses this compile produced, so it is exactly as stable
  // across a real reload (previousDocument=null) as it is in-memory. A
  // node derived from requirement fields alone (sites, users, network,
  // cloud -- no single clause backs any one of them) is left with no
  // clause to cite, same as before.
  const clauseIdFor = (templateId: string): string[] => {
    const c = input.clauses.find((x) => x.templateId === templateId);
    return c ? [c.id] : [];
  };
  const hasClause = (templateId: string) => input.clauses.some((c) => c.templateId === templateId);
  // Stage A closure pass (Robert, 14 Aug 2026), item 2 reproduction:
  // this checked ONLY the heavier "identity-aware-ztna"/"voice-continuity"
  // templateIds -- the correction round's own lighter templates
  // ("identity-provider-entra" for a bare Entra ID mention with no ZTNA
  // language, "voice-scope" for a bare Teams Phone mention with no
  // resilience language, both added to fix the correction round's
  // catch-all-clause defect) were never taught to this function, so
  // Prompt A's own exact wording -- which fires the LIGHTER templates,
  // not the heavier ones -- produced no identity/voice node at all. Each
  // pair is checked in the same priority order buildCandidateClauses
  // itself resolves them (the heavier, more specific template first,
  // since identityAndDataClauses()'s own `else if` means at most one of
  // the pair can ever be present in one compile), and cites whichever
  // one actually fired.
  const anyClauseId = (templateIds: string[]): string[] => {
    for (const t of templateIds) {
      const id = clauseIdFor(t);
      if (id.length) return id;
    }
    return [];
  };
  const IDENTITY_TEMPLATE_IDS = ["identity-aware-ztna", "identity-provider-entra"];
  const VOICE_TEMPLATE_IDS = ["voice-continuity", "voice-scope"];
  if (IDENTITY_TEMPLATE_IDS.some(hasClause)) nodes.push({ id: "identity", label: "Identity (Entra ID)", kind: "identity", sourceFactIds: [], sourceClauseIds: anyClauseId(IDENTITY_TEMPLATE_IDS) });
  if (VOICE_TEMPLATE_IDS.some(hasClause)) nodes.push({ id: "voice", label: "Voice service (Teams Phone)", kind: "voice", sourceFactIds: [], sourceClauseIds: anyClauseId(VOICE_TEMPLATE_IDS) });
  if (hasClause("application-resilience")) nodes.push({ id: "application", label: "Patient-facing application", kind: "application", sourceFactIds: [], sourceClauseIds: clauseIdFor("application-resilience") });
  if (hasClause("legacy-circuit-coexistence")) {
    nodes.push({ id: "legacy-application", label: "Legacy application", kind: "application", sourceFactIds: [], sourceClauseIds: clauseIdFor("legacy-circuit-coexistence") });
    nodes.push({ id: "retained-circuit", label: "Retained point-to-point Ethernet circuit", kind: "circuit", sourceFactIds: [], sourceClauseIds: clauseIdFor("legacy-circuit-coexistence") });
  }

  const has = (id: string) => nodes.some((n) => n.id === id);
  const link = (from: string, to: string, label: string) => {
    if (has(from) && has(to)) edges.push({ from, to, label });
  };
  link("sites", "network", "connects");
  link("remote-users", "network", "connects");
  for (const c of requirement.estate?.cloud ?? []) link("network", `cloud-${c}`, "reaches");
  link("network", "identity", "policy decision");
  link("identity", "application", "gated access");
  link("voice", "network", "depends on failover");
  link("application", "network", "depends on failover");
  link("legacy-application", "retained-circuit", "coexists via");
  link("retained-circuit", "network", "migrates onto");

  const accessibleSummary = nodes.length
    ? `Architecture: ${nodes.map((n) => n.label).join("; ")}. ${edges.length ? `Dependencies: ${edges.map((e) => `${e.from} ${e.label} ${e.to}`).join("; ")}.` : "No dependencies derived yet."}`
    : "No architecture derived yet: no supported facts stand.";

  return { nodes, edges, accessibleSummary };
}
