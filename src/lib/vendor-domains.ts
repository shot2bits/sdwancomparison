/** Approved email domains per supplier vendor, for domain-verified sign-in.
 *  Indicative public domains; confirm and extend per vendor during onboarding. */
export const VENDOR_DOMAINS: Record<string, string[]> = {
  "att-business": ["att.com"],
  "aryaka": ["aryaka.com"],
  "arista-velocloud": ["arista.com", "velocloud.com"],
  "bt-business": ["bt.com", "ee.co.uk"],
  "cato-networks": ["catonetworks.com"],
  "check-point": ["checkpoint.com"],
  "cisco": ["cisco.com", "meraki.com"],
  "cloudflare-one": ["cloudflare.com"],
  "colt-technology-services": ["colt.net"],
  "comcast-business": ["comcast.com", "masergy.com"],
  "cradlepoint-ericsson": ["cradlepoint.com", "ericsson.com"],
  "fatpipe-networks": ["fatpipe.com"],
  "forcepoint": ["forcepoint.com"],
  "fortinet": ["fortinet.com"],
  "gtt": ["gtt.net"],
  "hpe-aruba": ["hpe.com", "arubanetworks.com"],
  "hughes": ["hughes.com"],
  "juniper-networks": ["juniper.net"],
  "lumen": ["lumen.com"],
  "netskope": ["netskope.com"],
  "ntt": ["global.ntt", "ntt.com", "nttdata.com"],
  "orange-business": ["orange.com", "orange-business.com"],
  "palo-alto-networks": ["paloaltonetworks.com"],
  "peplink": ["peplink.com"],
  "sonicwall": ["sonicwall.com"],
  "telefonica-tech": ["telefonicatech.com", "telefonicatech.uk"],
  "verizon-business": ["verizon.com"],
  "versa-networks": ["versa-networks.com"],
  "vodafone-business": ["vodafone.com", "vodafone.co.uk"],
};

/** Netify staff can relay on behalf of any vendor (curated marketplace). */
export const NETIFY_DOMAINS = ["netify.co.uk", "netify.com"];

export function vendorForEmailDomain(domain: string): string | null {
  const d = domain.toLowerCase();
  for (const [slug, domains] of Object.entries(VENDOR_DOMAINS)) {
    if (domains.includes(d)) return slug;
  }
  return null;
}

export function isNetifyDomain(domain: string): boolean {
  return NETIFY_DOMAINS.includes(domain.toLowerCase());
}

// NOTE: the free/consumer webmail blocklist lives in lib/access-control.ts
// (FREE_EMAIL_DOMAINS, plus live KV extras from the admin console). A second
// FREE_WEBMAIL set that used to sit here (behind an unused isBusinessDomain
// helper) was removed so there is exactly one list to maintain.
