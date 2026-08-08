"use client";

/**
 * SessionActivity (Milestone 1, Commit 9B): the presentational surface for
 * the temporary, session-scoped record of what happened during the
 * current browser sitting — the buyer-facing renderer the Commit 9/9A/
 * 9B-prep sequence built the data contract and value formatter for.
 *
 * This component computes nothing. It is handed an already-built
 * `SessionActivityEntry[]` (produced elsewhere, from computeSessionChanges()
 * output for "changes" entries and from already-generated clarification
 * data for "clarification" entries — both out of scope here) and a
 * `labelFor` field-label function, and it only walks and renders that
 * structure. It does not call computeSessionChanges(), mergeUpdates(), any
 * extraction function, or any API; it does not manage a WorkspaceFact[]
 * ledger; it does not detect clarification intent, pick a clarification
 * target, or generate explanation text; it stores or persists nothing;
 * and it does not touch routes or ProjectDesk.tsx.
 *
 * Terminology (load-bearing, not decorative): this is temporary,
 * session-scoped activity — never the real append-only record Article 9
 * defines, which only begins at actual Project creation. Nothing in this
 * file's rendered output uses "history", "project history", "audit
 * history", "audit trail", "append-only" or "permanent record".
 *
 * Value presentation: every buyer-facing value goes through
 * humaniseWorkspaceValue(path, value) — the same authoritative formatter
 * factLabel() itself now delegates to (Commit 9B prerequisite) — so an
 * enum-coded SessionChange value (e.g. procurement.buying = "sdwan")
 * renders the same humanised phrase the rest of the Understanding shows,
 * without this component fabricating a WorkspaceFact or maintaining a
 * second label table of its own. Field names never render as a raw
 * AllowedPath string; every label comes from the supplied `labelFor`.
 *
 * Ordering: entries render in exactly the order supplied, and each
 * entry's `changes` render in exactly the order supplied — nothing here
 * sorts, groups, deduplicates or ranks. Cycle numbers are read only for
 * React `key`s; no cycle number is displayed as progress, a completion
 * count, or a ranking signal.
 *
 * Fix (visibility of glossary/fallback explanations): the caller
 * (QuickSorWorkspace.tsx) now supplies `entries` newest-first, not
 * chronological. This component still just renders whatever order it is
 * given — no sort was added here — but flagging it explicitly because a
 * card-placement bug was traced to the previous chronological order: a
 * "Netify explained" clarification card for the buyer's most recent
 * message rendered at the very bottom of a growing list, below the
 * Understanding and Questions cards too, making it easy to miss without
 * scrolling all the way down. Newest-first keeps the buyer's latest
 * answer immediately visible at the top of this section.
 *
 * The three same-value/different-value/added/inferred renderings below
 * mirror the exact behaviours specified for Commit 9B — see each branch's
 * comment for the specific rule it implements, including the "corrected,
 * same value, provenance stated" case, which is deliberately rendered as
 * neutral prose ("<value> recorded as stated.") rather than as
 * `<value> → <value>`, and is never labelled "confirmed" — Revision 3's
 * three-action taxonomy (added/corrected/inferred) is not extended here.
 *
 * Stateless, hookless, callback-free, presentational only.
 */

import type { AllowedPath } from "@/lib/workspace/extract";
import { humaniseWorkspaceValue } from "@/lib/workspace/draft";
import type { SessionActivityEntry, SessionChange } from "@/components/preview/session-diff";
import ClarificationEntry from "@/components/preview/ClarificationEntry";

const NO_CHANGE_LINE = "No changes to your Understanding.";

/**
 * One SessionChange -> one rendered line. Dispatches purely on
 * `change.action` (computeSessionChanges() only ever emits "added" with
 * stated provenance and "inferred" with inferred provenance — verified in
 * session-diff.ts — so branching on action alone already implies the
 * matching provenance without re-checking it, except for the "corrected"
 * same-value/stated case below, which genuinely needs the provenance
 * check because a "corrected" entry can carry either provenance).
 */
