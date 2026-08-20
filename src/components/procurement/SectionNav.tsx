"use client";

/**
 * The 2030 UI rebuild's primary navigation (Robert, 20 Aug 2026: "Should
 * the platform not tell the user what section they're working on...
 * This needs to be better thought out, a 2030 UI please... It's fine to
 * totally change the UI... It's the UI that's a massive mess.")
 *
 * REPLACES WizardRail.tsx as the primary navigation, per Robert's own
 * choice when asked directly ("Replace it (Recommended)" over "sit
 * alongside it"). The five-station rail told a buyer which STAGE of a
 * process they were in (Describe / Decisions / Review / Publish /
 * Compare); testers consistently said they still had no idea what was
 * going on. The reason: a stage is not a unit of WORK a buyer recognises
 * — a content SECTION is ("Resilience and availability", "Current
 * estate"...). This nav makes the section outline — already computed,
 * already labelled, previously a read-only list buried inside
 * LivingProcurementCanvas — the thing you click to move around the
 * enquiry, with the same honest five-state labelling every other outline
 * surface in this codebase already uses (procurement-outline.ts).
 *
 * WHAT IT IS NOT: a second, competing computation. Every row, every
 * state, the ready/total fraction — all read straight off the SAME
 * `OutlineRow[]` / `OutlineProgress` ProjectDesk already derives via
 * `buildSectionOutline()` / `outlineProgress()`. This stays a
 * presentational layer, same rule LivingProcurementCanvas's own header
 * comment states for itself.
 *
 * Publish and Compare are NOT sections — they are the two irreversible,
 * terminal actions the rebuild explicitly demotes to "a lightweight
 * strip, not a parallel rail" (Robert's own framing). They render here as
 * two small pills, gated by the SAME `reachable`/`completed` sets the
 * retired rail used, so an unreachable action is still a real `disabled`
 * button rather than a silent no-op.
 */

import type { OutlineProgress, OutlineRow } from "@/lib/workspace/procurement-outline";
import { outlineStateLabel, outlineProgressLine } from "@/lib/workspace/procurement-outline";

const mono: React.CSSProperties = { fontFamily: "var(--nf-font-mono)" };

const STATE_DOT: Record<OutlineRow["state"], string> = {
  confirmed: "var(--nf-emerald, #1e4e22)",
  needs_input: "var(--nf-ink-400, #83807b)",
  needs_decision: "var(--nf-orange, #c66000)",
  netify_suggested: "var(--nf-lilac, #573c7f)",
  later: "var(--nf-ink-200, #d3d0cd)",
};

