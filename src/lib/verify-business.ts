/**
 * The automatic business verification chain (Robert's Ruling Two, 29 Jul
 * 2026). Runs on the publish confirmation click, no human step, no queue:
 *
 *   1. the domain is not free webmail or disposable (the compiled list plus
 *      the live admin blocklist),
 *   2. the domain resolves with real MX records,
 *   3. the domain serves a live website,
 *   4. UK domains are looked up on Companies House and the result is STORED
 *      AS EVIDENCE (evidence, not a gate: a real trading name often differs
 *      from its registered name, so a search miss must not block a publish
 *      the first three checks passed).
 *
 * Why this is strong enough to trust (the ruling's own words): the domain
 * checks prove the domain is real; the confirmation click proves the person
 * controls an address at that company. Domain plus click is the
 * verification. All checks are best-effort-fast: the whole chain is bounded
 * to a few seconds because it runs inside a click.
 *
 * The company is DERIVED, never typed: from the domain name, the website
 * title and the Companies House register. Netify is an intermediary and
 * cannot introduce a business it cannot name.
 */

import { resolveMx } from "node:dns/promises";
import { isBlockedDomainLive, isAcademicDomain, isAdminEmail } from "@/lib/access-control";
import { getBuyerAllowlist } from "@/lib/rfp-store";

export type BusinessVerification = {
  domain: string;
  checked_at: number;
  /** The overall verdict: every gate passed and the notice may publish. */
  passed: boolean;
  /** Which gate stopped the chain, when one did. */
  failed_check: "free_or_disposable" | "academic" | "mx" | "website" | null;
  /** The sign-in convention honoured here too (Harry's retest, 29 Jul
   *  2026): admin emails and admin-allowlisted buyer domains are exempt
   *  from the free and academic refusals, exactly as they are at sign-in.
   *  The exemption is recorded on the evidence; MX and website still run. */
  exemption: "admin" | "buyer_allowlist" | null;
  mx: { pass: boolean; records: number };
  website: { pass: boolean; status: number | null; host: string | null; title: string | null };
  /** Derived, never typed by the buyer. */
  derived_company: string | null;
  /** Evidence only, never a gate. Null when the domain is not UK or the key is unset. */
  companies_house: { company_number: string; company_name: string; company_status: string } | { unavailable: string } | null;
};

const WEBSITE_TIMEOUT_MS = 6000;
const MX_TIMEOUT_MS = 4000;
const CH_TIMEOUT_MS = 5000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** The mail domain of an address, lowercased; null when it does not parse. */
export function domainOfEmail(email: string): string | null {
  const m = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/.exec(String(email ?? "").trim().toLowerCase());
  return m ? m[1] : null;
}

/** UK domains get the Companies House evidence lookup. */
export function isUkDomain(domain: string): boolean {
  return /\.uk$/.test(domain.toLowerCase());
}

/**
 * A readable company guess from the domain alone: "thorpe-networks.co.uk"
 * reads "Thorpe Networks". The website title and the CH register refine it;
 * this is the floor, never shown as fact without its provenance.
 */
