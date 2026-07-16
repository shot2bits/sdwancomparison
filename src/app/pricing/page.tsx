import type { Metadata } from "next";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema } from "@/lib/structured-data";
import { getAllVendors } from "@/lib/vendors";
import EstateBuilder from "@/components/EstateBuilder";

export const metadata: Metadata = {
  title: "Compare SD-WAN and SASE pricing across 30+ providers",
  description: "List your sites once, see indicative pricing instantly, then receive firm bids from matched providers. Pricing stays private to you and there are no sales calls until you choose.",
  alternates: { canonical: `${SITE_URL}/pricing/` },
};

/**
 * Pricing portal (feat/pricing-portal). Server-rendered explainer around the
 * client estate builder, in the clear and agent-readable: the how-it-works
 * copy, the MCP tool list and the JSON-LD are all in the initial HTML.
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
      description: "Describe your site estate, see indicative pricing bands instantly, and receive firm private bids from verified SD-WAN and SASE providers.",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      {schemas.map((s, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />)}

      <div className="mb-10 max-w-3xl">
        <p className="eyebrow mb-3">Compare pricing</p>
        <h1 className="mb-4">Compare SD-WAN and SASE pricing across 30+ providers</h1>
        <p className="text-lg text-[var(--ink-700)]">
          List your sites once. See indicative pricing instantly. Then submit your estate and
          watch firm bids arrive from verified providers, private to you, with no sales calls
          until you choose. Bands are produced by the Netify cost model and marked illustrative;
          ordering follows Netify evidence scores and is never paid for.
        </p>
      </div>

      <EstateBuilder vendors={vendors} />

      <section className="mt-16 max-w-3xl">
        <h2 className="text-2xl font-semibold mb-3">How the pricing portal works</h2>
        <p className="text-[var(--ink-700)] mb-3">
          Describe each site: address in its local format, the primary circuit, any failover
          circuit, the local site contact, users, and whether you want the service managed or
          co-managed. Choose the SASE elements in scope and, if you already know who you want to
          hear from, pick providers from the Netify marketplace. Your indicative estimate appears
          immediately. Submitting creates a pending bid with each chosen provider; the room shows
          every bid as pending until pricing lands, and each price is private to you.
        </p>
        <p className="text-[var(--ink-700)]">
          Firm bids are brokered through the Netify team today and answered directly by verified
          suppliers as provider self-serve rolls out. Nothing about your contacts or prices is
          public: the open version of an estate shows shape and bid statuses only.
        </p>
      </section>

      <section className="mt-10 max-w-3xl border border-[var(--ink-300,#ccc)] rounded-sm p-5">
        <p className="eyebrow mb-2">For AI agents</p>
        <p className="text-sm text-[var(--ink-700)] mb-2">
          The portal is fully drivable by agents over the public MCP endpoint at {`${SITE_URL}/api/mcp`}:
          create an estate (estate_create), read it (estate_get), submit it for bids
          (estate_submit) and poll bid statuses (estate_bid_status). The manage key returned at
          creation authorises updates and private reads; without it, reads return the public
          shape with bid statuses but no prices or contacts.
        </p>
        <p className="text-xs text-[var(--ink-500)]">
          REST equivalents: POST /api/estate, GET/PUT /api/estate/[id], POST /api/estate/[id]/submit.
        </p>
      </section>
    </div>
  );
}
