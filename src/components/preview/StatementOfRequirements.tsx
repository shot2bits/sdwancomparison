"use client";

/**
 * Phase 0 vertical slice — the readable Statement of Requirements (W0
 * preview, isolated route only).
 *
 * This renders the REAL production living-brief model: `briefModel()` from
 * `@/lib/workspace/draft`, unmodified, the same pure function the MCP
 * workspace tools call (via `briefText(briefModel(...))` in
 * `mcp-workspace-tools.ts`) for cross-assistant parity. `verdict` is passed
 * as `null` deliberately: the security-scope verdict engine (capability
 * recommendations, the "Services required" block) is a separate, existing
 * production system this slice does not touch or recompute — see the Phase
 * 0 exclusion list (no provider comparison, no security-scope verdict).
 * `briefModel` is written to run correctly with `verdict: null` (its own
 * fixtures test this case), so every other block — organisation, estate,
 * why now, compliance and operations, scope of supply, remaining gaps —
 * still renders from the standing facts alone.
 *
 * The Seg-rendering convention (stated facts solid-underlined, inferred
 * facts dotted-underlined, struck facts struck through) is adapted from the
 * `FactSpan` pattern in the retired `LiveWorkspace.tsx` — the one place in
 * this repo that previously rendered `brief.blocks` in full. The currently
 * LIVE `ProjectDesk.tsx` computes `briefModel()` too, but only reads
 * `.title` and `.openGaps` from it today; it does not render `.blocks` in
 * its own UI. This component is new, focused, and does not modify either
 * file.
 *
 * Read-only in this slice: gaps render as plain prompts, not answerable
 * inline controls (see Known limitations in the Phase 0 report).
 */

import { briefModel, type Seg, type WorkspaceFact } from "@/lib/workspace/draft";
import type { SecurityScopeVerdict } from "@/lib/security/rulebook";

function renderSeg(s: Seg, key: string) {
  if (s.kind === "text") return <span key={key}>{s.text}</span>;
  if (s.kind === "fact") {
    const f = s.fact;
    return (
      <span
        key={key}
        title={
          f.struck
            ? "Struck out."
            : f.provenance === "stated"
              ? `Your words: "${f.quote ?? s.text}"`
              : `Netify inference: ${f.reason ?? "derived from your description"}`
        }
        className={
          "rounded-[2px] " +
          (f.struck
            ? "text-[var(--ink-300)] line-through decoration-[1.5px]"
            : f.provenance === "stated"
              ? "border-b-2 border-[var(--ink-700)]"
              : "border-b-2 border-dotted border-[var(--ink-500)]")
        }
      >
        {s.text}
      </span>
    );
  }
  return (
    <span key={key} className="text-sm italic text-[var(--ink-500)]">
      {s.gap.question}
    </span>
  );
}

export default function StatementOfRequirements({
  facts,
  verdict = null,
}: {
  facts: WorkspaceFact[];
  verdict?: SecurityScopeVerdict | null;
}) {
  const brief = briefModel({ facts, verdict });

  if (brief.blocks.length === 0) {
    return (
      <div className="rounded-[13px] border border-dashed border-[#EAE7E1] p-6 text-center">
        <p className="m-0 text-[13px] text-[#8C8A85]">
          Your Statement of Requirements will build here as you describe your project below.
        </p>
      </div>
    );
  }

  return (
    <article className="rounded-[13px] border border-[#EAE7E1] bg-white p-5 sm:p-6">
      <p className="eyebrow m-0 mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
        Statement of requirements · draft
      </p>
      <h2 className="m-0 mb-5 text-xl leading-snug text-[#141414]">{brief.title}</h2>

      {brief.blocks.map((b) => (
        <section key={b.key} className="mb-6">
          {b.heading && (
            <h3 className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
              {b.heading}
            </h3>
          )}
          {b.paras.map((p, i) => (
            <p key={i} className="m-0 mb-2 max-w-2xl text-[14.5px] leading-relaxed text-[#18181b]">
              {p.map((seg, j) => renderSeg(seg, `${b.key}-${i}-${j}`))}
            </p>
          ))}
        </section>
      ))}

      {brief.assumptions.length > 0 && (
        <section className="mb-2">
          <h3 className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
            Working assumptions
          </h3>
          {brief.assumptions.map((a, i) => (
            <p key={i} className="m-0 mb-1.5 text-[13px] italic leading-relaxed text-[var(--ink-500)]">
              {a} <span className="not-italic text-[10.5px] text-amber-700">assumed</span>
            </p>
          ))}
        </section>
      )}
    </article>
  );
}
