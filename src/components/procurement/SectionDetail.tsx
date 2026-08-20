"use client";

/**
 * The 2030 UI rebuild's primary content pane (Robert, 20 Aug 2026: "the
 * platform should tell the user what section they're working on, provide
 * advice on what to ask, tell the user how complete they are but allow
 * the user to complete"). Paired with SectionNav.tsx, which is the click
 * surface; this is what renders once a section is chosen — a "you are
 * here", why-it-matters coaching pair (section-coaching.ts), what the
 * document already has for this section, what's still named-missing, and
 * the open questions that resolve it, answerable in place.
 *
 * NOT a replacement for the full document twin (LivingProcurementCanvas)
 * or the Decisions station — both still render, unchanged, reachable
 * exactly as before. This is deliberately narrower: one section's worth
 * of orientation and work, so a buyer never again has to guess which of
 * eight unrelated things on screen is the one that matters right now.
 *
 * Presentational only, same rule every other procurement/* component
 * follows: `row`/`cards`/`coaching` are all resolved once by ProjectDesk
 * from state it already owns (sectionOutline, allNextQuestionCards,
 * section-coaching.ts) — nothing here recomputes anything.
 */

import type { NextQuestionCard } from "@/components/procurement/LivingProcurementCanvas";
import type { OutlineRow } from "@/lib/workspace/procurement-outline";
import { outlineStateLabel } from "@/lib/workspace/procurement-outline";
import { stateFraming, type SectionCoaching } from "@/lib/workspace/section-coaching";
import { MATERIAL_IMPACTS } from "@/lib/workspace/procurement-next-questions";

const mono: React.CSSProperties = { fontFamily: "var(--nf-font-mono)" };

const STATE_CHIP: Record<OutlineRow["state"], React.CSSProperties> = {
  confirmed: { background: "var(--nf-emerald-soft, #d9f4d9)", color: "var(--nf-emerald, #1e4e22)", borderColor: "var(--nf-emerald-soft-border, #91bb91)" },
  needs_input: { background: "var(--nf-neutral-tag-soft, #e7e4e0)", color: "var(--nf-neutral-tag, #47413a)", borderColor: "var(--nf-ink-200, #d3d0cd)" },
  needs_decision: { background: "var(--nf-orange-soft, #ffe3cc)", color: "var(--nf-orange-strong, #832f00)", borderColor: "var(--nf-orange-soft-border, #db9f76)" },
  netify_suggested: { background: "var(--nf-lilac-soft, #eee6ff)", color: "var(--nf-lilac, #573c7f)", borderColor: "var(--nf-lilac-soft-border, #b6a2dc)" },
  later: { background: "#fff", color: "var(--nf-ink-400, #83807b)", borderColor: "var(--nf-ink-200, #d3d0cd)" },
};

