import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getAllVendorSlugs,
  getVendor,
  getCapabilitiesByCategory,
  STATUS_LABELS,
  STATUS_DESCRIPTIONS,
} from "@/lib/vendors";
import { SITE_URL } from "@/lib/structured-data";

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

  const capByCat = getCapabilitiesByCategory(vendor);
  const totalFeatures = 40;
  const yesPct = Math.round((vendor.score_summary.yes_count / totalFeatures) * 100);

  // JSON-LD for structured data: supports AI and search citation
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${vendor.name}: SD-WAN and SASE capability profile`,
    description: vendor.evidence_summary,
    url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://netify.co.uk/sase"}/vendors/${vendor.slug}`,
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
              <a href={`/alternatives/${vendor.slug}`} className="no-underline">
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

        {/* Sources */}
        <section className="mb-16">
          <div className="grid md:grid-cols-12 gap-6 mb-6">
            <div className="md:col-span-4">
              <p className="eyebrow mb-2">Evidence</p>
              <h2>Primary sources</h2>
            </div>
            <div className="md:col-span-7 md:col-start-6">
              <p className="text-[var(--ink-700)]">
                Every capability grade traces back to one of these sources. Reviewed{" "}
                {vendor.last_verified}.
              </p>
            </div>
          </div>
          <ol className="space-y-3 list-decimal list-inside text-[var(--ink-700)]">
            {vendor.primary_sources.map((url, i) => (
              <li key={i} className="break-words">
                <a href={url} target="_blank" rel="noopener" className="text-sm">
                  {url}
                </a>
              </li>
            ))}
          </ol>
        </section>

        {/* Provenance */}
        <section className="border-t border-[var(--ink-200)] pt-8 text-sm text-[var(--ink-500)]">
          <p className="eyebrow mb-2">Verification notes</p>
          <p className="max-w-3xl">{vendor.verification_notes}</p>
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
