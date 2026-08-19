"use client";

/**
 * Living Procurement OS · Phase 3 Stage A. Renders exactly
 * `LivingProcurementDocument.evaluation` — category weights (already
 * balanced to 100 by `balanceCategoriesTo100()`, procurement-readiness.ts)
 * and pass/fail gates (every mandatory clause, unweighted). Same
 * coordinated-projection rule as the other views: nothing here is
 * computed locally, only read and laid out.
 */

import type { LivingProcurementDocument } from "@/lib/workspace/procurement-document";

const mono: React.CSSProperties = { fontFamily: "var(--nf-font-mono)" };
const CATEGORY_COLORS = ["var(--nf-orange, #c66000)", "var(--nf-emerald, #1e4e22)", "var(--nf-cobalt, #004f8b)", "var(--nf-lilac, #573c7f)"];

export default function EvaluationView({
  evaluation,
  gateChangedIds,
}: {
  evaluation: LivingProcurementDocument["evaluation"];
  gateChangedIds: Set<string>;
}) {
  const weightTotal = evaluation.categories.reduce((n, c) => n + c.weight, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-2 flex items-baseline gap-[11px]">
          <span className="text-[11px] uppercase text-[#1c1a18]" style={{ ...mono, letterSpacing: "0.1em" }}>
            Scoring weight
          </span>
          <span className="min-w-0 flex-1 text-[12.5px] text-[#66635e]">always balances to 100</span>
          <span className="flex-none text-[11px] text-[#66635e]" style={mono}>{weightTotal}</span>
        </div>
        {evaluation.categories.length > 0 && (
          <>
            <div className="flex h-[6px] w-full overflow-hidden rounded-[3px] bg-[#e3e1de]">
              {evaluation.categories.map((c, i) => (
                <span
                  key={c.key}
                  title={`${c.label}: ${c.weight}%`}
                  className="h-full"
                  style={{ width: `${c.weight}%`, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              {evaluation.categories.map((c, i) => (
                <div key={c.key} className="flex items-center gap-1.5 text-[12.5px] text-[#66635e]">
                  <span
                    className="inline-block h-[8px] w-[8px] flex-none rounded-full"
                    style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                    aria-hidden="true"
                  />
                  {c.label} · {c.weight}%
                  {c.source !== "default" && <span className="text-[10.5px] text-[#66635e]">({c.source.replace(/_/g, " ")})</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="border-t border-[#e3e1de] pt-[18px]">
        <div className="mb-2 flex items-baseline gap-[11px]">
          <span className="text-[11px] uppercase text-[#1c1a18]" style={{ ...mono, letterSpacing: "0.1em" }}>
            Pass/fail gates
          </span>
          <span className="min-w-0 flex-1 text-[12.5px] text-[#66635e]">every mandatory requirement, unweighted</span>
          <span className="flex-none text-[11px] text-[#66635e]" style={mono}>{evaluation.gates.length}</span>
        </div>
        {evaluation.gates.length > 0 ? (
          <div className="flex flex-col">
            {evaluation.gates.map((g) => (
              <div
                key={g.id}
                className={`flex items-start gap-3.5 border-b border-dotted border-[#e3e1de] py-[9px] ${gateChangedIds.has(g.id) ? "ldoc-changed" : ""}`}
              >
                <span className="mt-[5px] inline-block h-[7px] w-[7px] flex-none rounded-full" style={{ background: "var(--nf-red, #8d1a1e)" }} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] leading-[1.5] text-[#110f0d]">{g.label}</div>
                  <div className="mt-0.5 text-[12px] leading-[1.5] text-[#66635e]">{g.description}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-[9px] text-[13.5px] leading-[1.55] text-[#66635e]">No mandatory gates yet.</p>
        )}
      </div>
    </div>
  );
}