export function companyNameFromDomain(domain: string): string {
  const base = domain.toLowerCase().replace(/\.(co|org|ac|gov|net|com|ltd|plc)\.uk$/, "").replace(/\.[a-z]{2,10}$/, "");
  return base
    .split(/[-_.]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function checkMx(domain: string): Promise<{ pass: boolean; records: number }> {
  try {
    const records = await withTimeout(resolveMx(domain), MX_TIMEOUT_MS);
    return { pass: records.length > 0, records: records.length };
  } catch {
    return { pass: false, records: 0 };
  }
}

/**
 * "Serves a live website" means the domain answers HTTP at all: any status
 * proves a live server behind the name (a 403 from a corporate WAF is still
 * a company running a website). Connection refusal, NXDOMAIN or a timeout
 * fail. Tries the bare domain then www.
 */
async function checkWebsite(domain: string): Promise<{ pass: boolean; status: number | null; host: string | null; title: string | null }> {
  for (const host of [domain, `www.${domain}`]) {
    try {
      const res = await withTimeout(fetch(`https://${host}/`, { redirect: "follow", headers: { "user-agent": "NetifyVerify/1.0 (+https://netify.co.uk/sase/)" } }), WEBSITE_TIMEOUT_MS);
      let title: string | null = null;
      try {
        const text = await withTimeout(res.text(), 2000);
        const m = /<title[^>]*>([^<]{1,120})/i.exec(text);
        title = m ? m[1].trim() : null;
      } catch { /* body unavailable; the response alone proves liveness */ }
      return { pass: true, status: res.status, host, title };
    } catch { /* try the next host */ }
  }
  return { pass: false, status: null, host: null, title: null };
}

/**
 * Companies House search, evidence only. Requires COMPANIES_HOUSE_API_KEY
 * (free, developer.company-information.service.gov.uk); without it the
 * evidence records why it is absent and the chain is unaffected.
 */
async function companiesHouseEvidence(domain: string, guess: string): Promise<BusinessVerification["companies_house"]> {
  if (!isUkDomain(domain)) return null;
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  if (!key) return { unavailable: "COMPANIES_HOUSE_API_KEY not configured" };
  try {
    const res = await withTimeout(
      fetch(`https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(guess)}&items_per_page=1`, {
        headers: { authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` },
      }),
      CH_TIMEOUT_MS,
    );
    if (!res.ok) return { unavailable: `Companies House responded ${res.status}` };
    const data = (await res.json()) as { items?: Array<{ company_number?: string; title?: string; company_status?: string }> };
    const top = data.items?.[0];
    if (!top?.company_number) return { unavailable: "no register match for the derived name" };
    return { company_number: top.company_number, company_name: top.title ?? "", company_status: top.company_status ?? "" };
  } catch {
    return { unavailable: "lookup failed or timed out" };
  }
}

/**
 * Run the full chain for a publishing email address. Never throws; the
 * verdict and the evidence come back together and the caller decides the
 * consequence (publish, or save unpublished with the reason).
 */
export async function verifyBusinessEmail(email: string): Promise<BusinessVerification> {
  const domain = domainOfEmail(email) ?? "";
  const base: BusinessVerification = {
    domain,
    checked_at: Date.now(),
    passed: false,
    failed_check: null,
    exemption: null,
    mx: { pass: false, records: 0 },
    website: { pass: false, status: null, host: null, title: null },
    derived_company: null,
    companies_house: null,
  };
  if (!domain) return { ...base, failed_check: "free_or_disposable" };

  // The sign-in convention, honoured here too: admin emails and
  // admin-allowlisted buyer domains bypass the free-webmail and academic
  // refusals. Sign-in already admits them; a publish gate that then
  // refuses them would be incoherent. The exemption is recorded and the
  // MX and website checks still run.
  let exemption: BusinessVerification["exemption"] = null;
  if (isAdminEmail(email)) {
    exemption = "admin";
  } else {
    try {
      if ((await getBuyerAllowlist()).includes(domain)) exemption = "buyer_allowlist";
    } catch { /* allowlist unavailable reads as no exemption */ }
  }
  base.exemption = exemption;

  if (!exemption) {
    if (await isBlockedDomainLive(domain)) return { ...base, failed_check: "free_or_disposable" };
    if (isAcademicDomain(domain)) return { ...base, failed_check: "academic" };
  }

  // MX and website in parallel: independent facts about the same domain.
  const [mx, website] = await Promise.all([checkMx(domain), checkWebsite(domain)]);
  const guess = companyNameFromDomain(domain);
  const derived = website.title && website.title.length >= 3 ? website.title : guess || null;
  if (!mx.pass) return { ...base, mx, website, derived_company: derived, failed_check: "mx" };
  if (!website.pass) return { ...base, mx, website, derived_company: derived, failed_check: "website" };

  const companies_house = await companiesHouseEvidence(domain, guess);
  const derivedFinal = companies_house && "company_name" in companies_house && companies_house.company_name
    ? companies_house.company_name
    : derived;
  return { ...base, passed: true, mx, website, derived_company: derivedFinal, companies_house };
}
