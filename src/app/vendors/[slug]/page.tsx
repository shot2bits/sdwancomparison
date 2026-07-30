import Link from "next/link";
import { notFound } from "next/navigation";
import RecordEditLink from "@/components/RecordEditLink";
import type { Metadata } from "next";
import {
  getAllVendorSlugs,
  getVendor,
  getCapabilitiesByCategory,
  FEATURE_NAMES,
  STATUS_LABELS,
  STATUS_DESCRIPTIONS,
} from "@/lib/vendors";
import {
  getBestAppearances,
  getClosePeers,
  getHeadToHeads,
  getResearchFor,
} from "@/lib/profile-edges";
import { SITE_URL } from "@/lib/structured-data";
import Continuation from "@/components/Continuation";
import { deriveContinuation } from "@/lib/continuation/derive";
import { continuationUrl } from "@/lib/continuation/types";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return getAllVendorSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const vendor = getVendor(slug);
    const longTitle = `${vendor.name}: SD-WAN and SASE capability profile`;
    const title = longTitle.length <= 56 ? longTitle : `${vendor.name}: capability profile`;
    const description = `${vendor.name} graded on 40 SD-WAN and SASE features: ${vendor.score_summary.yes_count} yes, ${vendor.score_summary.partial_count} partial. Profile, FAQs, alternatives and contact route.`.slice(0, 160);
    return {
      title,
      description,
      alternates: { canonical: `${SITE_URL}/vendors/${slug}/` },
      openGraph: {
        title,
        description,
        type: "article",
        url: `${SITE_URL}/vendors/${slug}/`,
      },
    };
  } catch {
    return { title: "Vendor not found" };
  }
}

