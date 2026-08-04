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
import type { FieldUpdate } from "@/lib/workspace/extract";
import { earnedQuestions } from "@/lib/workspace/questions";
import { labelFor } from "@/lib/workspace/labels";
import { computeSessionChanges, type SessionActivityEntry, type SessionChange } from "./session-diff";
import { createTombstoneSet, filterTombstonedUpdates, type TombstoneSet } from "./tombstone-preview";

type ExtractResponse = { updates: FieldUpdate[]; engine: string; notes: string[] };

/**
 * Deliberately narrow, deterministic clarification detection (no model
 * call, no keyword scan). Accepts only the five phrases the task names,
 * normalised by trim/lowercase/trailing-punctuation-strip only — no
 * stemming, no substring matching, no broad "contains explain" rule. Two
 * apostrophe spellings of "don't" are listed as literal accepted strings
 * (not a general normalisation step) purely because the acceptance
 * sequence's own Turn 3 example could plausibly be typed either way.
 *
 * The acceptance sequence's own Turn 3 message ("I don't know what you
 * mean, can you explain?") joins two of the five accepted phrases with a
 * comma. To honour that exact required case without adding broad matching,
 * a message is also accepted when EVERY comma-separated segment (after the
 * same narrow normalisation) is, on its own, one of the five accepted
 * phrases — still fully deterministic, and still false for any segment
 * that isn't an exact accepted phrase (so "We use Meraki, can you explain
 * the pricing?" is correctly rejected: its first segment is a substantive
 * fact, not one of the five phrases).
 */
const CLARIFICATION_PHRASES = new Set([
  "what do you mean",
  "can you explain",
  "i don't know what you mean",
  "i don’t know what you mean",
  "i do not know what you mean",
  "please explain",
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

/** Fixed, approved fallback only — no model call, no gap/question chosen. */
export const CLARIFICATION_FALLBACK_EXPLANATION =
  "There isn’t a current Netify question selected to explain. You can add or correct information about your project below.";

/**
 * The submitted-turn classification rule (entry types A/B/C from the
 * Commit 10 instructions), extracted as its own pure function for the
 * same testability reason as isNarrowClarificationMessage above. Takes
 * the REAL computeSessionChanges() output and the raw buyer text; invents
 * nothing, chooses no gap, calls no model.
 */
export function classifyTurnEntry(
  cycle: number,
  changes: SessionChange[],
  rawMessage: string,
): SessionActivityEntry {
  if (changes.length > 0) {
    // A. Changes entry.
    return { cycle, kind: "changes", changes };
  }
  if (isNarrowClarificationMessage(rawMessage)) {
    // C. Clarification entry: fixed fallback only.
    return {
      cycle,
      kind: "clarification",
      changes: [],
      clarification: { explanation: CLARIFICATION_FALLBACK_EXPLANATION },
    };
  }
  // B. No-change entry — not an error.
  return { cycle, kind: "no_change", changes: [] };
}

export default function QuickSorWorkspace() {
  const [journey, setJourney] = useState<JourneyId>("quick_sor");
  const [facts, setFacts] = useState<WorkspaceFact[]>([]);
  const [entries, setEntries] = useState<SessionActivityEntry[]>([]);
  const [cycle, setCycle] = useState(0);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (!res.ok) throw new Error(`Could not read that just now (${res.status}). Try again.`);

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
      // from a bare "what do you mean?").
      const entry = classifyTurnEntry(newCycle, changes, text);

      setFacts(afterFacts);
      setCycle(newCycle);
      setEntries((prev) => [...prev, entry]);
      setInput("");
    } catch (e) {
      // Facts, cycle and activity are all untouched here by construction —
      // none of the setters above are reached when this branch runs.
      setError(e instanceof Error ? e.message : "Something went wrong reading that. Try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const requirement = requirementFrom(facts);
  const buying = buyingOf(facts);
  const opModel = operatingModelOf(facts);
  // Positional call, verified from src/lib/workspace/questions.ts — see
  // this file's header comment for why notedIds/dismissed are [] here,
  // matching the MCP client's own resolution of the identical situation.
  const questions = earnedQuestions(requirement, buying, opModel, [], []);

  return (
    <div className="mx-auto max-w-3xl">
      <JourneySelector current={journey} onSelect={setJourney} />

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

          <div className="mt-6">
            <UnderstandingDocument facts={facts} />
          </div>

          <div className="mt-6">
            <EarnedQuestionsList questions={questions} />
          </div>

          <SessionActivity entries={entries} labelFor={labelFor} />
        </>
      )}
    </div>
  );
}
