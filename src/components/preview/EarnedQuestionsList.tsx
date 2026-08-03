"use client";

/**
 * EarnedQuestionsList (Milestone 1, Commit 8): renders an already-computed
 * `EarnedQuestion[]` exactly as supplied — the presentational half of the
 * approved ruling that `earnedQuestions()` (src/lib/workspace/questions.ts)
 * is the authoritative pre-verdict source for "what Netify would still ask
 * a buyer" when no security verdict exists yet.
 *
 * This component does NOT call `earnedQuestions()` itself, does not derive
 * `requirement`/`buying`/`opModel` from a fact ledger, and does not accept
 * a `WorkspaceFact[]` or a security verdict — it only renders the list its
 * caller already computed, exactly like `UnderstandingGroup` renders an
 * already-grouped `BriefBlock[]` rather than computing the grouping
 * itself. A future, separate commit is responsible for wiring a real
 * `EarnedQuestion[]` into this component; that wiring is out of scope here
 * (see the Commit 8 report for why).
 *
 * Terminology, per the approved ruling — load-bearing, not decorative:
 * these are QUESTIONS, never gaps, blockers, missing information,
 * requirements, priorities, recommendations or next steps. Nothing in
 * this file uses any of those words. `EarnedQuestion.weight` exists so a
 * cap can choose which questions to show when there are more than fit
 * ("Priority when more questions are earned than the cap shows" —
 * questions.ts's own doc comment) — it is not rendered, and no question
 * is singled out as "next" or "top": this component displays every
 * question it is given, once each, in the exact order supplied. That
 * order is `earnedQuestions()`'s own existing order (already used
 * identically by ProjectDesk.tsx and the workspace_cycle MCP tool,
 * Article 17) — reusing it is not the same as this component choosing or
 * inventing a ranking, and no shadow Next Step Policy is created here:
 * nothing is filtered, sorted, deduplicated, or reduced to a single item.
 *
 * `options`, `evidence`, `section`, and `weight` are deliberately not
 * rendered. `options` describes what answering a chip would DO (land
 * taxonomy items, record a note, open one of two path fields, or
 * dismiss) — rendering it would imply an answer control exists, which
 * this commit does not build (no callbacks, no mutation, no ledger
 * writes, consistent with every other Understanding primitive so far).
 * `evidence` is market-demand justification (citation counts), not a
 * buyer-facing rationale. `section`/`weight` are internal placement/cap
 * metadata with no buyer-safe rendering defined yet.
 *
 * Stateless, hookless, callback-free, presentational only — no API
 * calls, no ledger writes, no mutation of the input array or its
 * objects.
 */

import type { EarnedQuestion } from "@/lib/workspace/questions";

export type EarnedQuestionsListProps = {
  questions: EarnedQuestion[];
};

export default function EarnedQuestionsList({ questions }: EarnedQuestionsListProps) {
  if (questions.length === 0) return null;

  return (
    <section className="mb-6 rounded-[13px] border border-[#EAE7E1] bg-white p-5 sm:p-6">
      <h3 className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
        Questions
      </h3>
      <p className="m-0 mb-4 text-[13px] text-[#8C8A85]">Questions that would sharpen this further.</p>

      <ul className="m-0 list-none space-y-2 p-0">
        {questions.map((q, i) => (
          <li key={`${q.id}-${i}`} className="text-[14.5px] leading-relaxed text-[#18181b]">
            {q.question}
          </li>
        ))}
      </ul>
    </section>
  );
}
