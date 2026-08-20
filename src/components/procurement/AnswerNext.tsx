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

import { useEffect, useRef, useState } from "react";
import type { NextQuestionCard } from "@/components/procurement/LivingProcurementCanvas";
import { MATERIAL_IMPACTS } from "@/lib/workspace/procurement-next-questions";

const mono: React.CSSProperties = { fontFamily: "var(--nf-font-mono)" };

export default function AnswerNext({
  cards,
  totalOutstanding,
  demoted,
  onSeeAll,
  onJumpToSection,
}: {
  /** The top-ranked open decisions, already resolved into real answer
   *  handlers by ProjectDesk (never resolved here — this stays a
   *  presentational layer, the same rule LivingProcurementCanvas follows). */
  cards: NextQuestionCard[];
  /** How many MATERIAL decisions are outstanding in total — the same
   *  figure the rail badge and the Decisions station heading read, so the
   *  "see all" line can never quote a different number from the rail. */
  totalOutstanding: number;
  /** True once the REAL publish gate is satisfied (publish-checklist.ts).
   *  Robert, 20 Aug 2026: "this cannot be an everlasting AI conversation
   *  ... it has to end with a built RFP." `rankNextQuestions()` is
   *  generative — it can always produce another refinement — so when the
   *  document is genuinely publishable this block must stop presenting
   *  itself as the next thing to do and say what it actually is:
   *  optional. It is demoted, never hidden; suppressing real open
   *  decisions to manufacture a finished feeling would be the same
   *  dishonesty in the opposite direction. */
  demoted?: boolean;
  onSeeAll: () => void;
  /** 2030 UI rebuild (20 Aug 2026): elevates the "Fills section N of M"
   *  footnote from inert text into a jump link — clicking it takes the
   *  buyer straight to that section in the new primary navigation
   *  (SectionNav/SectionDetail), the "visible linkage between a question
   *  and the section it completes" the rebuild calls for. Optional and
   *  additive: when omitted the footnote renders exactly as before. */
  onJumpToSection?: (title: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  /** Robert, 19 Aug 2026: "when selecting the options for sites, I cannot
   *  be sure if the system has recorded it. It's not clear what I have
   *  answered or not."
   *
   *  He is right, and the reason is structural rather than cosmetic: the
   *  instant an option is clicked the document recompiles, the question
   *  drops out of the ranked list, and the card simply VANISHES. From the
   *  buyer's side a click made the thing they clicked disappear, which
   *  reads as "did that work?" far more than it reads as "done". The
   *  answer does land in the transcript, but as a Netify line in a
   *  scrolled panel, so it confirms nothing at the point of the click.
   *
   *  This holds the chosen answer on screen for a moment after the card
   *  has gone — deliberately survives the card's removal, which is why it
   *  is kept here rather than as state on the card itself. */
  const [confirmed, setConfirmed] = useState<{ label: string; question: string } | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); }, []);

  const confirm = (question: string, label: string) => {
    setConfirmed({ question, label });
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirmed(null), 3200);
  };

  if (cards.length === 0 && !confirmed) return null;

  return (
    <div data-answer-next className="w-full border-t px-0 pt-3.5 lg:px-6" style={{ borderColor: "var(--nf-rule, #d6d4d0)" }}>
      <div className="text-[10px] uppercase" style={{ ...mono, letterSpacing: "0.09em", color: "var(--nf-ink-600, #66635e)" }}>
        {demoted ? "Optional \u2014 sharpen the quotes you get back" : "Answer next"}
      </div>

      {confirmed && (
        <div
          className="mt-2.5 flex items-start gap-2 rounded-[3px] border px-2.5 py-2"
          role="status"
          aria-live="polite"
          style={{ borderColor: "var(--nf-emerald-soft-border, #91bb91)", background: "var(--nf-emerald-soft, #d9f4d9)" }}
        >
          <span aria-hidden="true" className="mt-[1px] flex-none text-[12px] font-bold" style={{ color: "var(--nf-emerald, #1e4e22)" }}>
            &#10003;
          </span>
          <span className="min-w-0 flex-1 text-[12px] leading-[1.45]" style={{ color: "var(--nf-emerald, #1e4e22)" }}>
            <strong>Recorded: {confirmed.label}</strong>
            <span className="mt-0.5 block" style={{ color: "var(--nf-ink-600, #66635e)" }}>{confirmed.question}</span>
          </span>
        </div>
      )}
      <div className="mt-2.5 flex flex-col gap-1.5">
        {cards.map(({ nq, buttons, hint, fills }) => {
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
                  {/* WHERE THIS LANDS. Robert, 20 Aug 2026: "it is 100%
                      not clear how the user is progressing... Feels like
                      a list of random questions with no end in sight."
                      Every card already knew which outline section it
                      fills; it just never said so, so each question
                      arrived unplaceable. `fills` is the SAME section run
                      the header fraction and the rail count, so a card
                      can never claim a position the fraction does not
                      have -- and null (no line at all) rather than a
                      guess when the question maps to no required row. */}
                  {fills && (
                    onJumpToSection ? (
                      <button
                        type="button"
                        onClick={() => onJumpToSection(fills.title)}
                        className="m-0 mb-2 block cursor-pointer border-0 bg-transparent p-0 text-left text-[11px] leading-[1.4] underline decoration-dotted underline-offset-2"
                        style={{ ...mono, color: "var(--nf-orange-strong, #832f00)" }}
                      >
                        {`Fills section ${fills.position} of ${fills.total} \u00b7 ${fills.title}`}
                      </button>
                    ) : (
                      <p className="m-0 mb-2 text-[11px] leading-[1.4]" style={{ ...mono, color: "var(--nf-orange-strong, #832f00)" }}>
                        {`Fills section ${fills.position} of ${fills.total} \u00b7 ${fills.title}`}
                      </p>
                    )
                  )}
                  {/* The reason gains the mockup's own framing ("Why
                      this matters"). Same `nq.reason` string, unchanged --
                      the label is what was missing, not the sentence. */}
                  {nq.reason && (
                    <p className="m-0 mb-2 text-[11.5px] leading-[1.45]" style={{ color: "var(--nf-ink-600, #66635e)" }}>
                      <span style={{ ...mono, fontWeight: 700, color: "var(--nf-ink-800, #302d2a)" }}>Why this matters &middot; </span>
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
                            confirm(nq.question, b.label);
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
