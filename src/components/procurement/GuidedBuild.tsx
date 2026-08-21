"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { NextQuestionCard } from "@/components/procurement/LivingProcurementCanvas";

type ClausePreview = { id: string; statement: string };

export default function GuidedBuild({
  card,
  position,
  total,
  understood,
  addedTo,
  stillNeeded,
  documentTitle,
  documentSummary,
  clauses,
  composer,
  issueTarget,
  questionBankCount,
  onFocusPrompt,
  onOpenDocument,
}: {
  card: NextQuestionCard | null;
  position: number;
  total: number;
  understood: string;
  addedTo: string;
  stillNeeded: string;
  documentTitle: string;
  documentSummary: string;
  clauses: ClausePreview[];
  composer: ReactNode;
  issueTarget: "concise" | "formal";
  questionBankCount: number;
  onFocusPrompt: () => void;
  onOpenDocument: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const questionReason = card
    ? card.nq.reason ?? `This completes ${card.fills?.title ?? "the next part of the requirement"} and gives suppliers a clear basis for their response.`
    : "The core requirement is ready. Review the living document before you shortlist suppliers.";

  useEffect(() => setSelected(null), [card?.nq.id]);

  const continueWithAnswer = () => {
    if (selected === null || !card?.buttons[selected]) {
      onFocusPrompt();
      return;
    }
    card.buttons[selected].onClick();
  };

  return (
    <>
      <main className="nf-guided-main">
        <section className="nf-guided-question" aria-label="Next requirement question">
          <p className="nf-guided-kicker">Next step · {Math.max(1, position)} of {Math.max(1, total)}</p>
          <h1>{card?.nq.question ?? "Review the requirement you have built"}</h1>
          <p className="nf-guided-reason">
            {questionReason}
          </p>

          {card && card.buttons.length > 0 ? (
            <div className="nf-guided-choices" role="radiogroup" aria-label={card.nq.question}>
              {card.buttons.map((button, index) => (
                <button
                  key={`${card.nq.id}-${button.label}`}
                  type="button"
                  role="radio"
                  aria-checked={selected === index}
                  data-selected={selected === index}
                  onClick={() => setSelected(index)}
                >
                  <span>{button.label}</span><span aria-hidden="true">›</span>
                </button>
              ))}
              <button type="button" onClick={onFocusPrompt}>
                <span>Describe it in your own words</span><span aria-hidden="true">›</span>
              </button>
            </div>
          ) : (
            <button type="button" className="nf-guided-review" onClick={onOpenDocument}>Review your RFP</button>
          )}

          {card && card.buttons.length > 0 && (
            <button type="button" className="nf-guided-continue" onClick={continueWithAnswer}>
              Continue
            </button>
          )}

          <div className="nf-guided-understood" aria-label="What Netify understood">
            <p>What Netify understands</p>
            <dl>
              <div><dt>✓ <span>Understood</span></dt><dd>{understood}</dd></div>
              <div><dt>＋ <span>Added to</span></dt><dd>{addedTo}</dd></div>
              <div><dt>··· <span>Still needed</span></dt><dd>{stillNeeded}</dd></div>
            </dl>
          </div>

          <div className="nf-guided-prompt">
            <p>You can answer naturally at any time</p>
            {composer}
            {card && <details><summary>Why Netify is asking this</summary><p>{questionReason}</p></details>}
          </div>
        </section>
      </main>

      <aside className="nf-guided-document" aria-label="Your living RFP preview">
        <div className="nf-guided-document-head">
          <div><strong>Your living RFP</strong><span>Updated just now</span></div>
          <span>{issueTarget === "formal" ? "Full RFP" : "Quick"}</span>
        </div>
        <h2>{documentTitle}</h2>
        <p>{documentSummary}</p>
        <div className="nf-guided-clause-preview">
          {clauses.length > 0 ? clauses.slice(0, 4).map((clause, index) => (
            <p key={clause.id} data-new={index === 0}>{clause.statement}</p>
          )) : <p>Answer the next question and the first supplier-ready requirement will appear here.</p>}
        </div>
        {issueTarget === "formal" && (
          <p className="nf-guided-depth">The full supplier pack includes {questionBankCount} tailored evidence and response questions from the Netify question bank and your sector pack.</p>
        )}
        <button type="button" onClick={onOpenDocument}>Open full document <span aria-hidden="true">›</span></button>
      </aside>
    </>
  );
}