export default function SectionNav({
  rows,
  activeKey,
  onSelect,
  progress,
  updatedBanner,
  materialDecisionsRemaining,
  onReviewDecisions,
  publishReachable,
  publishCompleted,
  compareReachable,
  onPublish,
  onCompare,
}: {
  rows: OutlineRow[];
  activeKey: string | null;
  onSelect: (key: string) => void;
  progress: OutlineProgress;
  /** "Updated N sections: X, Y, Z" — set for a few seconds after a single
   *  message lands facts in more than one section at once. Robert, 20 Aug
   *  2026: "someone types SD-WAN and Compliance across XYZ regulation,
   *  the portal should update all sections" — this is the confirmation
   *  that it did, named explicitly rather than left for the buyer to spot
   *  by comparing state chips themselves. */
  updatedBanner: string | null;
  materialDecisionsRemaining: number;
  onReviewDecisions: () => void;
  publishReachable: boolean;
  publishCompleted: boolean;
  compareReachable: boolean;
  onPublish: () => void;
  onCompare: () => void;
}) {
  return (
    <nav
      aria-label="Procurement sections"
      className="border-b"
      style={{ borderColor: "var(--nf-rule)", background: "var(--nf-ivory-raised)" }}
    >
      <div className="mx-auto max-w-[1400px] px-[26px] py-3 lg:px-[42px]">
        {updatedBanner && (
          <div
            role="status"
            aria-live="polite"
            className="mb-2.5 flex items-start gap-2 rounded-[3px] border px-3 py-2"
            style={{ borderColor: "var(--nf-emerald-soft-border, #91bb91)", background: "var(--nf-emerald-soft, #d9f4d9)" }}
          >
            <span aria-hidden="true" className="mt-[1px] flex-none text-[12px] font-bold" style={{ color: "var(--nf-emerald, #1e4e22)" }}>
              &#10003;
            </span>
            <span className="text-[12.5px] font-semibold leading-[1.4]" style={{ color: "var(--nf-emerald, #1e4e22)" }}>
              {updatedBanner}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] uppercase" style={{ ...mono, letterSpacing: "0.09em", color: "var(--nf-ink-600, #66635e)" }}>
              Sections
            </span>
            <span className="text-[12.5px] font-semibold" style={{ color: "var(--nf-ink-950, #110f0d)" }}>
              {outlineProgressLine(progress)}
            </span>
            {progress.laterCount > 0 && (
              <span className="text-[11.5px]" style={{ color: "var(--nf-ink-400, #83807b)" }}>{`(+${progress.laterCount} later)`}</span>
            )}
          </div>

          {/* The lightweight strip. Two pills, not two more rail stations —
              the rebuild's own explicit instruction. Decisions is included
              here too (not a section, but the one other cross-cutting view
              a buyer needs a door back into) rather than only reachable via
              in-body links, so it is never more than one click away. */}
          <div className="flex flex-none items-center gap-1.5">
            {materialDecisionsRemaining > 0 && (
              <button
                type="button"
                onClick={onReviewDecisions}
                className="cursor-pointer rounded-[3px] border px-2.5 py-1.5 text-[12px] font-semibold"
                style={{ borderColor: "var(--nf-orange-soft-border, #db9f76)", background: "var(--nf-orange-soft, #ffe3cc)", color: "var(--nf-orange-strong, #832f00)" }}
              >
                {`${materialDecisionsRemaining} open decision${materialDecisionsRemaining === 1 ? "" : "s"}`}
              </button>
            )}
            <button
              type="button"
              disabled={!publishReachable}
              onClick={onPublish}
              className={`rounded-[3px] border px-2.5 py-1.5 text-[12px] font-semibold ${publishReachable ? "cursor-pointer" : "cursor-default opacity-50"}`}
              style={
                publishCompleted
                  ? { borderColor: "var(--nf-emerald, #1e4e22)", background: "var(--nf-emerald, #1e4e22)", color: "#fff" }
                  : { borderColor: "var(--nf-ink-200, #d3d0cd)", background: "#fff", color: "var(--nf-ink-950, #110f0d)" }
              }
            >
              {publishCompleted ? "Published ✓" : "Publish"}
            </button>
            <button
              type="button"
              disabled={!compareReachable}
              onClick={onCompare}
              className={`rounded-[3px] border px-2.5 py-1.5 text-[12px] font-semibold ${compareReachable ? "cursor-pointer" : "cursor-default opacity-50"}`}
              style={{ borderColor: "var(--nf-ink-200, #d3d0cd)", background: "#fff", color: "var(--nf-ink-950, #110f0d)" }}
            >
              Compare
            </button>
          </div>
        </div>

        <ol className="mt-2.5 flex list-none flex-wrap gap-1.5 p-0">
          {rows.map((r) => {
            const isActive = r.key === activeKey;
            return (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => onSelect(r.key)}
                  aria-current={isActive ? "true" : undefined}
                  className="flex cursor-pointer items-center gap-1.5 rounded-[3px] border px-2.5 py-[7px] text-left transition-colors"
                  style={
                    isActive
                      ? { borderColor: "var(--nf-ink-950, #110f0d)", background: "var(--nf-ink-950, #110f0d)" }
                      : { borderColor: "var(--nf-ink-200, #d3d0cd)", background: "#fff" }
                  }
                >
                  <span aria-hidden="true" className="h-[7px] w-[7px] flex-none rounded-full" style={{ background: STATE_DOT[r.state] }} />
                  <span
                    className="whitespace-nowrap text-[12.5px]"
                    style={{ fontWeight: isActive ? 700 : 500, color: isActive ? "#fff" : "var(--nf-ink-800, #302d2a)" }}
                  >
                    {r.title}
                  </span>
                  <span
                    className="whitespace-nowrap text-[9.5px] uppercase"
                    style={{ ...mono, letterSpacing: "0.05em", color: isActive ? "var(--nf-ink-200, #d3d0cd)" : "var(--nf-ink-400, #83807b)" }}
                  >
                    {outlineStateLabel(r.state)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
