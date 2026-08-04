"use client";

/**
 * ClarificationEntry (Milestone 1, Commit 9B): renders one already-built
 * `BoundedClarification` — a clarification-only turn where the buyer's
 * reply changed nothing in the fact ledger, but Netify still recorded why.
 *
 * This component does not decide WHAT the explanation says or WHICH gap
 * or question it answers, does not generate any text, and does not pick
 * a clarification target — it only displays the `question`/`explanation`
 * pair its caller already produced, exactly as supplied (Ruling 2, and
 * the Commit 9B-prep stop report this component was blocked behind: that
 * generation/selection work stays explicitly out of scope here).
 *
 * `clarification.explanation` is rendered byte-for-byte, with no
 * trimming, reformatting or truncation. `clarification.question` is
 * optional on BoundedClarification and is only rendered when supplied —
 * never invented when absent.
 *
 * Stateless, hookless, callback-free: no input, button, generation,
 * ranking or "next question" wording of any kind.
 */

import type { BoundedClarification } from "@/components/preview/session-diff";

export type ClarificationEntryProps = {
  clarification: BoundedClarification;
};

export default function ClarificationEntry({ clarification }: ClarificationEntryProps) {
  return (
    <div className="text-[14.5px] leading-relaxed text-[#18181b]">
      {clarification.question && (
        <p className="m-0 mb-1 font-medium text-[#33302C]">{clarification.question}</p>
      )}
      <p className="m-0 mb-1.5">{clarification.explanation}</p>
      <p className="m-0 text-[13px] text-[#6E6C67]">No changes to your Understanding.</p>
    </div>
  );
}
