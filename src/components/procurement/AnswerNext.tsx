"use client";

/**
 * "Answer next" — the chat pane's follow-up block (Robert, 19 Aug 2026,
 * after reviewing the Perplexity interface: "we might be able to add some
 * kind of additional information in the style of perplexity").
 *
 * WHAT IT BORROWS. Perplexity closes an answer with a short list of
 * related questions, so the next move is always one tap away rather than a
 * blank cursor. This is that pattern, with one difference that matters:
 * the questions are not generated to look helpful, they ARE the product's
 * own ranked open decisions — the same `rankNextQuestions()` projection
 * that drives the Decisions station and the rail's outstanding-count
 * badge. A question can never appear here that the document does not
 * genuinely still need.
 *
 * WHY IT ANSWERS IN PLACE. The welcome message has always promised
 * "...or answer any open line in it directly", and until now the only way
 * to do that was to find the matching card elsewhere. Tapping a question
 * expands its REAL answer options — the same `buttons[].onClick` handlers
 * (`landOption` / `answerNextQuestion`) the Decisions station uses — so
 * answering here and answering there are literally the same call. Nothing
 * about how a decision is recorded, ranked or resolved lives in this file.
 *
 * TWO RULES THIS FILE MUST NOT BREAK, both from
 * procurement-next-questions.ts's own header:
 *  · "Sector suggestions must be labelled as Netify suggestions... and
 *    must never silently become a buyer fact." A `governedSuggestion`
 *    card is labelled distinctly here and carries its own reason.
 *  · "Do not insert Netify-authored question text into the buyer's source
 *    ledger. Only the buyer's answer may become buyer wording." Nothing
 *    here writes anything; tapping an option calls the existing handler,
 *    which lands the BUYER'S chosen option, never this question's prose.
 */

import { useState } from "react";
import type { NextQuestionCard } from "@/components/procurement/LivingProcurementCanvas";
import { MATERIAL_IMPACTS } from "@/lib/workspace/procurement-next-questions";

const mono: React.CSSProperties = { fontFamily: "var(--nf-font-mono)" };

export default function AnswerNext({
  cards,
  totalOutstanding,
  onSeeAll,
}: {
  /** The top-ranked open decisions, already resolved into real answer
   *  handlers by ProjectDesk (never resolved here — this stays a
   *  presentational layer, the same rule LivingProcurementCanvas follows). */
  cards: NextQuestionCard[];
  /** How many MATERIAL decisions are outstanding in total — the same
   *  figure the rail badge and the Decisions station heading read, so the
   *  "see all" line can never quote a different number from the rail. */
  totalOutstanding: number;
  onSeeAll: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (cards.length === 0) return null;

  return (
    <div className="w-full border-t px-0 pt-3.5 lg:px-6" style={{ borderColor: "var(--nf-rule, #d6d4d0)" }}>
      <div className="text-[10px] uppercase" style={{ ...mono, letterSpacing: "0.09em", color: "var(--nf-ink-600, #66635e)" }}>
        Answer next
      </div>
      <div className="mt-2.5 flex flex-col gap-1.5">
        {cards.map(({ nq, buttons, hint }) => {
          const isOpen = openId === nq.id;
          const isMaterial =
            !nq.governedSuggestion && nq.impact.some((i) => (MATERIAL_IMPACTS as readonly string[]).includes(i));
          return (
            <div
              key={nq.id}
              className="rounded-[3px] border"
              style={{
                borderColor: isOpen
                  ? "var(--nf-orange-soft-border, #db9f76)"
                  : nq.governedSuggestion
                    ? "var(--nf-lilac-soft-border, #b6a2dc)"
                    : "var(--nf-ink-200, #d3d0cd)",
                background: isOpen
                  ? "var(--nf-orange-soft, #ffe3cc)"
                  : nq.governedSuggestion
                    ? "var(--nf-lilac-soft, #eee6ff)"
                    : "#fff",
              }}
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : nq.id)}
                aria-expanded={isOpen}
                className="flex w-full cursor-pointer items-start gap-2 border-0 bg-transparent px-2.5 py-2 text-left"
              >
                <span
                  aria-hidden="true"
                  className="mt-[1px] flex-none text-[13px] font-bold leading-[1.35]"
                  style={{ color: isMaterial ? "var(--nf-orange-strong, #832f00)" : "var(--nf-ink-400, #83807b)" }}
                >
                  {isOpen ? "–" : "+"}
                </span>
                <span
                  className="min-w-0 flex-1 text-[12.5px] leading-[1.4]"
                  style={{ color: "var(--nf-ink-800, #302d2a)", fontWeight: isMaterial ? 600 : 500 }}
                >
                  {nq.question}
                  {/* The governed-suggestion label is not decoration: an
                      accept click here must never read as a buyer-stated
                      fact. Same wording the Decisions station uses. */}
                  {nq.governedSuggestion && (
                    <span
                      className="ml-1.5 whitespace-nowrap text-[9px] uppercase"
                      style={{ ...mono, letterSpacing: "0.06em", color: "var(--nf-lilac, #573c7f)", fontWeight: 700 }}
                    >
                      Netify suggests
                    </span>
                  )}
                </span>
              </button>

              {isOpen && (
                <div className="px-2.5 pb-2.5 pl-[26px]">
                  {nq.reason && (
                    <p className="m-0 mb-2 text-[11.5px] leading-[1.45]" style={{ color: "var(--nf-ink-600, #66635e)" }}>
                      {nq.reason}
                    </p>
                  )}
                  {buttons.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {buttons.map((b) => (
                        <button
                          key={b.label}
                          type="button"
                          onClick={() => {
                            b.onClick();
                            setOpenId(null);
                          }}
                          className="cursor-pointer rounded-[3px] border px-2.5 py-1.5 text-[12px] font-semibold transition-colors hover:border-[var(--nf-ink-950,#110f0d)]"
                          style={{ borderColor: "var(--nf-ink-200, #d3d0cd)", background: "#fff", color: "var(--nf-ink-950, #110f0d)" }}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    /* A compiler open decision with no 1:1 answer slot needs
                       explanation, not a button — the existing hint says
                       where to resolve it. Never a fabricated control. */
                    <p className="m-0 text-[11.5px] leading-[1.45]" style={{ color: "var(--nf-ink-600, #66635e)" }}>
                      {hint ?? "Answer this in your own words above."}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Only when there are genuinely more than shown. `totalOutstanding`
          is the rail's own figure, so this line can never advertise a
          different number from the badge two inches above it. */}
      {totalOutstanding > cards.length && (
        <button
          type="button"
          onClick={onSeeAll}
          className="mt-2 cursor-pointer border-0 bg-transparent p-0 text-[12px] font-semibold"
          style={{ color: "var(--nf-orange-strong, #832f00)" }}
        >
          {/* One expression, not `See all {n} decisions`: JSX strips the
              leading space from a text node that sits between an
              expression and a newline, which rendered this as
              "See all 8decisions" -- caught on a live 390px screenshot,
              not in review. A template literal cannot be whitespace-
              mangled by the compiler. */}
          {`See all ${totalOutstanding} decisions `}&rarr;
        </button>
      )}
    </div>
  );
}
