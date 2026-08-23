"use client";

import type { OutlineRow } from "@/lib/workspace/procurement-outline";
import type { SectionQuestionItem } from "@/lib/workspace/section-question-register";

export default function SectionBuildPanel({
  row,
  questions,
  position,
  total,
  issueTarget,
  onAnswer,
  activeQuestionId,
  onSelectQuestion,
}: {
  row: OutlineRow | null;
  questions: SectionQuestionItem[];
  position: number;
  total: number;
  issueTarget: "concise" | "formal";
  onAnswer: () => void;
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
    <main className="nf-section-build-panel" aria-label={`${row?.title ?? "RFP"} section builder`}>
      <header>
        <div className="nf-section-build-eyebrow"><strong>RFP Builder</strong><span>· {issueTarget === "formal" ? "Full RFP" : "Quick requirement"}</span></div>
        <p>Section {Math.max(position, 1)} of {Math.max(total, 1)}</p>
        <h1>{row?.title ?? "Organisation and scale"}</h1>
        <span>{ready ? "This section is ready. Review the captured answers below or choose the next section." : `Complete the ${required.length || 1} remaining core question${required.length === 1 ? "" : "s"}. Your answers build this section live.`}</span>
      </header>

      <div className="nf-section-build-progress" aria-label={`${completed.length} of ${Math.max(coreTotal, 1)} core questions answered`}>
        <div><strong>{completed.length} of {Math.max(coreTotal, 1)} answered</strong><span>{required.length ? `${required.length} to complete this section` : "Section complete"}</span></div>
        <i><b style={{ width: `${coreTotal ? Math.round((completed.length / coreTotal) * 100) : 0}%` }} /></i>
      </div>

      <section className="nf-section-build-questions" aria-labelledby="active-section-questions">
        <div><h2 id="active-section-questions">Section questions</h2><span>Answer in any order, or cover several in one message.</span></div>
        <ol>
          {questions.map((item) => (
            <li key={item.id} data-status={item.status} data-selected={activeQuestionId === item.id}>
              <button
                type="button"
                aria-pressed={activeQuestionId === item.id}
                aria-label={`${activeQuestionId === item.id ? "Selected question" : "Answer question"}: ${item.text}`}
                onClick={() => onSelectQuestion(item)}
              >
                <span aria-hidden="true">{item.status === "completed" ? "✓" : item.status === "custom" ? "+" : "○"}</span>
                <div><strong>{item.text}</strong>{item.answer && <small>{item.answer}</small>}</div>
                <em>{activeQuestionId === item.id ? "Selected" : item.status === "completed" ? "Answered" : item.status === "required" ? "Select" : item.status === "suggested" ? "Optional" : "Added by you"}</em>
              </button>
            </li>
          ))}
        </ol>
        {selectedQuestion && (
          <div className="nf-section-selected-question" aria-live="polite">
            <span>Selected question</span>
            <strong>{selectedQuestion.text}</strong>
            <button type="button" onClick={onAnswer}>Answer selected question in the AI prompt</button>
          </div>
        )}
      </section>

      <section className="nf-section-live-build" aria-labelledby="live-section-build">
        <div><h2 id="live-section-build">Live section build</h2><span>{completed.length ? "Updated from your answers" : "Waiting for your first answer"}</span></div>
        {completed.length ? (
          <dl>{completed.map((item) => <div key={item.id}><dt>{item.text}</dt><dd>{item.answer ?? "Confirmed"}</dd></div>)}</dl>
        ) : (
          <p>Nothing has been added to {row?.title ?? "this section"} yet. Describe what you know in the AI prompt above; each recognised answer will appear here immediately.</p>
        )}
        {optional.length > 0 && <small>{optional.length} optional refinement{optional.length === 1 ? "" : "s"} available after the core section is complete.</small>}
      </section>
    </main>
  );
}
