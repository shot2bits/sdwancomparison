import type { Metadata } from "next";
import Link from "next/link";
import { PRICING_ROUTES } from "@/lib/pricing-routes";
import { RESEARCH, formatDate, money, providerName } from "@/lib/workbook-research";
import { JsonLd, PricingCite } from "@/components/research/ResearchBits";
import { getShortlistFaqSchema } from "@/lib/structured-data";

const YEAR = 2026;
const TITLE = `SASE and SD-WAN pricing and licensing models (${YEAR})`;
const DESCRIPTION = "How SASE and SD-WAN are priced: per user, per site, per device and by bandwidth. Published list prices, contract terms, managed service fees, circuit costs and total cost of ownership factors.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://netify.co.uk/sase/pricing/" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "https://netify.co.uk/sase/pricing/", type: "article", locale: "en_GB" },
};

type Line = (typeof RESEARCH.price_lines)[number];
const lineById = new Map(RESEARCH.price_lines.map((l) => [l.id, l]));
const ruleById = new Map(RESEARCH.price_rules.map((r) => [r.id, r]));

/** Published list prices shown on this page. Each is read from the research dataset, never typed in. */
const EXAMPLE_ROWS: { model: string; id: string }[] = [
  { model: "Per user", id: "PL-cloudflare-one-02-01" },
  { model: "Per user", id: "PL-sonicwall-cse-02-01" },
  { model: "Per user", id: "PL-barracuda-secureedge-02-01" },
  { model: "Per user", id: "PL-forcepoint-02-01" },
  { model: "Per user, bundle", id: "PL-checkpoint-02-01" },
  { model: "Per site or location, managed", id: "PL-lumen-01-01" },
  { model: "Per device, hardware", id: "PL-barracuda-secureedge-02-02" },
  { model: "Per device, hardware", id: "PL-barracuda-secureedge-02-03" },
  { model: "Per device, licence", id: "PL-cisco-04-01" },
  { model: "Per device, licence", id: "PL-cisco-03-01" },
  { model: "Circuit, broadband", id: "PL-virgin-media-o2-02-01" },
  { model: "Circuit, installation", id: "PL-bt-01-01" },
];

const period = (p: string | null) => (p && !/^other/i.test(p) ? ` per ${p.toLowerCase()}` : "");
const unit = (l: Line) => (l.charge_unit ? ` per ${l.charge_unit}` : "");
const priceText = (l: Line) => `${money(l.amount, l.currency)}${unit(l)}${l.period === "One-off" ? ", one-off" : period(l.period)}`;
const termText = (l: Line) => (l.contract_term_months ? `${l.contract_term_months}-month term` : "No term stated");

const rows = EXAMPLE_ROWS.map((r) => ({ ...r, line: lineById.get(r.id) })).filter((r): r is { model: string; id: string; line: Line } => Boolean(r.line && r.line.amount !== null));
const seen = `${formatDate(RESEARCH.evidence_window.pricing_observed_from)} to ${formatDate(RESEARCH.evidence_window.pricing_observed_to)}`;
const ex = (id: string) => { const l = lineById.get(id); return l && l.amount !== null ? `${providerName(l.slug)} ${priceText(l)}` : null; };
const ruleText = (id: string) => ruleById.get(id)?.rule.replace(/;\s*(\w)/g, (_, c: string) => `. ${c.toUpperCase()}`) ?? null;

const faqs: { q: string; a: string }[] = [
  {
    q: "How is SASE priced?",
    a: `Most SASE and security service edge licences are priced per user, per year or per month. SD-WAN is usually priced per site, per device or by bandwidth tier. Published list prices recorded by Netify include ${[ex("PL-cloudflare-one-02-01"), ex("PL-sonicwall-cse-02-01"), ex("PL-barracuda-secureedge-02-01")].filter(Boolean).join(", ")}. These are list or published prices seen between ${seen}, not quotes, and they are shown in the currency the source states.`,
  },
  {
    q: "How much does SD-WAN cost per site?",
    a: `It depends on the device, bandwidth, edition, term and whether the service is managed. One published example is ${ex("PL-lumen-01-01") ?? "a managed SASE offer priced per location"}, listed as a managed offer. Other providers price by device model or bandwidth tier, or only on quotation. Treat any list price as a starting point and ask for a written quote for your sites.`,
  },
  {
    q: "What should a SASE total cost of ownership include?",
    a: "Add licences for the full term, renewal uplifts, edge hardware and spares, installation, circuits, managed service fees, migration and professional services, support tiers, tax and currency effects, and the internal time needed to run the service. Then subtract confirmed discounts. Compare the same scope and term across suppliers before comparing totals.",
  },
  {
    q: "Are published list prices what I will pay?",
    a: "No. A list price is a starting point. Contract prices depend on volume, term, region, edition, delivery partner and negotiation. Many providers publish no price at all and quote only on request. Netify labels every price as a list or published price and does not present it as a quote.",
  },
  {
    q: "How can I get comparable SASE and SD-WAN quotes?",
    a: "Describe your sites, users and requirements in the Netify RFP Builder and choose which providers to approach. Netify asks for the same scope, term and commercial detail from each, so the responses can be compared like for like. Netify does not charge buyers. Suppliers pay Netify when an introduction leads to business, which does not affect how providers are ordered.",
  },
];

