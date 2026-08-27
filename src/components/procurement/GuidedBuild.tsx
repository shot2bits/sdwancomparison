"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { NextQuestionCard } from "@/components/procurement/LivingProcurementCanvas";
import type { SectionQuestionItem } from "@/lib/workspace/section-question-register";
import type { OutlineProgress, OutlineRow } from "@/lib/workspace/procurement-outline";
import type { RfpValidationReport } from "@/lib/workspace/rfp-validator";

type ClausePreview = { id: string; statement: string; sourceFactIds?: string[] };
type CustomAnswerReceipt = { question: string; text: string; addedTo: string };
export type RfpDepth = "short" | "detailed";

const SECTION_COVERAGE: Record<string, string[]> = {
  organisation_scale: ["organisation profile", "users and devices", "sites and regions", "stakeholders", "procurement route"],
  solution_scope: ["SD-WAN and SASE scope", "SSE components", "use cases", "integrations", "exclusions"],
  current_estate: ["underlay inventory", "WAN topology", "cloud and SaaS", "identity", "tools and contracts"],
  resilience_availability: ["availability targets", "access diversity", "failover", "performance", "disaster recovery"],
  security_identity_data: ["ZTNA", "SWG, CASB and DLP", "FWaaS and threat", "logging and SIEM", "data and compliance"],
  sector_intelligence: ["sector regulation", "critical workflows", "operational risks", "assurance evidence", "industry SLAs"],
  operating_model_support: ["service ownership", "service desk", "SLAs", "RACI and escalation", "reporting"],
  migration_implementation: ["discovery and pilot", "migration waves", "cutover and rollback", "dependencies", "training"],
  commercial_contractual: ["pricing model", "licensing", "contract term", "indexation", "exit and benchmarking"],
  success_evaluation: ["evaluation criteria", "weightings", "evidence", "acceptance tests", "success measures"],
};

