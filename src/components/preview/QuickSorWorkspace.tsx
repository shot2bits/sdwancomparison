"use client";

/**
 * Milestone 1, Commit 10 — the isolated Understanding preview orchestrator
 * (W0 preview, isolated route only: /preview/quick-sor, public path
 * /sase/preview/quick-sor/ once merged and deployed). This commit is
 * orchestration and preview wiring ONLY: every fact, question, activity
 * entry and label rendered here is computed by an already-approved
 * production or preview function, imported and called exactly as written —
 * nothing here recomputes, reimplements or duplicates any of their logic
 * (Article 17: one truth, every client).
 *
 * Every submitted message is routed through the EXISTING production path,
 * unmodified: POST /sase/api/workspace/extract, then the same preview
 * tombstone parity filter (Commit 3) already proven against ProjectDesk.tsx,
 * then mergeUpdates() from @/lib/workspace/draft (unchanged, same call this
 * file made before this commit). No new backend route, no new persistence
 * rule, no vendor field, no auth, no MCP change. State lives in this
 * component only (React state and one React ref for the tombstone set),
 * never localStorage/sessionStorage/cookies — a refresh clears the preview,
 * same limitation the retired PositionWorkspace/LiveWorkspace components
 * accepted for their own scratch state.
 *
 * Newly wired in this commit: SessionActivity (Commit 9B) as the one
 * authoritative "what happened this turn" surface, UnderstandingDocument
 * (Commit 6) as the one authoritative buyer-facing document, and
 * EarnedQuestionsList (Commit 8) fed from earnedQuestions() (the same
 * function ProjectDesk.tsx and the workspace_cycle MCP tool already call).
 * CaptureReceiptBanner and StatementOfRequirements — the Phase 0 slice's
 * original, now-superseded per-cycle receipt and living-document renderers
 * — are no longer used by this orchestrator (their files are untouched;
 * this component simply stopped importing them, since SessionActivity and
 * UnderstandingDocument now serve those same two purposes without
 * duplicating a second label table or a second brief-rendering path).
 *
 * Milestone 1, Commit 11A — first-load hierarchy only, composition and
 * conditional-mounting changes in this file, no new derivation:
 *
 * Journey selector: JourneySelector.tsx itself is untouched (it is not in
 * this commit's allowed file list). Instead this file now decides WHETHER
 * to mount it: `journeyExpanded` (new, presentational-only local state)
 * defaults to false, so first load — and every load thereafter, unless the
 * buyer opts in — renders one quiet "Netify · Quick Understanding" line
 * plus a restrained "Other ways to work" toggle instead of the three
 * peer-weight cards. Choosing to reveal <JourneySelector current={journey}
 * onSelect={setJourney} /> unmodified, exactly as before, is what "not
 * showing the two inactive Coming Soon cards by default" means here — the
 * component and its props are unchanged; only its mount point is
 * conditional now.
 *
 * Empty-surface suppression: UnderstandingDocument, unlike
 * EarnedQuestionsList and SessionActivity, has no internal `return null`
 * for "nothing yet" — its own empty state is a rendered dashed placeholder
 * (see UnderstandingDocument.tsx's own header comment on why its gate is
 * `facts.length`, not `blocks.length`). Modifying that placeholder away
 * would mean editing UnderstandingDocument.tsx, which is outside this
 * commit's allowed files, so instead this file simply does not mount
 * UnderstandingDocument, EarnedQuestionsList or SessionActivity at all
 * until `started` (the existing `entries.length > 0` signal this
 * orchestrator already computed before this commit) is true — matching
 * this commit's own definition of "first load" ("no facts and no Session
 * Activity"). EarnedQuestionsList and SessionActivity already self-null on
 * empty input and are unaffected in substance; gating their wrapper divs
 * too is just removing a stray empty margin, not a behaviour change.
 *
 * earnedQuestions() call shape — verified from source, not guessed: the
 * real signature is positional,
 *   earnedQuestions(requirement, buying, opModel, notedIds, dismissed, corpus?)
 * — not the object shape a template might suggest. `requirement`, `buying`
 * and `opModel` are all derived directly from the current facts via
 * requirementFrom()/buyingOf()/operatingModelOf() (Article 24: questions
 * are shown because they derive from the current facts, nothing is
 * selected as "next"). `notedIds` and `dismissed` track which questions a
 * buyer has already answered or dismissed via chip clicks — an interactive
 * affordance EarnedQuestionsList deliberately does not build yet (Commit 8:
 * presentational only, no callbacks) — so there is no session state for
 * either to read here. This is not a gap invented for this commit: the
 * MCP workspace tool, the other existing Article-17 client of
 * earnedQuestions() that also has no per-buyer note/dismiss tracking of
 * its own, resolves the identical situation the identical way — verified
 * directly from src/lib/mcp-workspace-tools.ts:204,
 *   earnedQuestions(result.requirement, buying, operatingModel ?? null, [], [])
 * — passing empty arrays for both, with `corpus` left at its default. This
 * orchestrator follows that same, already-established call shape rather
 * than inventing a third resolution; see the Commit 10 report for the full
 * reasoning trail.
 *
 * Milestone 1, Commit 11C — bounded explanation treatment. classifyTurnEntry()
 * now also recognises a small, fixed glossary question set (src/lib/
 * workspace/explanations.ts's explanationForInput(), narrow deterministic
 * matching only) and, when matched with no real extraction changes,
 * appends a "clarification" entry carrying that fixed reviewed definition
 * instead of falling through to the generic fallback. A real change always
 * wins over a glossary or fallback classification (see classifyTurnEntry's
 * own doc comment for the full priority order). This file does not decide
 * WHAT any glossary definition says (that lives solely in explanations.ts)
 * and does not select, rank or explain the rationale for any EarnedQuestion.
 *
 * Commit 11C correction — three exact direct-explanation-request phrases
 * ("Why are you asking?", "Why does Netify need this?", "Why is that
 * relevant?") were added to CLARIFICATION_PHRASES so they now receive the
 * same honest fallback clarification as the original five narrow phrases,
 * instead of silently landing as "no_change" (the externally reported gap
 * this correction fixes). Still exact-phrase recognition only — no
 * rationale is invented, no question is selected, and a substantive
 * statement that merely contains "why"/"asking"/"relevant"/"need" (e.g.
 * "Suppliers must explain why their design is suitable.") still lands as
 * "no_change", unchanged from before this correction.
 */

