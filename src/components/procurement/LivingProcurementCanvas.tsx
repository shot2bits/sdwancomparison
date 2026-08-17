"use client";

/**
 * Living Procurement OS · Phase 3 Stage A (14 Aug 2026) — "Visible
 * Production Projection". The one visible top-level surface for the
 * compiled `LivingProcurementDocument`: the cover (title/summary/
 * readiness), the fact-strip counts, the change ribbon, the Living
 * document / Supplier pack / Evaluation view-switch (Section 5's
 * "coordinated projections of ONE compiled object"), and the honest
 * Project memory strip.
 *
 * This component NEVER computes anything from raw facts itself — every
 * number and label here is read straight off the `LivingProcurementDocument`
 * the caller (`ProjectDesk.tsx`) already compiled via the pure
 * `compileProcurementDocument()`. That keeps this a presentational layer
 * only: no second fact store, no manually-synchronized copy of the
 * document, per the Stage A implementation-quality rule.
 *
 * Deliberate Stage A scope decision (see the checkpoint report's
 * deviations section): the brief's Section 5.5 also describes an
 * "Agent Layer" and an "Approval Inbox" rail. Neither is built here —
 * both would need `agent_missions`/`action_receipts` data that does not
 * exist until a later stage, and rendering an empty shell for either
 * would be exactly the "not permission to implement it prematurely"
 * the brief itself warns against. The "Project memory" strip at the
 * foot of this component is the honest alternative: it shows only
 * counts that are already real (standing/withdrawn facts, recorded
 * source turns, clause provenance) with no fabricated agent activity.
 */

import { useRef } from "react";
import type { LivingProcurementDocument, ProcurementClause } from "@/lib/workspace/procurement-document";
import type { NextQuestion } from "@/lib/workspace/procurement-next-questions";
import type { OutlineRow } from "@/lib/workspace/procurement-outline";
import { outlineStateLabel } from "@/lib/workspace/procurement-outline";
import ProcurementArchitecture from "./ProcurementArchitecture";
import ProcurementClauseList from "./ProcurementClauseList";
import SupplierPackView from "./SupplierPackView";
import EvaluationView from "./EvaluationView";

export type NextQuestionCard = {
  nq: NextQuestion;
  buttons: Array<{ label: string; onClick: () => void }>;
  hint: string | null;
};

/** Hotfix (Robert, 15 Aug 2026), post-f33f103 production verification: an
 *  accepted sector suggestion, resolved into a card by ProjectDesk.tsx
 *  the same way `nextQuestionCards` already is -- this component reads
 *  `label`/`reason` straight off the projection and never recomputes
 *  anything, per this file's own presentational-layer rule (see its
 *  header comment). */
export type AcceptedSuggestionCard = {
  id: string;
  label: string;
  reason: string;
  onUndo: () => void;
};

export type ProcurementView = "document" | "supplier" | "evaluation";

const VIEW_ORDER: ProcurementView[] = ["document", "supplier", "evaluation"];
const tabId = (v: ProcurementView) => `ldoc-tab-${v}`;
const panelId = (v: ProcurementView) => `ldoc-panel-${v}`;

