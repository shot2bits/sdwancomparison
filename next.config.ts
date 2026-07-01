import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app is served under netify.co.uk/sase/* via a rewrite from the main
  // site. basePath makes every route and asset resolve under /sase, so the
  // rewrite serves correct links and static files. Set NEXT_PUBLIC_SITE_URL
  // to https://netify.co.uk/sase in Vercel so canonicals, the sitemap, the
  // magic-link sign-in and structured data all use the new home.
  basePath: "/sase",
  // Match the main netify.co.uk site (trailingSlash: true). Both zones must
  // agree, otherwise the /sase rewrite bounces between a slash and no-slash
  // form and loops. Every /sase URL is therefore /sase/<path>/.
  trailingSlash: true,
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
        destination: "https://netify.co.uk/sase/rfp-builder/",
        permanent: true,
        basePath: false,
      },
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