import { useRef, useState } from "react";
import JourneySelector, { type JourneyId } from "./JourneySelector";
import PersistentAssistantInput from "./PersistentAssistantInput";
import UnderstandingDocument from "./UnderstandingDocument";
import EarnedQuestionsList from "./EarnedQuestionsList";
import SessionActivity from "./SessionActivity";
import {
  mergeUpdates,
  requirementFrom,
  buyingOf,
  operatingModelOf,
  type WorkspaceFact,
} from "@/lib/workspace/draft";
import { QUANTITY_NOT_RECORDED_PREFIX, type FieldUpdate } from "@/lib/workspace/extract";
import { earnedQuestions } from "@/lib/workspace/questions";
import { labelFor } from "@/lib/workspace/labels";
import { computeSessionChanges, type SessionActivityEntry, type SessionChange } from "./session-diff";
import { createTombstoneSet, filterTombstonedUpdates, type TombstoneSet } from "./tombstone-preview";
import { explanationForInput } from "@/lib/workspace/explanations";
import { CREATE_CONSENT_TEXT } from "@/lib/security/create-project";
import { withManageToken } from "@/lib/manage-redirect";

type ExtractResponse = { updates: FieldUpdate[]; engine: string; notes: string[] };

/**
 * Deliberately narrow, deterministic clarification detection (no model
 * call, no keyword scan). Accepts only the eight phrases named below —
 * the original five from Commit 10, plus three direct-explanation-request
 * phrases added in the Commit 11C correction ("Why are you asking?", "Why
 * does Netify need this?", "Why is that relevant?") — normalised by
 * trim/lowercase/trailing-punctuation-strip only — no stemming, no
 * substring matching, no broad "contains why/asking/relevant/need" rule.
 * Two apostrophe spellings of "don't" are listed as literal accepted
 * strings (not a general normalisation step) purely because the
 * acceptance sequence's own Turn 3 example could plausibly be typed
 * either way.
 *
 * The three "why" phrases are treated exactly like the original five: an
 * honest statement that no specific question or recognised glossary term
 * is currently available to explain, using the same fixed fallback
 * explanation (CLARIFICATION_FALLBACK_EXPLANATION below). Nothing here
 * invents a reason for any EarnedQuestion, selects a question, or claims
 * why a particular fact or answer is needed — this remains exact-phrase
 * recognition only, so a substantive statement that happens to contain
 * "why", "asking", "relevant" or "need" (e.g. "Suppliers must explain why
 * their design is suitable.", "We need to know why the current network is
 * failing.") is correctly rejected: none of those sentences, taken whole
 * or as a comma-separated segment, is byte-for-byte one of the eight
 * accepted phrases.
 *
 * The acceptance sequence's own Turn 3 message ("I don't know what you
 * mean, can you explain?") joins two of the accepted phrases with a
 * comma. To honour that exact required case without adding broad matching,
 * a message is also accepted when EVERY comma-separated segment (after the
 * same narrow normalisation) is, on its own, one of the accepted
 * phrases — still fully deterministic, and still false for any segment
 * that isn't an exact accepted phrase (so "We use Meraki, can you explain
 * the pricing?" is correctly rejected: its first segment is a substantive
 * fact, not one of the accepted phrases).
 */
