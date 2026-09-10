"use client";

/**
 * Living Procurement OS · Phase 3 Stage A. Renders exactly
 * `LivingProcurementDocument.responseGroups` — the same clause set as the
 * Living document view, projected as what suppliers and vendors will be
 * asked to answer against (Section 5's "coordinated projections of ONE
 * compiled object": every question here traces back to `clauseId`, one
 * of the same stable ids the Living document view shows).
 *
 * This is the visible, pre-publication supplier-question projection
 * only — it carries no vendor names, no match count, no shortlist
 * membership, and no invitation state. That boundary belongs to the
 * Phase 2 fact ledger / publish machinery this stage does not touch; see
 * `ProjectDesk.tsx`'s own `phase === "fits"` panel and its "DO NOT
 * TOUCH" doc comment for where that boundary actually lives.
 */

import type { SupplierResponseGroup } from "@/lib/workspace/procurement-document";

const mono: React.CSSProperties = { fontFamily: "var(--nf-font-mono)" };

export default function SupplierPackView({ groups }: { groups: SupplierResponseGroup[] }) {
  const totalQuestions = groups.reduce((n, g) => n + g.questions.length, 0);

  if (totalQuestions === 0) {
    return (
      <div className="pb-4">
        <p className="m-0 text-[13.5px] leading-[1.55] text-[#66635e]">No supplier questions yet. They compile alongside the requirements above.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="m-0 max-w-[48em] pb-2 text-[13px] leading-[1.6] text-[#66635e]">
        What suppliers and vendors will be asked to answer against: {totalQuestions} question{totalQuestions === 1 ? "" : "s"} across {groups.length}{" "}
        area{groups.length === 1 ? "" : "s"}, each tied to a numbered requirement above.
      </p>
      {groups.map((g) => (
        <div key={g.key} className="border-t border-[#e3e1de] pt-[18px]">
          <div className="mb-2 flex items-baseline gap-[11px]">
            <span className="text-[11px] uppercase text-[#1c1a18]" style={{ ...mono, letterSpacing: "0.1em" }}>
              {g.title}
            </span>
            <span className="flex-none text-[11px] text-[#66635e]" style={mono}>{g.questions.length}</span>
          </div>
          <div className="flex flex-col">
            {g.questions.map((q) => (
              <div key={q.id} className="flex items-start gap-3.5 border-b border-dotted border-[#e3e1de] py-[9px]">
                <span className="w-[64px] flex-none pt-[2px] text-[10px] text-[#66635e]" style={mono}>{q.clauseId}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] leading-[1.5] text-[#110f0d]">{q.text}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#66635e]">
                    {/* Contrast fix (verification pass, 18 Aug 2026): this
                        badge would otherwise inherit its parent's
                        --nf-ink-400 (4.25:1 on white/ivory), which falls
                        just short of 4.5:1 on this badge's own slightly
                        warmer #e3e1de fill (measured 4.25:1 there too) --
                        #66635e is the same neutral hue, darkened just
                        enough to clear 4.5:1 specifically against #e3e1de. */}
                    <span className="rounded-[4px] bg-[#e3e1de] px-[6px] py-[2px] uppercase" style={{ ...mono, letterSpacing: "0.06em", color: "#66635e" }}>
                      {q.answerFormat.replace(/_/g, " ")}
                    </span>
                    {q.evidenceRequested.map((e) => (
                      <span key={e} className="text-[#004f8b]">evidence: {e}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
