import Link from "next/link";
import { getAllVendors } from "@/lib/vendors";
import type { Vendor } from "@data/schema";

/**
 * One server-rendered evidence table, reused by every page that ranks or lists
 * suppliers: /best/*, /alternatives/* and anywhere else a ranked set appears.
 *
 * Why it exists. The pages earning Netify's citation share are not the head-term
 * shortlist, they are the qualified cuts: "top SD-WAN vendors healthcare
 * industry", "affordable SASE providers for global enterprise networks",
 * "Forcepoint SASE evaluation". Measured 29 July 2026, those sit between 17 and
 * 43 per cent citation share. Every one of those pages was rendering a scored
 * card list and no table at all, so the engine quoting them had nothing
 * structured to lift. This puts the same extractable shape on all of them.
 *
 * Takes an ordered list of slugs so the caller keeps control of the ranking,
 * and reads the full records itself so callers holding the compact shortlist
 * dataset do not have to change.
 */

const LABELS: Record<string, string> = {
  yes: "Yes",
  partial: "Partial",
  partner_integrated: "Partner",
  managed_service_dependent: "Via managed service",
  not_primary: "Not primary",
  owns_own_circuits: "Owns",
  resells_third_party_circuits: "Resells",
  customer_supplied_only: "Customer supplied",
  mixed: "Mixed",
  native: "Native",
  partner: "Partner",
  resold: "Resold",
  none: "None",
  technology_vendor: "Builds",
  managed_provider: "Runs",
  both: "Both",
  documented: "Documented",
  assurance_only: "Assurance only",
  not_found: "None found",
};

type Facts = Record<string, { value: string; quote: string; note: string | null }>;

function val(v: Vendor, key: string): string | null {
  const f = ((v as unknown as { sourced_facts?: Facts }).sourced_facts ?? {})[key];
  if (f && f.value && f.value !== "unknown") return f.value;
  return null;
}

const COLS: { key: string; head: string; help: string }[] = [
  { key: "delivery_model", head: "Type", help: "Builds the platform, operates a managed service, or both" },
  { key: "underlay_ownership", head: "Underlay", help: "Owns the circuits and core routing, or rides someone else's" },
  { key: "sse_layer_ownership", head: "SSE layer", help: "Built its own security service edge stack, or uses another vendor's" },
  { key: "f21_private_global_backbone", head: "Backbone", help: "Traffic between regions rides a backbone the vendor owns or controls" },
  { key: "pop_count", head: "PoPs", help: "Points of presence the vendor publishes" },
  { key: "f01_fully_managed_service", head: "Fully managed", help: "Designs, deploys, monitors, changes and reports end to end" },
  { key: "regulatory_documentation", head: "Compliance docs", help: "Named framework documentation found, not just a general assurance" },
  { key: "sla_availability_pct", head: "Published SLA", help: "Availability percentage stated publicly" },
];

export default function SourcedTable({
  slugs,
  caption,
  intro,
  id = "evidence-table",
  ranked = true,
}: {
  /** Ordered slugs. Order is the caller's ranking and is preserved. */
  slugs: string[];
  /** Written as the question this page answers: it becomes the table title an engine binds to. */
  caption: string;
  intro?: string;
  id?: string;
  ranked?: boolean;
}) {
  const all = getAllVendors();
  const bySlug = new Map(all.map((v) => [v.slug, v]));
  const rows = slugs.map((s) => bySlug.get(s)).filter((v): v is Vendor => Boolean(v));
  if (rows.length === 0) return null;

  const verified = rows[0]?.last_verified ?? "";
  const sources = rows.reduce(
    (n, v) => n + ((v as unknown as { evidence_register?: unknown[] }).evidence_register?.length ?? 0),
    0,
  );

  return (
    <section className="mt-14" id={id}>
      <h2 className="mb-3">{caption}</h2>
      {intro && <p className="text-sm text-[var(--ink-700)] mb-4 max-w-3xl">{intro}</p>}
      <p className="text-sm text-[var(--ink-600,#5b636e)] mb-4 max-w-3xl">
        {rows.length} vendors. Each value below is graded from the vendor&apos;s own published
        material or an independently accountable record, with a sentence quoted from that source
        and confirmed present on the page. {sources} sources behind this table. Verified {verified}.
        Where evidence was not found a cell reads Not published rather than being inferred.
      </p>
      <div className="overflow-x-auto border border-[var(--ink-200,#e8ebef)] rounded-lg">
        <table className="w-full text-sm border-collapse min-w-[880px]">
          <caption className="sr-only">
            {caption}. {rows.length} vendors compared on{" "}
            {COLS.map((c) => c.head.toLowerCase()).join(", ")}. Verified {verified}.
          </caption>
          <thead>
            <tr className="bg-[var(--ink-50,#f6f8fa)] border-b-2 border-[var(--ink-300,#c9ced6)]">
              {ranked && (
                <th scope="col" className="text-left px-3 py-2.5 font-semibold text-xs text-[var(--ink-700)]">
                  #
                </th>
              )}
              <th scope="col" className="text-left px-3.5 py-2.5 font-semibold text-xs text-[var(--ink-700)] whitespace-nowrap">
                Vendor
              </th>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  title={c.help}
                  className="text-left px-3.5 py-2.5 font-semibold text-xs text-[var(--ink-700)] whitespace-nowrap"
                >
                  {c.head}
                </th>
              ))}
              <th scope="col" title="Named sources in this vendor's evidence register" className="text-left px-3.5 py-2.5 font-semibold text-xs text-[var(--ink-700)]">
                Sources
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v, i) => {
              const reg = (v as unknown as { evidence_register?: unknown[] }).evidence_register;
              return (
                <tr key={v.slug} className="border-b border-[var(--ink-200,#e8ebef)]">
                  {ranked && (
                    <td className="px-3 py-2.5 text-[var(--ink-600,#5b636e)] tabular-nums">{i + 1}</td>
                  )}
                  <th scope="row" className="text-left px-3.5 py-2.5 font-medium whitespace-nowrap">
                    <Link href={`/vendors/${v.slug}`} className="underline">
                      {v.name}
                    </Link>
                  </th>
                  {COLS.map((c) => {
                    const raw = val(v, c.key);
                    return raw === null ? (
                      <td key={c.key} className="px-3.5 py-2.5 text-[var(--ink-500,#8b939d)]">
                        Not published
                      </td>
                    ) : (
                      <td key={c.key} className="px-3.5 py-2.5 text-[var(--ink-700)]">
                        {LABELS[raw] ?? raw}
                      </td>
                    );
                  })}
                  <td className="px-3.5 py-2.5 text-[var(--ink-600,#5b636e)] tabular-nums">
                    {reg?.length ?? 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-[var(--ink-600,#5b636e)] mt-3 max-w-3xl">
        Full sources for each vendor, including the sources we found and rejected and any claims
        that disagree, are on its{" "}
        <Link href="/vendors" className="underline">
          profile page
        </Link>
        .
      </p>
    </section>
  );
}