const CLARIFICATION_PHRASES = new Set([
  "what do you mean",
  "can you explain",
  "i don't know what you mean",
  "i don’t know what you mean",
  "i do not know what you mean",
  "please explain",
  "why are you asking",
  "why does netify need this",
  "why is that relevant",
]);

function normaliseForClarificationCheck(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s.?!]+$/g, "");
}

/**
 * Exported (alongside the default component export) so the validation
 * script can call this REAL, un-duplicated function directly — this
 * component has hooks (useState/useRef) and so cannot itself be invoked
 * as a plain function the way the stateless preview primitives can; this
 * is the "extract the smallest pure helper functions" allowance the
 * Commit 10 testing-approach section names explicitly.
 */
export function isNarrowClarificationMessage(raw: string): boolean {
  const normalised = normaliseForClarificationCheck(raw);
  if (CLARIFICATION_PHRASES.has(normalised)) return true;
  const parts = normalised.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((p) => CLARIFICATION_PHRASES.has(p));
}

/**
 * Fixed, approved fallback only — no model call, no gap/question chosen,
 * no EarnedQuestion rationale invented. Commit 11C's exact required
 * wording (replacing the earlier Commit 9A/10 text): now explicitly names
 * BOTH things this fallback covers — no current Netify question AND no
 * recognised glossary term — since Commit 11C adds a second, distinct
 * "nothing to explain" path (an unrecognised direct question, as opposed
 * to a recognised glossary term or a currently-selected question, neither
 * of which this Milestone implements).
 */
export const CLARIFICATION_FALLBACK_EXPLANATION =
  "There isn’t a specific Netify question or recognised term selected to explain. You can continue adding or correcting information about your project.";

/**
 * Fix (retraction requests are a silent no-op — the externally reported
 * gap this closes): a message like "Ignore the budget I mentioned
 * earlier." currently extracts no changes (correctly — there is nothing
 * for the model or the deterministic rail to add), and previously fell
 * straight through to "no_change", rendering the same bare "No changes to
 * your Understanding." line as any ordinary no-op turn. That is honest
 * about the ledger but not about the request: the buyer asked Netify to
 * remove something, and nothing told them whether that happened or why
 * not. Retracting a SPECIFIC already-recorded fact is not implemented in
 * this preview (there is no removal semantics in mergeUpdates()/the fact
 * ledger to hook into without a much larger change), so this says that
 * plainly instead of staying silent, and offers the one workaround that
 * already works today (restate the correct value; a correction already
 * overwrites the old one).
 *
 * Deliberately narrow and deterministic, same philosophy as
 * isNarrowClarificationMessage above: the message must both START with a
 * retraction verb (ignore/forget/disregard/scratch/remove/delete,
 * optionally after "please") AND separately reference the buyer's own
 * earlier statement (e.g. "i mentioned", "we said", "i told you", "that").
 * Requiring both halves is what keeps a real requirement sentence that
 * merely contains "ignore" from misfiring — e.g. "Suppliers should ignore
 * legacy hardware in their proposal." starts with "Suppliers", not a
 * retraction verb, so it correctly does not match; "Please ignore what I
 * said about the budget" matches both halves and correctly does.
 */
const RETRACTION_LEAD = /^(?:please\s+)?(?:ignore|forget|disregard|scratch|remove|delete)\b/;
/* Fix (correction pass 2, Priority 6 — the brief's own required exact
 * sequence): "Ignore what I just said, forget the 15 sites." is the
 * literal second message the brief specifies, and it did not match this
 * check before this fix — "i just said" sat one filler word away from the
 * bare "i said"/"we said" the pattern required, so RETRACTION_SELF_REFERENCE
 * never fired, isRetractionRequest() returned false, and the message fell
 * through to an ordinary (silent, no-op-looking) turn instead of the
 * honest retraction acknowledgment Priority 6 requires. A small, bounded
 * filler-word gap (one of "just/already/previously/earlier", at most one)
 * between the pronoun and the verb closes exactly that gap without loosening
 * the match into a general "mentions time" scan — "i mentioned", "we said",
 * "i just said", "i already said" all now match; nothing else does. */
const RETRACTION_SELF_REFERENCE =
  /\b(?:i|we)\s+(?:just\s+|already\s+|previously\s+|earlier\s+)?(?:mentioned|said|told\s+you|noted|wrote|typed)\b|\bthat\b/;

export function isRetractionRequest(raw: string): boolean {
  const normalised = raw.trim().toLowerCase();
  return RETRACTION_LEAD.test(normalised) && RETRACTION_SELF_REFERENCE.test(normalised);
}

