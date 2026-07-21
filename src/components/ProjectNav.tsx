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

export type ProjectTab = "overview" | "assessment" | "rfp" | "preview" | "review" | "story" | "timeline";

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
  const items: Array<{ key: ProjectTab; label: string; href: string }> = [
    { key: "overview", label: "Overview", href: `/project/${id}${qs}` },
    ...(engine ? [{ key: "assessment" as const, label: "Assessment", href: `/project/${id}/assessment${qs}` }] : []),
    { key: "rfp", label: "RFP", href: `/rfp-builder/${id}${qs}` },
    { key: "preview", label: "Preview", href: `/rfp-builder/${id}/preview${qs}` },
    { key: "review", label: "Review & responses", href: `/rfp-builder/${id}/review${qs}` },
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
