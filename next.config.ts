import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
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
