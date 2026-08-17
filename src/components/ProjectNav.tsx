/**
 * Project navigation (Phase D1, Robert's amendment): the Project is the
 * permanent navigation root, a mini application. The shell hosts its own
 * views (Overview, Assessment) and links OUT to the existing surfaces
 * (builder, preview, review). Existing routes are never re-parented and
 * gain no second rendering path; they get a breadcrumb back instead.
 *
 * Server-safe presentational component; the manage key is propagated on
 * every link so anonymous drafts keep working across the workspace.
 */

import Link from "next/link";

export type ProjectTab = "overview" | "assessment" | "rfp" | "preview" | "review" | "story" | "timeline" | "rescope" | "room";

export default function ProjectNav({
  id,
  manage,
  active,
  engine,
}: {
  id: string;
  manage?: string;
  active: ProjectTab;
  engine: boolean;
}) {
  const qs = manage ? `?manage=${encodeURIComponent(manage)}` : "";
  // Engine tabs follow the notice-first journey (Robert, 21 July 2026): the
  // requirement page IS the product, so it carries the buyer's name for it,
  // and the RFP Builder leaves the tab bar (it remains reachable as the
  // labelled escape hatch on Overview). A buyer landed in the builder still
  // sees the bar with "Requirement" marked active.
  const items: Array<{ key: ProjectTab; label: string; href: string }> = engine
    ? [
        { key: "overview", label: "Overview", href: `/project/${id}${qs}` },
        { key: "assessment", label: "Assessment", href: `/project/${id}/assessment${qs}` },
        { key: "preview", label: "Requirement", href: `/rfp-builder/${id}/preview${qs}` },
        { key: "story", label: "Story", href: `/project/${id}/story${qs}` },
        { key: "timeline", label: "Timeline", href: `/project/${id}/timeline${qs}` },
        { key: "review", label: "Review & responses", href: `/rfp-builder/${id}/review${qs}` },
        // 2030 blueprint, Checkpoint D (17 Aug 2026): the frozen,
        // read-only record of exactly what publication produced -- the
        // one place a buyer (or, later, an invited vendor with the
        // right room-scoped access) sees the SAME content the board
        // notice, the invitations and every export all read from,
        // never a live/possibly-drifted recompute. Placed last, after
        // Review, since it only has real content once published.
        { key: "room", label: "Procurement Room", href: `/project/${id}/room${qs}` },
      ]
    : [
        // One door per activity, completed for the non-engine lane too
        // (Harry's P1 retest, 29 Jul 2026: the RFP tab, Review and edit and
        // the publish link all reached the builder). The RFP tab leaves this
        // bar exactly as it left the engine bar; editing's one door is the
        // Current RFP card's Review and edit on Overview.
        { key: "overview", label: "Overview", href: `/project/${id}${qs}` },
        { key: "preview", label: "Preview", href: `/rfp-builder/${id}/preview${qs}` },
        { key: "story", label: "Story", href: `/project/${id}/story${qs}` },
        { key: "timeline", label: "Timeline", href: `/project/${id}/timeline${qs}` },
        { key: "review", label: "Review & responses", href: `/rfp-builder/${id}/review${qs}` },
        { key: "room", label: "Procurement Room", href: `/project/${id}/room${qs}` },
      ];
  return (
    <nav aria-label="Project" className="mb-6 border-b border-[var(--ink-200,#e5e5e5)]">
      <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-sm">
        {items.map((it) => (
          <li key={it.key}>
            <Link
              href={it.href}
              className={
                it.key === active
                  ? "inline-block border-b-2 border-[var(--ink-900,#111)] pb-2 font-medium text-[var(--ink-900,#111)] no-underline"
                  : "inline-block border-b-2 border-transparent pb-2 text-[var(--ink-600,#555)] no-underline hover:text-[var(--ink-900,#111)]"
              }
            >
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
