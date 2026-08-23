"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { NextQuestionCard } from "@/components/procurement/LivingProcurementCanvas";

type ClausePreview = { id: string; statement: string };
type CustomAnswerReceipt = { question: string; text: string; addedTo: string };
export type SectionQuestionItem = {
  id: string;
  text: string;
  status: "completed" | "required" | "suggested" | "custom";
  answer?: string;
};

export default function GuidedBuild({
  card,
  ready,
  sectionComplete,
  incompleteSectionTitle,
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
  onDescribeQuestion,
  customAnswerQuestionId,
  customAnswerReceipt,
  sectionTitle,
  sectionQuestions,
  onAddSupplierQuestion,
  onGoToNextSection,
  onOpenDocument,
}: {
  card: NextQuestionCard | null;
  ready: boolean;
  sectionComplete: boolean;
  incompleteSectionTitle: string | null;
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
  onDescribeQuestion: (question: NextQuestionCard["nq"] | null) => void;
  customAnswerQuestionId: string | null;
  customAnswerReceipt: CustomAnswerReceipt | null;
  sectionTitle: string;
  sectionQuestions: SectionQuestionItem[];
  onAddSupplierQuestion: (question: string) => void;
  onGoToNextSection: () => void;
  onOpenDocument: () => void;
}) {
  const [selection, setSelection] = useState<{ questionId: string; index: number } | null>(null);
  const [transitionReceipt, setTransitionReceipt] = useState<{ question: string; label: string } | null>(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionLocked = useRef(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  useEffect(() => () => { if (transitionTimer.current) clearTimeout(transitionTimer.current); }, []);
  const selected = selection && selection.questionId === card?.nq.id ? selection.index : null;
  const writingCustomAnswer = Boolean(card && customAnswerQuestionId === card.nq.id);
  const questionReason = card
    ? card.nq.reason ?? `This completes ${card.fills?.title ?? "the next part of the requirement"} and gives suppliers a clear basis for their response.`
    : ready
      ? "Every required section is complete. Review the living document before publishing the opportunity."
      : sectionComplete
        ? `${sectionTitle} is complete. You can review its recorded answers below or continue to the next unfinished section.`
      : `${incompleteSectionTitle ?? "The next required section"} still needs an answer. Add it in the prompt below.`;
  const completedCount = sectionQuestions.filter((item) => item.status === "completed").length;
  const outstandingCount = sectionQuestions.filter((item) => item.status === "required" || item.status === "suggested").length;

  const addSupplierQuestion = (value: string) => {
    const text = value.trim();
    if (!text) return;
    onAddSupplierQuestion(text);
    setNewQuestion("");
    setSuggestions((items) => items.filter((item) => item !== value));
  };

  const askForSuggestions = async () => {
    if (suggesting) return;
    setSuggesting(true);
    setSuggestionError(null);
    try {
      const res = await fetch("/sase/api/workspace/suggest-questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          section: sectionTitle,
          context: `${documentTitle}. ${documentSummary}`,
          existing: sectionQuestions.map((item) => item.text),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { questions?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Suggestions are unavailable.");
      setSuggestions(Array.isArray(data.questions) ? data.questions : []);
    } catch (error) {
      setSuggestionError(error instanceof Error ? error.message : "Suggestions are unavailable.");
    } finally {
      setSuggesting(false);
    }
  };

  const continueWithAnswer = () => {
    if (transitionLocked.current) return;
    if (writingCustomAnswer) {
      onFocusPrompt();
      return;
    }
    if (selected === null || !card?.buttons[selected]) return;
    const answer = card.buttons[selected];
    transitionLocked.current = true;
    setTransitionReceipt({ question: card.nq.question, label: answer.label });
    answer.onClick();
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    transitionTimer.current = setTimeout(() => {
      transitionLocked.current = false;
      setSelection(null);
      setTransitionReceipt(null);
    }, 750);
  };

  return (
    <>
      <main className="nf-guided-main">
        <section className="nf-guided-question" aria-label="Next requirement question">
          <p className="nf-guided-kicker">Next step · {Math.max(1, position)} of {Math.max(1, total)}</p>
          <div className="nf-guided-section-progress" aria-label={`${sectionTitle} question progress`}>
            <span><strong>{sectionTitle}</strong><small>{completedCount} answered · {outstandingCount} to complete</small></span>
            <span aria-hidden="true"><i style={{ width: `${sectionQuestions.length ? Math.round((completedCount / sectionQuestions.length) * 100) : 0}%` }} /></span>
          </div>
          <h1>{card?.nq.question ?? (ready ? "Review the requirement you have built" : sectionComplete ? `${sectionTitle} is complete` : `Complete ${incompleteSectionTitle ?? "the next section"}`)}</h1>
          <p className="nf-guided-reason">
            {questionReason}
          </p>

          {customAnswerReceipt && (
            <div className="nf-guided-custom-receipt" role="status" aria-live="polite">
              <strong>Added from your words</strong>
              <span>“{customAnswerReceipt.text}”</span>
              <small>Answer to “{customAnswerReceipt.question}” saved to {customAnswerReceipt.addedTo}. The next question is shown below.</small>
            </div>
          )}

          {transitionReceipt ? (
            <div className="nf-guided-answer-recorded" role="status" aria-live="polite" aria-busy="true">
              <span aria-hidden="true">✓</span>
              <div><strong>Recorded: {transitionReceipt.label}</strong><small>{transitionReceipt.question}</small></div>
            </div>
          ) : card && card.buttons.length > 0 ? (
            <div className="nf-guided-choices" role="radiogroup" aria-label={card.nq.question}>
              {card.buttons.map((button, index) => (
                <button
                  key={`${card.nq.id}-${button.label}`}
                  type="button"
                  role="radio"
                  aria-checked={selected === index}
                  data-selected={selected === index}
                  onClick={() => {
                    onDescribeQuestion(null);
                    setSelection({ questionId: card.nq.id, index });
                  }}
                >
                  <span>{button.label}</span><span aria-hidden="true">›</span>
                </button>
              ))}
              <button
                type="button"
                aria-pressed={writingCustomAnswer}
                data-selected={writingCustomAnswer}
                onClick={() => {
                  setSelection(null);
                  onDescribeQuestion(card.nq);
                }}
              >
                <span>{writingCustomAnswer ? "Write your answer in the prompt below" : "Describe it in your own words"}</span>
                <span aria-hidden="true">{writingCustomAnswer ? "↓" : "›"}</span>
              </button>
            </div>
          ) : ready ? (
            <button type="button" className="nf-guided-review" onClick={onOpenDocument}>Review your RFP</button>
          ) : sectionComplete ? (
            <button type="button" className="nf-guided-review" onClick={onGoToNextSection}>Continue to {incompleteSectionTitle ?? "the next section"}</button>
          ) : (
            <button type="button" className="nf-guided-review" onClick={onFocusPrompt}>Answer in the prompt below</button>
          )}

          {card && card.buttons.length > 0 && !transitionReceipt && (
            <button
              type="button"
              className="nf-guided-continue"
              disabled={!writingCustomAnswer && selected === null}
              onClick={continueWithAnswer}
            >
              {writingCustomAnswer ? "Use the prompt below" : selected === null ? "Choose an answer" : "Continue"}
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

          <section className="nf-guided-register" aria-labelledby="section-question-register">
            <div className="nf-guided-register-head">
              <div><p id="section-question-register">Section questions</p><span>Everything answered, outstanding and added by you.</span></div>
              <strong>{completedCount}/{Math.max(completedCount + outstandingCount, 1)} complete</strong>
            </div>
            <ul>
              {sectionQuestions.map((item) => (
                <li key={item.id} data-status={item.status}>
                  <span aria-hidden="true">{item.status === "completed" ? "✓" : item.status === "custom" ? "+" : "○"}</span>
                  <div><strong>{item.text}</strong>{item.answer && <small>{item.answer}</small>}</div>
                  <em>{item.status === "completed" ? "Answered" : item.status === "required" ? "To do" : item.status === "suggested" ? "Netify suggests" : "Added by you"}</em>
                </li>
              ))}
              {sectionQuestions.length === 0 && <li data-status="required"><span aria-hidden="true">○</span><div><strong>No questions recorded for this section yet.</strong></div><em>To do</em></li>}
            </ul>
            <div className="nf-guided-add-question">
              <label htmlFor="bespoke-supplier-question">Add your own question for suppliers</label>
              <div>
                <input
                  id="bespoke-supplier-question"
                  value={newQuestion}
                  onChange={(event) => setNewQuestion(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSupplierQuestion(newQuestion); } }}
                  placeholder="e.g. How will you evidence application performance during failover?"
                />
                <button type="button" disabled={!newQuestion.trim()} onClick={() => addSupplierQuestion(newQuestion)}>Add</button>
              </div>
              <button type="button" className="nf-guided-ai-suggest" disabled={suggesting} onClick={() => void askForSuggestions()}>
                {suggesting ? "Netify is thinking…" : "Suggest questions with Netify AI"}
              </button>
              {suggestionError && <p role="alert">{suggestionError}</p>}
              {suggestions.length > 0 && (
                <div className="nf-guided-suggestions" aria-label="AI suggested supplier questions">
                  {suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => addSupplierQuestion(suggestion)}><span>＋</span>{suggestion}</button>)}
                  <small>Suggestions are never added until you choose them.</small>
                </div>
              )}
            </div>
          </section>

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