const mono: React.CSSProperties = { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' };

export default function LivingProcurementCanvas({
  document,
  view,
  onViewChange,
  factsKept,
  factsStruck,
  sourceTurnCount,
  nextQuestionCards,
  outline,
  materialDecisionsRemaining,
  acceptedSuggestionCards,
  acceptedSuggestionsTitle,
}: {
  document: LivingProcurementDocument;
  view: ProcurementView;
  onViewChange: (view: ProcurementView) => void;
  factsKept: number;
  factsStruck: number;
  sourceTurnCount: number;
  /** Living Procurement UK Decision-Maker Blueprint (Robert, 15 Aug
   *  2026): the top-3 prioritised next decisions, already resolved into
   *  clickable buttons by ProjectDesk.tsx (see that file's own comment
   *  for why the resolution happens there, not here) -- this component
   *  stays presentational, reading `nq`'s own id/question/impact/source
   *  straight off the projection, never recomputing anything. */
  nextQuestionCards?: NextQuestionCard[];
  /** The section outline (implementation step 10) -- Confirmed/Needs
   *  input/Needs decision/Netify suggested/Later, already computed. */
  outline?: OutlineRow[];
  /** The readiness reason line's own count -- rendered beside the
   *  readiness ring so "N material decisions remain" is never a
   *  disconnected claim from the ring's own score. */
  materialDecisionsRemaining?: number;
  /** Hotfix (Robert, 15 Aug 2026): accepted sector suggestions the buyer
   *  can still see and reverse, instead of an acceptance silently
   *  vanishing from the UI the instant it compiles. Rendered directly
   *  beneath the section outline, under the SAME title as the outline's
   *  own sector row (`acceptedSuggestionsTitle`, e.g. "Manufacturing and
   *  OT") so it reads as part of that named section rather than a
   *  disconnected new surface. */
  acceptedSuggestionCards?: AcceptedSuggestionCard[];
  acceptedSuggestionsTitle?: string | null;
}) {
  const changedClauseIds = new Set<string>([...document.changeSet.clauses.added, ...document.changeSet.clauses.updated]);
  const gateChangedIds = new Set<string>(document.changeSet.gates.added);
  const hasChange =
    document.version > 1 &&
    (document.changeSet.clauses.added.length > 0 ||
      document.changeSet.clauses.updated.length > 0 ||
      document.changeSet.clauses.removed.length > 0 ||
      document.changeSet.gates.added.length > 0 ||
      document.changeSet.gates.removed.length > 0);
  const readinessColor = document.readiness.score >= 70 ? "#256B3E" : document.readiness.score >= 40 ? "#B4650B" : "#A3A099";
  const circumference = 2 * Math.PI * 27;
  const tabRefs = useRef<Partial<Record<ProcurementView, HTMLButtonElement | null>>>({});

  /** Full WAI-ARIA tabs keyboard pattern (correction round, Robert, 14
   *  Aug 2026, item 9): Left/Right move focus AND activate the adjacent
   *  tab (wrapping at the ends), Home/End jump to the first/last tab.
   *  Focus always moves with selection here (a roving tabindex where the
   *  selected tab is the only one in the tab order — see the `tabIndex`
   *  below), so there is never a focused-but-unselected tab to leave
   *  behind. */
  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, current: ProcurementView) => {
    const idx = VIEW_ORDER.indexOf(current);
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % VIEW_ORDER.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + VIEW_ORDER.length) % VIEW_ORDER.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = VIEW_ORDER.length - 1;
    if (nextIdx === null) return;
    e.preventDefault();
    const next = VIEW_ORDER[nextIdx];
    onViewChange(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section aria-label="Living procurement document" className="border-t border-[#EFECE5] pt-[22px]">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] uppercase text-[#B4650B]" style={{ ...mono, letterSpacing: "0.11em" }}>
            Living procurement document · v{document.version}
          </div>
          <h2 className="mb-1.5 mt-2.5 text-[24px] font-semibold leading-[1.2] sm:text-[27px]" style={{ letterSpacing: "-0.025em" }}>
            {document.title}
          </h2>
          <p className="m-0 max-w-[48em] text-[13.5px] leading-[1.6] text-[#8C8A85]">{document.summary}</p>
        </div>

        <div
          className="flex flex-none flex-col items-center gap-1"
          role="img"
          aria-label={`Readiness ${document.readiness.score} percent, ${document.readiness.label}`}
        >
          <svg width="60" height="60" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="27" fill="none" stroke="#EFECE5" strokeWidth="7" />
            <circle
              cx="32"
              cy="32"
              r="27"
              fill="none"
              stroke={readinessColor}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${(Math.max(0, Math.min(100, document.readiness.score)) / 100) * circumference} ${circumference}`}
              transform="rotate(-90 32 32)"
            />
            <text x="32" y="37" textAnchor="middle" fontSize="15" fontWeight={600} fill="#141414">
              {document.readiness.score}
            </text>
          </svg>
          <span className="text-[10px] uppercase text-[#8C8A85]" style={{ ...mono, letterSpacing: "0.07em" }}>
            {document.readiness.label}
          </span>
        </div>
      </div>

      {typeof materialDecisionsRemaining === "number" && (
        <p className="m-0 mt-2 max-w-[48em] text-[13px] leading-[1.6] text-[#8C8A85]">
          {materialDecisionsRemaining > 0
            ? `Core scope captured. ${materialDecisionsRemaining} material decision${materialDecisionsRemaining === 1 ? "" : "s"} remain before suppliers can price consistently.`
            : "Every material decision this document tracks is resolved or deliberately accepted open."}
        </p>
      )}

      {hasChange && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-full border border-[#F5D9A8] bg-[#FFFCF3] px-4 py-2 text-[12.5px] text-[#8A4D08]">
          <span className="inline-block h-[6px] w-[6px] flex-none rounded-full bg-[#F5A21B]" aria-hidden="true" />
          {changeSummaryLine(document)}
        </div>
      )}

      {nextQuestionCards && nextQuestionCards.length > 0 && (
        <NextQuestions cards={nextQuestionCards} />
      )}

      {acceptedSuggestionCards && acceptedSuggestionCards.length > 0 && (
        <AcceptedSuggestions cards={acceptedSuggestionCards} title={acceptedSuggestionsTitle ?? "Netify suggestions"} />
      )}

      {outline && outline.length > 0 && <SectionOutline rows={outline} />}

      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="Requirements" value={document.counts.requirements} />
        <StatTile label="Supplier questions" value={document.counts.questions} />
        <StatTile label="Pass/fail gates" value={document.counts.gates} />
        <StatTile label="Open decisions" value={document.counts.decisions} warn={document.counts.decisions > 0} />
      </div>

      <div role="tablist" aria-label="Document projection" className="mt-7 flex gap-1 overflow-x-auto border-b border-[#EFECE5]" style={{ scrollbarWidth: "none" }}>
        {(
          [
            ["document", "Living document"],
            ["supplier", document.counts.questions ? `Supplier pack · ${document.counts.questions}` : "Supplier pack"],
            ["evaluation", "Evaluation"],
          ] as [ProcurementView, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            ref={(el) => { tabRefs.current[key] = el; }}
            id={tabId(key)}
            type="button"
            role="tab"
            aria-selected={view === key}
            aria-controls={panelId(key)}
            tabIndex={view === key ? 0 : -1}
            onClick={() => onViewChange(key)}
            onKeyDown={(e) => onTabKeyDown(e, key)}
            className="flex-none cursor-pointer border-0 border-b-2 bg-transparent px-3 py-2.5 text-[13.5px] font-medium"
            style={{ borderBottomColor: view === key ? "#F5A21B" : "transparent", color: view === key ? "#141414" : "#8C8A85" }}
          >
            {label}
          </button>
        ))}
      </div>

      <div id={panelId(view)} role="tabpanel" aria-labelledby={tabId(view)} tabIndex={0} className="pt-2">
        {view === "document" && (
          <>
            <ProcurementArchitecture architecture={document.architecture} />
            <ProcurementClauseList clauses={document.clauses} changedClauseIds={changedClauseIds} />
            <OpenDecisions decisions={document.openDecisions} />
          </>
        )}
        {view === "supplier" && <SupplierPackView groups={document.responseGroups} />}
        {view === "evaluation" && <EvaluationView evaluation={document.evaluation} gateChangedIds={gateChangedIds} />}
      </div>

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-[#EFECE5] pt-4 text-[11px] text-[#A3A099]" style={mono}>
        <span className="uppercase" style={{ letterSpacing: "0.07em" }}>Project memory</span>
        <span>
          {factsKept} standing fact{factsKept === 1 ? "" : "s"}
          {factsStruck ? `, ${factsStruck} withdrawn` : ""}
        </span>
        <span>
          {sourceTurnCount} recorded turn{sourceTurnCount === 1 ? "" : "s"}
        </span>
        {/* Stage A closure pass (Robert, 14 Aug 2026), item 3: this line
            was labelled bare "your words" -- `document.provenance.buyer`
            is genuinely a count of COMPILED CLAUSES attributed to buyer
            wording, not of retained buyer-authored source items, so a
            turn whose entire content is an unresolved conflict (no clause
            compiles from it at all, by design -- see
            detectSupplierStrategyConflict()'s own comment,
            procurement-templates.ts) correctly produces buyer=0 here
            while a real buyer sentence is still sitting one span up, in
            `sourceTurnCount`. "0 your words" read as a false claim that
            nothing was received from the buyer at all. Renamed precisely
            instead of changing what this number counts (clause
            provenance is a real, separately useful metric -- see the
            Evaluation view's own use of the same split) -- "0 requirement
            clauses from your words" is accurate even when
            `sourceTurnCount` is simultaneously nonzero, and never
            contradicts it. */}
        <span>
          {document.provenance.buyer} requirement clause{document.provenance.buyer === 1 ? "" : "s"} from your words · {document.provenance.netify} from netify · {document.provenance.sector} from sector rule
          {document.provenance.sector === 1 ? "" : "s"}
        </span>
      </div>
    </section>
  );
}

const IMPACT_LABEL: Record<string, string> = {
  eligibility: "Affects who can bid",
  price: "Affects pricing",
  architecture: "Affects architecture",
  compliance: "Affects compliance",
  delivery: "Affects delivery",
  evaluation: "Affects evaluation",
  risk: "Affects resilience/risk",
};

/** Living Procurement UK Decision-Maker Blueprint (Robert, 15 Aug 2026):
 *  "Show no more than three prioritised next decisions in the primary
 *  flow" -- the caller already caps this at three; this component just
 *  renders whatever it is given, with each card's own stable id, impact
 *  labels and answer buttons. A `governedSuggestion` card is labelled
 *  distinctly ("Netify suggests") so an accept click can never read as a
 *  buyer-stated fact -- see procurement-next-questions.ts's own header
 *  comment for why that distinction is load-bearing, not decorative.
 *  Mobile-safe: cards stack full-width under 390px (no fixed min-widths
 *  wider than the viewport, buttons wrap). */
/**
 * 2030 shell reset (16 Aug 2026): exported so ProjectDesk.tsx can render
 * these cards inside the binding blueprint's sticky Mission Rail (right,
 * ~30%) instead of inline underneath the document header. `bare`, when
 * true, drops this component's own "Best next decisions" heading and
 * top border — the rail supplies its own "Mission control" heading — so
 * the same card markup (and the exact same `onClick` handlers ProjectDesk
 * already wires up) renders correctly in both places without forking the
 * card JSX. LivingProcurementCanvas itself no longer renders these cards
 * inline once a caller has moved them to the rail (see that component's
 * own doc comment on `nextQuestionCards`).
 */
export function NextQuestions({ cards, bare = false }: { cards: NextQuestionCard[]; bare?: boolean }) {
  return (
    <div className={bare ? "" : "mt-5 border-t border-[#EFECE5] pt-[18px]"}>
      {!bare && (
        <div className="mb-2.5 flex items-baseline gap-[11px]">
          <span className="text-[11px] uppercase text-[#33302C]" style={{ ...mono, letterSpacing: "0.1em" }}>
            Best next decisions
          </span>
          <span className="min-w-0 flex-1 text-[12.5px] text-[#A3A099]">answering moves this document closer to publish</span>
        </div>
      )}
      <div className={bare ? "flex flex-col gap-3" : "grid grid-cols-1 gap-2.5 sm:grid-cols-3"}>
        {cards.map(({ nq, buttons, hint }) => (
          <div key={nq.id} className="flex min-w-0 flex-col gap-2 rounded-[10px] border border-[#EFECE5] p-3.5" style={{ background: nq.governedSuggestion ? "#FBF9FF" : "#fff" }}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-[4px] px-[6px] py-[2px] text-[9.5px] uppercase" style={{ ...mono, letterSpacing: "0.06em", background: nq.governedSuggestion ? "#EDE6FB" : "#F4F2ED", color: nq.governedSuggestion ? "#5B3E9C" : "#8C8A85" }}>
                {nq.governedSuggestion ? "Netify suggests · optional" : "Open decision"}
              </span>
              <span className="text-[9.5px] text-[#B8B5AD]" style={mono} title="Stable question id">
                {nq.id}
              </span>
            </div>
            <div className="text-[13.5px] leading-[1.5] text-[#141414]">{nq.question}</div>
            {/* defect 6 (correction pass, 15 Aug 2026): every governed
                suggestion shows its own short "why Netify is raising this"
                reason, straight from the sector pack -- never left as a
                bare label the buyer has to take on faith. */}
            {nq.reason && <div className="text-[12px] leading-[1.5] text-[#8C8A85]">{nq.reason}</div>}
            {nq.conflictReason && <div className="text-[12px] leading-[1.5] text-[#8A2E1F]">{nq.conflictReason}</div>}
            {nq.impact.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {nq.impact.map((i) => (
                  <span key={i} className="rounded-[4px] bg-[#F4F2ED] px-[6px] py-[2px] text-[9.5px] uppercase text-[#8C8A85]" style={{ ...mono, letterSpacing: "0.05em" }}>
                    {IMPACT_LABEL[i] ?? i}
                  </span>
                ))}
              </div>
            )}
            {buttons.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {buttons.map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    onClick={b.onClick}
                    className="cursor-pointer rounded-[6px] border border-[#E8E4DC] bg-transparent px-2.5 py-1.5 text-[12px] text-[#141414] hover:border-[#D8D4CA]"
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            ) : hint ? (
              <div className="text-[12px] text-[#A3A099]">{hint}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Hotfix (Robert, 15 Aug 2026), post-f33f103 production verification:
 *  "This is a real buyer-facing gap ... show accepted suggestions there
 *  with their source, status and reversal action instead of making them
 *  disappear entirely." Deliberately its own block, styled to match
 *  `NextQuestions` above (same card shell, badge and button treatment)
 *  rather than folded into `SectionOutline`, which is explicitly a
 *  plain, non-interactive list per its own header comment -- this one
 *  needs a real click target, `NextQuestions` already has one, so this
 *  is that pattern applied to a card that has already been answered
 *  rather than one still open. The green "Accepted" badge reuses
 *  `SectionOutline`'s own `confirmed` colour pair for visual continuity
 *  with the rest of the outline. */
function AcceptedSuggestions({ cards, title }: { cards: AcceptedSuggestionCard[]; title: string }) {
  return (
    <div className="mt-5 border-t border-[#EFECE5] pt-[18px]">
      <div className="mb-2.5 flex items-baseline gap-[11px]">
        <span className="text-[11px] uppercase text-[#33302C]" style={{ ...mono, letterSpacing: "0.1em" }}>
          {title} · accepted
        </span>
        <span className="min-w-0 flex-1 text-[12.5px] text-[#A3A099]">
          Netify suggested these; you accepted them. Each compiles a governed clause until reversed.
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.id} className="flex min-w-0 flex-col gap-2 rounded-[10px] border border-[#EFECE5] bg-white p-3.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-[4px] px-[6px] py-[2px] text-[9.5px] uppercase" style={{ ...mono, letterSpacing: "0.06em", background: "#EAF4EC", color: "#256B3E" }}>
                Accepted
              </span>
              <span className="text-[9.5px] text-[#B8B5AD]" style={mono} title="Stable suggestion id">
                {c.id}
              </span>
            </div>
            <div className="text-[13.5px] leading-[1.5] text-[#141414]">{c.label}</div>
            <div className="text-[12px] leading-[1.5] text-[#8C8A85]">{c.reason}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={c.onUndo}
                className="cursor-pointer rounded-[6px] border border-[#E8E4DC] bg-transparent px-2.5 py-1.5 text-[12px] text-[#141414] hover:border-[#D8D4CA]"
              >
                Mark as not needed
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const OUTLINE_STATE_STYLE: Record<string, { bg: string; color: string }> = {
  confirmed: { bg: "#EAF4EC", color: "#256B3E" },
  needs_input: { bg: "#F4F2ED", color: "#8C8A85" },
  needs_decision: { bg: "#FFF1DE", color: "#B4650B" },
  netify_suggested: { bg: "#EDE6FB", color: "#5B3E9C" },
  later: { bg: "#F4F2ED", color: "#A3A099" },
};

/** The document outline (implementation step 10): "which relevant
 *  sections are confirmed/incomplete/unresolved/suggested/deliberately
 *  deferred" -- one compact row per section, never the old bare
 *  "Project details / edit source facts" wording alone. Deliberately a
 *  plain list, not a second interactive surface: the buttons that
 *  actually resolve a gap live in the NextQuestions cards above and in
 *  the existing Project details sheet, so this never duplicates a click
 *  target with a different, easier-to-miss behaviour. */
function SectionOutline({ rows }: { rows: OutlineRow[] }) {
  return (
    <div className="mt-5 border-t border-[#EFECE5] pt-[18px] pb-1">
      <div className="mb-2.5 text-[11px] uppercase text-[#33302C]" style={{ ...mono, letterSpacing: "0.1em" }}>
        Document outline
      </div>
      <div className="flex flex-col gap-[1px] overflow-hidden rounded-[10px] border border-[#EFECE5]">
        {rows.map((r) => {
          const st = OUTLINE_STATE_STYLE[r.state] ?? OUTLINE_STATE_STYLE.later;
          return (
            <div key={r.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-white px-3.5 py-2.5 sm:flex-nowrap">
              <span className="w-full min-w-0 text-[13px] text-[#141414] sm:w-[190px] sm:flex-none">{r.title}</span>
              <span className="min-w-0 flex-1 text-[12px] text-[#8C8A85]">{r.detail}</span>
              <span
                className="flex-none rounded-[4px] px-[6px] py-[2px] text-[9.5px] uppercase"
                style={{ ...mono, letterSpacing: "0.05em", background: st.bg, color: st.color }}
              >
                {outlineStateLabel(r.state)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatTile({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-[10px] border border-[#EFECE5] px-3.5 py-3">
      <div className="text-[19px] font-semibold leading-none" style={{ ...mono, color: warn && value > 0 ? "#B4650B" : "#141414" }}>
        {value}
      </div>
      <div className="mt-1 text-[10.5px] uppercase text-[#8C8A85]" style={{ ...mono, letterSpacing: "0.06em" }}>
        {label}
      </div>
    </div>
  );
}

function changeSummaryLine(document: LivingProcurementDocument): string {
  const cs = document.changeSet;
  const parts: string[] = [];
  if (cs.clauses.added.length) parts.push(`${cs.clauses.added.length} requirement${cs.clauses.added.length === 1 ? "" : "s"} added`);
  if (cs.clauses.updated.length) parts.push(`${cs.clauses.updated.length} updated in place`);
  if (cs.clauses.removed.length) parts.push(`${cs.clauses.removed.length} removed`);
  if (cs.gates.added.length) parts.push(`${cs.gates.added.length} gate${cs.gates.added.length === 1 ? "" : "s"} added`);
  if (cs.gates.removed.length) parts.push(`${cs.gates.removed.length} gate${cs.gates.removed.length === 1 ? "" : "s"} dropped`);
  return parts.length ? `Since your last change: ${parts.join(", ")}.` : "Updated just now.";
}

function OpenDecisions({ decisions }: { decisions: LivingProcurementDocument["openDecisions"] }) {
  if (!decisions.length) return null;
  return (
    <div className="border-t border-[#EFECE5] pb-4 pt-[18px]">
      <div className="mb-2 flex items-baseline gap-[11px]">
        <span className="text-[11px] uppercase text-[#33302C]" style={{ ...mono, letterSpacing: "0.1em" }}>
          Open decisions
        </span>
        <span className="min-w-0 flex-1 text-[12.5px] text-[#A3A099]">nothing here becomes a gate or requirement until you decide</span>
        <span className="flex-none text-[11px] text-[#A3A099]" style={mono}>{decisions.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {decisions.map((d) => (
          <div
            key={d.id}
            className="flex items-start gap-3 rounded-[10px] border px-3.5 py-3"
            style={{ borderColor: d.conflict ? "#F2C1B8" : "#EFECE5", background: d.conflict ? "#FFF6F4" : "transparent" }}
          >
            <span
              className="mt-[4px] inline-block h-[7px] w-[7px] flex-none rounded-full"
              style={{ background: d.conflict ? "#B42318" : "#A3A099" }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] leading-[1.5] text-[#141414]">{d.question}</div>
              {d.conflict && d.conflictReason && <div className="mt-1 text-[12px] leading-[1.5] text-[#8A2E1F]">{d.conflictReason}</div>}
              {d.impact.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {d.impact.map((i) => (
                    <span key={i} className="rounded-[4px] bg-[#F4F2ED] px-[6px] py-[2px] text-[9.5px] uppercase text-[#8C8A85]" style={{ ...mono, letterSpacing: "0.06em" }}>
                      {i}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Re-exported so ClauseRow-style consumers elsewhere can share the exact
 *  origin-label wording without redefining it — not currently imported
 *  outside this module, but kept exported rather than duplicated the
 *  moment a second consumer needs it (ProcurementClauseList defines its
 *  own copy today; see that file). */
export function originLabel(origin: ProcurementClause["origin"]): string {
  switch (origin) {
    case "buyer":
      return "your words";
    case "buyer_override":
      return "your override";
    case "netify":
      return "netify derived";
    case "sector":
      return "sector rule";
    default:
      return origin;
  }
}
