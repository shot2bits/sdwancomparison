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
 * Value rendering: a WorkspaceFact's `value` is always a single already-
 * exploded value, never an array — confirmed from draft.ts's explode(),
 * which splits a list-path update into one fact per array element before
 * merge. String(fact.value) is therefore always a plain scalar rendering,
 * never a comma-joined array artefact.
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

import type { WorkspaceFact } from "@/lib/workspace/draft";
import type { AllowedPath } from "@/lib/workspace/extract";

export default function FactInspector({
  fact,
  labelFor,
}: {
  fact: WorkspaceFact;
  labelFor: (path: AllowedPath) => string;
}) {
  const label = labelFor(fact.path);
  const value = String(fact.value);
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
