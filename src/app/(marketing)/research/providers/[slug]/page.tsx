import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPairsFor } from "@/lib/compare-pages";
import { CLAIM_LABEL, formatDate, money, priceLabels, providerName, providerResearch, researchSlugs } from "@/lib/workbook-research";
import { Crumbs, JsonLd, PricingCite, ResearchNotice, SourceCite, breadcrumbLd, host } from "@/components/research/ResearchBits";
import { SITE_URL } from "@/lib/structured-data";

export const dynamic = "force-static";
export const dynamicParams = false;
type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return researchSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = providerResearch(slug);
  if (!r.provider) return {};
  const title = `${r.provider.name} SD-WAN and SASE evidence (updated ${formatDate(r.updated)})`;
  const description = `${r.findings.length} sourced findings, ${r.newSources.length} provider sources, ${r.cases.length} published customer cases and ${r.priceLines.filter((l) => l.amount !== null).length} list-price lines for ${r.provider.name}. Unverified provider claims with access dates.`;
  return { title, description, alternates: { canonical: `${SITE_URL}/research/providers/${slug}/` }, openGraph: { title, description, url: `${SITE_URL}/research/providers/${slug}/`, type: "article", locale: "en_GB" } };
}

const clip = (s: string, n = 400) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

export default async function ProviderResearchPage({ params }: Props) {
  const { slug } = await params;
  const r = providerResearch(slug);
  if (!r.provider) notFound();
  const name = r.provider.name;
  const path = `/research/providers/${slug}/`;
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "@id": `${SITE_URL}${path}#article`,
      headline: `${name} SD-WAN and SASE evidence`,
      description: `${r.findings.length} sourced findings and ${r.cases.length} published customer cases for ${name}.`,
      dateModified: r.updated,
      author: { "@type": "Organization", name: "Netify research team", url: "https://netify.co.uk/" },
      publisher: { "@type": "Organization", name: "Netify", url: "https://netify.co.uk/" },
      about: { "@type": "Organization", name },
      citation: r.newSources.slice(0, 50).map((s) => ({ "@type": "CreativeWork", url: s.url, name: s.title ?? s.publisher ?? host(s.url), datePublished: s.published_date ?? undefined })),
      mainEntityOfPage: `${SITE_URL}${path}`,
    },
    breadcrumbLd([{ name: "Home", path: "/" }, { name: "Research", path: "/research/" }, { name, path }]),
  ];
  const pairs = getPairsFor(slug);
  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <JsonLd data={ld} />
      <Crumbs items={[{ href: "/", label: "Netify" }, { href: "/research/", label: "Research" }, { label: name }]} />
      <p className="eyebrow mb-3" data-updated>Updated {formatDate(r.updated)} · {r.newSources.length} new sources</p>
      <h1 id="page-h1" className="mb-4">{name}: SD-WAN and SASE evidence</h1>
      <p id="page-subhead" className="text-lg text-[var(--ink-700)]">
        {r.findings.length} findings across {r.themes.length} themes, each tied to a {name} or third-party source, plus {r.cases.length} published customer case{r.cases.length === 1 ? "" : "s"}, {r.products.length} named products, {r.siteDelivery.length} location records and {r.priceLines.filter((l) => l.amount !== null).length} published list-price lines.
        {r.provider.roles.length ? ` Provider roles: ${r.provider.roles.map((x) => x.replace(/_/g, " ")).join(", ")}.` : ""}
      </p>
      <ResearchNotice />
      {pairs.length > 0 && (
        <p className="text-sm">Compare: {pairs.map((p, i) => <span key={p.slug}>{i ? " · " : ""}<Link href={`/compare/${p.slug}/`} className="underline">{providerName(p.a)} vs {providerName(p.b)}</Link></span>)}</p>
      )}

      {r.themes.map(({ theme, rows }) => (
        <section key={theme} className="mt-10">
          <h2 className="mb-3">{theme} <span className="text-base text-[var(--ink-500)]">({rows.length})</span></h2>
          <dl className="space-y-3">
            {rows.map((f) => (
              <div key={f.id}>
                <dt className="text-sm text-[var(--ink-500)]">{f.question}</dt>
                <dd>{clip(f.answer)}{f.outcome && f.outcome !== "Offered" ? ` (${f.outcome})` : ""}{f.numeric_value !== null ? ` · ${f.numeric_value}${f.unit ? ` ${f.unit}` : ""}` : ""}<br /><SourceCite id={f.source_id} /></dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {r.cases.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3">Published customer cases</h2>
          <ul className="space-y-2">
            {r.cases.map((c) => (
              <li key={c.id}>{c.customer} · {c.sector}{c.site_count !== null ? ` · ${c.site_count_qualifier === "At least" ? "at least " : ""}${c.site_count} sites` : ""}{c.user_count !== null ? ` · ${c.user_count} users` : ""}<br /><SourceCite id={c.source_id} /></li>
            ))}
          </ul>
        </section>
      )}

      {r.priceLines.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3">Published list prices</h2>
          <ul className="space-y-2">
            {r.priceLines.map((l) => (
              <li key={l.id}><strong>{money(l.amount, l.currency)}</strong>{l.charge_unit ? ` per ${l.charge_unit}` : ""}{l.period && !/^other/i.test(l.period) ? ` / ${l.period.toLowerCase()}` : ""} · {l.product}{l.component ? ` (${l.component})` : ""}<br /><span className="text-xs">{priceLabels(l).join(" · ")}</span> · <PricingCite id={l.source_id} /></li>
            ))}
          </ul>
          <p className="text-sm mt-2"><Link href="/research/list-prices/" className="underline">All published list prices</Link></p>
        </section>
      )}

      {r.products.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3">Named products</h2>
          <ul className="grid sm:grid-cols-2 gap-1 text-sm">
            {r.products.map((p) => <li key={p.id}>{p.name}{p.category ? ` · ${p.category}` : ""} · <SourceCite id={p.source_id} /></li>)}
          </ul>
        </section>
      )}

      {r.siteDelivery.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3">Locations, PoPs and cloud on-ramps</h2>
          <ul className="grid sm:grid-cols-2 gap-1 text-sm">
            {r.siteDelivery.map((d) => <li key={d.id}>{d.service}{d.country ? ` · ${d.country}` : ""} · {d.location_type} · <SourceCite id={d.source_id} /></li>)}
          </ul>
        </section>
      )}

      {r.furtherReading.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3">Further reading on pricing (third-party, not prices)</h2>
          <ul className="text-sm space-y-1">
            {r.furtherReading.map((f) => <li key={f.id}><a href={f.url} rel="nofollow noopener" target="_blank" className="underline">{f.title ?? f.publisher ?? host(f.url)}</a> · {f.publisher ?? host(f.url)}</li>)}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <h2 className="mb-3">Sources ({r.sources.length})</h2>
        <ol className="text-sm space-y-1 list-decimal pl-5">
          {r.sources.map((s) => (
            <li key={s.id} id={s.id}><a href={s.url} rel="nofollow noopener" target="_blank" className="underline">{s.title ?? host(s.url)}</a> · {s.publisher ?? host(s.url)}{s.accessed_date ? ` · accessed ${formatDate(s.accessed_date)}` : ""}{s.published_date ? ` · dated ${formatDate(s.published_date)}` : ""} · {CLAIM_LABEL[s.claim]}</li>
          ))}
        </ol>
      </section>
      <p className="mt-10 text-sm"><Link href="/research/" className="underline">All provider research</Link> · <a href="https://netify.co.uk/marketplace/" className="underline">Compare providers in the marketplace</a></p>
    </div>
  );
}