export default async function VendorPage({ params }: Props) {
  const { slug } = await params;
  let vendor;
  try {
    vendor = getVendor(slug);
  } catch {
    notFound();
  }
  const continuation = deriveContinuation({ kind: "vendor", vendor });

  // Provenance, added 29 July 2026. Tier 4 sources were read and rejected;
  // they are rendered separately rather than hidden, which is the whole point.
  const register = vendor.evidence_register ?? [];
  const usedSources = register.filter((e) => e.tier !== 4);
  const rejectedSources = register.filter((e) => e.tier === 4);
  const conflicts = vendor.conflicts ?? [];
  const sourcedFacts = Object.entries(vendor.sourced_facts ?? {});

  const capByCat = getCapabilitiesByCategory(vendor);
  const totalFeatures = 40;
  const yesPct = Math.round((vendor.score_summary.yes_count / totalFeatures) * 100);

  // The derived edges (final architecture §4.2): head-to-heads, best-for
  // appearances, close peers and research, all computed from the datasets
  // at build time. Empty lists render nothing; no edge is ever invented.
  const headToHeads = getHeadToHeads(vendor.slug);
  const bestAppearances = getBestAppearances(vendor.slug);
  const closePeers = getClosePeers(vendor.slug);
  const research = getResearchFor(vendor.slug);

  // JSON-LD for structured data: supports AI and search citation
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${vendor.name}: SD-WAN and SASE capability profile`,
    description: vendor.evidence_summary,
    url: `${SITE_URL}/vendors/${vendor.slug}/`,
    dateModified: vendor.last_verified,
    about: {
      "@type": "Organization",
      name: vendor.name,
      url: vendor.website,
    },
    publisher: {
      "@type": "Organization",
      name: "Netify",
      url: "https://netify.co.uk",
    },
    isBasedOn: vendor.primary_sources.map((url) => ({
      "@type": "WebPage",
      url,
    })),
  };

  // The agentic evaluation kit (20 July 2026): research agents ground
  // vendor-evaluation reports on this page. The CreateAction and the
  // Evaluate section give those reports a next step a buyer can click.
  const evaluateLd = {
    "@context": "https://schema.org",
    "@type": "CreateAction",
    name: `Evaluate ${vendor.name} with a structured RFP`,
    description: `Netify's free RFP builder pre-loads ${vendor.name} for an evidence-graded evaluation against its closest alternatives, sent to matched vendors and service providers with responses side by side.`,
    target: `${SITE_URL}/rfp-builder/new/?vendors=${vendor.slug}`,
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: vendor.vendor_faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(evaluateLd) }}
      />

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Breadcrumb */}
        <nav className="text-sm mb-8 text-[var(--ink-500)]">
          <Link href="/" className="no-underline text-[var(--ink-500)] hover:text-[var(--accent)]">
            Netify
          </Link>
          <span className="mx-2 text-[var(--ink-300)]">/</span>
          <Link href="/vendors" className="no-underline text-[var(--ink-500)] hover:text-[var(--accent)]">
            Vendors
          </Link>
          <span className="mx-2 text-[var(--ink-300)]">/</span>
          <span className="text-[var(--ink-700)]">{vendor.name}</span>
        </nav>

        {/* Netify only, renders nothing for anyone else. See RecordEditLink. */}
        <RecordEditLink slug={vendor.slug} />

        {/* Hero */}
        <header className="mb-16 grid md:grid-cols-12 gap-8 fade-rise">
          <div className="md:col-span-8">
            <p className="eyebrow mb-3">{vendor.category}</p>
            <h1 id="page-h1" className="display mb-6" style={{ fontSize: "var(--text-display)", fontWeight: 600, letterSpacing: "-0.02em" }}>
              {vendor.name}
            </h1>
            <p id="page-subhead" className="text-lg text-[var(--ink-700)] mb-6 max-w-2xl">
              {vendor.evidence_summary}
            </p>
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <a
                href={vendor.marketplace_url ?? "https://netify.co.uk/marketplace/"}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-zinc-950 font-medium no-underline hover:bg-amber-400 transition-colors rounded-full"
              >
                Contact {vendor.name} via Netify ↗
              </a>
              <a href={vendor.website} target="_blank" rel="noopener" className="no-underline">
                {vendor.website.replace(/^https?:\/\//, "").split("/")[0]} ↗
              </a>
              <a href={`/sase/alternatives/${vendor.slug}`} className="no-underline">
                {vendor.name} alternatives
              </a>
              <span className="text-[var(--ink-500)]">
                Last verified {vendor.last_verified}
              </span>
            </div>
          </div>

          {/* Score sidebar */}
          <aside className="md:col-span-4 md:border-l md:border-[var(--ink-200)] md:pl-6">
            <p className="eyebrow mb-4">Capability scorecard</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <ScoreCell label="Yes" value={vendor.score_summary.yes_count} statusClass="status-yes" />
              <ScoreCell label="Partial" value={vendor.score_summary.partial_count} statusClass="status-partial" />
              <ScoreCell label="Partner" value={vendor.score_summary.partner_integrated_count} statusClass="status-partner_integrated" />
              <ScoreCell label="Managed" value={vendor.score_summary.managed_service_dependent_count} statusClass="status-managed_service_dependent" />
              <ScoreCell label="Not primary" value={vendor.score_summary.not_primary_count} statusClass="status-not_primary" />
              <ScoreCell label="Unknown" value={vendor.score_summary.unknown_count} statusClass="status-unknown" />
            </div>
            <p className="text-xs text-[var(--ink-500)] mt-2">
              Out of 40 features. Evidence coverage{" "}
              {Math.round(vendor.score_summary.evidence_coverage_pct * 100)}%.
            </p>
          </aside>
        </header>

        <hr className="rule mb-16" />

        {/* Full editorial profile */}
        <section className="mb-16 max-w-3xl">
          <p className="eyebrow mb-2">Netify profile</p>
          <h2 className="mb-6">{vendor.name} in depth</h2>
          <div className="space-y-8">
            <div>
              <h3 className="text-base font-medium mb-2">Platform and architecture</h3>
              <p className="text-[var(--ink-700)]">{vendor.profile.platform_architecture}</p>
            </div>
            <div>
              <h3 className="text-base font-medium mb-2">Security and SASE capability</h3>
              <p className="text-[var(--ink-700)]">{vendor.profile.security_sase}</p>
            </div>
            <div>
              <h3 className="text-base font-medium mb-2">Service, support and channel</h3>
              <p className="text-[var(--ink-700)]">{vendor.profile.service_support_channel}</p>
            </div>
            <div>
              <h3 className="text-base font-medium mb-2">Commercials and the Netify verdict</h3>
              <p className="text-[var(--ink-700)]">{vendor.profile.commercials_verdict}</p>
            </div>
          </div>
        </section>

        {/* Evaluate block: written to survive into an agent's evaluation report */}
        <section className="mt-10 border-t border-[var(--ink-300,#ccc)] pt-6">
          <h2 className="text-lg mb-2">Evaluate {vendor.name} properly</h2>
          {/* One Door (DEF wave one follow-up, Robert's word 23 Jul): the
              advantage statement keeps the page-standards law (what the
              platform does that an AI cannot, one action, named tools) but
              its destination is the Workspace; the Builder is recommended
              from inside the position when it is warranted. */}
          <p className="text-sm text-[var(--ink-700)] max-w-3xl">
            An AI can summarise {vendor.name}. It cannot gather structured, evidence-backed responses from
            {" "}{vendor.name} and its closest competitors. Describe your requirement once at{" "}
            <a className="underline" href={continuation ? continuationUrl(continuation.sentence, continuation.pins) : "https://netify.co.uk/"}>netify.co.uk</a>{" "}
            and {vendor.name} arrives pinned for an evidence-graded evaluation: the market takes position
            around your words, one signature publishes an anonymous notice free, and matched vendors
            respond side by side with pricing private to you.
          </p>
          <p className="mt-2 text-sm text-[var(--ink-700)] max-w-3xl">
            AI assistants can score {vendor.name} against a requirements list directly with the{" "}
            <code className="text-[13px]">score_vendor_fit</code> tool on the{" "}
            <a className="underline" href="/sase/connector/">Netify connector</a>, and build the same
            position with <code className="text-[13px]">workspace_ingest</code>.
          </p>
        </section>

        {/* Vendor FAQs */}
        <section className="mb-16 max-w-3xl">
          <p className="eyebrow mb-2">Questions</p>
          <h2 className="mb-6">{vendor.name}: common buyer questions</h2>
          <div className="space-y-6">
            {vendor.vendor_faqs.map((f) => (
              <div key={f.q}>
                <h3 className="text-base font-medium mb-1">{f.q}</h3>
                <p className="text-sm text-[var(--ink-700)]">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Editorial: differentiators / fit / watch-outs */}
        <section className="grid md:grid-cols-3 gap-8 mb-16">
          <div>
            <p className="eyebrow mb-4">Key differentiators</p>
            <ul className="space-y-4">
              {vendor.key_differentiators.map((d, i) => (
                <li key={i} className="text-[var(--ink-700)] pl-4 border-l-2 border-[var(--accent)]">
                  {d}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-4">Best fit for</p>
            <ul className="space-y-4">
              {vendor.best_fit_for.map((d, i) => (
                <li key={i} className="text-[var(--ink-700)] pl-4 border-l-2 border-[var(--ink-200)]">
                  {d}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-4">Watch-outs</p>
            <ul className="space-y-4">
              {vendor.watch_outs.map((d, i) => (
                <li key={i} className="text-[var(--ink-700)] pl-4 border-l-2 border-[var(--status-partial)]">
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <hr className="rule mb-16" />

        {/* Capability matrix */}
        <section className="mb-16">
          <div className="grid md:grid-cols-12 gap-6 mb-8">
            <div className="md:col-span-4">
              <p className="eyebrow mb-2">40 features, 6 categories</p>
              <h2>Capability matrix</h2>
            </div>
            <div className="md:col-span-7 md:col-start-6">
              <p className="text-[var(--ink-700)]">
                Each capability is graded against public source evidence. Hover any
                status grade for a definition. Where evidence is limited, the grade
                reflects that uncertainty rather than assuming the capability is
                present.
              </p>
            </div>
          </div>

          <div className="space-y-12">
            {capByCat.map(({ category, features }) => (
              <div key={category}>
                <h3 className="mb-4 pb-2 border-b-2 border-[var(--ink-900)]">{category}</h3>
                <table className="matrix-table">
                  <thead>
                    <tr>
                      <th style={{ width: "8%" }}>#</th>
                      <th style={{ width: "32%" }}>Capability</th>
                      <th style={{ width: "20%" }}>Status</th>
                      <th>Definition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {features.map(({ feature, status }) => (
                      <tr key={feature.id}>
                        <td className="font-mono text-xs text-[var(--ink-500)]">
                          F{String(feature.number).padStart(2, "0")}
                        </td>
                        <td className="font-medium">{feature.name}</td>
                        <td>
                          <span
                            className={`status-pill status-${status}`}
                            title={STATUS_DESCRIPTIONS[status]}
                          >
                            {STATUS_LABELS[status]}
                          </span>
                        </td>
                        <td className="text-sm text-[var(--ink-700)]">
                          {feature.definition}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>

        <hr className="rule mb-16" />

        {/* Commercial */}
        <section className="grid md:grid-cols-12 gap-8 mb-16">
          <div className="md:col-span-4">
            <p className="eyebrow mb-2">Commercial</p>
            <h2>Cost model and pricing visibility</h2>
          </div>
          <div className="md:col-span-7 md:col-start-6 space-y-4">
            <div>
              <p className="eyebrow mb-2">Public pricing visibility</p>
              <p className="text-[var(--ink-700)]">
                {vendor.public_pricing_visibility === "quote_based"
                  ? "Quote-based. No complete public enterprise price was found in reviewed sources."
                  : vendor.public_pricing_visibility === "partial_public"
                    ? "Partial public pricing. Some elements published, full enterprise pricing typically quote-based."
                    : "Public pricing available."}
              </p>
            </div>
            <div>
              <p className="eyebrow mb-2">Cost model</p>
              <p className="text-[var(--ink-700)]">{vendor.cost_model}</p>
            </div>
          </div>
        </section>

        <hr className="rule mb-16" />

        {/* Sources. The evidence register: every source used, every source
            rejected, and the sentence each graded fact rests on. No competitor
            publishes its exclusions, which is the reason to do it. */}
        <section className="mb-16" id="evidence">
          <div className="grid md:grid-cols-12 gap-6 mb-6">
            <div className="md:col-span-4">
              <p className="eyebrow mb-2">Evidence</p>
              <h2>Sources and exclusions</h2>
            </div>
            <div className="md:col-span-7 md:col-start-6">
              <p className="text-[var(--ink-700)]">
                {sourcedFacts.length > 0 ? (
                  <>
                    {sourcedFacts.length} facts about {vendor.name} were re-verified on{" "}
                    {vendor.last_verified} against named sources, each carrying a sentence quoted
                    from the source and confirmed present on that page. {usedSources.length}{" "}
                    sources were used.{" "}
                    {rejectedSources.length > 0
                      ? `${rejectedSources.length} more were read and rejected, and are listed below with the reason.`
                      : ""}
                  </>
                ) : (
                  <>Primary sources behind this record. Reviewed {vendor.last_verified}.</>
                )}
              </p>
            </div>
          </div>

          {sourcedFacts.length > 0 && (
            <div className="overflow-x-auto border border-[var(--ink-200)] rounded-lg mb-8">
              <table className="w-full text-sm border-collapse min-w-[720px]">
                <caption className="sr-only">
                  Sourced facts for {vendor.name}, each with its grade, the source it rests on and
                  the sentence quoted from that source.
                </caption>
                <thead>
                  <tr className="bg-[var(--ink-50,#f6f8fa)] border-b-2 border-[var(--ink-300,#c9ced6)]">
                    <th scope="col" className="text-left px-3.5 py-2.5 text-xs font-semibold">
                      Fact
                    </th>
                    <th scope="col" className="text-left px-3.5 py-2.5 text-xs font-semibold">
                      Finding
                    </th>
                    <th scope="col" className="text-left px-3.5 py-2.5 text-xs font-semibold">
                      Evidence
                    </th>
                    <th scope="col" className="text-left px-3.5 py-2.5 text-xs font-semibold">
                      Quoted from the source
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sourcedFacts.map(([key, f]) => (
                    <tr key={key} className="border-b border-[var(--ink-200)] align-top">
                      <th
                        scope="row"
                        className="text-left px-3.5 py-2.5 font-medium whitespace-nowrap"
                      >
                        {FEATURE_NAMES[key] ?? key.replace(/_/g, " ")}
                      </th>
                      <td className="px-3.5 py-2.5 text-[var(--ink-700)] whitespace-nowrap">
                        {f.value === "unknown"
                          ? "Not found"
                          : (STATUS_LABELS[f.value] ?? f.value)}
                      </td>
                      <td className="px-3.5 py-2.5 text-[var(--ink-600,#5b636e)] whitespace-nowrap">
                        {f.evidence.length > 0
                          ? f.evidence.map((n) => `[${n}]`).join(" ")
                          : "none"}
                      </td>
                      <td className="px-3.5 py-2.5 text-[var(--ink-700)]">
                        {f.quote ? (
                          `"${f.quote}"`
                        ) : (
                          <span className="text-[var(--ink-500)]">
                            {f.note ?? "Not found in public sources reviewed."}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="text-base font-medium mb-3">Sources used</h3>
          <ol className="space-y-2 text-[var(--ink-700)] mb-8">
            {usedSources.length > 0
              ? usedSources.map((e) => (
                  <li key={e.n} className="text-sm break-words">
                    <span className="font-medium">[{e.n}]</span> Tier {e.tier}.{" "}
                    <a href={e.url} target="_blank" rel="noopener" className="underline">
                      {e.title}
                    </a>
                    {e.published ? ` Published ${e.published}.` : " Undated."}{" "}
                    <span className="text-[var(--ink-500)]">
                      Read {e.verified_on}. {e.reliability}
                    </span>
                  </li>
                ))
              : vendor.primary_sources.map((url, i) => (
                  <li key={i} className="text-sm break-words">
                    <a href={url} target="_blank" rel="noopener" className="underline">
                      {url}
                    </a>
                  </li>
                ))}
          </ol>

          {rejectedSources.length > 0 && (
            <div className="mb-8">
              <h3 className="text-base font-medium mb-2">Sources found and not used</h3>
              <p className="text-sm text-[var(--ink-700)] mb-3 max-w-3xl">
                These were read and rejected as evidence. They are listed so the record can be
                audited rather than taken on trust, and because what a comparison refuses to rely
                on says as much as what it cites.
              </p>
              <ol className="space-y-2 text-[var(--ink-600,#5b636e)]">
                {rejectedSources.map((e) => (
                  <li key={e.n} className="text-sm break-words">
                    <span className="font-medium">[{e.n}]</span> {e.title}.{" "}
                    <a href={e.url} target="_blank" rel="noopener" className="underline">
                      {e.url}
                    </a>{" "}
                    {e.reliability}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {conflicts.length > 0 && (
            <div>
              <h3 className="text-base font-medium mb-2">Claims that disagree</h3>
              <p className="text-sm text-[var(--ink-700)] mb-3 max-w-3xl">
                Where two sources conflict, both are recorded rather than one being chosen
                quietly. Confirm these directly with the vendor.
              </p>
              <ul className="space-y-3 text-sm text-[var(--ink-700)]">
                {conflicts.map((c, i) => (
                  <li key={i}>
                    <span className="font-medium">{c.field.replace(/_/g, " ")}.</span> [
                    {c.source_a}] {c.claim_a} [{c.source_b}] {c.claim_b}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Provenance */}
        <section className="border-t border-[var(--ink-200)] pt-8 text-sm text-[var(--ink-500)]">
          <p className="eyebrow mb-2">Verification notes</p>
          <p className="max-w-3xl">{vendor.verification_notes}</p>
        </section>

        {/* Continue your evaluation: the derived edges. Every row below is
            computed from a dataset the reader can inspect; a row with no
            data does not render. */}
        <section aria-label={`Continue your ${vendor.name} evaluation`} className="mt-16 border-t-2 border-[var(--ink-900)] pt-8">
          <p className="eyebrow mb-2">Where next</p>
          <h2 className="mb-6">Continue your {vendor.name} evaluation</h2>

          {/* The Continuation (DEF wave one): derived from this vendor's own
              record or not rendered at all. No derivation, no rendering. */}
          <div className="mb-10">
            <Continuation c={continuation} pageUrl={`${SITE_URL}/vendors/${vendor.slug}`} />
          </div>

          <div className="space-y-8">
            {research.length > 0 && (
              <div>
                <p className="eyebrow mb-3">Research covering {vendor.name}</p>
                <ul className="space-y-2">
                  {research.map((m) => (
                    <li key={m.url}>
                      <a href={m.url} className="text-[var(--ink-700)] hover:text-[var(--accent)]">
                        {m.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {headToHeads.length > 0 && (
              <div>
                <p className="eyebrow mb-3">Head to head</p>
                <div className="flex flex-wrap gap-2">
                  {headToHeads.map((p) => (
                    <Link
                      key={p.slug}
                      href={`/compare/${p.slug}`}
                      className="px-3.5 py-1.5 text-sm rounded-full border border-[var(--ink-300,#ccc)] no-underline hover:border-[var(--ink-900)]"
                    >
                      {vendor.name} vs {p.otherName}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {bestAppearances.length > 0 && (
              <div>
                <p className="eyebrow mb-3">Ranked shortlists featuring {vendor.name}</p>
                <div className="flex flex-wrap gap-2">
                  {bestAppearances.map((b) => (
                    <Link
                      key={b.slug}
                      href={`/best/${b.slug}`}
                      className="px-3.5 py-1.5 text-sm rounded-full border border-[var(--ink-300,#ccc)] no-underline hover:border-[var(--ink-900)]"
                    >
                      {b.title} · #{b.rank}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {closePeers.length > 0 && (
              <div>
                <p className="eyebrow mb-3">Close peers in the directory</p>
                <div className="flex flex-wrap gap-2">
                  {closePeers.map((p) => (
                    <Link
                      key={p.slug}
                      href={`/vendors/${p.slug}`}
                      className="px-3.5 py-1.5 text-sm rounded-full border border-[var(--ink-300,#ccc)] no-underline hover:border-[var(--ink-900)]"
                    >
                      {p.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href={`/shortlist`}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm border border-[var(--ink-300,#ccc)] rounded-full no-underline hover:border-[var(--ink-900)]"
              >
                Score {vendor.name} against your requirements
              </Link>
              <Link
                href="/vendors"
                className="inline-flex items-center px-4 py-2.5 text-sm border border-[var(--ink-300,#ccc)] rounded-full no-underline hover:border-[var(--ink-900)]"
              >
                Back to the evaluated directory
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function ScoreCell({
  label,
  value,
  statusClass,
}: {
  label: string;
  value: number;
  statusClass: string;
}) {
  return (
    <div className="flex flex-col items-start">
      <span className={`status-pill ${statusClass} mb-1`}>{label}</span>
      <span className="display text-2xl font-medium">{value}</span>
    </div>
  );
}
