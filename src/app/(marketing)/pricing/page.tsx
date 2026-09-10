import type { Metadata } from "next";
import { PRICING_ROUTES } from "@/lib/pricing-routes";

export const metadata: Metadata = {
  title: "SASE, SD-WAN and circuit pricing",
  description: "Explore indicative SASE and SD-WAN budgets, request supplier project pricing, or ask Netify to source circuit quotes for your locations.",
  alternates: { canonical: "https://netify.co.uk/sase/pricing/" },
};

export default function PricingPage() {
  return <article className="mx-auto max-w-5xl px-6 py-12 text-slate-800">
    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">SASE, SD-WAN and circuit pricing</h1>
    <p className="mt-5 max-w-3xl text-lg leading-8">Choose the pricing you need. Explore a provisional budget, ask suppliers to price your project, or have Netify source connectivity quotes.</p>
    <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
      {PRICING_ROUTES.map(route => <section key={route.id} className="py-8">
        <h2 className="text-2xl font-semibold">{route.title}</h2>
        <p className="mt-3 max-w-3xl leading-7">{route.description}</p>
        <a className="mt-5 inline-block rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-700" href={route.href}>{route.action} →</a>
      </section>)}
    </div>
    <section className="mt-10 max-w-3xl">
      <h2 className="text-2xl font-semibold">Compare the complete commercial offer</h2>
      <p className="mt-3 leading-7">Ask for recurring charges, installation costs, licences, contract term, currency, tax treatment, exclusions and quote validity. Check what is included in support, resilience and migration before comparing totals.</p>
      <p className="mt-4 leading-7">Circuit requests support site addresses, bandwidth and resilience requirements, or quantities for SIM-only users. International sites need a local contact. Fortinet and Meraki edge options and CrowdStrike device protection are optional UK-only additions. Check the final quote for the service, billing period and terms.</p>
      <p className="mt-4 leading-7">Publishing shares an anonymous notice, not your private contact details or circuit quotes. Review what suppliers will see before publication.</p>
      <a className="mt-5 inline-block underline underline-offset-4" href="/sase/shortlist/">Still choosing suppliers? Compare vendors and managed service providers</a>
    </section>
  </article>;
}
