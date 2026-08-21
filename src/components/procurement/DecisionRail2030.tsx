"use client";

import { useEffect, useRef, useState } from "react";
import type { NextQuestionCard } from "./LivingProcurementCanvas";

export default function DecisionRail2030({
  cards,
  totalOutstanding,
  onSeeAll,
  onJumpToSection,
}: {
  cards: NextQuestionCard[];
  totalOutstanding: number;
  onSeeAll: () => void;
  onJumpToSection: (title: string) => void;
}) {
  const [recorded, setRecorded] = useState<{ question: string; answer: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const card = cards[0] ?? null;
  const choose = (question: string, answer: string, action: () => void) => {
    action();
    setRecorded({ question, answer });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setRecorded(null), 4200);
  };

  return (
    <aside className="nf-2030-decision" aria-label="Next decision">
      <p className="nf-2030-side-label">Next decision</p>

      {recorded ? (
        <div className="nf-2030-recorded" role="status" aria-live="polite">
          <strong>Recorded: {recorded.answer}</strong>
          <span>{recorded.question}</span>
        </div>
      ) : card ? (
        <>
          <h2>{card.nq.question}</h2>
          {card.nq.reason && <p className="nf-2030-decision-reason">{card.nq.reason}</p>}
          {card.nq.impact.length > 0 && (
            <p className="nf-2030-impact">Affects {card.nq.impact.join(", ")}</p>
          )}
          {card.buttons.length > 0 ? (
            <div className="nf-2030-choices">
              {card.buttons.map((button) => (
                <button
                  key={button.label}
                  type="button"
                  onClick={() => choose(card.nq.question, button.label, button.onClick)}
                >
                  {button.label}
                </button>
              ))}
            </div>
          ) : card.hint ? (
            <p className="nf-2030-decision-reason">{card.hint}</p>
          ) : null}
          {card.fills && (
            <button type="button" className="nf-2030-section-link" onClick={() => onJumpToSection(card.fills!.title)}>
              Completes {card.fills.title}
            </button>
          )}
        </>
      ) : (
        <div className="nf-2030-recorded">
          <strong>No material decision is waiting</strong>
          <span>You can review, issue or keep adding depth.</span>
        </div>
      )}

      {totalOutstanding > 1 && (
        <button type="button" className="nf-2030-all-decisions" onClick={onSeeAll}>
          See all {totalOutstanding} open decisions
        </button>
      )}

      <div className="nf-2030-control-note">
        <strong>You remain in control</strong>
        Research, drafting and connected tools may update the working model. Issuing, inviting suppliers and external actions always require explicit approval.
      </div>
    </aside>
  );
}