export const RETRACTION_FALLBACK_EXPLANATION =
  "Netify can’t remove a specific earlier statement in this preview yet, so nothing was deleted. To change it, restate the correct value instead (for example, “Actually, our budget is £150,000”) and Netify will update it.";

/**
 * Fix (correction pass 2, Priority 5 — "No, dual-circuit isn't
 * required."): the q-resilience EarnedQuestion ("At your site count, is
 * dual-circuit resilience per site required?") already has a "Not
 * required" option in questions.ts, but that option is only reachable by
 * clicking a chip — EarnedQuestionsList renders it presentation-only
 * (Commit 8), and this preview's own earnedQuestions() call has always
 * passed `dismissed` as a hardcoded `[]` (see this file's header
 * comment), so nothing could ever resolve any EarnedQuestion by any
 * route before this fix. A free-text "No, dual-circuit isn't required."
 * answer previously matched no recognised phrase at all, so it fell
 * through to a bare, unacknowledged "No changes to your Understanding."
 * and the question stayed listed forever, unresolved and unaffected —
 * matching Harry's report exactly.
 *
 * Deliberately narrow and deterministic, same philosophy as
 * isRetractionRequest/isNarrowClarificationMessage above: this
 * recognises only a negative answer to the dual-circuit question
 * specifically, not resilience language in general, so an ordinary
 * requirement sentence that happens to mention resilience is never
 * misread as answering a question that may not even be showing. The
 * caller (runCycle, below) only acts on a match here when q-resilience
 * was actually an active EarnedQuestion the moment the buyer answered —
 * recognising the phrase alone is not enough to change anything.
 */
const DUAL_CIRCUIT_NOT_REQUIRED = /^no,?\s*dual[- ]circuit(?:\s+resilience)?\s+(?:isn'?t|is\s+not)\s+required$/;

export function isDualCircuitNotRequiredAnswer(raw: string): boolean {
  const normalised = raw
    .trim()
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[\s.?!]+$/g, "")
    .replace(/\s+/g, " ");
  return DUAL_CIRCUIT_NOT_REQUIRED.test(normalised);
}

/**
 * Fixed copy for the dual-circuit answer above: names the question
 * answered, in the buyer's own words that a real chip click would
 * already have recorded via the existing "Not required" option (see
 * questions.ts) — same outcome as that option (the question resolves;
 * no new fact is written to the ledger, exactly like that option's own
 * `{ kind: "dismiss" }` behaviour), just reached from typed text instead
 * of a click, and now actually acknowledged instead of silently
 * discarded.
 */
export const RESILIENCE_ANSWER_EXPLANATION =
  "Recorded: dual-circuit resilience per site isn’t required. This question is now resolved and won’t be asked again this session.";

/**
 * The submitted-turn classification rule (entry types A/B/C from the
 * Commit 10 instructions, extended in Commit 11C with a bounded glossary
 * branch inside C), extracted as its own pure function for the same
 * testability reason as isNarrowClarificationMessage above. Takes the REAL
 * computeSessionChanges() output and the raw buyer text; invents nothing,
 * chooses no gap, selects or ranks no EarnedQuestion, calls no model.
 *
 * Priority, unchanged in spirit from Commit 10, extended for glossary and
 * (Commit 11C correction) the three direct-explanation-request phrases:
 *   A. changes.length > 0            -> "changes" (a real change always wins,
 *                                        even if the same text also happens
 *                                        to look like a glossary question or
 *                                        a narrow clarification phrase).
 *   C1. a recognised glossary question (explanationForInput(rawMessage) !=
 *       null) AND no changes         -> "clarification", glossary-shaped.
 *   C2. a narrow retraction request (isRetractionRequest(rawMessage)) AND
 *       no changes AND not already handled by C1
 *                                     -> "clarification", retraction-shaped
 *                                        (fix: previously fell through to
 *                                        B with no acknowledgment at all).
 *   C3. one of the eight narrow clarification phrases — including "why are
 *       you asking", "why does netify need this", "why is that relevant"
 *       — AND no changes AND not already handled by C1/C2
 *                                     -> "clarification", fixed fallback.
 *   B. anything else                 -> "no_change" (not an error; this is
 *                                        where any OTHER, unrecognised
 *                                        direct question lands — no
 *                                        rationale is invented for it
 *                                        here).
 *
 * Correction pass 2 additions:
 *   C2.5. isDualCircuitNotRequiredAnswer(rawMessage) AND the caller
 *       confirms q-resilience was an active EarnedQuestion this turn
 *       (`resilienceQuestionActive`) AND no changes AND not already
 *       handled by C1/C2      -> "clarification", resilience-answer-shaped
 *       (Priority 5: the question resolves; see isDualCircuitNotRequired
 *       Answer's own comment for why this needs the caller-supplied
 *       context instead of matching on text alone).
 *   `notes` (Priority 3, Tests 72/73): independent of A/B/C above — any
 *       entry, whichever kind it lands as, gets `droppedQuantityNote`
 *       attached when `notes` contains a QUANTITY_NOT_RECORDED_PREFIX
 *       marker, so a turn that both adds a real fact (kind "changes")
 *       AND had an implausible quantity rejected in the same sentence
 *       shows both, never just one.
 */