function renderChangeLine(change: SessionChange, labelFor: (path: AllowedPath) => string, key: string) {
  const label = labelFor(change.path);

  if (change.action === "added") {
    // Added, stated: human label, humanised new value, the exact quote
    // when present. No quote is ever invented when absent.
    const value = humaniseWorkspaceValue(change.path, change.nextValue);
    return (
      <li key={key} className="text-[14.5px] leading-relaxed text-[#18181b]">
        <span className="font-medium text-[#33302C]">{label}:</span> {value}
        {change.quote && (
          <span className="block text-[13px] italic text-[#6E6C67]">&ldquo;{change.quote}&rdquo;</span>
        )}
      </li>
    );
  }

  if (change.action === "inferred") {
    // Added, inferred: human label, humanised new value, a clear
    // "Inferred" marker, and the exact reason when present. No reason is
    // ever invented when absent.
    const value = humaniseWorkspaceValue(change.path, change.nextValue);
    return (
      <li key={key} className="text-[14.5px] leading-relaxed text-[#18181b]">
        <span className="font-medium text-[#33302C]">{label}:</span> {value}
        <span className="ml-1.5 rounded-full border border-[#8C8A85] px-1.5 py-0.5 text-[10px] font-medium text-[#6E6C67]">
          Inferred
        </span>
        {change.reason && <span className="block text-[13px] text-[#6E6C67]">{change.reason}</span>}
      </li>
    );
  }

  // action === "corrected"
  const sameValue = change.previousValue === change.nextValue;
  if (sameValue && change.provenance === "stated") {
    // Corrected, same value, provenance stated: the temporary
    // inferred-to-stated upgrade (and the resurrection edge case
    // session-diff.ts's own doc comment flags — both land here, by
    // design, since Revision 3 gives neither a separate action). Render
    // neutral prose, never "<value> -> <value>", and never "confirmed" —
    // no new action type is introduced; this is still action==="corrected"
    // on the underlying data, just rendered with different wording.
    const value = humaniseWorkspaceValue(change.path, change.nextValue);
    return (
      <li key={key} className="text-[14.5px] leading-relaxed text-[#18181b]">
        {value} recorded as stated.
      </li>
    );
  }

  // Corrected, different value: humanise both sides, render previous -> next.
  const previous = humaniseWorkspaceValue(change.path, change.previousValue);
  const next = humaniseWorkspaceValue(change.path, change.nextValue);
  return (
    <li key={key} className="text-[14.5px] leading-relaxed text-[#18181b]">
      <span className="font-medium text-[#33302C]">{label}</span> corrected: {previous} → {next}
    </li>
  );
}

/* Correction pass 2, Priority 3 (Tests 72/73): rendered under whichever
 * `kind` the turn already has, never a kind of its own — see this note's
 * field-level comment on SessionActivityEntry (session-diff.ts) for why.
 * Neutral, muted styling matching the existing quote/reason sublines
 * elsewhere in this file; no number is ever shown here, since none was
 * recorded. */
function renderDroppedQuantityNote(note: string, key: string) {
  return (
    <p key={key} className="m-0 mt-1.5 text-[13px] text-[#6E6C67]">
      {note}
    </p>
  );
}

function renderEntry(entry: SessionActivityEntry, labelFor: (path: AllowedPath) => string, key: string) {
  const droppedNote = entry.droppedQuantityNote
    ? renderDroppedQuantityNote(entry.droppedQuantityNote, `${key}-dropped-qty`)
    : null;

  if (entry.kind === "changes") {
    return (
      <div key={key}>
        <ul className="m-0 list-none space-y-1.5 p-0">
          {entry.changes.map((change, ci) => renderChangeLine(change, labelFor, `${key}-${ci}`))}
        </ul>
        {droppedNote}
      </div>
    );
  }

  if (entry.kind === "clarification") {
    // By convention (not compiler-enforced — see the Commit 9A report)
    // a "clarification" entry carries `clarification`. If an upstream
    // caller ever violates that convention, this still renders truthfully
    // rather than reading a property off `undefined`: the one fact that
    // is always true regardless — no ledger change happened this turn —
    // is shown, and nothing is invented in its place.
    return (
      <div key={key}>
        {entry.clarification ? (
          <ClarificationEntry clarification={entry.clarification} />
        ) : (
          <p className="m-0 text-[13.5px] text-[#6E6C67]">{NO_CHANGE_LINE}</p>
        )}
        {droppedNote}
      </div>
    );
  }

  // kind === "no_change": not an error, no explanation invented.
  return (
    <div key={key}>
      <p className="m-0 text-[13.5px] text-[#6E6C67]">{NO_CHANGE_LINE}</p>
      {droppedNote}
    </div>
  );
}

export type SessionActivityProps = {
  entries: SessionActivityEntry[];
  labelFor: (path: AllowedPath) => string;
};

export default function SessionActivity({ entries, labelFor }: SessionActivityProps) {
  if (entries.length === 0) return null;

  return (
    <section className="mb-6 rounded-[13px] border border-[#EAE7E1] bg-white p-5 sm:p-6">
      <h3 className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
        Session activity
      </h3>
      <p className="m-0 mb-1 text-[13px] text-[#8C8A85]">Changes captured during this session, most recent first.</p>
      <p className="m-0 mb-4 text-[12px] text-[#8C8A85]">
        Temporary — this activity is cleared when you leave or refresh until the Project is saved.
      </p>

      <ul className="m-0 list-none space-y-3 p-0">
        {entries.map((entry, ei) => (
          <li key={`entry-${ei}-${entry.cycle}`} className="border-t border-[#EAE7E1] pt-3 first:border-t-0 first:pt-0">
            {renderEntry(entry, labelFor, `entry-${ei}`)}
          </li>
        ))}
      </ul>
    </section>
  );
}
