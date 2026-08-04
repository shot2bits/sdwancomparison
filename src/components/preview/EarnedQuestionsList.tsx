"use client";

/**
 * EarnedQuestionsList (Milestone 1, Commit 8; zero-state rendering added in
 * Commit 11B): renders an already-computed `EarnedQuestion[]` exactly as
 * supplied — the presentational half of the approved ruling that
 * `earnedQuestions()` (src/lib/workspace/questions.ts) is the authoritative
 * pre-verdict source for "what Netify would still ask a buyer" when no
 * security verdict exists yet.
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
 * Commit 11B — zero-question rendering. Previously `questions.length === 0`
 * returned `null`, producing a silent gap in the layout that Harry's test
 * read as confusing ("No questions provided?"). Returning null was never a
 * readiness, completeness or "all done" signal — `earnedQuestions()`
 * returning nothing only means the current earned-question rules do not
 * suggest another question from the current facts, which proves nothing
 * about whether the Understanding is complete, market-ready or
 * publication-ready (a separate, not-yet-built authoritative readiness
 * policy owns that question — see the diagnosis-correction report). This
 * commit does not build that policy; it only replaces silence with an
 * honest, neutral statement of the current question state, using the same
 * neutral card treatment as the non-empty state — no success colour, no
 * checkmark, no completion badge, no percentage, no meter. The supporting
 * line for the non-empty state was also reworded from "Questions that
 * would sharpen this further" to a count-based sentence that avoids
 * "outstanding"/"remaining" (both of which would imply the buyer is
 * required to answer, which is not true — see EARNED-QUESTION LAW).
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
  const count = questions.length;

  return (
    <section className="mb-6 rounded-[13px] border border-[#EAE7E1] bg-white p-5 sm:p-6">
      <h3 className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
        Questions
      </h3>
      {count === 0 ? (
        <p className="m-0 text-[13px] leading-relaxed text-[#8C8A85]">
          No questions are currently suggested from the information captured so far. You can continue adding or
          correcting detail at any time.
        </p>
      ) : (
        <>
          <p className="m-0 mb-4 text-[13px] text-[#8C8A85]">
            {`${count} ${count === 1 ? "question" : "questions"} could still sharpen this Understanding.`}
          </p>

          <ul className="m-0 list-none space-y-2 p-0">
            {questions.map((q, i) => (
              <li key={`${q.id}-${i}`} className="text-[14.5px] leading-relaxed text-[#18181b]">
                {q.question}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