export function classifyTurnEntry(
  cycle: number,
  changes: SessionChange[],
  rawMessage: string,
  notes: string[] = [],
  resilienceQuestionActive = false,
): SessionActivityEntry {
  const droppedQuantityNote = notes.find((n) => n.startsWith(QUANTITY_NOT_RECORDED_PREFIX));
  const withDroppedNote = (entry: SessionActivityEntry): SessionActivityEntry =>
    droppedQuantityNote ? { ...entry, droppedQuantityNote } : entry;

  if (changes.length > 0) {
    // A. Changes entry — a real change always wins over any clarification
    // classification, glossary, retraction or fallback.
    return withDroppedNote({ cycle, kind: "changes", changes });
  }

  // C1. Bounded, fixed-glossary explanation: narrow deterministic
  // recognition only (src/lib/workspace/explanations.ts) — never a
  // substantive project statement that merely mentions an approved term.
  const glossary = explanationForInput(rawMessage);
  if (glossary) {
    return withDroppedNote({
      cycle,
      kind: "clarification",
      changes: [],
      clarification: {
        question: glossary.question,
        explanation: glossary.explanation,
        kind: "glossary",
        term: glossary.term,
      },
    });
  }

  // C2. Narrow retraction request: an honest "can't remove that here yet"
  // instead of the previously-silent "no_change" fall-through.
  if (isRetractionRequest(rawMessage)) {
    return withDroppedNote({
      cycle,
      kind: "clarification",
      changes: [],
      clarification: { question: rawMessage.trim(), explanation: RETRACTION_FALLBACK_EXPLANATION, kind: "retraction" },
    });
  }

  // C2.5. Dual-circuit resilience answer: only acts when the caller
  // confirms the question was actually active this turn (see this
  // function's header comment) — recognising the phrase alone is not
  // enough, so an out-of-context match never fires.
  if (resilienceQuestionActive && isDualCircuitNotRequiredAnswer(rawMessage)) {
    return withDroppedNote({
      cycle,
      kind: "clarification",
      changes: [],
      clarification: { question: rawMessage.trim(), explanation: RESILIENCE_ANSWER_EXPLANATION, kind: "resilience_answer" },
    });
  }

  if (isNarrowClarificationMessage(rawMessage)) {
    // C3. Clarification entry: fixed fallback only.
    return withDroppedNote({
      cycle,
      kind: "clarification",
      changes: [],
      clarification: { explanation: CLARIFICATION_FALLBACK_EXPLANATION, kind: "fallback" },
    });
  }
  // B. No-change entry — not an error. Also where any OTHER, unrecognised
  // direct question (e.g. "Why does the desk want this level of detail?")
  // lands: no rationale is invented for it here.
  return withDroppedNote({ cycle, kind: "no_change", changes: [] });
}

