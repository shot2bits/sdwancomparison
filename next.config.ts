import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app is served under netify.co.uk/sase/* via a rewrite from the main
  // site. basePath makes every route and asset resolve under /sase, so the
  // rewrite serves correct links and static files. Set NEXT_PUBLIC_SITE_URL
  // to https://netify.co.uk/sase in Vercel so canonicals, the sitemap, the
  // magic-link sign-in and structured data all use the new home.
  basePath: "/sase",
  // Match the main netify.co.uk site (trailingSlash: true) so generated links,
  // the sitemap and canonicals all carry trailing slashes: /sase/<path>/.
  trailingSlash: true,
  // CRITICAL for the proxy: the main site rewrites netify.co.uk/sase/<path>/ to
  // this app, but Next forwards the path WITHOUT the trailing slash (it lands in
  // :path*). With trailingSlash:true this app would 308 /sase/<path> ->
  // /sase/<path>/, and because that redirect is relative it bounces back onto
  // netify.co.uk, re-enters the rewrite and loops until Vercel returns 503.
  // skipTrailingSlashRedirect disables that automatic 308 so the slash-less
  // proxied request is served 200 directly. The public URL still always carries
  // the slash (the parent site enforces it), so there is no duplicate exposure.
  skipTrailingSlashRedirect: true,
  // Vercel injects `X-Robots-Tag: noindex` on *.vercel.app hosts (its
  // deployment-URL anti-indexing measure). The main site's /sase/* rewrite
  // targets sasecomparison-netifymarketplace.vercel.app, so that header was
  // leaking through the proxy and noindexing EVERY page under
  // netify.co.uk/sase/* (found via Screaming Frog, 2026-07-02). Setting our
  // own X-Robots-Tag stops the platform injection. Pages that must stay out
  // of the index (opportunity rooms, admin, auth) set meta robots noindex,
  // which still wins: crawlers honour the most restrictive signal.
  // Duplicate-content exposure on the raw .vercel.app host is handled by the
  // canonicals, which all point at https://netify.co.uk/sase/*.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "index, follow" }],
      },
    ];
  },
  async redirects() {
    return [
      // Retire the sase.netify.co.uk subdomain: 301 every path on the old host
      // to the new canonical home under the main domain. Host-scoped so it only
      // fires on the subdomain, never on netify.co.uk/sase/*. basePath:false
      // because the incoming subdomain request has no /sase prefix yet.
      {
        source: "/:path*",
        has: [{ type: "host", value: "sase.netify.co.uk" }],
        destination: "https://netify.co.uk/sase/:path*",
        permanent: true,
        basePath: false,
      },
      // app.netify.co.uk (the retired Base44 RFP app) forwards entirely to the
      // agentic builder under the main domain.
      {
        source: "/:path*",
        has: [{ type: "host", value: "app.netify.co.uk" }],
        // Straight to the apex (23 Jul 2026: the wizard's entries 301 there
        // too, so pointing at /sase/rfp-builder/ would chain two hops).
        destination: "https://netify.co.uk/",
        permanent: true,
        basePath: false,
      },
      // ================================================================
      // One Door completes (Robert's verdict, 23 Jul 2026 night): the
      // standalone wizard's ENTRY surfaces 301 to the apex, where the
      // desk derives SoR, RFI and full RFP from one description. Known
      // ?sector= arrivals carry their blessed prefill sentence into ?q=
      // (verbatim parity with SECTOR_PREFILL in continuation/derive.ts;
      // sector rules stand before the generic entries so they match
      // first). The wizard's WORKING surfaces keep serving untouched:
      // /rfp-builder/[id] records, /rfp-builder/supplier responses,
      // sample-rfp and questions (both Continuation research surfaces).
      // ================================================================
      { source: "/rfp-builder/new", has: [{ type: "query", key: "sector", value: "healthcare" }], destination: "https://netify.co.uk/?q=We%20are%20a%20healthcare%20provider%20replacing%20legacy%20connectivity%20with%20managed%20SD-WAN%20and%20SASE.", statusCode: 301 },
      { source: "/rfp-builder/new/", has: [{ type: "query", key: "sector", value: "healthcare" }], destination: "https://netify.co.uk/?q=We%20are%20a%20healthcare%20provider%20replacing%20legacy%20connectivity%20with%20managed%20SD-WAN%20and%20SASE.", statusCode: 301 },
      { source: "/rfp-builder/new", has: [{ type: "query", key: "sector", value: "financial_services" }], destination: "https://netify.co.uk/?q=We%20are%20a%20financial%20services%20firm%20consolidating%20network%20and%20security%20into%20SASE.", statusCode: 301 },
      { source: "/rfp-builder/new/", has: [{ type: "query", key: "sector", value: "financial_services" }], destination: "https://netify.co.uk/?q=We%20are%20a%20financial%20services%20firm%20consolidating%20network%20and%20security%20into%20SASE.", statusCode: 301 },
      { source: "/rfp-builder/new", has: [{ type: "query", key: "sector", value: "retail_ecommerce" }], destination: "https://netify.co.uk/?q=We%20are%20a%20retailer%20needing%20a%20PCI%20DSS%20compliant%20network.", statusCode: 301 },
      { source: "/rfp-builder/new/", has: [{ type: "query", key: "sector", value: "retail_ecommerce" }], destination: "https://netify.co.uk/?q=We%20are%20a%20retailer%20needing%20a%20PCI%20DSS%20compliant%20network.", statusCode: 301 },
      { source: "/rfp-builder/new", has: [{ type: "query", key: "sector", value: "manufacturing" }], destination: "https://netify.co.uk/?q=We%20are%20a%20manufacturer%20securing%20IT%20and%20OT%20with%20managed%20SASE.", statusCode: 301 },
      { source: "/rfp-builder/new/", has: [{ type: "query", key: "sector", value: "manufacturing" }], destination: "https://netify.co.uk/?q=We%20are%20a%20manufacturer%20securing%20IT%20and%20OT%20with%20managed%20SASE.", statusCode: 301 },
      { source: "/rfp-builder/new", has: [{ type: "query", key: "sector", value: "energy_utilities" }], destination: "https://netify.co.uk/?q=We%20are%20an%20energy%20and%20utilities%20operator%20needing%20resilient%2C%20secure%20networking%20for%20remote%20and%20critical%20locations.", statusCode: 301 },
      { source: "/rfp-builder/new/", has: [{ type: "query", key: "sector", value: "energy_utilities" }], destination: "https://netify.co.uk/?q=We%20are%20an%20energy%20and%20utilities%20operator%20needing%20resilient%2C%20secure%20networking%20for%20remote%20and%20critical%20locations.", statusCode: 301 },
      { source: "/rfp-builder/new", has: [{ type: "query", key: "sector", value: "government_public_sector" }], destination: "https://netify.co.uk/?q=We%20are%20a%20public%20sector%20organisation%20buying%20SD-WAN%20and%20SASE%20with%20UK%20data%20residency.", statusCode: 301 },
      { source: "/rfp-builder/new/", has: [{ type: "query", key: "sector", value: "government_public_sector" }], destination: "https://netify.co.uk/?q=We%20are%20a%20public%20sector%20organisation%20buying%20SD-WAN%20and%20SASE%20with%20UK%20data%20residency.", statusCode: 301 },
      { source: "/rfp-builder/new", has: [{ type: "query", key: "sector", value: "education" }], destination: "https://netify.co.uk/?q=We%20are%20an%20education%20provider%20connecting%20campuses%20with%20managed%20SD-WAN.", statusCode: 301 },
      { source: "/rfp-builder/new/", has: [{ type: "query", key: "sector", value: "education" }], destination: "https://netify.co.uk/?q=We%20are%20an%20education%20provider%20connecting%20campuses%20with%20managed%20SD-WAN.", statusCode: 301 },
      { source: "/rfp-builder/new", has: [{ type: "query", key: "sector", value: "transport_logistics" }], destination: "https://netify.co.uk/?q=We%20are%20a%20transport%20and%20logistics%20operator%20connecting%20depots%20with%20resilient%20SD-WAN.", statusCode: 301 },
      { source: "/rfp-builder/new/", has: [{ type: "query", key: "sector", value: "transport_logistics" }], destination: "https://netify.co.uk/?q=We%20are%20a%20transport%20and%20logistics%20operator%20connecting%20depots%20with%20resilient%20SD-WAN.", statusCode: 301 },
      { source: "/rfp-builder/new", has: [{ type: "query", key: "sector", value: "professional_services" }], destination: "https://netify.co.uk/?q=We%20are%20a%20professional%20services%20firm%20consolidating%20security%20into%20SASE%20for%20hybrid%20work.", statusCode: 301 },
      { source: "/rfp-builder/new/", has: [{ type: "query", key: "sector", value: "professional_services" }], destination: "https://netify.co.uk/?q=We%20are%20a%20professional%20services%20firm%20consolidating%20security%20into%20SASE%20for%20hybrid%20work.", statusCode: 301 },
      { source: "/rfp-builder/new", has: [{ type: "query", key: "sector", value: "hospitality_leisure" }], destination: "https://netify.co.uk/?q=We%20are%20a%20hospitality%20operator%20needing%20managed%20SD-WAN%20across%20the%20estate.", statusCode: 301 },
      { source: "/rfp-builder/new/", has: [{ type: "query", key: "sector", value: "hospitality_leisure" }], destination: "https://netify.co.uk/?q=We%20are%20a%20hospitality%20operator%20needing%20managed%20SD-WAN%20across%20the%20estate.", statusCode: 301 },
      { source: "/rfp-builder", destination: "https://netify.co.uk/", statusCode: 301 },
      { source: "/rfp-builder/", destination: "https://netify.co.uk/", statusCode: 301 },
      { source: "/rfp-builder/new", destination: "https://netify.co.uk/", statusCode: 301 },
      { source: "/rfp-builder/new/", destination: "https://netify.co.uk/", statusCode: 301 },
      { source: "/rfp-builder/start", destination: "https://netify.co.uk/", statusCode: 301 },
      { source: "/rfp-builder/start/", destination: "https://netify.co.uk/", statusCode: 301 },
      { source: "/rfp-builder/sase", destination: "https://netify.co.uk/", statusCode: 301 },
      { source: "/rfp-builder/sase/", destination: "https://netify.co.uk/", statusCode: 301 },
      { source: "/rfp-builder/sd-wan", destination: "https://netify.co.uk/", statusCode: 301 },
      { source: "/rfp-builder/sd-wan/", destination: "https://netify.co.uk/", statusCode: 301 },
      { source: "/rfp-builder/sse", destination: "https://netify.co.uk/", statusCode: 301 },
      { source: "/rfp-builder/sse/", destination: "https://netify.co.uk/", statusCode: 301 },
      // /shortlist is the flagship for the head terms; the standalone
      // best-of pages for those queries were retired 12 June 2026.
      {
        source: "/best/sd-wan-providers",
        destination: "/shortlist",
        statusCode: 301,
      },
      {
        source: "/best/sase-providers",
        destination: "/shortlist",
        statusCode: 301,
      },
      {
        source: "/best/managed-sd-wan-providers",
        destination: "/shortlist",
        statusCode: 301,
      },
    ];
  },
};

export default nextConfig;
