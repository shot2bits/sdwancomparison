/**
 * Notice display titles: derived, never authored (the Derived UI Principle).
 *
 * Stored notice titles arrive from three sources: the RFP Builder's schema
 * default ("Untitled SASE / SD-WAN RFP"), the security engine's pre-guard
 * legacy artefact ("Security sourcing for 66", Harry's QA F1) and buyers'
 * own typing. A public notice is a supplier-facing procurement document, so
 * when the stored title carries no information the public projection derives
 * one from the notice's own structured fields, in the house grammar of the
 * worked examples ("Co-managed SD-WAN, 6-20 sites, Asia Pacific").
 *
 * The stored title is never rewritten (provenance stays intact); derivation
 * happens at read time inside toPublicOpportunity, so the board page, the
 * notice page, data.json twins, the supplier API and the MCP all render the
 * same word from the same rule (Article 17). No derivation, no rendering:
 * when nothing can be derived, the stored title stands unchanged.
 */

import type { OppScope } from "@/lib/opportunity-types";
import { REGIONS, SECTORS, USERS_BANDS, labelFor, siteBandLabelFor, siteFigureIsIdentifying } from "@/lib/notice-options";

export const NOTICE_TITLE_RULES_VERSION = "notice-title v2026.07.23";

/** Scope words as they read inside a title (OPP_SCOPE_LABELS says "Full SASE"; a title says "SASE"). */
const TITLE_SCOPE: Partial<Record<OppScope, string>> = {
  sase: "SASE",
  sd_wan: "SD-WAN",
  sse: "SSE",
  underlay_circuits: "Underlay circuits",
  firewall_fwaas: "Firewall / FWaaS",
  ztna: "ZTNA",
  swg: "Secure web gateway",
  casb: "CASB",
  connectivity: "Connectivity",
  managed_security: "Managed security",
};

/**
 * A stored title is insufficient when it is empty or matches a known
 * information-free pattern. Deterministic and versioned; extend only with
 * observed patterns (Article 23: evidence, not taste).
 */
const INSUFFICIENT_TITLE_PATTERNS: RegExp[] = [
  /^untitled\b/i,                                              // "Untitled SASE / SD-WAN RFP" and kin
  /^security sourcing for \d+(?:\s*\(\d+\s*users\))?$/i,       // the F1 numeric-sector artefact
  /^(?:full\s+)?(?:sase|sse|sd[\s-]?wan)(?:\s*\/\s*sd[\s-]?wan)?\s*(?:rfp|rfi|requirement)$/i, // generic "SASE requirement"
];

export function insufficientNoticeTitle(title: string): boolean {
  const s = String(title ?? "").replace(/\s+/g, " ").trim();
  if (!s) return true;
  return INSUFFICIENT_TITLE_PATTERNS.some((re) => re.test(s));
}

/** The structured fields a title can be derived from (Opportunity and PublicOpportunity both satisfy this). */
export type NoticeTitleSource = {
  title: string;
  scope: OppScope[] | readonly OppScope[];
  sites: number | null;
  regions: string[] | readonly string[];
  buyer_sector: string;
  users_band: string;
  // Optional so older callers and fixtures keep working; absent reads as
  // anonymous, the privacy-conservative default (titles are public surfaces).
  buyer_visibility?: string;
};

/** The site figure as a public title states it: exact unless identifying (Robert's ruling, 29 Jul 2026). */
function titleSitePhrase(f: { sites: number | null; regions: readonly string[] | string[]; buyer_sector?: string; buyer_visibility?: string }): string | null {
  if (typeof f.sites !== "number" || !Number.isFinite(f.sites) || f.sites < 1) return null;
  if (siteFigureIsIdentifying({ buyer_visibility: f.buyer_visibility, buyer_sector: f.buyer_sector ?? "", regions: f.regions })) {
    return siteBandLabelFor(f.sites);
  }
  return `${f.sites} ${f.sites === 1 ? "site" : "sites"}`;
}

