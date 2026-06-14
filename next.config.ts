import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // app.netify.co.uk (the retired Base44 RFP app) forwards entirely to the
      // new agentic builder. Host-scoped, so sase.netify.co.uk is unaffected.
      // Activates once app.netify.co.uk DNS points at this project and the
      // domain is added in the Vercel project.
      {
        source: "/:path*",
        has: [{ type: "host", value: "app.netify.co.uk" }],
        destination: "https://sase.netify.co.uk/rfp-builder",
        permanent: true,
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