const MODELS: { title: string; body: string }[] = [
  {
    title: "Per user",
    body: "Security service edge licences such as secure web gateway, ZTNA and CASB are usually sold per user, per year or per month. Editions differ by feature set. Check minimum user counts and volume bands, because lower tiers often have a floor.",
  },
  {
    title: "Per site or location",
    body: "Some SD-WAN and managed SASE offers charge a flat rate per site or location each month. This suits estates with many similar branches. Confirm what a site includes, such as the device, bandwidth and support level.",
  },
  {
    title: "Per device or appliance",
    body: "Edge devices carry a hardware price, a licence for the feature edition and sometimes a spare or high availability licence. Licences are often tied to the device model and the term, not to bandwidth.",
  },
  {
    title: "By bandwidth or tier",
    body: "Several vendors price SD-WAN by bandwidth tier, platform class or edition, and some add region and term to the licence code. Others state that bandwidth does not change the price. Ask which meter applies before you size sites.",
  },
  {
    title: "Term lengths",
    body: "Terms of 12, 24 and 36 months are common. Longer terms usually lower the monthly price but raise the exit cost. Check renewal rules and any scheduled yearly uplift.",
  },
  {
    title: "Managed service fees",
    body: "A managed service adds design, monitoring, change handling and support on top of the licence. It may be bundled into a per-site or per-user rate or charged as a separate line. Ask what the fee covers and how change requests are priced.",
  },
  {
    title: "Circuit costs",
    body: "Connectivity is normally a separate cost. Expect an installation charge, a monthly rental, and a contract term that may differ from the SD-WAN or SASE term. Resilience, such as a second circuit or cellular backup, adds to the total.",
  },
];

const TCO_FACTORS: string[] = [
  "Licences for the whole term, not only the first year",
  "Renewal rules and scheduled yearly uplifts",
  "Edge hardware, spares and high availability licences",
  "Installation, circuits and backup connectivity",
  "Managed service fees and change request charges",
  "Migration, design and professional services",
  "Support tier, service levels and out of hours charges",
  "Minimum quantities, volume bands and overage terms",
  "Tax, currency and billing period",
  "Internal staff time to run and review the service",
];

