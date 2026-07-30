import Link from "next/link";
import type { Vendor } from "@data/schema";

/**
 * The server-rendered comparison tables.
 *
 * Why this exists: the live page shipped 402,179 bytes of HTML containing zero
 * <table> elements, because every comparison was built client-side into cards.
 * An engine cannot lift a card grid it has to execute JavaScript to build. It
 * can lift a table, which is exactly what Google did to the competing pages it
 * cited for "sd-wan providers": that citation read "Table_title: Comparative
 * Overview of Leading SD-WAN Providers Table_content: ...". The parser binds
 * the caption to the content, so every caption here is written as the question
 * it answers rather than as a label.
 *
 * The split is by the BUYER'S QUESTION, not by the company's identity. Eleven
 * of the thirty suppliers both build a platform and operate it as a service.
 * Naming the tables after the two questions lets them appear in both, which is
 * correct, and makes "eleven of thirty do both" a fact worth stating.
 *
 * COLLAPSED BY DEFAULT (Robert, 29 July 2026): thirty rows of nine columns
 * opening cold is a wall, so each table sits inside a native <details>.
 * <details> is not a JavaScript reveal: the rows are in the server HTML either
 * way, so a crawler or an assistant parsing the response sees exactly the same
 * bytes it saw when the tables were open. Only the visual state changes. The
 * extractable answer paragraph deliberately stays OUTSIDE the collapse, because
 * that is the passage an engine quotes.
 *
 * Alphabetical, not ranked. These facts are defensible today; an order is not,
 * until the scoring rework lands.
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

function sourced(v: Vendor): Facts {
  return ((v as unknown as { sourced_facts?: Facts }).sourced_facts ?? {}) as Facts;
}

/** A value we can stand behind, or null. Never a guess, never a blank. */
function val(v: Vendor, key: string): string | null {
  const f = sourced(v)[key];
  if (f && f.value && f.value !== "unknown") return f.value;
  return null;
}

function Cell({ v, k }: { v: Vendor; k: string }) {
  const raw = val(v, k);
  if (raw === null) {
    return <td className="px-3.5 py-2.5 text-[var(--ink-500,#8b939d)]">Not published</td>;
  }
  return <td className="px-3.5 py-2.5 text-[var(--ink-700)]">{LABELS[raw] ?? raw}</td>;
}

type Col = { key: string; head: string; help: string };

/** Columns that separate builders. Underlay ownership is meaningless here. */
const BUILD_COLS: Col[] = [
  { key: "sse_layer_ownership", head: "SSE layer", help: "Built its own security service edge stack, or uses another vendor's" },
  { key: "f21_private_global_backbone", head: "Private backbone", help: "Traffic between regions rides a backbone the vendor owns or controls" },
  { key: "pop_count", head: "PoPs", help: "Points of presence the vendor publishes" },
  { key: "f27_integrated_next_generation_firewall", head: "Integrated NGFW", help: "Firewall built into the platform rather than a separate appliance" },
  { key: "sla_availability_pct", head: "Published SLA", help: "Availability percentage stated publicly, not just a mention of an SLA" },
  { key: "f01_fully_managed_service", head: "Fully managed", help: "Offers to run it end to end as well as sell it" },
];

/** Columns that separate operators. Feature lists do not. */
const RUN_COLS: Col[] = [
  { key: "underlay_ownership", head: "Underlay", help: "Owns the circuits and core routing, or rides someone else's" },
  { key: "sse_layer_ownership", head: "SSE layer", help: "Whose security stack the service is built on" },
  { key: "f01_fully_managed_service", head: "Fully managed", help: "Designs, deploys, monitors, changes and reports end to end" },
  { key: "f03_co_managed_service", head: "Co-managed", help: "Customer keeps selected policy and change rights" },
  { key: "f40_managed_service_assurance", head: "24/7 NOC and SOC", help: "Owns incidents to root cause and runs service reviews" },
  { key: "regulatory_documentation", head: "Compliance docs", help: "Named framework documentation found, not just a general assurance" },
  { key: "sla_availability_pct", head: "Published SLA", help: "Availability percentage stated publicly" },
];

