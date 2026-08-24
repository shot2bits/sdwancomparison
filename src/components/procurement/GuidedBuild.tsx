"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { NextQuestionCard } from "@/components/procurement/LivingProcurementCanvas";
import type { SectionQuestionItem } from "@/lib/workspace/section-question-register";
import { RFP_SECTION_QUESTION_TARGET } from "@/lib/workspace/rfp-coverage";

type ClausePreview = { id: string; statement: string };
type CustomAnswerReceipt = { question: string; text: string; addedTo: string };

function splitQuestion(value: string): { prompt: string; context: string | null } {
  const questionMark = value.indexOf("?");
  if (questionMark < 0 || questionMark === value.length - 1) return { prompt: value, context: null };
  return {
    prompt: value.slice(0, questionMark + 1),
    context: value.slice(questionMark + 1).trim() || null,
  };
}

export default function GuidedBuild({
  card,
  ready,
  advisorMessage,
  sectionComplete,
  incompleteSectionTitle,
  position,
  total,
  documentTitle,
  documentSummary,
  clauses,
  composer,
  onFocusPrompt,
  onDescribeQuestion,
  customAnswerQuestionId,
  customAnswerReceipt,
  sectionTitle,
  sectionQuestions,
  onAddSupplierQuestion,
  onImportQuestions,
  onGoToNextSection,
  onOpenDocument,
}: {
  card: NextQuestionCard | null;
  ready: boolean;
  advisorMessage: string;
  sectionComplete: boolean;
  incompleteSectionTitle: string | null;
  position: number;
  total: number;
  documentTitle: string;
  documentSummary: string;
  clauses: ClausePreview[];
  composer: ReactNode;
  onFocusPrompt: () => void;
  onDescribeQuestion: (question: NextQuestionCard["nq"] | null) => void;
  customAnswerQuestionId: string | null;
  customAnswerReceipt: CustomAnswerReceipt | null;
  sectionTitle: string;
  sectionQuestions: SectionQuestionItem[];
  onAddSupplierQuestion: (question: string) => void;
  onImportQuestions: () => void;
  onGoToNextSection: () => void;
  onOpenDocument: () => void;
}) {
  const [selection, setSelection] = useState<{ questionId: string; indices: number[] } | null>(null);
  const [transitionReceipt, setTransitionReceipt] = useState<{ question: string; label: string } | null>(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionLocked = useRef(false);
  const questionSectionRef = useRef<HTMLElement | null>(null);
  const previousQuestionIdRef = useRef<string | null>(null);
  const [newQuestion, setNewQuestion] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const questionManagerRef = useRef<HTMLDetailsElement | null>(null);
  useEffect(() => () => { if (transitionTimer.current) clearTimeout(transitionTimer.current); }, []);
  useEffect(() => {
    const nextId = card?.nq.id ?? null;
    const previousId = previousQuestionIdRef.current;
    previousQuestionIdRef.current = nextId;
    if (!previousId || !nextId || previousId === nextId || !window.matchMedia("(max-width: 1023px)").matches) return;
    window.requestAnimationFrame(() => questionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [card?.nq.id]);
  const selected = selection && selection.questionId === card?.nq.id ? selection.indices : [];
  const multipleChoice = card?.selectionMode === "multiple";
  const writingCustomAnswer = Boolean(card && customAnswerQuestionId === card.nq.id);
  const questionReason = card
    ? card.nq.reason ?? `This completes ${card.fills?.title ?? "the next part of the requirement"} and gives suppliers a clear basis for their response.`
    : ready
      ? "Every required section is complete. Review the living document before publishing the opportunity."
      : sectionComplete
        ? `${sectionTitle} is complete. You can review its recorded answers below or continue to the next unfinished section.`
      : `${incompleteSectionTitle ?? "The next required section"} still needs an answer. Add it in the prompt below.`;
  const completedCount = sectionQuestions.filter((item) => item.status === "completed").length;
  const suggestedCount = sectionQuestions.filter((item) => item.status === "suggested").length;
  const rfpTarget = RFP_SECTION_QUESTION_TARGET;
  const rfpAnswered = Math.min(completedCount, rfpTarget);
  const fallbackPrompt = ready
    ? "Review the requirement you have built"
    : sectionComplete
      ? `${sectionTitle} is complete`
      : `Complete ${incompleteSectionTitle ?? "the next section"}`;
  const visibleQuestion = splitQuestion(card?.nq.question ?? fallbackPrompt);
  const bespokeCount = sectionQuestions.filter((item) => item.status === "custom").length;
  const additionalCount = sectionQuestions.filter((item) => item.status === "suggested").length;

  const openQuestionManager = (suggest = false) => {
    if (questionManagerRef.current) questionManagerRef.current.open = true;
    window.requestAnimationFrame(() => questionManagerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    if (suggest) void askForSuggestions();
  };

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
    if (!selected.length || !card) return;
    const answers = selected.map((index) => card.buttons[index]).filter(Boolean);
    if (!answers.length) return;
    transitionLocked.current = true;
    setTransitionReceipt({ question: card.nq.question, label: answers.map((answer) => answer.label).join(", ") });
    if (multipleChoice && card.onConfirmSelection) card.onConfirmSelection(selected);
    else answers[0].onClick();
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
        <section ref={questionSectionRef} className="nf-guided-question" aria-label="Next requirement question">
          <div className="nf-guided-builder-label"><strong>RFP Builder</strong><span>· One living document</span></div>
          <p className="nf-guided-kicker">Section {Math.max(1, position)} of {Math.max(1, total)}</p>
          <div className="nf-guided-section-progress" aria-label={`${sectionTitle} question progress`}>
            <span><strong>{sectionTitle}</strong><small>{rfpAnswered} of {rfpTarget} questions populated for RFP depth{suggestedCount ? ` · ${suggestedCount} suggested` : ""}</small></span>
            <span aria-hidden="true"><i style={{ width: `${Math.round((rfpAnswered / rfpTarget) * 100)}%` }} /></span>
          </div>
          <div className="nf-guided-focus">
            <p className="nf-guided-next-label">{ready ? "RFP ready for review" : sectionComplete ? "Section complete" : "Next best question"}</p>
            <h1>{visibleQuestion.prompt}</h1>
            {visibleQuestion.context && <p className="nf-guided-question-context">{visibleQuestion.context}</p>}
            <p className="nf-guided-reason">{questionReason}</p>
            <div className="nf-guided-prompt">
              {composer}
              {card && <details><summary>Why Netify is asking this</summary><p>{questionReason}</p></details>}
            </div>
          </div>

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
            <div className="nf-guided-choices" role={multipleChoice ? "group" : "radiogroup"} aria-label={card.nq.question}>
              {multipleChoice && (
                <div className="nf-guided-multi-help">
                  <span>Select every country or region in scope.</span>
                  <button
                    type="button"
                    onClick={() => setSelection({ questionId: card.nq.id, indices: card.buttons.map((_, index) => index) })}
                  >
                    {card.selectAllLabel ?? "Select all"}
                  </button>
                </div>
              )}
              {card.buttons.map((button, index) => (
                <button
                  key={`${card.nq.id}-${button.label}`}
                  type="button"
                  role={multipleChoice ? "checkbox" : "radio"}
                  aria-checked={selected.includes(index)}
                  data-selected={selected.includes(index)}
                  onClick={() => {
                    onDescribeQuestion(null);
                    setSelection((current) => {
                      const existing = current?.questionId === card.nq.id ? current.indices : [];
                      if (!multipleChoice) return { questionId: card.nq.id, indices: [index] };
                      return {
                        questionId: card.nq.id,
                        indices: existing.includes(index) ? existing.filter((value) => value !== index) : [...existing, index],
                      };
                    });
                  }}
                >
                  <span>{button.label}</span><span aria-hidden="true">{multipleChoice ? selected.includes(index) ? "✓" : "+" : "›"}</span>
                </button>
              ))}
              <button
                type="button"
                aria-pressed={writingCustomAnswer}
                data-selected={writingCustomAnswer}
                onClick={() => {
                  setSelection(null);
                  onDescribeQuestion(card.nq);
                  onFocusPrompt();
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
              disabled={!writingCustomAnswer && selected.length === 0}
              onClick={continueWithAnswer}
            >
              {writingCustomAnswer
                ? "Use the prompt below"
                : selected.length === 0
                  ? multipleChoice ? "Select one or more regions" : "Choose an answer"
                  : multipleChoice ? `Save ${selected.length} region${selected.length === 1 ? "" : "s"}` : "Continue"}
            </button>
          )}

          <section className="nf-guided-register" aria-labelledby="section-question-register">
            <div className="nf-guided-register-head">
              <div><p id="section-question-register">Questions in this section</p><span>Every core answer, optional refinement and supplier question in this section. {rfpTarget} core · {additionalCount} additional available · {bespokeCount} bespoke</span></div>
              <strong>{rfpAnswered}/{rfpTarget} core populated</strong>
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
            <div className="nf-guided-question-actions" aria-label="Extend this RFP section">
              <button type="button" onClick={() => openQuestionManager(true)}>＋ Add recommended question</button>
              <button type="button" onClick={() => openQuestionManager(true)}>Browse additional questions</button>
              <button type="button" onClick={() => openQuestionManager(false)}>＋ Add bespoke question</button>
              <button type="button" onClick={onImportQuestions}>Import from Word or spreadsheet</button>
            </div>
            <details ref={questionManagerRef} className="nf-guided-add-question">
              <summary>Add a bespoke supplier question</summary>
              <p>Add your own wording, or ask Netify to suggest questions for this section. Nothing is added without your approval.</p>
              <label htmlFor="bespoke-supplier-question">Question for suppliers</label>
              <div>
                <input
                  id="bespoke-supplier-question"
                  value={newQuestion}
                  onChange={(event) => setNewQuestion(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSupplierQuestion(newQuestion); } }}
                  placeholder="Write the question suppliers must answer"
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
            </details>
          </section>

        </section>
      </main>

      <aside className="nf-guided-document" aria-label="Your living RFP preview">
        <div className="nf-guided-document-head">
          <div><strong>Your living RFP</strong><span>Updated just now</span></div>
          <span>{ready ? "RFP ready" : "Building"}</span>
        </div>
        <h2>{documentTitle}</h2>
        <p>{documentSummary}</p>
        <div className="nf-guided-clause-preview">
          {clauses.length > 0 ? clauses.slice(0, 4).map((clause, index) => (
            <p key={clause.id} data-new={index === 0}>{clause.statement}</p>
          )) : <p>Answer the next question and the first supplier-ready requirement will appear here.</p>}
        </div>
        <div className="nf-guided-before-publish">
          <strong>Before publishing</strong>
          <button type="button" onClick={onFocusPrompt}><span>Complete the next answer</span><small>{visibleQuestion.prompt}</small></button>
          {!sectionComplete && <button type="button" onClick={() => openQuestionManager(true)}><span>Add recommended depth</span><small>Let Netify suggest useful supplier questions.</small></button>}
          <p>{advisorMessage}</p>
        </div>
        <button type="button" onClick={onOpenDocument}>Open full document <span aria-hidden="true">›</span></button>
      </aside>
    </>
  );
}
