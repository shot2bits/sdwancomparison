"use client";

import type { ReactNode } from "react";
import type { OutlineRow } from "@/lib/workspace/procurement-outline";
import type { SectionQuestionItem } from "@/lib/workspace/section-question-register";

export default function SectionBuildPanel({
  row,
  questions,
  position,
  total,
  composer,
  activeQuestionId,
  onSelectQuestion,
}: {
  row: OutlineRow | null;
  questions: SectionQuestionItem[];
  position: number;
  total: number;
  composer: ReactNode;
  activeQuestionId: string | null;
  onSelectQuestion: (question: SectionQuestionItem) => void;
}) {
  const completed = questions.filter((item) => item.status === "completed");
  const required = questions.filter((item) => item.status === "required");
  const optional = questions.filter((item) => item.status === "suggested" || item.status === "custom");
  const selectedQuestion = questions.find((item) => item.id === activeQuestionId) ?? null;
  const coreTotal = completed.length + required.length;
  const ready = row?.state === "confirmed" || (coreTotal > 0 && required.length === 0);

  return (
    <section className="nf-section-build-panel" aria-label={`${row?.title ?? "RFP"} section builder`}>
      <header>
        <div className="nf-section-build-eyebrow"><strong>RFP Builder</strong><span>· One living document</span></div>
        <p>Section {Math.max(position, 1)} of {Math.max(total, 1)}</p>
        <h2>{row?.title ?? "Organisation and scale"}</h2>
        <span>{ready ? "This section is ready. Review the captured answers below or choose the next section." : `Complete the ${required.length || 1} remaining core question${required.length === 1 ? "" : "s"}. Your answers build this section live.`}</span>
      </header>

      <div className="nf-section-build-progress" aria-label={`${completed.length} of ${Math.max(coreTotal, 1)} core questions answered`}>
        <div><strong>{completed.length} of {Math.max(coreTotal, 1)} answered</strong><span>{required.length ? `${required.length} to complete this section` : "Section complete"}</span></div>
        <i><b style={{ width: `${coreTotal ? Math.round((completed.length / coreTotal) * 100) : 0}%` }} /></i>
      </div>

      <section className="nf-section-question-workspace" aria-label="Answer the active RFP question">
        <div className="nf-section-build-questions" aria-labelledby="active-section-questions">
          <div><h2 id="active-section-questions">Questions in this section</h2><span>Choose the question you want to answer.</span></div>
          <ol>
            {questions.map((item) => (
              <li key={item.id} data-status={item.status} data-selected={activeQuestionId === item.id}>
                <button
                  type="button"
                  aria-pressed={activeQuestionId === item.id}
                  aria-label={`${activeQuestionId === item.id ? "Current question" : "Open question"}: ${item.text}`}
                  onClick={() => onSelectQuestion(item)}
                >
                  <span aria-hidden="true">{item.status === "completed" ? "✓" : item.status === "custom" ? "+" : "○"}</span>
                  <div><strong>{item.text}</strong>{item.answer && <small>{item.answer}</small>}</div>
                  <em>{activeQuestionId === item.id ? "Open" : item.status === "completed" ? "Answered" : item.status === "required" ? "To do" : item.status === "suggested" ? "Optional" : "Added by you"}</em>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="nf-section-answer-panel" aria-live="polite">
          <span>{selectedQuestion?.status === "completed" ? "Review or correct" : "Answering now"}</span>
          <h2>{selectedQuestion?.text ?? "Describe what you need"}</h2>
          {selectedQuestion?.answer && <p className="nf-section-current-answer"><strong>Current answer</strong>{selectedQuestion.answer}</p>}
          <p>Answer in your own words. You can include other known details and Netify will place each one into the appropriate RFP section.</p>
          {composer}
          <small>Your answer is saved to the living RFP and progress updates in place.</small>
        </div>
      </section>

      <section className="nf-section-live-build" aria-labelledby="live-section-build">
        <div><h2 id="live-section-build">Live section build</h2><span>{completed.length ? "Updated from your answers" : "Waiting for your first answer"}</span></div>
        {completed.length ? (
          <dl>{completed.map((item) => <div key={item.id}><dt>{item.text}</dt><dd>{item.answer ?? "Confirmed"}</dd></div>)}</dl>
        ) : (
          <p>Nothing has been added to {row?.title ?? "this section"} yet. Use the answer panel for the active question; each recognised answer will appear here immediately.</p>
        )}
        {optional.length > 0 && <small>{optional.length} optional refinement{optional.length === 1 ? "" : "s"} available after the core section is complete.</small>}
      </section>
    </section>
  );
}
