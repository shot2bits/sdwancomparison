"use client";

/**
 * FactInspector (Milestone 1, Commit 5): the detail view for a single
 * WorkspaceFact attached to a Seg of kind "fact" — this is what lets a
 * buyer inspect the exact source quote or inference reason behind a fact
 * in their Understanding, per the Product Blueprint's "buyer can inspect
 * source quote/inference reason" requirement.
 *
 * Presentational only: no state, no hooks, no callbacks, no API calls, no
 * ledger writes. Reads only the WorkspaceFact and AllowedPath types
 * already defined in src/lib/workspace/draft.ts and
 * src/lib/workspace/extract.ts — nothing here redefines them.
 *
 * `labelFor` is received as a prop (typed against the real
 * `labelFor(path: AllowedPath): string` from src/lib/workspace/labels.ts)
 * rather than imported directly, matching the sibling UnderstandingGroup
 * component's own contract (it receives labelFor and threads it down to
 * every FactInspector it renders) — one injected label source per render
 * tree, not two components each independently importing labels.ts.
 *
 * Value rendering (Milestone 1, Commit 7 fix): a WorkspaceFact's `value`
 * is always a single already-exploded value, never an array — confirmed
 * from draft.ts's explode(), which splits a list-path update into one
 * fact per array element before merge — so there is never a comma-joined
 * array artefact to worry about here. But the raw value itself is not
 * always human-readable: for enum-coded paths (constraints.
 * complianceRequirements, drivers, estate.cloud, estate.existingNetwork,
 * organisation.regions, procurement.buying, procurement.operatingModel)
 * WorkspaceFact.value holds the internal enum id ("iso27001"), while the
 * buyer-facing Understanding sentence displays the humanised label
 * ("ISO 27001") via draft.ts's own `factLabel(fact)` — the single
 * authoritative value-formatting function, already used consistently by
 * StatementOfRequirements.tsx, briefModel() itself (`fs()`'s default
 * text), and every value display in the live ProjectDesk.tsx (verified:
 * ProjectDesk.tsx calls factLabel() at every point it shows a fact's
 * value — lines 1135, 1472, 1820, 1888-1889, 2804 — there is no second,
 * competing enum-label system to reconcile). This file previously used
 * `String(fact.value)` directly, which bypassed that humanisation and
 * showed the raw enum id — a buyer-visible inconsistency against the
 * same sentence's own wording, fixed here by calling factLabel(fact)
 * instead. For every path with no enum table (free text, numbers, and
 * every PKM path), factLabel()'s own default case returns String(value)
 * unchanged, so this fix changes nothing for those paths.
 *
 * Struck facts are shown, not hidden (the existing preview renderer,
 * StatementOfRequirements.tsx's renderSeg, also never hides a struck
 * fact — it renders it with a strike-through style and a tooltip). Here
 * a struck fact keeps its full detail (label, value, quote/reason) but is
 * visually marked inactive/superseded, since a buyer inspecting "why did
 * this fact drop out" needs to see what it used to say.
 *
 * No fabrication: when the relevant provenance detail (quote for a stated
 * fact, reason for an inferred fact) is absent, this states plainly that
 * no source detail is available rather than inventing one.
 */

import { factLabel, type WorkspaceFact } from "@/lib/workspace/draft";
import type { AllowedPath } from "@/lib/workspace/extract";

export default function FactInspector({
  fact,
  labelFor,
}: {
  fact: WorkspaceFact;
  labelFor: (path: AllowedPath) => string;
}) {
  const label = labelFor(fact.path);
  const value = factLabel(fact);
  const provenanceLabel = fact.provenance === "stated" ? "Stated" : "Inferred";

  return (
    <div
      className={
        "min-w-[220px] max-w-sm rounded-[8px] border p-2.5 text-[12.5px] leading-snug " +
        (fact.struck ? "border-[#EAE7E1] bg-[#FBFAF8]" : "border-[#EAE7E1] bg-white")
      }
    >
      <p className="m-0 mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-medium text-[#33302C]">{label}:</span>
        <span className={fact.struck ? "text-[#8C8A85] line-through decoration-[1.5px]" : "text-[#141414]"}>
          {value}
        </span>
        <span
          className={
            "rounded-full px-1.5 py-0.5 text-[10px] font-medium " +
            (fact.provenance === "stated" ? "bg-[#141414] text-white" : "border border-[#8C8A85] text-[#6E6C67]")
          }
        >
          {provenanceLabel}
        </span>
        {fact.struck && (
          <span className="rounded-full border border-[#D9A6A6] px-1.5 py-0.5 text-[10px] font-medium text-[#9C3B3B]">
            Superseded
          </span>
        )}
      </p>

      {fact.provenance === "stated" ? (
        fact.quote ? (
          <p className="m-0 italic text-[#6E6C67]">&ldquo;{fact.quote}&rdquo;</p>
        ) : (
          <p className="m-0 text-[#8C8A85]">No source quote is available for this.</p>
        )
      ) : fact.reason ? (
        <p className="m-0 text-[#6E6C67]">{fact.reason}</p>
      ) : (
        <p className="m-0 text-[#8C8A85]">No inference reason is available for this.</p>
      )}
    </div>
  );
}
