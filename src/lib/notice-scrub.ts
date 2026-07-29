/**
 * The free-text scrub (Robert's R2, ruled 28-29 Jul 2026): pre-publish
 * validation FLAGS identifying content in the buyer's own words. Flags
 * warn and the buyer decides; nothing is silently rewritten (ask, never
 * guess). Deterministic and dependency-light so it runs identically in
 * the wizard preview (client), the desk and any server gate.
 *
 * What it looks for, per the ruling: named incumbents matched against the
 * vendor roster, UK postcodes and specific-place markers, phrases of
 * uniqueness ("the only", "the largest"), and company-shaped proper names
 * (Something Something Ltd). The identifying power is the COMBINATION of
 * these with sector and region; the scrub surfaces the raw material so
 * the combination sentence and the buyer can weigh it.
 *
 * Flag wording is machine-plain and PROVISIONAL pending Harry's copy pass.
 */

import { VENDOR_DOMAINS } from "@/lib/vendor-domains";

export type ScrubFlag = {
  field: string;
  kind: "named_vendor" | "postcode" | "uniqueness" | "company_name";
  match: string;
  why: string;
};

/** Vendor display names derived from roster slugs ("cato-networks" reads "Cato Networks"). */
const VENDOR_NAMES: string[] = Object.keys(VENDOR_DOMAINS).map((slug) =>
  slug
    .split("-")
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" "),
);

/** Extra market names buyers actually type (short forms of roster entries). */
const VENDOR_SHORT_FORMS = [
  "Cato", "Meraki", "Viptela", "VeloCloud", "Zscaler", "Netskope", "Fortinet", "Palo Alto",
  "Cisco", "Juniper", "Aruba", "Versa", "Aryaka", "Cloudflare", "Forcepoint", "SonicWall",
  "Check Point", "Vodafone", "Verizon", "Lumen", "Colt", "Orange", "Telefonica", "GTT", "NTT", "Hughes", "Peplink",
];

const POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/g;
const UNIQUENESS = /\b(the (?:only|largest|biggest|first|leading|sole)|one of only|uniquely)\b/gi;
// Two or more capitalised words followed by a company suffix.
const COMPANY_SHAPE = /\b(?:[A-Z][A-Za-z&']+\s+){1,3}(?:Ltd|Limited|PLC|plc|LLP|Group|Holdings|Trust|Council)\b/g;

function flagsIn(field: string, text: string): ScrubFlag[] {
  const out: ScrubFlag[] = [];
  if (!text || !text.trim()) return out;

  const names = [...new Set([...VENDOR_NAMES, ...VENDOR_SHORT_FORMS])];
  for (const name of names) {
    const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    const m = re.exec(text);
    if (m) {
      out.push({
        field,
        kind: "named_vendor",
        match: m[0],
        why: `Naming your incumbent (${m[0]}) narrows who you could be, especially combined with your sector and region. It also tells every supplier who they are bidding against.`,
      });
    }
  }
  for (const m of text.matchAll(POSTCODE)) {
    out.push({ field, kind: "postcode", match: m[0], why: `A postcode (${m[0]}) points at a specific site. The public notice needs regions, not addresses.` });
  }
  for (const m of text.matchAll(UNIQUENESS)) {
    out.push({ field, kind: "uniqueness", match: m[0], why: `"${m[0]}" can identify you on its own: phrases of uniqueness describe exactly one organisation.` });
  }
  for (const m of text.matchAll(COMPANY_SHAPE)) {
    out.push({ field, kind: "company_name", match: m[0], why: `"${m[0]}" reads as a named organisation. If that is you or a supplier, the public notice shows it verbatim.` });
  }
  return out;
}

/**
 * Scrub the public free-text fields of a notice draft. Pass only fields
 * that will render publicly; the caller labels them in buyer English.
 * Deduplicated per field and match so one repeated name flags once.
 */
export function scrubNoticeText(fields: Record<string, string | null | undefined>): ScrubFlag[] {
  const all: ScrubFlag[] = [];
  for (const [field, text] of Object.entries(fields)) {
    all.push(...flagsIn(field, String(text ?? "")));
  }
  const seen = new Set<string>();
  return all.filter((f) => {
    const k = `${f.field}|${f.kind}|${f.match.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
