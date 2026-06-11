/** Curated natural pairings for the static /compare/[pair] pages. */

export type ComparePair = { slug: string; a: string; b: string };

function pair(a: string, b: string): ComparePair {
  return { slug: `${a}-vs-${b}`, a, b };
}

export const COMPARE_PAIRS: ComparePair[] = [
  // Single-vendor SASE rivalries
  pair("cato-networks", "zscaler"),
  pair("cato-networks", "fortinet"),
  pair("cato-networks", "versa-networks"),
  pair("cato-networks", "aryaka"),
  pair("cato-networks", "palo-alto-networks"),
  // SSE leaders
  pair("zscaler", "netskope"),
  pair("zscaler", "palo-alto-networks"),
  pair("zscaler", "cloudflare-one"),
  pair("netskope", "palo-alto-networks"),
  pair("netskope", "cloudflare-one"),
  // Security platform rivalries
  pair("fortinet", "cisco"),
  pair("fortinet", "palo-alto-networks"),
  pair("fortinet", "check-point"),
  pair("fortinet", "versa-networks"),
  // Network heritage
  pair("cisco", "juniper-networks"),
  pair("cisco", "hpe-aruba"),
  pair("hpe-aruba", "arista-velocloud"),
  pair("arista-velocloud", "cisco"),
  // Managed providers
  pair("bt-business", "vodafone-business"),
  pair("bt-business", "verizon-business"),
  pair("orange-business", "ntt"),
  pair("gtt", "colt-technology-services"),
  // Wireless-first
  pair("cradlepoint-ericsson", "peplink"),
];

export function getComparePair(slug: string): ComparePair | undefined {
  return COMPARE_PAIRS.find((p) => p.slug === slug);
}