export default function SectionDetail({
  row,
  position,
  total,
  coaching,
  cards,
  onSeeAllDecisions,
  materialDecisionsRemaining,
}: {
  row: OutlineRow;
  /** 0 for a `later` row — it deliberately sits outside the counted run. */
  position: number;
  total: number;
  coaching: SectionCoaching | null;
  /** Already filtered to just this section by ProjectDesk (matching
   *  `NextQuestionCard.fills.title`), same resolved buttons every other
   *  card surface uses — clicking here IS clicking in Decisions/Answer
   *  next, literally the same handler. */
  cards: NextQuestionCard[];
  onSeeAllDecisions: () => void;
  materialDecisionsRemaining: number;
}) {
  return (
    <div className="rounded-[4px] border p-6" style={{ borderColor: "var(--nf-rule, #d6d4d0)", background: "#fff" }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase" style={{ ...mono, letterSpacing: "0.09em", color: "var(--nf-ink-400, #83807b)" }}>
          {position > 0 ? `You're on section ${position} of ${total}` : "You're on"}
        </span>
        <span
          className="rounded-[3px] border px-2 py-[3px] text-[10px] font-semibold uppercase"
          style={{ ...mono, letterSpacing: "0.05em", ...STATE_CHIP[row.state] }}
        >
          {outlineStateLabel(row.state)}
        </span>
      </div>

      <h2
        className="m-0 mt-1.5 text-[24px] font-semibold leading-[1.2]"
        style={{ fontFamily: "var(--nf-font-serif)", letterSpacing: "-0.02em", color: "var(--nf-ink-950, #110f0d)" }}
      >
        {row.title}
      </h2>

      <p className="m-0 mt-2 text-[12.5px] leading-[1.5]" style={{ color: "var(--nf-ink-600, #66635e)" }}>
        {stateFraming(row.state)}
      </p>

      {coaching && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-[10px] uppercase" style={{ ...mono, letterSpacing: "0.07em", color: "var(--nf-ink-400, #83807b)" }}>What this covers</div>
            <p className="m-0 mt-1 text-[13px] leading-[1.5]" style={{ color: "var(--nf-ink-800, #302d2a)" }}>{coaching.what}</p>
          </div>
          <div>
            <div className="text-[10px] uppercase" style={{ ...mono, letterSpacing: "0.07em", color: "var(--nf-ink-400, #83807b)" }}>Why suppliers need it</div>
            <p className="m-0 mt-1 text-[13px] leading-[1.5]" style={{ color: "var(--nf-ink-800, #302d2a)" }}>{coaching.why}</p>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-[3px] border p-3.5" style={{ borderColor: "var(--nf-rule, #d6d4d0)", background: "var(--nf-ivory-raised, #fefdfc)" }}>
        <div className="text-[10px] uppercase" style={{ ...mono, letterSpacing: "0.07em", color: "var(--nf-ink-400, #83807b)" }}>What&rsquo;s captured so far</div>
        <p className="m-0 mt-1 text-[13px] leading-[1.5]" style={{ color: "var(--nf-ink-800, #302d2a)" }}>{row.detail}</p>
        {row.missing && row.missing.length > 0 && (
          <p className="m-0 mt-1.5 text-[12.5px] leading-[1.5]" style={{ color: "var(--nf-orange-strong, #832f00)" }}>
            {`Still needed: ${row.missing.join(", ")}`}
          </p>
        )}
      </div>

      {cards.length > 0 && (
        <div className="mt-5 flex flex-col gap-3">
          <div className="text-[10px] uppercase" style={{ ...mono, letterSpacing: "0.09em", color: "var(--nf-ink-600, #66635e)" }}>
            Complete this section
          </div>
          {cards.map(({ nq, buttons, hint }) => {
            const isMaterial = !nq.governedSuggestion && nq.impact.some((i) => (MATERIAL_IMPACTS as readonly string[]).includes(i));
            return (
              <div
                key={nq.id}
                className="rounded-[3px] border p-3.5"
                style={{
                  borderColor: nq.governedSuggestion ? "var(--nf-lilac-soft-border, #b6a2dc)" : "var(--nf-ink-200, #d3d0cd)",
                  background: nq.governedSuggestion ? "var(--nf-lilac-soft, #eee6ff)" : "#fff",
                }}
              >
                <p className="m-0 text-[14.5px] font-semibold leading-[1.4]" style={{ color: "var(--nf-ink-950, #110f0d)" }}>
                  {nq.question}
                  {nq.governedSuggestion && (
                    <span className="ml-1.5 whitespace-nowrap align-middle text-[9px] uppercase" style={{ ...mono, letterSpacing: "0.06em", color: "var(--nf-lilac, #573c7f)", fontWeight: 700 }}>
                      Netify suggests
                    </span>
                  )}
                  {!nq.governedSuggestion && isMaterial && (
                    <span className="ml-1.5 whitespace-nowrap align-middle text-[9px] uppercase" style={{ ...mono, letterSpacing: "0.06em", color: "var(--nf-orange-strong, #832f00)", fontWeight: 700 }}>
                      Changes price or risk
                    </span>
                  )}
                </p>
                {nq.reason && (
                  <p className="m-0 mt-1.5 text-[12.5px] leading-[1.5]" style={{ color: "var(--nf-ink-600, #66635e)" }}>{nq.reason}</p>
                )}
                {buttons.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {buttons.map((b) => (
                      <button
                        key={b.label}
                        type="button"
                        onClick={b.onClick}
                        className="cursor-pointer rounded-[3px] border px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:border-[var(--nf-ink-950,#110f0d)]"
                        style={{ borderColor: "var(--nf-ink-200, #d3d0cd)", background: "#fff", color: "var(--nf-ink-950, #110f0d)" }}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                ) : hint ? (
                  <p className="m-0 mt-2 text-[12px]" style={{ color: "var(--nf-ink-600, #66635e)" }}>{hint}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {materialDecisionsRemaining > cards.length && (
        <button
          type="button"
          onClick={onSeeAllDecisions}
          className="mt-4 cursor-pointer border-0 bg-transparent p-0 text-[12.5px] font-semibold"
          style={{ color: "var(--nf-orange-strong, #832f00)" }}
        >
          {`See all ${materialDecisionsRemaining} open decisions `}&rarr;
        </button>
      )}
    </div>
  );
}
