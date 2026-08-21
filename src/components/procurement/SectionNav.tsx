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
  const statusLabel = (state: OutlineRow["state"], active: boolean) => {
    if (state === "confirmed") return "Ready";
    if (active) return "In progress";
    if (state === "netify_suggested") return "Review suggestion";
    if (state === "later") return "Optional";
    return "Not started";
  };

  return (
    <nav
      aria-label="Procurement sections"
      className="nf-2030-section-nav"
    >
      {updatedBanner && (
        <div role="status" aria-live="polite" className="nf-2030-updated">
          <span aria-hidden="true">&#10003;</span>
          {updatedBanner}
        </div>
      )}

      <div className="nf-2030-section-nav-head">
        <span><b>Your RFP</b><small>{progress.ready} of {progress.total} ready</small></span>
      </div>

      <ol>
          {rows.map((r, index) => {
            const isActive = r.key === activeKey;
            return (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => onSelect(r.key)}
                  aria-current={isActive ? "true" : undefined}
                >
                  <span className="nf-2030-area-mark" data-state={r.state} aria-hidden="true">
                    {r.state === "confirmed" ? "✓" : index + 1}
                  </span>
                  <span className="nf-2030-area-copy">
                    <strong>{r.title}</strong>
                    <small>{statusLabel(r.state, isActive)}</small>
                  </span>
                </button>
              </li>
            );
          })}
      </ol>

      <div className="nf-2030-section-actions" aria-label="Later stages">
        {materialDecisionsRemaining > 0 && (
          <button type="button" onClick={onReviewDecisions}>
            {materialDecisionsRemaining} open decision{materialDecisionsRemaining === 1 ? "" : "s"}
          </button>
        )}
        <button type="button" disabled={!publishReachable} onClick={onPublish}>
          {publishCompleted ? "Published ✓" : "Review & issue"}
        </button>
        <button type="button" disabled={!compareReachable} onClick={onCompare}>Responses</button>
      </div>
    </nav>
  );
}
