import type { Metadata } from "next";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema } from "@/lib/structured-data";
import { getAllVendors } from "@/lib/vendors";
import EstateBuilder from "@/components/EstateBuilder";

export const metadata: Metadata = {
  title: "Compare SD-WAN and SASE pricing across 30+ providers",
  description: "List your sites once, see indicative pricing instantly, then let verified providers price your estate directly in your private room. Alerts the moment pricing lands. No sales calls until you choose.",
  alternates: { canonical: `${SITE_URL}/pricing/` },
};

const FAQS: [string, string][] = [
  ["Is comparing pricing on Netify really free?", "Yes, completely. Netify is paid by providers when deals complete; that fee never changes the price you pay and never changes the order you see providers in. Rankings follow Netify evidence scores, and vendors cannot pay to influence scores or where they land."],
  ["How accurate is the instant estimate?", "The instant bands come from the Netify cost model and are deliberately shown as ranges, marked illustrative: real enterprise pricing depends on your exact sites, terms and negotiation. That is why firm pricing comes only from the providers themselves, priced against your actual estate."],
  ["Do providers see each other's prices?", "Never. Each provider prices your estate blind, in your private room. You see everything side by side; they see only their own bid. Your site contacts are never public and never shared beyond the providers you invite."],
  ["Will I get sales calls?", "Not from submitting. Your details go only to a vetted account manager at each provider you invite, and they may contact you with clarifying questions about your requirement, because accurate pricing needs accurate understanding. There is no obligation to award and no pressure selling."],
  ["How quickly does pricing arrive?", "Pending bids appear the moment you submit. Providers then price your estate directly in the portal, typically within days, and the portal emails you the moment each price becomes available, so there is no need to chase or check back."],
];

/**
 * Pricing portal landing (feat/pricing-portal). Compare-the-market energy,
 * Netify substance: full-bleed hero, footnoted trust numbers, the builder as
 * the centrepiece, and a straight-talking FAQ. Server-rendered end to end so
 * crawlers and agents get the whole story in the HTML.
 */