function recommendationTopics(value: string): string[] {
  const text = value.toLowerCase();
  const topics: string[] = [];
  if (/health|nhs|clinic|hospital/.test(text)) topics.push("Clinical continuity and data protection");
  if (/manufactur|factory|plant|warehouse|\bot\b|ics/.test(text)) topics.push("OT separation and site resilience");
  if (/retail|store|shop|pos|pci/.test(text)) topics.push("PCI, branch resilience and rollout");
  if (/financ|bank|insurance|fca/.test(text)) topics.push("Regulatory evidence and auditability");
  if (/\b(?:[2-9]|[1-9]\d+)\s+(?:uk\s+)?(?:sites?|branches|stores|offices|locations)\b/.test(text)) topics.push("Underlay diversity, failover and migration waves");
  if (/mpls|ethernet|leased line|broadband|internet|4g|5g|underlay/.test(text)) topics.push("Underlay performance and transition");
  if (/casb|ztna|swg|fwaa?s|sase|sse/.test(text)) topics.push("SASE controls, policy and integrations");
  if (/managed|co-managed|service desk|noc|soc/.test(text)) topics.push("Operating model, SLAs and RACI");
  return [...new Set(topics)].slice(0, 4);
}

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
  onEditClause,
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
  entryMode,
  onEntryModeChange,
  validationReport,
  validatingRfp,
  validationError,
  rfpDepth,
  onRfpDepthChange,
  rfpQuestionTarget,
  onAnswerSectionQuestion,
  onContinueBuilding,
  settingsOpen,
  onSettingsOpenChange,
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
  onEditClause: (clause: ClausePreview) => void;
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
  entryMode: "build" | "check";
  onEntryModeChange: (mode: "build" | "check") => void;
  validationReport: RfpValidationReport | null;
  validatingRfp: boolean;
  validationError: string | null;
  rfpDepth: RfpDepth;
  onRfpDepthChange: (depth: RfpDepth) => void;
  rfpQuestionTarget: number;
  onAnswerSectionQuestion: (item: SectionQuestionItem, answer: string) => Promise<void> | void;
  onContinueBuilding: () => void;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
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
  const suggestionRequestRef = useRef(0);
  const [questionManagerOpen, setQuestionManagerOpen] = useState(false);
  const [inlineAnswers, setInlineAnswers] = useState<Record<string, string>>({});
  const questionManagerRef = useRef<HTMLDetailsElement | null>(null);
  useEffect(() => () => { if (transitionTimer.current) clearTimeout(transitionTimer.current); }, []);
  useEffect(() => {
    /* Recommendations belong to exactly one document section. Clear the
       previous section immediately and invalidate any slower response that
       returns after the buyer has moved elsewhere. */
    suggestionRequestRef.current += 1;
    setSuggestions([]);
    setSuggestionError(null);
    setSuggesting(false);
    setQuestionManagerOpen(false);
  }, [sectionTitle]);
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
  const rfpTarget = rfpQuestionTarget;
  const rfpAnswered = Math.min(completedCount, rfpTarget);
  const fallbackPrompt = ready
    ? "Review the requirement you have built"
    : sectionComplete
      ? `${sectionTitle} is complete`
      : `Complete ${incompleteSectionTitle ?? "the next section"}`;
  const visibleQuestion = splitQuestion(card?.nq.question ?? fallbackPrompt);
  const bespokeCount = sectionQuestions.filter((item) => item.status === "custom").length;
  const additionalCount = sectionQuestions.filter((item) => item.status === "suggested").length;
  const recommendedTopics = useMemo(
    () => recommendationTopics(`${documentTitle} ${documentSummary} ${clauses.map((clause) => clause.statement).join(" ")}`),
    [clauses, documentSummary, documentTitle],
  );

  const openQuestionManager = (suggest = false) => {
    setQuestionManagerOpen(true);
    window.requestAnimationFrame(() => questionManagerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    if (suggest) void askForSuggestions();
  };

  const addSupplierQuestion = (value: string) => {
    const text = value.trim();
    if (!text) return;
    onAddSupplierQuestion(text);
    setNewQuestion("");
    setSuggestions((items) => items.filter((item) => item !== value));
    setQuestionManagerOpen(true);
  };

  const addAllSuggestedQuestions = () => {
    const pending = [...suggestions];
    for (const suggestion of pending) onAddSupplierQuestion(suggestion);
    setSuggestions([]);
    setQuestionManagerOpen(true);
  };

  const chooseSingleAnswer = (question: NextQuestionCard, index: number) => {
    if (transitionLocked.current) return;
    const answer = question.buttons[index];
    if (!answer) return;
    transitionLocked.current = true;
    setTransitionReceipt({ question: question.nq.question, label: answer.label });
    answer.onClick();
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
    transitionTimer.current = setTimeout(() => {
      transitionLocked.current = false;
      setSelection(null);
      setTransitionReceipt(null);
    }, 750);
  };

  const submitInlineAnswer = async (item: SectionQuestionItem) => {
    const answer = (inlineAnswers[item.id] ?? "").trim();
    if (!answer) return;
    await onAnswerSectionQuestion(item, answer);
    setInlineAnswers((values) => ({ ...values, [item.id]: "" }));
  };

  const askForSuggestions = async () => {
    if (suggesting) return;
    const requestId = suggestionRequestRef.current + 1;
    suggestionRequestRef.current = requestId;
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
      if (requestId !== suggestionRequestRef.current) return;
      setSuggestions(Array.isArray(data.questions) ? data.questions : []);
    } catch (error) {
      if (requestId !== suggestionRequestRef.current) return;
      setSuggestionError(error instanceof Error ? error.message : "Suggestions are unavailable.");
    } finally {
      if (requestId === suggestionRequestRef.current) setSuggesting(false);
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

  const hasStarted = clauses.length > 0 || progress.ready > 0;

  const displayDocumentTitle = documentTitle === "Sourcing procurement" ? "Your SASE & SD-WAN RFP" : documentTitle;

  return (
    <div className="lpos-builder">
      <main className="nf-guided-main">
        <section ref={questionSectionRef} className="nf-guided-question" aria-label="Next requirement question">
          <div className="nf-guided-builder-label"><span aria-hidden="true">✦</span><strong>Guided conversation</strong></div>
          <p className="lpos-guided-intro">Describe what you need. Netify builds the document.</p>
          <div className="nf-essential-progress" role="status" aria-live="polite">
            <strong>{ready ? "Essential baseline complete" : `${Math.max(0, total - Math.max(0, position - 1))} essential section${Math.max(0, total - Math.max(0, position - 1)) === 1 ? "" : "s"} remaining`}</strong>
            <span>{ready ? "Review the RFP before publishing." : `Next: ${sectionTitle}`}</span>
            <i aria-hidden="true"><b style={{ width: `${ready ? 100 : Math.round((Math.max(0, position - 1) / Math.max(1, total)) * 100)}%` }} /></i>
          </div>
          <div className="lpos-own-words lpos-persistent-prompt">
            <div className="lpos-prompt-heading">
              <strong>{entryMode === "check" ? "Check an existing RFP" : "Tell Netify what you need"}</strong>
              <span>{entryMode === "check" ? "Paste or upload; Netify checks and rebuilds it" : "Answer, add context or change anything"}</span>
            </div>
            <div className="lpos-entry-mode" role="group" aria-label="How do you want to start?">
              <span>Start from</span>
              <button type="button" data-selected={entryMode === "build"} onClick={() => onEntryModeChange("build")}>New requirements</button>
              <button type="button" data-selected={entryMode === "check"} onClick={() => onEntryModeChange("check")}>Check an AI-generated RFP</button>
            </div>
            <div className="nf-guided-prompt">{composer}</div>
            {entryMode === "check" && <div className="lpos-check-intro"><span>{validatingRfp ? "Checking procurement readiness against the Netify question bank…" : "Already created an RFP with ChatGPT, Claude or another AI? Paste it above or upload Word, PDF, text or a spreadsheet. Netify finds what is missing and preserves the original wording."}</span><button type="button" onClick={onImportQuestions}>Upload RFP</button></div>}
            {validationError && <p className="lpos-validation-error" role="alert">{validationError}</p>}
            <div className="lpos-depth" data-depth={rfpDepth}>
              <span>RFP depth</span>
              <button type="button" data-selected={rfpDepth === "short"} onClick={() => onRfpDepthChange("short")}><strong>Short RFP</strong><small>Minimum valid brief</small></button>
              <button type="button" data-selected={rfpDepth === "detailed"} onClick={() => onRfpDepthChange("detailed")}><strong>Detailed RFP</strong><small>Five-question section depth</small></button>
            </div>
            {rfpDepth === "detailed" && (
              <div className="lpos-depth-recommendations">
                <p><strong>Detailed RFP enabled</strong><span>Target: {rfpQuestionTarget} populated questions in each included section</span></p>
                <div>{(recommendedTopics.length ? recommendedTopics : ["Add sector, sites, SASE scope, underlay or service model for tailored recommendations"]).map((topic) => <span key={topic}>{topic}</span>)}</div>
                <button type="button" onClick={() => openQuestionManager(true)}>Review recommended questions →</button>
              </div>
            )}
          </div>
          <div className="lpos-you-said"><small>You said</small><strong>{documentSummary || "Start with what you know about the project."}</strong><time>Now</time></div>
          <div className="lpos-captured">
            <small>Netify captured</small>
            {(clauses.length ? clauses.slice(0, 4) : [{ id: "empty", statement: "Your confirmed requirements will appear here" }]).map((clause) => (
              <div key={clause.id}><span aria-hidden="true">✓</span><p>{clause.statement}</p><button type="button" onClick={() => onEditClause(clause)}>Edit</button></div>
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
                    if (!multipleChoice) {
                      chooseSingleAnswer(card, index);
                      return;
                    }
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
          ) : sectionComplete && incompleteSectionTitle ? (
            <button type="button" className="nf-guided-review" onClick={onGoToNextSection}>Continue to {incompleteSectionTitle ?? "the next section"}</button>
          ) : sectionComplete ? (
            <button type="button" className="nf-guided-review" onClick={onOpenDocument}>Review your RFP</button>
          ) : (
            <button type="button" className="nf-guided-review" onClick={onFocusPrompt}>Answer in the prompt below</button>
          )}

          {card && card.buttons.length > 0 && !transitionReceipt && (multipleChoice || writingCustomAnswer) && (
            <button
              type="button"
              className="nf-guided-continue"
              disabled={!writingCustomAnswer && selected.length === 0}
              onClick={continueWithAnswer}
            >
              {writingCustomAnswer
                ? "Use the prompt below"
                : selected.length === 0
                  ? multipleChoice ? "Select one or more options" : "Choose an answer"
                  : multipleChoice ? `Save ${selected.length} selection${selected.length === 1 ? "" : "s"}` : "Continue"}
            </button>
          )}

          <div className="lpos-impact"><span aria-hidden="true">✦</span><div><strong>What your answer changes</strong><p>We update the RFP wording, supplier questions and evidence request together.</p></div><b aria-hidden="true">✓</b></div>

          <section className="nf-guided-register" aria-labelledby="section-question-register">
            <div className="nf-guided-register-head">
              <div><p id="section-question-register">Questions in this section</p><span>Every core answer, optional refinement and supplier question in this section. {rfpTarget} core · {additionalCount} additional available · {bespokeCount} bespoke</span></div>
              <strong>{rfpAnswered}/{rfpTarget} core populated</strong>
            </div>
            <ul>
              {sectionQuestions.map((item) => (
                <li key={item.id} data-status={item.status}>
                  <span aria-hidden="true">{item.status === "completed" ? "✓" : item.status === "custom" ? "+" : "○"}</span>
                  <div>
                    <strong>{item.text}</strong>{item.answer && <small>{item.answer}</small>}
                    {item.status === "required" && (
                      <div className="nf-guided-inline-answer">
                        <input
                          aria-label={`Answer: ${item.text}`}
                          value={inlineAnswers[item.id] ?? ""}
                          onChange={(event) => setInlineAnswers((values) => ({ ...values, [item.id]: event.target.value }))}
                          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void submitInlineAnswer(item); } }}
                          placeholder="Type an answer"
                        />
                        <button type="button" disabled={!(inlineAnswers[item.id] ?? "").trim()} onClick={() => void submitInlineAnswer(item)}>Save answer</button>
                      </div>
                    )}
                  </div>
                  <em>{item.status === "completed" ? "Answered" : item.status === "required" ? "To do" : item.status === "suggested" ? "Netify suggests" : "Added by you"}</em>
                </li>
              ))}
              {sectionQuestions.length === 0 && <li data-status="required"><span aria-hidden="true">○</span><div><strong>No questions recorded for this section yet.</strong></div><em>To do</em></li>}
            </ul>
            <div className="nf-guided-question-actions" role="group" aria-label="Extend this RFP section">
              <button type="button" onClick={() => openQuestionManager(true)}>＋ Add recommended question</button>
              <button type="button" onClick={() => openQuestionManager(true)}>Browse additional questions</button>
              <button type="button" onClick={() => openQuestionManager(false)}>＋ Add bespoke question</button>
              <button type="button" onClick={onImportQuestions}>Import Word, PDF, text or spreadsheet</button>
            </div>
            <details ref={questionManagerRef} className="nf-guided-add-question" open={questionManagerOpen} onToggle={(event) => setQuestionManagerOpen(event.currentTarget.open)}>
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
                  <button type="button" className="nf-guided-add-all" onClick={addAllSuggestedQuestions}><span>＋</span>Add all {suggestions.length} recommendations</button>
                  {suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => addSupplierQuestion(suggestion)}><span>＋</span>{suggestion}</button>)}
                </div>
              )}
            </details>
          </section>

        </section>
      </main>

      <aside className="nf-guided-document" aria-label="Your living RFP preview">
        <div className="nf-guided-document-head">
          <div><h2>{displayDocumentTitle}</h2><span>{progress.ready} of {progress.total} essential sections ready</span></div>
          <span>● &nbsp; DRAFT · NOT PUBLISHED</span>
          <button type="button" onClick={() => onSettingsOpenChange(true)}>⚙ &nbsp; Document settings</button>
        </div>
        {validationReport && (
          <section className="lpos-validation-report" aria-label="RFP validation report">
            <div className="lpos-validation-score"><strong>{validationReport.score}</strong><span>/100</span><small>{validationReport.label}</small></div>
            <div className="lpos-validation-body">
              <div className="lpos-validation-head"><div><strong>Netify procurement-readiness check</strong><span>{validationReport.wordCount.toLocaleString("en-GB")} words · {validationReport.questionCount} supplier questions · {validationReport.bank.totalQuestions}-question bank v{validationReport.bank.version}</span></div><b data-valid={validationReport.validBaseline}>{validationReport.validBaseline ? "Valid baseline" : "Baseline incomplete"}</b></div>
              <p className="lpos-validation-missing"><strong>{validationReport.missingRequirementCount}</strong> important requirement{validationReport.missingRequirementCount === 1 ? "" : "s"} missing or unclear</p>
              <div className="lpos-validation-sections">{validationReport.sections.map((section) => <button type="button" key={section.key} onClick={() => onSelectSection(section.key)}><span>{section.title}</span><i><b style={{ width: `${section.score}%` }} /></i><em>{section.score}%</em></button>)}</div>
              <div className="lpos-validation-findings"><div><strong>Most important gaps</strong>{[...validationReport.gaps, ...validationReport.comparabilityWarnings, ...validationReport.vendorNeutralityWarnings].slice(0, 4).map((gap) => <p key={gap}>• {gap}</p>)}</div><div><strong>Bank questions to consider</strong>{validationReport.recommendedQuestions.slice(0, 3).map((question) => <p key={question.id}><span>{question.id} · {question.category}</span>{question.text}</p>)}</div></div>
              <button type="button" className="lpos-validation-improve" onClick={() => { const weak = validationReport.sections.find((section) => section.score < 67); if (weak) onSelectSection(weak.key); openQuestionManager(true); }}>{validationReport.score >= 90 ? "Prepare this RFP for the Opportunity Board" : "Complete this RFP with Netify"} →</button>
            </div>
          </section>
        )}
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
            const coverage = SECTION_COVERAGE[row.key] ?? ["requirements", "supplier evidence", "response format", "evaluation", "buyer-specific questions"];
            return <li key={row.key} data-current={current} data-state={row.state}><button type="button" onClick={() => onSelectSection(row.key)}><b>{index + 1}</b><strong>{row.title}</strong><span><b>{row.detail}</b><small>{coverage.join(" · ")}</small></span><em>{row.state === "confirmed" ? "✓ Confirmed" : current ? "● Needs input" : row.state === "needs_decision" ? "● Needs decision" : "○ Later"}</em><i>⌄</i></button>{current && <div className="lpos-section-extensions"><button type="button" onClick={() => openQuestionManager(true)}>＋ Recommended questions</button><button type="button" onClick={() => openQuestionManager(false)}>＋ Bespoke question</button></div>}</li>;
          })}
        </ol>
        <div className="lpos-unlock"><span aria-hidden="true">{publishReachable ? "✓" : hasStarted ? "🔒" : "✦"}</span><div><strong>{publishReachable ? "Ready to publish" : hasStarted ? "Continue building your RFP" : "Start your RFP"}</strong><p>{publishReachable ? "Your essential baseline is complete. Publishing remains anonymous until you choose to unlock supplier identity." : hasStarted ? advisorMessage : "Nothing has been entered yet. Tell Netify your sector, site count, regions and what you are buying to begin."}</p></div><ul><li>Matched providers</li><li>Structured responses</li><li>Evidence pack</li><li>Pricing comparison</li></ul></div>
        <div className="lpos-document-actions"><button type="button" className="primary" onClick={publishReachable ? onPublish : onContinueBuilding}>{publishReachable ? "Review & publish" : "Continue to next requirement"} →</button><button type="button" onClick={onOpenDocument}>◉ &nbsp; Preview what suppliers receive</button></div>
      </aside>
      {settingsOpen && (
        <div className="lpos-settings-backdrop" role="presentation" onMouseDown={() => onSettingsOpenChange(false)}>
          <section className="lpos-settings-panel" role="dialog" aria-modal="true" aria-labelledby="lpos-document-settings" onMouseDown={(event) => event.stopPropagation()}>
            <div><p>Document preferences</p><button type="button" aria-label="Close document settings" onClick={() => onSettingsOpenChange(false)}>×</button></div>
            <h2 id="lpos-document-settings">Document settings</h2>
            <fieldset><legend>RFP depth</legend><button type="button" data-selected={rfpDepth === "short"} onClick={() => onRfpDepthChange("short")}><strong>Short RFP</strong><span>Minimum valid procurement brief</span></button><button type="button" data-selected={rfpDepth === "detailed"} onClick={() => onRfpDepthChange("detailed")}><strong>Detailed RFP</strong><span>Five populated questions per included section</span></button></fieldset>
            <fieldset><legend>Starting material</legend><button type="button" data-selected={entryMode === "build"} onClick={() => onEntryModeChange("build")}><strong>New requirements</strong><span>Build from your answers</span></button><button type="button" data-selected={entryMode === "check"} onClick={() => onEntryModeChange("check")}><strong>Existing RFP</strong><span>Check and improve an AI- or human-generated RFP</span></button></fieldset>
            <p className="lpos-settings-methodology">Recommendations are selected from Netify&apos;s governed 386-question procurement bank, including 43 extended SASE questions and sector-specific packs.</p>
            <button type="button" className="lpos-settings-done" onClick={() => onSettingsOpenChange(false)}>Save and close</button>
          </section>
        </div>
      )}
    </div>
  );
}
