import type { Metadata } from "next";
import Link from "next/link";
import { RESEARCH, formatDate, money, priceLabels, providerName } from "@/lib/workbook-research";
import { Crumbs, JsonLd, PricingCite, breadcrumbLd, host } from "@/components/research/ResearchBits";
import { SITE_URL } from "@/lib/structured-data";

export const dynamic = "force-static";

const priced = RESEARCH.price_lines.filter((l) => l.amount !== null);
const uk = priced.filter((l) => !l.non_uk);
const TITLE = `SD-WAN and SASE list prices: ${priced.length} published prices with sources (${formatDate(RESEARCH.evidence_window.pricing_observed_to)})`;
const DESCRIPTION = `${priced.length} published SD-WAN, SASE and connectivity list prices from ${new Set(priced.map((l) => l.slug)).size} providers, each with currency, source and date. ${uk.length} are UK (GBP) prices. List or published prices, not quotes.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/research/list-prices/` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/research/list-prices/`, type: "article", locale: "en_GB" },
};

const period = (p: string | null) => (p && !/^other/i.test(p) ? ` / ${p.toLowerCase()}` : "");

export default function ListPricesPage() {
  const offersById = new Map(RESEARCH.offers.map((o) => [o.id, o]));
  const sorted = [...RESEARCH.price_lines].sort((a, b) => Number(a.non_uk) - Number(b.non_uk) || Number(a.historical) - Number(b.historical) || providerName(a.slug).localeCompare(providerName(b.slug)));
  const quoteOnly = RESEARCH.offers.filter((o) => /quotation/i.test(o.evidence_route ?? ""));
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      "@id": `${SITE_URL}/research/list-prices/#dataset`,
      name: "Published SD-WAN and SASE list prices",
      description: DESCRIPTION,
      url: `${SITE_URL}/research/list-prices/`,
      dateModified: RESEARCH.evidence_window.pricing_observed_to,
      creator: { "@type": "Organization", name: "Netify", url: "https://netify.co.uk/" },
      license: "https://creativecommons.org/licenses/by/4.0/",
      isAccessibleForFree: true,
      distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE_URL}/research/data.json` }],
    },
    breadcrumbLd([{ name: "Home", path: "/" }, { name: "Research", path: "/research/" }, { name: "List prices", path: "/research/list-prices/" }]),
  ];
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <JsonLd data={ld} />
      <Crumbs items={[{ href: "/", label: "Netify" }, { href: "/research/", label: "Research" }, { label: "List prices" }]} />
      <p className="eyebrow mb-3">Published prices · Seen {formatDate(RESEARCH.evidence_window.pricing_observed_from)} to {formatDate(RESEARCH.evidence_window.pricing_observed_to)}</p>
      <h1 id="page-h1" className="mb-4">SD-WAN and SASE list prices, with sources</h1>
      <p id="page-subhead" className="text-lg text-[var(--ink-700)]">{DESCRIPTION}</p>
      <p className="text-sm border-l-4 border-[var(--ink-300,#ccc)] pl-3 text-[var(--ink-700)] my-6" data-price-notice>
        Every amount is a list or published price, not a quote. It is shown in the currency the source states, without conversion, and is labelled UK (GBP) or non-UK, and historical where the source is dated or superseded. Real contract prices depend on volume, term, delivery partner and your sites. Ask for comparable quotes through the <a href="https://netify.co.uk/marketplace/" className="underline">Netify marketplace</a>.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <caption className="text-left text-[var(--ink-500)] mb-2">Published list prices ({priced.length} with an amount, {RESEARCH.price_lines.length - priced.length} where the source states no amount)</caption>
          <thead>
            <tr className="border-b border-[var(--ink-300,#ccc)]">
              <th scope="col" className="text-left py-2 pr-3">Provider</th>
              <th scope="col" className="text-left py-2 px-3">Product and component</th>
              <th scope="col" className="text-right py-2 px-3">Price</th>
              <th scope="col" className="text-left py-2 px-3">Terms stated</th>
              <th scope="col" className="text-left py-2 px-3">Labels</th>
              <th scope="col" className="text-left py-2 pl-3">Source and date</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((l) => {
              const o = offersById.get(l.offer_id);
              return (
                <tr key={l.id} className="border-b border-[var(--ink-100,#eee)] align-top">
                  <th scope="row" className="text-left font-normal py-2 pr-3"><Link href={`/research/providers/${l.slug}/`} className="underline">{providerName(l.slug)}</Link></th>
                  <td className="py-2 px-3">{l.product}{l.component ? <span className="block text-xs text-[var(--ink-500)]">{l.component}{o?.seller ? ` · sold by ${o.seller}` : ""}</span> : null}</td>
                  <td className="py-2 px-3 text-right whitespace-nowrap"><strong>{money(l.amount, l.currency)}</strong>{l.amount !== null && l.charge_unit ? <span className="block text-xs">per {l.charge_unit}{period(l.period)}</span> : null}</td>
                  <td className="py-2 px-3 text-xs">{[l.qualifier, l.contract_term_months ? `${l.contract_term_months}-month term` : null, l.minimum_quantity ? `min ${l.minimum_quantity}` : null, l.maximum_quantity ? `max ${l.maximum_quantity}` : null, l.tax].filter(Boolean).join(" · ")}</td>
                  <td className="py-2 px-3 text-xs">{priceLabels(l).join(" · ")}{l.evidence_class ? ` · ${l.evidence_class}` : ""}</td>
                  <td className="py-2 pl-3"><PricingCite id={l.source_id} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {RESEARCH.price_rules.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3">Published pricing rules</h2>
          <ul className="text-sm space-y-2">
            {RESEARCH.price_rules.map((r) => (
              <li key={r.id}><strong>{providerName(r.slug)}</strong>{r.rule_type ? ` · ${r.rule_type}` : ""}: {r.rule}{r.amount !== null ? ` (${money(r.amount, r.currency)})` : ""} · <PricingCite id={r.source_id} /></li>
            ))}
          </ul>
        </section>
      )}

      {quoteOnly.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3">Quote-only offers</h2>
          <ul className="text-sm space-y-1">
            {quoteOnly.map((o) => <li key={o.id}>{providerName(o.slug)} · {o.product}: {o.evidence_route} · <PricingCite id={o.source_id} /></li>)}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <h2 className="mb-3">Further reading (third-party pricing commentary, not prices)</h2>
        <p className="text-sm text-[var(--ink-700)] mb-2">Third-party sites that discuss SD-WAN and SASE pricing. Netify does not treat their figures as prices.</p>
        <ul className="text-sm space-y-1">
          {RESEARCH.further_reading.map((f) => <li key={f.id}><a href={f.url} rel="nofollow noopener" target="_blank" className="underline">{f.title ?? host(f.url)}</a> · {f.publisher ?? host(f.url)}{f.slug ? ` · about ${providerName(f.slug)}` : ""}</li>)}
        </ul>
      </section>
    </div>
  );
}
