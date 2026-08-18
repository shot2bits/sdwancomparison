"use client";

/**
 * Living Procurement OS · Phase 3 Stage A. Renders exactly
 * `LivingProcurementDocument.clauses` — the numbered, testable-clause
 * list Section 5's Figure 2 describes: stable id, statement, mandatory-
 * or-scored-with-weight, the buyer's own quoted wording where it exists,
 * and a provenance dot (green = buyer's own words, orange = Netify
 * derived, purple = sector rule — the exact three-colour key the brief's
 * aesthetic constitution names). `changedClauseIds` drives the shared
 * `.ldoc-changed` pulse-then-settle treatment (globals.css) for a clause
 * this compile added or updated in place — never for a merely re-ordered
 * or unchanged row.
 */

import type { ProcurementClause, ProcurementSectionKey } from "@/lib/workspace/procurement-document";
import { SECTION_TITLES } from "@/lib/workspace/procurement-document";

const mono: React.CSSProperties = { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' };

const SECTION_ORDER: ProcurementSectionKey[] = [
  "network",
  "security",
  "identity",
  "application",
  "operations",
  "project",
  "commercial",
  "supplier",
  "additional",
];

export default function ProcurementClauseList({
  clauses,
  changedClauseIds,
}: {
  clauses: ProcurementClause[];
  changedClauseIds: Set<string>;
}) {
  if (clauses.length === 0) {
    return (
      <div className="border-t border-[#EFECE5] pb-4 pt-[18px]">
        <span className="text-[11px] uppercase text-[#33302C]" style={{ ...mono, letterSpacing: "0.1em" }}>
          Testable requirements
        </span>
        <p className="mt-2 text-[13.5px] leading-[1.55] text-[#655F52]">
          Nothing compiled yet — say what you need above and it lands here as a testable, numbered clause.
        </p>
      </div>
    );
  }

  const bySection = new Map<ProcurementSectionKey, ProcurementClause[]>();
  for (const c of clauses) {
    const list = bySection.get(c.section) ?? [];
    list.push(c);
    bySection.set(c.section, list);
  }
  const sections = SECTION_ORDER.filter((s) => (bySection.get(s) ?? []).length > 0);

  return (
    <div className="border-t border-[#EFECE5] pb-4 pt-[18px]">
      <div className="mb-1 flex items-baseline gap-[11px]">
        <span className="text-[11px] uppercase text-[#33302C]" style={{ ...mono, letterSpacing: "0.1em" }}>
          Testable requirements
        </span>
        <span className="min-w-0 flex-1 text-[12.5px] text-[#655F52]">every clause carries a stable id and traces to your own words or a named rule</span>
        <span className="flex-none text-[11px] text-[#655F52]" style={mono}>{clauses.length}</span>
      </div>
      {sections.map((section) => (
        <div key={section} className="pt-3">
          <div className="mb-1.5 text-[11.5px] font-medium text-[#5F5D59]">{SECTION_TITLES[section]}</div>
          <div className="flex flex-col">
            {(bySection.get(section) ?? []).map((c) => (
              <ClauseRow key={c.id} clause={c} changed={changedClauseIds.has(c.id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ClauseRow({ clause, changed }: { clause: ProcurementClause; changed: boolean }) {
  return (
    <div className={`flex items-start gap-3.5 border-b border-dotted border-[#EFECE5] py-[10px] ${changed ? "ldoc-changed" : ""}`}>
      <span
        className={`ldoc-dot-${clause.origin} mt-[6px] inline-block h-[7px] w-[7px] flex-none rounded-full`}
        title={originLabel(clause.origin)}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="text-[10px] text-[#655F52]" style={mono}>{clause.id}</span>
          <span className="text-[14.5px] font-medium leading-[1.45] text-[#141414]" style={{ textWrap: "pretty" }}>
            {clause.statement}
          </span>
          <span
            className="flex-none rounded-[4px] px-[5px] py-[3px] text-[9.5px] font-semibold uppercase"
            style={{
              ...mono,
              letterSpacing: "0.07em",
              ...(clause.mandatory ? { background: "#FFF3DC", color: "#8A4D08" } : { background: "#EEF0FA", color: "#33408C" }),
            }}
          >
            {clause.mandatory ? "mandatory" : `scored · weight ${clause.weight}`}
          </span>
        </div>
        {clause.quote && <p className="m-0 mt-1 text-[12px] italic leading-[1.5] text-[#655F52]">&ldquo;{clause.quote}&rdquo;</p>}
        {clause.supplierResponse.length > 0 && (
          <ul className="m-0 mt-1.5 flex list-none flex-col gap-0.5 p-0 text-[12px] leading-[1.5] text-[#655F52]">
            {clause.supplierResponse.map((r, i) => (
              <li key={i}>· {r}</li>
            ))}
          </ul>
        )}
      </div>
      <span className="flex-none pt-[2px] text-[10px] text-[#C4C0B8]" style={mono}>
        {originLabel(clause.origin)}
      </span>
    </div>
  );
}

function originLabel(origin: ProcurementClause["origin"]): string {
  switch (origin) {
    case "buyer":
      return "your words";
    case "buyer_override":
      return "your override";
    case "netify":
      return "netify derived";
    case "sector":
      return "sector rule";
  }
}
