/**
 * Final public destination for each vendor profile link.
 *
 * netify.co.uk/sase/vendors/<slug>/ redirects to the main site's own provider
 * profile under /marketplace/. Linking straight to the destination avoids a
 * redirect hop on every vendor link. Each URL below returned 200 on
 * 20 Nov 2026 after following the live redirects. The two vendors without a
 * main-site profile (fatpipe-networks, telefonica-tech) land on the
 * marketplace index, as the redirects do. Peplink keeps its alternatives page.
 */
export const VENDOR_PROFILE_URL: Readonly<Record<string, string>> = {
  "arista-velocloud": "https://netify.co.uk/marketplace/velocloud/",
  "aryaka": "https://netify.co.uk/marketplace/aryaka/",
  "att-business": "https://netify.co.uk/marketplace/att/",
  "bt-business": "https://netify.co.uk/marketplace/bt/",
  "cato-networks": "https://netify.co.uk/marketplace/cato-networks/",
  "check-point": "https://netify.co.uk/marketplace/checkpoint/",
  "cisco": "https://netify.co.uk/marketplace/cisco/",
  "cloudflare-one": "https://netify.co.uk/marketplace/cloudflare-one/",
  "colt-technology-services": "https://netify.co.uk/marketplace/colt/",
  "comcast-business": "https://netify.co.uk/marketplace/comcastbusiness/",
  "cradlepoint-ericsson": "https://netify.co.uk/marketplace/ericsson-cradlepoint/",
  "fatpipe-networks": "https://netify.co.uk/marketplace/",
  "forcepoint": "https://netify.co.uk/marketplace/forcepoint/",
  "fortinet": "https://netify.co.uk/marketplace/fortinet-fortisase/",
  "gtt": "https://netify.co.uk/marketplace/gtt/",
  "hpe-aruba": "https://netify.co.uk/marketplace/hpe-aruba-edgeconnect/",
  "hughes": "https://netify.co.uk/marketplace/hughes-network-systems/",
  "juniper-networks": "https://netify.co.uk/marketplace/juniper/",
  "lumen": "https://netify.co.uk/marketplace/lumen/",
  "netskope": "https://netify.co.uk/marketplace/netskope/",
  "ntt": "https://netify.co.uk/marketplace/ntt-data/",
  "orange-business": "https://netify.co.uk/marketplace/orangebusiness/",
  "palo-alto-networks": "https://netify.co.uk/marketplace/palo-alto-prisma-sase/",
  "peplink": "https://netify.co.uk/sase/alternatives/peplink/",
  "sonicwall": "https://netify.co.uk/marketplace/sonicwall-cse/",
  "telefonica-tech": "https://netify.co.uk/marketplace/",
  "verizon-business": "https://netify.co.uk/marketplace/verizon/",
  "versa-networks": "https://netify.co.uk/marketplace/versa-networks/",
  "vodafone-business": "https://netify.co.uk/marketplace/vodafone/",
  "zscaler": "https://netify.co.uk/marketplace/zscaler/",
};

export const VENDOR_INDEX_URL = "https://netify.co.uk/marketplace/";

/** Absolute URL, so Next's basePath is never prepended to it. */
export function vendorProfileHref(slug: string): string {
  return VENDOR_PROFILE_URL[slug] ?? VENDOR_INDEX_URL;
}
