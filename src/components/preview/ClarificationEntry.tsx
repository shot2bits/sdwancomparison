"use client";

/**
 * ClarificationEntry (Milestone 1, Commit 9B; presentation extended in
 * Commit 11C): renders one already-built `BoundedClarification` — a
 * clarification-only turn where the buyer's reply changed nothing in the
 * fact ledger, but Netify still recorded why.
 *
 * This component does not decide WHAT the explanation says or WHICH gap,
 * question or glossary term it answers, does not generate any text, and
 * does not pick a clarification target or an EarnedQuestion — it only
 * displays the `question`/`term`/`explanation` data its caller already
 * produced, exactly as supplied (Ruling 2, and the Commit 9B-prep stop
 * report this component was blocked behind: that generation/selection
 * work stays explicitly out of scope here). Commit 11C's bounded glossary
 * explanations (src/lib/workspace/explanations.ts) are one more example of
 * already-produced data flowing through this same unchanged contract —
 * this file does not import or call explanationForInput() itself.
 *
 * `clarification.explanation` is rendered byte-for-byte, with no
 * trimming, reformatting or truncation. `clarification.question` and
 * `clarification.term` are optional on BoundedClarification and are only
 * rendered when supplied — never invented when absent. `clarification.kind`
 * only selects whether the canonical `term` line renders ("glossary")
 * or not; every clarification entry — glossary or fallback, and any
 * pre-Commit-11C caller that never sets `kind` at all — renders under the
 * same "Netify explained" heading and the same calm, informational card
 * treatment: no success/warning colour, no chat bubble, no avatar, no
 * typing indicator, no transcript styling, no controls, no links, no
 * feedback affordance.
 *
 * Stateless, hookless, callback-free: no input, button, generation,
 * ranking or "next question" wording of any kind.
 */

import type { BoundedClarification } from "@/components/preview/session-diff";

export type ClarificationEntryProps = {
  clarification: BoundedClarification;
};

export default function ClarificationEntry({ clarification }: ClarificationEntryProps) {
  const isGlossary = clarification.kind === "glossary";

  return (
    <div className="text-[14.5px] leading-relaxed text-[#18181b]">
      <p className="m-0 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
        Netify explained
      </p>
      {isGlossary && clarification.term && (
        <p className="m-0 mb-1 text-[12px] font-medium text-[#6E6C67]">{clarification.term}</p>
      )}
      {clarification.question && (
        <p className="m-0 mb-1 font-medium text-[#33302C]">{clarification.question}</p>
      )}
      <p className="m-0 mb-1.5">{clarification.explanation}</p>
      <p className="m-0 text-[13px] text-[#6E6C67]">No changes to your Understanding.</p>
    </div>
  );
}
