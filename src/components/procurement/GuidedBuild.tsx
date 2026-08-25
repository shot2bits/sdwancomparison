"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { NextQuestionCard } from "@/components/procurement/LivingProcurementCanvas";
import type { SectionQuestionItem } from "@/lib/workspace/section-question-register";
import { RFP_SECTION_QUESTION_TARGET } from "@/lib/workspace/rfp-coverage";
import type { OutlineProgress, OutlineRow } from "@/lib/workspace/procurement-outline";

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
  rows,
  activeKey,
  progress,
  materialDecisionsRemaining,
  publishReachable,
  onSelectSection,
  onPublish,
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
  rows: OutlineRow[];
  activeKey: string | null;
  progress: OutlineProgress;
  materialDecisionsRemaining: number;
  publishReachable: boolean;
  onSelectSection: (key: string) => void;
  onPublish: () => void;
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
    <div className="lpos-builder">
      <main className="nf-guided-main">
        <section ref={questionSectionRef} className="nf-guided-question" aria-label="Next requirement question">
          <div className="nf-guided-builder-label"><span aria-hidden="true">✦</span><strong>Guided conversation</strong></div>
          <p className="lpos-guided-intro">Describe what you need. Netify builds the document.</p>
          <div className="lpos-you-said"><small>You said</small><strong>{documentSummary || "Start with what you know about the project."}</strong><time>Now</time></div>
          <div className="lpos-captured">
            <small>Netify captured</small>
            {(clauses.length ? clauses.slice(0, 4) : [{ id: "empty", statement: "Your confirmed requirements will appear here" }]).map((clause) => (
              <div key={clause.id}><span aria-hidden="true">✓</span><p>{clause.statement}</p><button type="button" onClick={onFocusPrompt}>Edit</button></div>
            ))}
          </div>
          <div className="nf-guided-focus">
            <div className="lpos-question-heading"><p className="nf-guided-next-label">{ready ? "Essential baseline complete" : sectionComplete ? "Section complete" : "Next essential question"}</p><span>{Math.max(1, position)} of {Math.max(1, total)}</span></div>
            <h1>{visibleQuestion.prompt}</h1>
            {visibleQuestion.context && <p className="nf-guided-question-context">{visibleQuestion.context}</p>}
            <div className="lpos-why"><strong>♙ &nbsp; Why this matters</strong><p>{questionReason}</p></div>
            <p className="lpos-adds"><span aria-hidden="true">▣</span> Adds to your document: <strong>{sectionTitle}</strong></p>
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

          <div className="lpos-impact"><span aria-hidden="true">✦</span><div><strong>Impact preview</strong><p>Your answer updates the requirement, supplier questions and evidence request together.</p></div><b aria-hidden="true">✓</b></div>
          <div className="lpos-own-words"><strong>Or add details in your own words</strong><div className="nf-guided-prompt">{composer}</div></div>

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
          <div><h2>{documentTitle}</h2><span>{progress.ready} of {progress.total} essential sections ready</span></div>
          <span>● &nbsp; DRAFT · UPDATES LIVE</span>
          <button type="button" onClick={onOpenDocument}>⚙ &nbsp; Document settings</button>
        </div>
        <div className="lpos-metrics">
          <div className="lpos-completeness"><span>Document completeness</span><p><i><b style={{ width: `${Math.round((progress.ready / Math.max(1, progress.total)) * 100)}%` }} /></i><strong>{Math.round((progress.ready / Math.max(1, progress.total)) * 100)}%</strong></p></div>
          <div><strong>{clauses.length}</strong><span>Requirements<br/>confirmed</span></div>
          <div><strong>{sectionQuestions.length}</strong><span>Supplier questions<br/>prepared</span></div>
          <div><strong>{Math.max(0, materialDecisionsRemaining)}</strong><span>Open decisions<br/>remaining</span></div>
        </div>
        <div className="lpos-architecture" aria-label="Procurement architecture">
          <div><strong>Sites</strong><span>your estate</span></div><b>→</b><div><strong>SD-WAN</strong><span>secure connectivity</span></div><b>→</b><div><strong>SASE</strong><span>security &amp; access</span></div><b>→</b><div><strong>Cloud apps</strong><span>apps and data</span></div>
        </div>
        <ol className="lpos-sections" aria-label="Essential document sections">
          {rows.map((row, index) => {
            const current = row.key === activeKey;
            return <li key={row.key} data-current={current} data-state={row.state}><button type="button" onClick={() => onSelectSection(row.key)}><b>{index + 1}</b><strong>{row.title}</strong><span>{row.detail}</span><em>{row.state === "confirmed" ? "✓ Confirmed" : current ? "● Needs input" : row.state === "needs_decision" ? "● Needs decision" : "○ Later"}</em><i>⌄</i></button>{current && <div className="lpos-section-extensions"><button type="button" onClick={() => openQuestionManager(true)}>＋ Recommended questions</button><button type="button" onClick={() => openQuestionManager(false)}>＋ Bespoke question</button></div>}</li>;
          })}
        </ol>
        <div className="lpos-unlock"><span aria-hidden="true">🔒</span><div><strong>{publishReachable ? "Ready to publish" : "Almost ready to publish"}</strong><p>{publishReachable ? "Your essential baseline is complete. Publishing remains anonymous until you choose to unlock supplier identity." : advisorMessage}</p></div><ul><li>Matched providers</li><li>Structured responses</li><li>Evidence pack</li><li>Pricing comparison</li></ul></div>
        <div className="lpos-document-actions"><button type="button" className="primary" onClick={publishReachable ? onPublish : onFocusPrompt}>{publishReachable ? "Review & publish" : "Continue building"} →</button><button type="button" onClick={onOpenDocument}>◉ &nbsp; Preview what suppliers receive</button></div>
      </aside>
    </div>
  );
}
