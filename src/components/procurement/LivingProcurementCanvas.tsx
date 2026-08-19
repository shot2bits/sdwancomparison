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
import { MATERIAL_IMPACTS, type NextQuestion } from "@/lib/workspace/procurement-next-questions";
import type { OutlineRow } from "@/lib/workspace/procurement-outline";
import { outlineStateLabel } from "@/lib/workspace/procurement-outline";
import ProcurementArchitecture from "./ProcurementArchitecture";
import ProcurementClauseList from "./ProcurementClauseList";
import SupplierPackView from "./SupplierPackView";
import EvaluationView from "./EvaluationView";
import { ProvenanceTag } from "./ProvenanceTag";

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

const mono: React.CSSProperties = { fontFamily: "var(--nf-font-mono)" };

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
  // 2030 palette (18 Aug 2026): emerald = verified/ready, orange = still in
  // progress/needs action, ink-300 = not yet started -- the same semantic
  // roles the approved prototype's own palette assigns those two colours
  // (index.html tokens), applied here to the existing real readiness score
  // rather than inventing a new scoring concept.
  // Contrast fix (verification pass, 18 Aug 2026): the low-score ring
  // colour (#a7a4a0) measured 2.65:1 on white, below WCAG 1.4.11's 3:1
  // threshold for meaningful non-text UI graphics (this ring conveys real
  // status, not decoration) -- #83807b is the same neutral grey, darkened
  // just enough to clear 3:1 (3.05:1).
  const readinessColor = document.readiness.score >= 70 ? "#1e4e22" : document.readiness.score >= 40 ? "#c66000" : "#83807b";
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
    <section aria-label="Living procurement document" className="border-t border-[#e3e1de] pt-[22px]">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <div style={{ ...mono, fontSize: "11px", letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--nf-orange, #832f00)", fontWeight: 600 }}>
            Living procurement document · v{document.version}
          </div>
          {/* Typography role (2030 visual pass, 18 Aug 2026): the document's
              own title now carries the approved prototype's editorial-serif
              doc-title role (index.html: h1.doc-title/h2.doc-title), the
              same role CollapsibleHero's H1 already picked up. Only the
              family changes -- size/weight/spacing are this component's
              own existing, tuned values. */}
          <h2 className="mb-1.5 mt-2.5 text-[24px] font-semibold leading-[1.2] sm:text-[27px]" style={{ fontFamily: "var(--nf-font-serif)", letterSpacing: "-0.015em" }}>
            {document.title}
          </h2>
          <p className="m-0 max-w-[48em] text-[13.5px] leading-[1.6] text-[#66635e]">{document.summary}</p>
        </div>

        <div
          className="flex flex-none flex-col items-center gap-1"
          role="img"
          aria-label={`Readiness ${document.readiness.score} percent, ${document.readiness.label}`}
        >
          <svg width="60" height="60" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="27" fill="none" stroke="#e3e1de" strokeWidth="7" />
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
            <text x="32" y="37" textAnchor="middle" fontSize="15" fontWeight={600} fill="#110f0d">
              {document.readiness.score}
            </text>
          </svg>
          <span className="text-[10px] uppercase text-[#66635e]" style={{ ...mono, letterSpacing: "0.07em" }}>
            {document.readiness.label}
          </span>
        </div>
      </div>

      {typeof materialDecisionsRemaining === "number" && (
        <p className="m-0 mt-2 max-w-[48em] text-[13px] leading-[1.6] text-[#66635e]">
          {materialDecisionsRemaining > 0
            ? `Core scope captured. ${materialDecisionsRemaining} material decision${materialDecisionsRemaining === 1 ? "" : "s"} remain before suppliers can price consistently.`
            : "Every material decision this document tracks is resolved or deliberately accepted open."}
        </p>
      )}

      {/* "What changed" (Constitution correction, 18 Aug 2026): this
          ribbon IS the real equivalent of the approved prototype's
          state-2 "value created" box (index.html renderDiff(),
          `.value-box`) -- same underlying data (document.changeSet), no
          change to that. What changed is the colour and the eyebrow
          label: the newly-attached, binding "Netify 2030 Living Document
          Aesthetic Constitution" (18 Aug 2026) reassigns this exact box
          to the palette's "Confirmed = Evidence green" role, and its own
          mockups (image2/image3) render it as a light-emerald box under
          an uppercase "WHAT CHANGED" eyebrow, not the orange "Value
          created" label the original prototype used -- this is Netify's
          own confirmed, server-computed delta (the document actually
          changed), which is exactly the "confirmed" role the green tokens
          are reserved for, not a suggestion or open decision (those stay
          orange elsewhere on this canvas, unchanged). The `ProvenanceTag
          kind="intel"` chip is dropped to match the mockup's own box
          exactly (no chip shown there); the underlying event is still a
          Netify-computed summary, which the eyebrow label itself already
          says plainly. */}
      {hasChange && (
        <div className="mt-4 rounded-[4px] border px-4 py-3" style={{ borderColor: "var(--nf-emerald-soft-border, #91bb91)", background: "var(--nf-emerald-soft, #d9f4d9)" }}>
          <span style={{ ...mono, fontSize: "10.5px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--nf-emerald, #1e4e22)", fontWeight: 700 }}>
            What changed
          </span>
          <p className="m-0 mt-1 text-[13.5px] font-semibold leading-[1.4]" style={{ color: "var(--nf-ink-900, #1c1a18)" }}>
            {changeSummaryLine(document)}
          </p>
        </div>
      )}

      {nextQuestionCards && nextQuestionCards.length > 0 && (
        <NextQuestions cards={nextQuestionCards} />
      )}

      {acceptedSuggestionCards && acceptedSuggestionCards.length > 0 && (
        <AcceptedSuggestions cards={acceptedSuggestionCards} title={acceptedSuggestionsTitle ?? "Netify suggestions"} />
      )}

      {outline && outline.length > 0 && <SectionOutline rows={outline} />}

      {/* Lifecycle-consistency closure pass (18 Aug 2026), correction C:
          this was labelled "Open decisions" -- the SAME word Mission
          Control uses for `materialDecisionsRemaining` (compiler
          openDecisions + earned questions + sector suggestions, ranked
          and filtered to blocking-only), while this tile shows the raw,
          unfiltered `document.counts.decisions` (every open decision the
          compiler sees, sector suggestions included, no material-impact
          filter). The two numbers can legitimately differ -- this one is
          strictly a superset -- so sharing a label invited exactly the
          "which number is real" confusion this pass exists to remove.
          "Document gaps" names what this genuinely is (every unresolved
          field in the compiled document) without claiming to be the
          blocking-decision count Mission Control and the publish panel
          both now share. Same real `document.counts.decisions` value,
          only the label changed. */}
      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="Requirements" value={document.counts.requirements} />
        <StatTile label="Supplier questions" value={document.counts.questions} />
        <StatTile label="Pass/fail gates" value={document.counts.gates} />
        <StatTile label="Document gaps" value={document.counts.decisions} warn={document.counts.decisions > 0} />
      </div>

      <div role="tablist" aria-label="Document projection" className="mt-7 flex gap-1 overflow-x-auto border-b border-[#e3e1de]" style={{ scrollbarWidth: "none" }}>
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
            style={{ borderBottomColor: view === key ? "#c66000" : "transparent", color: view === key ? "#110f0d" : "#66635e" }}
          >
            {label}
          </button>
        ))}
      </div>

      <div id={panelId(view)} role="tabpanel" aria-labelledby={tabId(view)} tabIndex={0} className="pt-2">
        {view === "document" && (
          <>
            <ProcurementArchitecture architecture={document.architecture} deltaCaption={hasChange ? architectureDeltaCaption(document) : null} />
            <ProcurementClauseList clauses={document.clauses} changedClauseIds={changedClauseIds} />
            <OpenDecisions decisions={document.openDecisions} />
          </>
        )}
        {view === "supplier" && <SupplierPackView groups={document.responseGroups} />}
        {view === "evaluation" && <EvaluationView evaluation={document.evaluation} gateChangedIds={gateChangedIds} />}
      </div>

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-[#e3e1de] pt-4 text-[11px] text-[#66635e]" style={mono}>
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
/** `dark` (2030 visual pass, 18 Aug 2026): applied only when `bare` is
 *  also true -- the aside/Mission-Control rail in ProjectDesk.tsx is the
 *  only call site that ever passes `bare`, and it now wraps this in the
 *  approved prototype's dark `.card.dark` panel (see that call site's own
 *  comment), so its decision cards need the matching dark `.decision`
 *  treatment (index.html: bg #2b2825, border #2b2825, orange hover) in
 *  place of the light card styling. The non-bare, non-dark path (used
 *  when this renders inline inside the canvas rather than the rail) is
 *  unchanged, since that path isn't reachable in production today
 *  (ProjectDesk.tsx passes `nextQuestionCards={undefined}` to suppress
 *  it) but is left correct in case it's ever re-enabled. */
export function NextQuestions({ cards, bare = false, dark = false }: { cards: NextQuestionCard[]; bare?: boolean; dark?: boolean }) {
  return (
    <div className={bare ? "" : "mt-5 border-t border-[#e3e1de] pt-[18px]"}>
      {!bare && (
        <div className="mb-2.5 flex items-baseline gap-[11px]">
          <span className="text-[11px] uppercase text-[#1c1a18]" style={{ ...mono, letterSpacing: "0.1em" }}>
            Best next decisions
          </span>
          <span className="min-w-0 flex-1 text-[12.5px] text-[#66635e]">answering moves this document closer to publish</span>
        </div>
      )}
      <div className={bare ? "flex flex-col gap-3" : "grid grid-cols-1 gap-2.5 sm:grid-cols-3"}>
        {cards.map(({ nq, buttons, hint }, i) => (
          <div
            key={nq.id}
            // 2030 shell reset, mobile correction (17 Aug 2026): the
            // blueprint's binding mobile rule is ONE decision card
            // readable above the fold, not three -- three full cards
            // stacked in `bare` mode ran to 1000px+ tall on a 390px
            // viewport, burying the living document below a wall of
            // Mission Control before a buyer ever saw it (measured via
            // Playwright: aside height 1025px on a 844px-tall viewport).
            // Cards after the first stay in the DOM (so "load more"/
            // desktop parity needs no extra fetch) but are hidden below
            // `lg`, where the rail is no longer sticky-sidebar-sized and
            // instead sits inline above the document.
            className={`flex min-w-0 flex-col gap-2 rounded-[4px] border p-3.5 ${bare && i > 0 ? "hidden lg:flex" : ""}`}
            style={
              dark
                ? { background: "#2b2825", borderColor: "#2b2825" }
                : { background: nq.governedSuggestion ? "#eee6ff" : "#fff", borderColor: "#e3e1de" }
            }
          >
            {/* Honesty fix (Robert, 18 Aug 2026 correction, "state labels,
                readiness values, visible decisions and document content
                must always agree"): `nq.impact` is the SAME MATERIAL_IMPACTS
                classification `materialDecisionsRemaining` (Mission
                Control's own count) is built from -- a card badged "Open
                decision" used to render unconditionally whenever a
                candidate existed, even a delivery/evaluation-only earned
                question that materialDecisionCount() correctly does not
                count. That let "Nothing material outstanding" render
                directly above a card whose own badge implied an
                outstanding open decision. isMaterial below is computed
                from the exact same field, so the badge and the heading
                can never disagree again. */}
            {(() => {
              const isMaterial = !nq.governedSuggestion && nq.impact.some((i) => (MATERIAL_IMPACTS as readonly string[]).includes(i));
              const label = isMaterial ? "Open decision" : nq.governedSuggestion ? "Netify suggests · optional" : "Optional · not required to publish";
              return (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className="rounded-[4px] px-[6px] py-[2px] text-[9.5px] uppercase"
                    style={
                      dark
                        ? isMaterial
                          ? { ...mono, letterSpacing: "0.06em", background: "var(--nf-orange-strong, #832f00)", color: "#fff" }
                          : { ...mono, letterSpacing: "0.06em", background: "#2b2825", color: "#d0cdc9" }
                        : { ...mono, letterSpacing: "0.06em", background: nq.governedSuggestion ? "#eee6ff" : isMaterial ? "#e3e1de" : "#e3e1de", color: nq.governedSuggestion ? "#ae96da" : isMaterial ? "#66635e" : "#66635e" }
                    }
                  >
                    {label}
                  </span>
                  {/* Contrast fix (verification pass, 18 Aug 2026): both
                      sides of this id label failed WCAG AA on their own
                      background (#66635e on this card's #2b2825 measured
                      3.07:1; #a7a4a0 on the light card's white/#eee6ff
                      measured under 2:1) -- #bab7b3/#66635e are the same
                      hues moved just far enough to clear 4.5:1 on each. */}
                  <span className="text-[9.5px]" style={{ ...mono, color: dark ? "#bab7b3" : "#66635e" }} title="Stable question id">
                    {nq.id}
                  </span>
                </div>
              );
            })()}
            <div className="text-[13.5px] leading-[1.5]" style={{ color: dark ? "#fff" : "#110f0d", fontWeight: dark ? 600 : 400 }}>{nq.question}</div>
            {/* defect 6 (correction pass, 15 Aug 2026): every governed
                suggestion shows its own short "why Netify is raising this"
                reason, straight from the sector pack -- never left as a
                bare label the buyer has to take on faith. */}
            {nq.reason && <div className="text-[12px] leading-[1.5]" style={{ color: dark ? "#d0cdc9" : "#66635e" }}>{nq.reason}</div>}
            {nq.conflictReason && <div className="text-[12px] leading-[1.5]" style={{ color: dark ? "#eb827b" : "#8d1a1e" }}>{nq.conflictReason}</div>}
            {nq.impact.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {nq.impact.map((i) => (
                  <span
                    key={i}
                    className="rounded-[4px] px-[6px] py-[2px] text-[9.5px] uppercase"
                    style={dark ? { ...mono, letterSpacing: "0.05em", background: "#2b2825", color: "#d0cdc9" } : { ...mono, letterSpacing: "0.05em", background: "#e3e1de", color: "#66635e" }}
                  >
                    {IMPACT_LABEL[i] ?? i}
                  </span>
                ))}
              </div>
            )}
            {/* Consistent five-tag provenance (closure-pass rule 5): every
                Mission Control card is, by definition, a decision Netify
                has ranked and is proposing the buyer resolve -- the exact
                real-data equivalent of the approved prototype's own usage
                (every decision card in its state 1 carries `provTag
                ('agent')`; see ProvenanceTag.tsx's own doc comment for the
                full mapping). */}
            {dark && (
              <div className="mt-0.5">
                <ProvenanceTag kind="agent" dark />
              </div>
            )}
            {buttons.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {buttons.map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    onClick={b.onClick}
                    className={`cursor-pointer rounded-[4px] border px-2.5 py-1.5 text-[12px] transition-colors ${dark ? "hover:border-[#46423d]" : "hover:border-[#d3d0cd]"}`}
                    style={
                      dark
                        ? { borderColor: "#2b2825", background: "transparent", color: "#f7f5f2" }
                        : { borderColor: "#d3d0cd", background: "transparent", color: "#110f0d" }
                    }
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            ) : hint ? (
              <div className="text-[12px]" style={{ color: dark ? "#bab7b3" : "#66635e" }}>{hint}</div>
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
    <div className="mt-5 border-t border-[#e3e1de] pt-[18px]">
      <div className="mb-2.5 flex items-baseline gap-[11px]">
        <span className="text-[11px] uppercase text-[#1c1a18]" style={{ ...mono, letterSpacing: "0.1em" }}>
          {title} · accepted
        </span>
        <span className="min-w-0 flex-1 text-[12.5px] text-[#66635e]">
          Netify suggested these; you accepted them. Each compiles a governed clause until reversed.
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.id} className="flex min-w-0 flex-col gap-2 rounded-[4px] border border-[#e3e1de] bg-white p-3.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-[4px] px-[6px] py-[2px] text-[9.5px] uppercase" style={{ ...mono, letterSpacing: "0.06em", background: "#d9f4d9", color: "#1e4e22" }}>
                Accepted
              </span>
              <span className="text-[9.5px] text-[#a7a4a0]" style={mono} title="Stable suggestion id">
                {c.id}
              </span>
            </div>
            <div className="text-[13.5px] leading-[1.5] text-[#110f0d]">{c.label}</div>
            <div className="text-[12px] leading-[1.5] text-[#66635e]">{c.reason}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={c.onUndo}
                className="cursor-pointer rounded-[4px] border border-[#d3d0cd] bg-transparent px-2.5 py-1.5 text-[12px] text-[#110f0d] hover:border-[#d3d0cd]"
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

/* Contrast fix (verification pass, 18 Aug 2026): "#83807b"/"#83807b" on this
 *  map's own "#e3e1de" background measured 3.08:1 / 2.33:1, both well below
 *  WCAG AA's 4.5:1 for normal text -- and even the design system's own
 *  general-purpose muted token (--nf-ink-400, #83807b) falls just short here
 *  (4.25:1) because #e3e1de is a slightly warmer/lighter tint than the
 *  white/ivory it was tuned against. #66635e is the same neutral hue, darkened
 *  just enough to clear 4.5:1 specifically against #e3e1de (4.55:1). */
const OUTLINE_STATE_STYLE: Record<string, { bg: string; color: string }> = {
  confirmed: { bg: "#d9f4d9", color: "#1e4e22" },
  needs_input: { bg: "#e3e1de", color: "#66635e" },
  needs_decision: { bg: "#ffe3cc", color: "var(--nf-orange-strong, #832f00)" },
  netify_suggested: { bg: "#eee6ff", color: "#ae96da" },
  later: { bg: "#e3e1de", color: "#66635e" },
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
    <div className="mt-5 border-t border-[#e3e1de] pt-[18px] pb-1">
      <div className="mb-2.5 text-[11px] uppercase text-[#1c1a18]" style={{ ...mono, letterSpacing: "0.1em" }}>
        Document outline
      </div>
      <div className="flex flex-col gap-[1px] overflow-hidden rounded-[4px] border border-[#e3e1de]">
        {rows.map((r) => {
          const st = OUTLINE_STATE_STYLE[r.state] ?? OUTLINE_STATE_STYLE.later;
          return (
            <div key={r.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-white px-3.5 py-2.5 sm:flex-nowrap">
              <span className="w-full min-w-0 text-[13px] text-[#110f0d] sm:w-[190px] sm:flex-none">{r.title}</span>
              <span className="min-w-0 flex-1 text-[12px] text-[#66635e]">{r.detail}</span>
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

// Affected-surfaces treatment (2030 visual pass, 18 Aug 2026): a left
// orange accent border, matching the approved prototype's `.surf` tile
// (index.html renderDiff()'s "Affected surfaces" row) -- same real
// document.counts data as before, only the accent border is new.
function StatTile({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-[4px] border border-[#e3e1de] px-3.5 py-3" style={{ borderLeft: "3px solid var(--nf-orange, #c66000)" }}>
      <div className="text-[19px] font-semibold leading-none" style={{ ...mono, color: warn && value > 0 ? "var(--nf-orange-strong, #832f00)" : "#110f0d" }}>
        {value}
      </div>
      <div className="mt-1 text-[10.5px] uppercase text-[#66635e]" style={{ ...mono, letterSpacing: "0.06em" }}>
        {label}
      </div>
    </div>
  );
}

/** The architecture card's own short "Δ ..." caption (Constitution
 *  mockups, image2/image3: "Δ 3 clauses · 1 gate · 2 evidence requests
 *  added"). Built from the SAME real `document.changeSet` counts
 *  `changeSummaryLine()` above already uses -- deliberately NOT copying
 *  the mockup's "evidence requests added" clause, since this codebase
 *  has no real per-change count of evidence requests to report; adding
 *  one here would be exactly the fabricated-number problem this whole
 *  pass exists to avoid. Two real counts shown instead of three. */
function architectureDeltaCaption(document: LivingProcurementDocument): string | null {
  const cs = document.changeSet;
  const clauseCount = cs.clauses.added.length + cs.clauses.updated.length;
  const gateCount = cs.gates.added.length;
  const parts: string[] = [];
  if (clauseCount > 0) parts.push(`${clauseCount} clause${clauseCount === 1 ? "" : "s"}`);
  if (gateCount > 0) parts.push(`${gateCount} gate${gateCount === 1 ? "" : "s"}`);
  return parts.length ? `Δ ${parts.join(" · ")}` : null;
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
    <div className="border-t border-[#e3e1de] pb-4 pt-[18px]">
      <div className="mb-2 flex items-baseline gap-[11px]">
        {/* Lifecycle-consistency closure pass, correction C: same
            relabel as the StatTile above (same `document.openDecisions`
            source) -- "Document gaps" so this never reads as the same
            "blocking decisions" figure Mission Control and the publish
            panel share; the sub-copy already made clear these don't gate
            anything, this just stops the label implying otherwise. */}
        <span className="text-[11px] uppercase text-[#1c1a18]" style={{ ...mono, letterSpacing: "0.1em" }}>
          Document gaps
        </span>
        <span className="min-w-0 flex-1 text-[12.5px] text-[#66635e]">nothing here becomes a gate or requirement until you decide</span>
        <span className="flex-none text-[11px] text-[#66635e]" style={mono}>{decisions.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {decisions.map((d) => (
          <div
            key={d.id}
            className="flex items-start gap-3 rounded-[4px] border px-3.5 py-3"
            style={{ borderColor: d.conflict ? "#ec928b" : "#e3e1de", background: d.conflict ? "#ffdfda" : "transparent" }}
          >
            <span
              className="mt-[4px] inline-block h-[7px] w-[7px] flex-none rounded-full"
              style={{ background: d.conflict ? "#8d1a1e" : "#83807b" }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] leading-[1.5] text-[#110f0d]">{d.question}</div>
              {d.conflict && d.conflictReason && <div className="mt-1 text-[12px] leading-[1.5] text-[#8d1a1e]">{d.conflictReason}</div>}
              {d.impact.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {d.impact.map((i) => (
                    <span key={i} className="rounded-[4px] bg-[#e3e1de] px-[6px] py-[2px] text-[9.5px] uppercase" style={{ ...mono, letterSpacing: "0.06em", color: "#66635e" }}>
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
