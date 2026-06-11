import { STATUS_LABELS, type ComparisonResult } from "@/lib/shortlist-core";

/**
 * Grade table for 2 or 3 vendors. Server-renderable (no hooks) so the
 * compare pages ship the full table in HTML for crawlers; also used by
 * the client-side compare panel and AI assistant.
 */

const GRADE_CLASS: Record<string, string> = {
  yes: "bg-emerald-100 text-emerald-900",
  partial: "bg-amber-100 text-amber-900",
  partner_integrated: "bg-sky-100 text-sky-900",
  managed_service_dependent: "bg-indigo-100 text-indigo-900",
  not_primary: "bg-gray-200 text-gray-600",
  unknown: "bg-gray-100 text-gray-500",
};

function gradeLabel(value: string): string {
  return (STATUS_LABELS as Record<string, string>)[value] ?? value;
}

export default function CompareTable({ comparison }: { comparison: ComparisonResult }) {
  const { slugs, names, groups } = comparison;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left py-2 pr-3 border-b-2 border-[var(--ink-900)] w-1/3">
              Capability
            </th>
            {slugs.map((s) => (
              <th key={s} className="text-left py-2 px-3 border-b-2 border-[var(--ink-900)]">
                {names[s]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Group key={g.name} group={g} slugs={slugs} />
          ))}
        </tbody>
      </table>
      <p className="text-xs text-[var(--ink-500)] mt-3">
        Grades: Yes (public evidence), Partial, Via partner, Via managed
        service, Not primary, Not confirmed. Extended dimensions are indicative
        desk research; confirm via RFP.
      </p>
    </div>
  );
}

function Group({ group, slugs }: { group: { name: string; rows: { key: string; label: string; grades: Record<string, string> }[] }; slugs: string[] }) {
  return (
    <>
      <tr>
        <td colSpan={slugs.length + 1} className="pt-5 pb-1">
          <span className="eyebrow">{group.name}</span>
        </td>
      </tr>
      {group.rows.map((row) => (
        <tr key={row.key} className="border-b border-[var(--ink-200,#e5e5e5)]">
          <td className="py-1.5 pr-3 text-[var(--ink-700)]">{row.label}</td>
          {slugs.map((s) => (
            <td key={s} className="py-1.5 px-3">
              <span
                className={`inline-block px-2 py-0.5 rounded-sm text-xs ${GRADE_CLASS[row.grades[s]] ?? "bg-gray-100 text-gray-600"}`}
              >
                {gradeLabel(row.grades[s])}
              </span>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
