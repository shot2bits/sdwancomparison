"use client";

/**
 * Phase 0 vertical slice — the capture receipt (W0 preview, isolated route
 * only). A real receipt of what THIS cycle actually added or changed in the
 * production fact ledger: nothing here is invented, it is a direct render
 * of the `FieldUpdate[]` the real `/sase/api/workspace/extract` endpoint
 * returned for the buyer's last message, via the real `factLabel()` from
 * `@/lib/workspace/draft` (unmodified).
 *
 * When a cycle produces zero updates (the buyer asked a clarifying question,
 * or said something with no recordable fact in it), this shows a plain
 * explanation instead of a receipt. That explanation text is a PRESENTATION
 * addition made for this preview only — the production endpoint itself does
 * not return a canned explanation string, it simply returns no updates. See
 * the Phase 0 report's "known limitations" for this distinction.
 */

import type { FieldUpdate } from "@/lib/workspace/extract";
import { factLabel, type WorkspaceFact } from "@/lib/workspace/draft";

const FIELD_NAMES: Record<string, string> = {
  "organisation.sector": "Sector",
  "organisation.sizeBand": "Organisation size",
  "organisation.regions": "Region",
  "estate.users": "Users",
  "estate.sites": "Sites",
  "estate.cloud": "Cloud platform",
  "estate.existingSecurity": "Existing security",
  "estate.existingNetwork": "Existing network",
  "drivers": "Driver",
  "constraints.complianceRequirements": "Compliance requirement",
  "constraints.inHouseSocCapacity": "In-house SOC capacity",
  "constraints.timeline": "Timeline",
  "constraints.budgetBand": "Budget band",
  "procurement.buying": "Buying",
  "procurement.operatingModel": "Operating model",
};

function labelFor(u: FieldUpdate): string {
  // factLabel() expects a WorkspaceFact; a raw FieldUpdate carries every
  // field it needs (value + path), so this is a safe narrowing for display,
  // not a claim that the update is already a standing fact.
  return factLabel(u as WorkspaceFact);
}

export default function CaptureReceiptBanner({
  updates,
  cycle,
}: {
  updates: FieldUpdate[];
  cycle: number;
}) {
  if (updates.length === 0) {
    return (
      <div className="mb-6 rounded-[10px] border border-[#EAE7E1] bg-[#FBFAF8] p-3.5">
        <p className="m-0 text-[13px] leading-snug text-[#6E6C67]">
          Nothing new recorded from that message. If it was a question rather than a detail about your project, ask
          again below and I&apos;ll explain — nothing in your Statement of Requirements changes until you tell me
          something new.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-[10px] border border-[#BFE0CB] bg-[#F3FBF6] p-3.5">
      <p className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#2E9E52]">
        Captured this cycle · #{cycle}
      </p>
      <ul className="m-0 list-none space-y-1 p-0">
        {updates.map((u, i) => (
          <li key={`${u.path}-${i}`} className="flex flex-wrap items-baseline gap-x-2 text-[13px] leading-snug text-[#141414]">
            <span className="font-medium text-[#33302C]">{FIELD_NAMES[u.path] ?? u.path}:</span>
            <span>{labelFor(u)}</span>
            <span
              className={
                "rounded-full px-1.5 py-0.5 text-[10px] font-medium " +
                (u.provenance === "stated" ? "bg-[#141414] text-white" : "border border-[#8C8A85] text-[#6E6C67]")
              }
            >
              {u.provenance}
            </span>
            {u.quote && <span className="italic text-[#6E6C67]">&ldquo;{u.quote}&rdquo;</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