/** Region list as a title reads it: "UK & Ireland", "UK & Ireland and Europe", "UK & Ireland, Europe and more". */
function regionPhrase(regions: readonly string[]): string | null {
  const labels = regions.map((r) => labelFor(REGIONS, r)).filter(Boolean);
  if (labels.length === 0) return null;
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels[0]}, ${labels[1]} and more`;
}

/**
 * Derive a title from the notice's structured fields, or return null when the
 * fields cannot carry one (no usable scope). Null means: render the stored
 * title; never invent.
 */
export function deriveNoticeTitle(f: NoticeTitleSource): string | null {
  const primary = f.scope.find((s): s is OppScope => s !== "managed_service" && s !== "not_sure" && Boolean(TITLE_SCOPE[s]));
  if (!primary) return null;
  const managed = f.scope.includes("managed_service") && primary !== "managed_security";
  const scopeWord = TITLE_SCOPE[primary] as string;
  const head = managed ? `Managed ${scopeWord}` : scopeWord;

  const segments: string[] = [];
  // Titles are public surfaces: the site figure enters exactly unless the
  // identifying combination holds, in which case the band enters instead
  // (Robert's ruling, 29 Jul 2026). One rule with the projection, so the
  // title never says more than the notice body does.
  const sitePhrase = titleSitePhrase(f);
  if (sitePhrase) {
    segments.push(sitePhrase);
  } else if (f.users_band) {
    // Only a known band enters the title (labels already read "100–500 users").
    // Unknown or free-typed values are skipped — the "66" lesson, applied here.
    const known = USERS_BANDS.find((b) => b.key === f.users_band);
    if (known) segments.push(known.label.startsWith("Under") ? `u${known.label.slice(1)}` : known.label);
  }
  const regions = regionPhrase(f.regions);
  if (regions) segments.push(regions);

  if (segments.length > 0) return `${head}, ${segments.join(", ")}`;

  // No estate facts: fall back to the sector when it reads as one (letters
  // required — the "66" lesson), then to a plain requirement line.
  const sectorRaw = String(f.buyer_sector ?? "").trim();
  if (sectorRaw && /[a-zA-Z]/.test(sectorRaw)) {
    return `${head} for ${labelFor(SECTORS, sectorRaw)}`;
  }
  return `${head} requirement`;
}

/**
 * The display title every public surface renders: the stored title when it
 * carries information, the derived title when it does not, and the stored
 * title again when nothing can be derived.
 */
export function noticeDisplayTitle(f: NoticeTitleSource): string {
  if (!insufficientNoticeTitle(f.title)) return f.title;
  return deriveNoticeTitle(f) ?? f.title;
}

/**
 * A title that would sit on the board beside an identical open title gains
 * one distinguishing stated fact, in the house grammar (Harry's Section 1
 * finding, 28 Jul 2026: two live notices both read "SASE requirement:
 * Retail & e-commerce", indistinguishable to suppliers). Derived, never
 * invented: sites first, then a region not already in the title, then the
 * users band, and when no stated fact distinguishes, the created date,
 * which is always true. Applied at listing time to the opportunity record
 * being created or refreshed; stored titles of OTHER notices are never
 * touched.
 */
export function ensureDistinctNoticeTitle(
  title: string,
  src: { sites: number | null; regions: string[] | readonly string[]; users_band?: string; created: number; buyer_sector?: string; buyer_visibility?: string },
  openTitles: string[],
): string {
  const norm = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();
  const clash = (t: string) => openTitles.some((o) => norm(o) === norm(t));
  if (!clash(title)) return title;
  const region = src.regions && src.regions.length ? labelFor(REGIONS, String(src.regions[0])) : "";
  // The distinguishing site fact follows the projection's rule: exact
  // unless the identifying combination holds, then the band (Robert's
  // ruling, 29 Jul 2026).
  const sitePhrase = titleSitePhrase({ sites: src.sites, regions: src.regions, buyer_sector: src.buyer_sector, buyer_visibility: src.buyer_visibility });
  const candidates = [
    sitePhrase ? `${title}, ${sitePhrase}` : "",
    region && !norm(title).includes(norm(region)) ? `${title}, ${region}` : "",
    src.users_band ? `${title}, ${labelFor(USERS_BANDS, src.users_band)} users` : "",
    `${title} (${new Date(src.created).toLocaleDateString("en-GB", { day: "numeric", month: "short" })})`,
  ].filter(Boolean) as string[];
  for (const c of candidates) if (!clash(c)) return c;
  return title;
}