function ComparisonTable({
  id,
  title,
  intro,
  vendors,
  cols,
}: {
  id: string;
  title: string;
  intro: string;
  vendors: Vendor[];
  cols: Col[];
}) {
  const sorted = [...vendors].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <details className="mb-4 border border-[var(--ink-200,#e8ebef)] rounded-lg overflow-hidden group">
      <summary className="cursor-pointer list-none px-4 py-3.5 bg-[var(--ink-50,#f6f8fa)] hover:bg-[var(--ink-100,#eef1f5)] flex items-baseline gap-3">
        <span aria-hidden="true" className="text-[var(--ink-500)] text-xs mt-0.5 transition-transform group-open:rotate-90">
          ▶
        </span>
        <span className="flex-1">
          <h3 id={id} className="text-base font-medium inline">
            {title}
          </h3>{" "}
          <span className="text-sm text-[var(--ink-600,#5b636e)]">
            {sorted.length} vendors, compared on {cols.length} points
          </span>
        </span>
      </summary>
      <div className="px-4 pt-4 pb-2">
        <p className="text-sm text-[var(--ink-700)] mb-4 max-w-3xl">{intro}</p>
        <div className="overflow-x-auto border border-[var(--ink-200,#e8ebef)] rounded-lg mb-2">
          <table className="w-full text-sm border-collapse min-w-[860px]">
            <caption className="sr-only">
              {title}. {sorted.length} vendors compared on{" "}
              {cols.map((c) => c.head.toLowerCase()).join(", ")}. Verified{" "}
              {sorted[0]?.last_verified ?? ""}.
            </caption>
            <thead>
              <tr className="bg-[var(--ink-50,#f6f8fa)] border-b-2 border-[var(--ink-300,#c9ced6)]">
                <th scope="col" className="text-left px-3.5 py-2.5 font-semibold text-xs text-[var(--ink-700)] whitespace-nowrap">
                  Vendor
                </th>
                {cols.map((c) => (
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
              {sorted.map((v) => {
                const reg = (v as unknown as { evidence_register?: unknown[] }).evidence_register;
                return (
                  <tr key={v.slug} className="border-b border-[var(--ink-200,#e8ebef)]">
                    <th scope="row" className="text-left px-3.5 py-2.5 font-medium whitespace-nowrap">
                      <Link href={`/vendors/${v.slug}`} className="underline">
                        {v.name}
                      </Link>
                    </th>
                    {cols.map((c) => (
                      <Cell key={c.key} v={v} k={c.key} />
                    ))}
                    <td className="px-3.5 py-2.5 text-[var(--ink-600,#5b636e)] tabular-nums">
                      {reg?.length ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

export default function ProviderTables({ vendors }: { vendors: Vendor[] }) {
  const builders = vendors.filter((v) => {
    const d = val(v, "delivery_model");
    return d === "technology_vendor" || d === "both";
  });
  const runners = vendors.filter((v) => {
    const d = val(v, "delivery_model");
    return d === "managed_provider" || d === "both";
  });
  const both = vendors.filter((v) => val(v, "delivery_model") === "both").length;
  const unplaced = vendors.filter((v) => val(v, "delivery_model") === null);

  const sources = vendors.reduce(
    (n, v) => n + ((v as unknown as { evidence_register?: unknown[] }).evidence_register?.length ?? 0),
    0,
  );
  const rejected = vendors.reduce(
    (n, v) =>
      n +
      (((v as unknown as { evidence_register?: { tier: number }[] }).evidence_register ?? []).filter(
        (e) => e.tier === 4,
      ).length),
    0,
  );

  return (
    <section className="mt-20" id="comparison-tables">
      <p className="eyebrow mb-3">The market, compared</p>
      <h2 className="mb-4">SD-WAN and SASE providers compared</h2>

      {/* The extractable answer block. Under 80 words, stating the distinction
          the head query actually turns on. Never inside a collapse: this is the
          passage an engine lifts and a reader needs before the tables mean
          anything. */}
      <p className="text-base text-[var(--ink-800,#222)] mb-4 max-w-3xl">
        The word provider means two different things in this market. Some companies build the
        SD-WAN or SASE platform and sell it as a product. Others operate a managed service on top
        of a platform, usually someone else&apos;s, and own the circuits underneath it. Buyers
        asking about providers mean one or the other, so the tables below are split by that
        question rather than by company.
      </p>

      <p className="text-sm text-[var(--ink-600,#5b636e)] mb-6 max-w-3xl">
        {vendors.length} vendors and service providers. {builders.length} build the technology,
        {runners.length} run it as a service, {both} do both and appear in both tables. Every value is
        graded from the company&apos;s own published material or an independently accountable record, with a
        quoted sentence behind each fact. {sources} sources in total, of which {rejected} were
        found and rejected.
      </p>

      <ComparisonTable
        id="technology-vendors"
        title="Who builds the technology"
        intro="Vendors that author the platform. Sold direct, through partners, and resold by most of the managed providers below. The columns are the ones that separate builders: whose security stack it is, whether there is a real backbone behind it, and how large the published footprint actually is."
        vendors={builders}
        cols={BUILD_COLS}
      />

      <ComparisonTable
        id="managed-providers"
        title="Who runs it for you"
        intro="Service providers that operate the service. Most run a technology vendor's platform, so feature lists do not separate them. What separates them is who owns the circuits, how much of the operation they take on, and whether the compliance documentation actually exists."
        vendors={runners}
        cols={RUN_COLS}
      />

      {unplaced.length > 0 && (
        <p className="text-sm text-[var(--ink-700)] max-w-3xl mt-5">
          {unplaced.length === 1 ? "One vendor is" : `${unplaced.length} vendors are`} held back
          from the tables above: {unplaced.map((v) => v.name).join(", ")}. Their delivery model
          could not be confirmed from a sentence we could quote on their own published material.
        </p>
      )}

      <p className="text-sm text-[var(--ink-600,#5b636e)] max-w-3xl mt-4">
        Where evidence was not found, a cell reads Not published rather than being inferred. Full
        sources for each one sit on its profile page, including the sources we found and
        rejected.
      </p>
    </section>
  );
}