export default function PricingPage() {
  const uplift = ruleText("PR-zscaler-02-01");
  const forcepointMin = ruleText("PR-forcepoint-02-01");
  const bandwidthNone = ruleText("PR-fortinet-fortisase-02-01");
  return <article className="mx-auto max-w-5xl px-6 py-12 text-slate-800">
    <JsonLd data={[getShortlistFaqSchema(faqs)]} />
    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{TITLE}</h1>
    <p className="mt-5 max-w-3xl text-lg leading-8">Choose the pricing you need. Explore a provisional budget, ask suppliers to price your project, or have Netify source connectivity quotes. Below, find how SASE and SD-WAN are licensed, the published list prices Netify has recorded and the costs that decide the total over three years.</p>
    <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
      {PRICING_ROUTES.map(route => <section key={route.id} className="py-8">
        <h2 className="text-2xl font-semibold">{route.title}</h2>
        <p className="mt-3 max-w-3xl leading-7">{route.description}</p>
        <a className="mt-5 inline-block rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-700" href={route.href}>{route.action} →</a>
      </section>)}
    </div>
    <section className="mt-12" id="licensing-models">
      <h2 className="text-2xl font-semibold">How SASE and SD-WAN are licensed</h2>
      <p className="mt-3 max-w-3xl leading-7">Suppliers combine several meters. Security service edge is mostly priced by user. SD-WAN is priced by site, device or bandwidth. Services and circuits add their own lines. Ask each supplier to state the meter, the term and what is excluded.</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {MODELS.map((m) => <div key={m.title} className="rounded-lg border border-slate-200 p-5">
          <h3 className="text-lg font-semibold">{m.title}</h3>
          <p className="mt-2 text-sm leading-6">{m.body}</p>
        </div>)}
      </div>
    </section>
    <section className="mt-12" id="list-prices">
      <h2 className="text-2xl font-semibold">Published list prices by licensing model</h2>
      <p className="mt-3 max-w-3xl leading-7">A selection from Netify&apos;s desk research, seen {seen}. Every amount is a list or published price, not a quote. It is shown in the currency the source states, with no conversion. See all {RESEARCH.price_lines.filter((l) => l.amount !== null).length} published prices on the <Link href="/research/list-prices/" className="underline">list price research page</Link>.</p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="mb-2 text-left text-slate-500">Examples of published SASE, SD-WAN and connectivity list prices</caption>
          <thead>
            <tr className="border-b border-slate-300">
              <th scope="col" className="py-2 pr-3 text-left">Model</th>
              <th scope="col" className="px-3 py-2 text-left">Provider and product</th>
              <th scope="col" className="px-3 py-2 text-right">List price</th>
              <th scope="col" className="px-3 py-2 text-left">Term</th>
              <th scope="col" className="py-2 pl-3 text-left">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => <tr key={r.id} className="border-b border-slate-100 align-top">
              <th scope="row" className="py-2 pr-3 text-left font-normal">{r.model}</th>
              <td className="px-3 py-2"><Link href={`/research/providers/${r.line.slug}/`} className="underline">{providerName(r.line.slug)}</Link><span className="block text-xs text-slate-500">{r.line.product}</span></td>
              <td className="whitespace-nowrap px-3 py-2 text-right"><strong>{money(r.line.amount, r.line.currency)}</strong><span className="block text-xs">{`${unit(r.line)}${r.line.period === "One-off" ? ", one-off" : period(r.line.period)}`.trim()}</span></td>
              <td className="px-3 py-2 text-xs">{termText(r.line)}</td>
              <td className="py-2 pl-3"><PricingCite id={r.line.source_id} /></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">Unverified desk research. Each price is a provider-published or third-party claim recorded with its access date. Netify has not independently verified it.</p>
    </section>
    <section className="mt-12" id="tco">
      <h2 className="text-2xl font-semibold">Total cost of ownership over three years</h2>
      <p className="mt-3 max-w-3xl leading-7">Compare suppliers on the same scope and the same term. A simple structure keeps the comparison fair.</p>
      <p className="mt-4 max-w-3xl rounded-lg bg-slate-50 p-4 leading-7">Three-year cost = licences for 36 months + renewal uplifts + hardware and spares + installation and circuits for 36 months + managed service fees + migration and one-off services + internal running costs, less confirmed discounts.</p>
      <h3 className="mt-6 text-lg font-semibold">What to include</h3>
      <ul className="mt-3 max-w-3xl list-disc space-y-1 pl-6 leading-7">
        {TCO_FACTORS.map((f) => <li key={f}>{f}</li>)}
      </ul>
      <h3 className="mt-6 text-lg font-semibold">Commercial terms seen in published price data</h3>
      <ul className="mt-3 max-w-3xl list-disc space-y-2 pl-6 leading-7">
        {uplift ? <li>{providerName("zscaler")}: {uplift}</li> : null}
        {forcepointMin ? <li>{providerName("forcepoint")}: {forcepointMin}</li> : null}
        {bandwidthNone ? <li>{providerName("fortinet")}: {bandwidthNone}</li> : null}
      </ul>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">These are provider-stated terms, recorded as unverified desk research. Confirm them in a written quote. For a quick budget range, use the <Link href="/cost-estimator" className="underline">cost estimator</Link>.</p>
    </section>
    <section className="mt-12" id="faq">
      <h2 className="text-2xl font-semibold">SASE and SD-WAN pricing questions</h2>
      <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
        {faqs.map((f) => <div key={f.q} className="py-5">
          <h3 className="text-lg font-semibold">{f.q}</h3>
          <p className="mt-2 max-w-3xl leading-7">{f.a}</p>
        </div>)}
      </div>
    </section>
    <section className="mt-10 max-w-3xl">
      <h2 className="text-2xl font-semibold">Compare the complete commercial offer</h2>
      <p className="mt-3 leading-7">Ask for recurring charges, installation costs, licences, contract term, currency, tax treatment, exclusions and quote validity. Check what is included in support, resilience and migration before comparing totals.</p>
      <p className="mt-4 leading-7">Circuit requests support site addresses, bandwidth and resilience requirements, or quantities for SIM-only users. International sites need a local contact. Fortinet and Meraki edge options and CrowdStrike device protection are optional UK-only additions. Check the final quote for the service, billing period and terms.</p>
      <p className="mt-4 leading-7">Publishing shares an anonymous notice, not your private contact details or circuit quotes. Review what suppliers will see while the notice is a draft.</p>
      <Link className="mt-5 inline-block underline underline-offset-4" href="/shortlist/">Still choosing suppliers? Compare vendors and managed service providers</Link>
    </section>
  </article>;
}