export default function QuickSorWorkspace() {
  const [journey, setJourney] = useState<JourneyId>("quick_sor");
  const [facts, setFacts] = useState<WorkspaceFact[]>([]);
  const [entries, setEntries] = useState<SessionActivityEntry[]>([]);
  const [cycle, setCycle] = useState(0);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bridge (Quick Understanding -> real Project): a completely separate
  // busy/error pair from the extraction turn above. Continuing calls a
  // different endpoint (POST /api/security-sourcing/project) than
  // runCycle's extraction call, so it must not share `busy`/`error` and
  // risk either disabling the wrong control or clobbering an extraction
  // error message with a continue error or vice versa.
  const [continueBusy, setContinueBusy] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);

  // Same-tick reentrancy guard as busyRef below, and for the same reason:
  // `continueBusy` state alone can still read false for a second click that
  // lands before React commits the first setContinueBusy(true). Set BEFORE
  // the state update, checked BEFORE either. Deliberately never reset on
  // the success path (see handleContinue's finally-free success branch) --
  // once a project is actually created, this guard must stay tripped for
  // the rest of this component's lifetime, since the page is navigating
  // away and any further click here would create a second, unwanted
  // project from the same facts.
  const continueBusyRef = useRef(false);

  // Correction pass 2, Priority 5: the one EarnedQuestion id this preview
  // can now resolve from typed text (see isDualCircuitNotRequiredAnswer's
  // header comment) — mirrors the exact `dismissed` shape earnedQuestions()
  // already accepts, so this is additive local state, not a new concept.
  // Every other question remains unresolvable via any route, exactly as
  // before this pass.
  const [dismissedQuestionIds, setDismissedQuestionIds] = useState<string[]>([]);

  // Commit 11A, presentational only: whether the full three-card
  // JourneySelector is revealed. Defaults closed so the quiet single-line
  // mode indicator is what renders by default; JourneySelector itself is
  // neither modified nor given new props — this only decides whether it
  // mounts. Does not participate in extraction, facts, or any state
  // transition runCycle() reads or writes.
  const [journeyExpanded, setJourneyExpanded] = useState(false);

  // Preview tombstone parity (Commit 3), owned for the life of this preview
  // session only — same ownership convention as the live desk's own
  // useRef<Set<string>>, mirrored (not reimplemented) by tombstone-preview.ts.
  const tombstonesRef = useRef<TombstoneSet>(createTombstoneSet());

  // Synchronous re-entrancy guard: `busy` state alone can be stale within
  // the same tick (two calls before the next render), so a ref backs the
  // same simple busy guard the UI already shows — not a queue, not
  // concurrency control, just a same-tick duplicate-submit guard.
  const busyRef = useRef(false);

  // An entry is only ever appended on a genuinely successful turn (see
  // runCycle's catch branch, which appends nothing), so entries.length is
  // the authoritative "has the buyer submitted anything yet" signal —
  // more accurate than facts.length alone, since a clarification-only or
  // no-change turn is still a real, successful turn.
  const started = entries.length > 0;

  async function runCycle() {
    const text = input.trim();
    if (!text || busyRef.current) return; // 1. reject blank/whitespace-only, no API call

    busyRef.current = true;
    setBusy(true); // 2. busy state
    setError(null);

    try {
      // 3. Send the buyer text to the existing workspace extraction
      // endpoint, current request shape — same endpoint, same body shape,
      // same requirementFrom() bridge ProjectDesk.tsx uses today.
      const res = await fetch("/sase/api/workspace/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, requirement: requirementFrom(facts) }),
      });
      // Fix (raw HTTP status leaking to buyers): res.status is logged, not
      // shown — a buyer-facing error names no status code, matching the
      // wording of every other thrown error in this function.
      //
      // Tidy-up fix (Harry's tracker, row 104 — typing "UK" alone produced
      // a confusing "(400) Try again" with no explanation): a 400 from this
      // endpoint is always a client-correctable input problem (e.g. the API's
      // own 3-character minimum — see api/workspace/extract/route.ts), and
      // the API already returns a clear, actionable `error` string for it
      // ("Describe your requirement in a sentence or two."). Previously this
      // branch discarded that message unconditionally and always showed the
      // same generic "Could not read that just now," which reads as a
      // system failure even when the buyer's own next move (add a few more
      // words) is obvious from the API's real response. Any other non-ok
      // status (5xx, network-adjacent failures) still gets the generic,
      // status-code-free message, since those aren't the buyer's to fix.
      if (!res.ok) {
        console.error(`Quick Understanding extraction request failed: HTTP ${res.status}`);
        if (res.status === 400) {
          let apiMessage: string | undefined;
          try {
            const body = (await res.json()) as { error?: unknown };
            if (typeof body?.error === "string" && body.error.trim()) apiMessage = body.error.trim();
          } catch {
            // Malformed/non-JSON 400 body — fall through to the generic message.
          }
          throw new Error(apiMessage ?? "Could not read that just now. Try again.");
        }
        throw new Error("Could not read that just now. Try again.");
      }

      const data = (await res.json()) as Partial<ExtractResponse> | null;
      // Invalid response shape -> extraction failure, no partial merge.
      if (!data || !Array.isArray(data.updates)) {
        throw new Error("Something went wrong reading that. Try again.");
      }

      // 4. the authoritative FieldUpdate[] result
      const rawUpdates = data.updates;

      // 5. filter through the preview tombstone helper (live ProjectDesk
      // parity rule: an inferred update whose path+value was previously
      // dropped never returns; a stated update is never filtered).
      const filteredUpdates = filterTombstonedUpdates(rawUpdates, tombstonesRef.current);

      // 6. snapshot the current facts immediately before mergeUpdates()
      const beforeFacts = facts;

      // 7. increment the cycle once for this submitted turn
      const newCycle = cycle + 1;

      // 8. mergeUpdates() exactly once, same source value ("extract")
      // this file already used before this commit.
      const merged = mergeUpdates(beforeFacts, filteredUpdates, newCycle, "extract");
      const afterFacts = merged.facts; // 9. the new authoritative in-memory ledger

      // 10. computeSessionChanges(before, after, updates, cycle)
      const changes = computeSessionChanges(beforeFacts, afterFacts, filteredUpdates, newCycle);

      // 11. append exactly one SessionActivityEntry for this turn — the
      // classification rule itself lives in classifyTurnEntry() above so
      // it can be unit-tested directly (facts merged above are whatever
      // filteredUpdates produced; for a genuine clarification message
      // that is always nothing, since extraction earns no real update
      // from a bare "what do you mean?"). `resilienceQuestionActive` is
      // read from `questions` (computed below, from `facts` as of the
      // PREVIOUS render — i.e. before this turn's merge, exactly the
      // question set the buyer was actually looking at when they typed
      // their answer) via closure, same pattern this file already uses
      // for `requirementFrom(facts)` above. `data.notes` threads Priority
      // 3's dropped-quantity marker through, independent of `changes`.
      const resilienceQuestionActive = questions.some((q) => q.id === "q-resilience");
      const entry = classifyTurnEntry(newCycle, changes, text, data.notes ?? [], resilienceQuestionActive);

      setFacts(afterFacts);
      setCycle(newCycle);
      setEntries((prev) => [...prev, entry]);
      setInput("");
      // Priority 5: the dual-circuit answer resolves q-resilience the same
      // way its "Not required" chip option already would — no new ledger
      // fact, the question just stops being asked again this session.
      if (entry.clarification?.kind === "resilience_answer") {
        setDismissedQuestionIds((prev) => (prev.includes("q-resilience") ? prev : [...prev, "q-resilience"]));
      }
    } catch (e) {
      // Facts, cycle and activity are all untouched here by construction —
      // none of the setters above are reached when this branch runs.
      setError(e instanceof Error ? e.message : "Something went wrong reading that. Try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  // Bridge (Quick Understanding -> real Project): turns this session's
  // facts into a real, persisted Project via the existing Security
  // Sourcing creation route rather than any new backend. That route
  // already accepts exactly the SecurityRequirementInput shape
  // requirementFrom(facts) produces, already validates confidence
  // server-side (rejecting with actionable gap-question text this UI
  // simply surfaces, not reinterprets), and already returns a
  // builder_path redirect target plus a manage_token for anonymous
  // continued editing.
  //
  // Ownership handoff on success deliberately mirrors DescribeWizard.tsx's
  // own established pattern (netify_mtok_{id} in localStorage, then a
  // /sase-prefixed window.location.assign) so this project is
  // indistinguishable, from the platform's perspective, from any other
  // anonymous draft created via the existing Describe flow.
  // `?welcome=generated` is deliberately NOT appended: RfpBuilder.tsx
  // treats that exact string as "just came from the Describe wizard's
  // generate step" and fires an rfp_generated analytics event that would
  // misreport this session's true origin. A dedicated welcome state for
  // this entry point is an explicit follow-up, not part of this increment.
  //
  // Manage-token continuity (follow-up, verified against the live click-
  // through Robert reviewed): the redirect target now carries
  // `?manage=<token>` via withManageToken(), not just the localStorage
  // write above. RfpBuilder.tsx's own client code already recovers the
  // token from localStorage for ITS OWN API calls, which is why the
  // builder page itself worked even without this -- but ProjectNav's tab
  // links (Overview, Assessment, Story, Timeline) and every other
  // server-rendered Project page derive their own `?manage=` purely from
  // that request's URL, with no localStorage fallback (see
  // manage-redirect.ts's header comment for the full trace). Seeding it
  // here, on this first redirect, is what those pages need -- nothing
  // downstream needed to change.
  async function handleContinue() {
    if (continueBusyRef.current || facts.length === 0) return;
    continueBusyRef.current = true;
    setContinueBusy(true);
    setContinueError(null);
    try {
      const res = await fetch("/sase/api/security-sourcing/project", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requirement: requirementFrom(facts), consent: true }),
      });
      const data = (await res.json().catch(() => null)) as
        | { project?: { id?: string; manage_token?: string }; builder_path?: string; error?: string }
        | null;
      if (!res.ok) {
        const message = data && typeof data.error === "string" ? data.error : "Could not create your project just now. Try again.";
        throw new Error(message);
      }
      const project = data?.project;
      const builderPath = data?.builder_path;
      if (!project?.id || !builderPath) {
        throw new Error("Could not create your project just now. Try again.");
      }
      if (project.manage_token) {
        try {
          localStorage.setItem(`netify_mtok_${project.id}`, project.manage_token);
        } catch {
          // Private browsing / storage disabled: the project still exists
          // server-side, the buyer just won't see it auto-recovered on a
          // later visit from this browser. Not fatal to this turn.
        }
      }
      // Success: deliberately no finally-reset here. continueBusyRef and
      // continueBusy both stay tripped for the rest of this component's
      // lifetime -- the button stays disabled and showing "Creating your
      // project..." until the browser actually navigates away, so a click
      // landing in the gap between assign() and unload cannot fire a
      // second create call from the same (now-stale) facts.
      window.location.assign(withManageToken(`/sase${builderPath}/`, project.manage_token));
      return;
    } catch (e) {
      setContinueError(e instanceof Error ? e.message : "Could not create your project just now. Try again.");
      continueBusyRef.current = false;
      setContinueBusy(false);
    }
  }

  const requirement = requirementFrom(facts);
  const buying = buyingOf(facts);
  const opModel = operatingModelOf(facts);
  // Positional call, verified from src/lib/workspace/questions.ts — see
  // this file's header comment for why notedIds stays [] here, matching
  // the MCP client's own resolution of the identical situation.
  // `dismissed` (correction pass 2, Priority 5) is no longer hardcoded —
  // it now carries whatever this session has actually resolved via typed
  // text (currently just q-resilience; see isDualCircuitNotRequiredAnswer
  // and the runCycle branch that populates dismissedQuestionIds).
  const questions = earnedQuestions(requirement, buying, opModel, [], dismissedQuestionIds);

  return (
    <div className="mx-auto max-w-3xl">
      {journeyExpanded ? (
        <JourneySelector current={journey} onSelect={setJourney} />
      ) : (
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="m-0 text-[13px] font-medium text-[#141414]">Netify &middot; Quick Understanding</p>
          <button
            type="button"
            onClick={() => setJourneyExpanded(true)}
            className="m-0 shrink-0 text-[12px] text-[#8C8A85] underline decoration-[#D8D5CE] underline-offset-2 transition-colors hover:text-[#141414]"
          >
            Other ways to work
          </button>
        </div>
      )}

      {journey !== "quick_sor" ? (
        <div className="rounded-[13px] border border-dashed border-[#EAE7E1] p-6 text-center">
          <p className="m-0 text-[13px] text-[#8C8A85]">
            This journey isn&rsquo;t built in this preview yet. Choose &ldquo;Quick Statement of Requirements&rdquo;
            above to try the working slice.
          </p>
        </div>
      ) : (
        <>
          <PersistentAssistantInput
            value={input}
            onChange={setInput}
            onSubmit={() => void runCycle()}
            busy={busy}
            started={started}
            error={error}
          />

          {/* Commit 11A: nothing below the input mounts until the buyer's
              first successful turn — this commit's own definition of
              first load ("no facts and no Session Activity"). Each
              component's existing render logic (including
              UnderstandingDocument's own internal empty-state placeholder)
              is unchanged; this only decides whether they mount at all. */}
          {started && (
            <>
              <div className="mt-6">
                <UnderstandingDocument facts={facts} />
              </div>

              <div className="mt-6">
                <EarnedQuestionsList questions={questions} />
              </div>

              {/* Newest-first (see SessionActivity.tsx's "Fix" doc-comment
                  note): keeps the most recent turn's clarification/change
                  card visible at the top of this section instead of
                  sinking to the bottom of a growing list. `entries` itself
                  (React state, chronological append order) is untouched —
                  this only reverses what is handed to the presentational
                  component. */}
              <SessionActivity entries={[...entries].reverse()} labelFor={labelFor} />

              {/* Bridge (Quick Understanding -> real Project): the only
                  exit from this otherwise-isolated preview into the real
                  platform. Deliberately its own card, after Session
                  Activity, so it reads as the natural next step rather
                  than competing with the Understanding/Questions content
                  above it. */}
              <div className="mt-6 rounded-[13px] border border-[#EAE7E1] bg-white p-5 sm:p-6">
                <h3 className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
                  Continue
                </h3>
                <p className="m-0 mb-4 text-[13px] leading-relaxed text-[#8C8A85]">
                  Ready to take this further? Continuing creates a real, saved project from what you&rsquo;ve told
                  Netify so far, and takes you to the full Statement of Requirements builder &mdash; nothing here is
                  lost.
                </p>
                <button
                  type="button"
                  disabled={continueBusy || facts.length === 0}
                  onClick={() => void handleContinue()}
                  className="rounded-full bg-[#141414] px-5 py-2 text-[14px] font-medium text-white transition-opacity disabled:opacity-40"
                >
                  {continueBusy ? "Creating your project…" : "Continue to full project"}
                </button>
                <p className="m-0 mt-3 text-[12px] leading-relaxed text-[#8C8A85]">
                  <span>{CREATE_CONSENT_TEXT}</span>
                </p>
                {continueError && <p className="m-0 mt-2 text-[12.5px] text-red-700">{continueError}</p>}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