export default function PricingPortalPage() {
  const vendors = getAllVendors().map((v) => ({ slug: v.slug, name: v.name, category: v.category }));
  const schemas = [
    getOrganizationSchema(),
    getBreadcrumbSchema("Compare pricing", "/pricing"),
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Netify SD-WAN and SASE pricing comparison",
      url: `${SITE_URL}/pricing/`,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
      description: "Describe your site estate, see indicative pricing bands instantly, and receive firm private bids from verified SD-WAN and SASE providers, with alerts the moment pricing lands.",
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ];

  return (
    <div>
      {schemas.map((s, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />)}

      <div className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-5xl mx-auto px-6 pt-16 pb-12">
          <p className="text-amber-700 text-sm font-semibold tracking-wide uppercase mb-4">Compare pricing</p>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight max-w-3xl mb-5">
            Your network, priced by the market.
          </h1>
          <p className="text-lg sm:text-xl text-[var(--ink-700)] max-w-2xl mb-3">
            List your sites once and 30+ verified SD-WAN and SASE providers compete for your
            business. Indicative pricing in seconds. Firm bids in your private room. Alerts the
            moment each price lands.
          </p>
          <p className="text-base text-[var(--ink-800)] max-w-2xl mb-8 font-medium">
            One submission replaces five sales calls. The hard work is done for you.
          </p>
          <a href="#estate-builder" className="inline-flex items-center rounded-full bg-amber-500 px-8 py-3.5 text-base font-semibold text-zinc-950 no-underline hover:bg-amber-400 transition-colors">
            Price my sites →
          </a>
          <p className="text-xs text-[var(--ink-500)] mt-4">Free to compare. No sign-in for your estimate. No obligation to award.</p>

          <div className="flex flex-wrap items-center gap-2.5 mt-6">
            <span className="text-sm text-[var(--ink-600)] font-medium">Built for businesses in:</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3.5 py-1.5 text-sm text-[var(--ink-800)]"><span aria-hidden="true">🇬🇧</span> United Kingdom</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3.5 py-1.5 text-sm text-[var(--ink-800)]"><span aria-hidden="true">🇺🇸</span> United States</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3.5 py-1.5 text-sm text-[var(--ink-800)]"><span aria-hidden="true">🇨🇦</span> Canada</span>
            <span className="text-sm text-[var(--ink-500)]">with national or global site requirements</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-12 border-t border-amber-200 pt-8">
            <div><p className="text-3xl font-bold">30+</p><p className="text-sm text-[var(--ink-600)]">verified providers competing<sup>1</sup></p></div>
            <div><p className="text-3xl font-bold">40</p><p className="text-sm text-[var(--ink-600)]">evidence-graded capabilities per provider</p></div>
            <div><p className="text-3xl font-bold">386</p><p className="text-sm text-[var(--ink-600)]">analyst questions behind the scores</p></div>
            <div><p className="text-3xl font-bold">£0</p><p className="text-sm text-[var(--ink-600)]">to compare, always</p></div>
          </div>
          <p className="text-[11px] text-[var(--ink-500)] mt-4">
            <sup>1</sup> Netify marketplace dataset, July 2026. Vendors cannot pay to influence scores or where they land; ordering follows Netify evidence scores.
          </p>
        </div>
      </div>

      <div className="bg-white border-b border-[var(--ink-200,#e5e5e5)]">
        <div className="max-w-5xl mx-auto px-6 py-6 grid sm:grid-cols-3 gap-6">
          <div className="flex gap-3 items-start">
            <span className="flex-none w-8 h-8 rounded-full bg-amber-500 text-zinc-950 font-bold flex items-center justify-center">1</span>
            <div><p className="font-semibold">List your sites</p><p className="text-sm text-[var(--ink-700)]">Addresses, circuits, failover, users. Rough is fine; two minutes is typical.</p></div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="flex-none w-8 h-8 rounded-full bg-amber-500 text-zinc-950 font-bold flex items-center justify-center">2</span>
            <div><p className="font-semibold">See the market instantly</p><p className="text-sm text-[var(--ink-700)]">Indicative bands per provider, side by side, before you give any details.</p></div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="flex-none w-8 h-8 rounded-full bg-amber-500 text-zinc-950 font-bold flex items-center justify-center">3</span>
            <div><p className="font-semibold">Firm bids come to you</p><p className="text-sm text-[var(--ink-700)]">Providers price your estate directly in your private room; you hear the moment each lands.</p></div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12" id="estate-builder">
        <EstateBuilder vendors={vendors} />
      </div>

      <div className="bg-[var(--ink-100,#f5f5f5)]">
        <div className="max-w-5xl mx-auto px-6 py-14 grid md:grid-cols-3 gap-8">
          <div>
            <p className="text-lg font-semibold mb-2">Providers do the pricing</p>
            <p className="text-sm text-[var(--ink-700)]">No PDF attachments, no phone tag. Each provider updates their price directly in your room: the number, the unit, the term, side by side with every rival.</p>
          </div>
          <div>
            <p className="text-lg font-semibold mb-2">You hear the moment it lands</p>
            <p className="text-sm text-[var(--ink-700)]">The portal alerts you as each price becomes available, so the market comes to you while you get on with your day.</p>
          </div>
          <div>
            <p className="text-lg font-semibold mb-2">Private by design</p>
            <p className="text-sm text-[var(--ink-700)]">Every price is private to you. Providers never see each other&apos;s numbers or your site contacts, and there is no obligation to award.</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-14">
        <h2 className="text-2xl font-semibold mb-6">Questions, answered straight</h2>
        <div className="space-y-6">
          {FAQS.map(([q, a]) => (
            <div key={q}>
              <h3 className="font-semibold mb-1">{q}</h3>
              <p className="text-sm text-[var(--ink-700)]">{a}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-sm bg-[#13294b] text-white p-8 text-center">
          <p className="text-2xl font-bold mb-2">Ready to see what your network should cost?</p>
          <p className="text-blue-200 mb-5">Two minutes to list your sites. Seconds to see the market.</p>
          <a href="#estate-builder" className="inline-flex items-center rounded-full bg-amber-500 px-8 py-3.5 text-base font-semibold text-zinc-950 no-underline hover:bg-amber-400 transition-colors">Price my sites →</a>
        </div>

        <section className="mt-12 border border-[var(--ink-300,#ccc)] rounded-sm p-5">
          <p className="eyebrow mb-2">For AI agents</p>
          <p className="text-sm text-[var(--ink-700)] mb-2">
            The portal is fully drivable by agents over the public MCP endpoint at {`${SITE_URL}/api/mcp`}:
            create an estate (estate_create), read it (estate_get), submit it for bids
            (estate_submit, which requires the buyer&apos;s identity and explicit terms acceptance) and
            poll bid statuses (estate_bid_status). The manage key returned at creation authorises
            updates and private reads; without it, reads return the public shape with bid statuses
            but no prices or contacts.
          </p>
          <p className="text-xs text-[var(--ink-500)]">
            REST equivalents: POST /api/estate, GET/PUT /api/estate/[id], POST /api/estate/[id]/submit.
          </p>
        </section>
      </div>
    </div>
  );
}
