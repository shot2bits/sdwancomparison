/**
 * Access control: business-only email policy, admin allowlist, and the
 * live merge of static config with KV overrides.
 *
 * Two layers:
 *   1. Static defaults compiled into the build (this file).
 *   2. Live overrides stored in KV and editable from the admin page,
 *      so domain and blocklist changes take effect without a redeploy.
 *
 * Identity policy: free webmail and disposable domains are never accepted
 * for sign-in. Admin allowlist emails are the only exemption, so an admin
 * can always reach the console.
 */

import { VENDOR_DOMAINS, NETIFY_DOMAINS } from "@/lib/vendor-domains";
import { getVendorDomainOverrides, getBlocklistExtra } from "@/lib/rfp-store";

/**
 * Free / consumer webmail and common disposable domains. Sign-in with any
 * of these is rejected for both suppliers and buyers. Extend live from the
 * admin blocklist editor; this is the compiled baseline.
 */
export const FREE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  // Mainstream consumer webmail
  "gmail.com", "googlemail.com",
  "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "live.co.uk", "msn.com", "windowslive.com",
  "yahoo.com", "yahoo.co.uk", "ymail.com", "rocketmail.com",
  "icloud.com", "me.com", "mac.com",
  "aol.com", "aim.com",
  "proton.me", "protonmail.com", "pm.me",
  "gmx.com", "gmx.co.uk", "gmx.net", "gmx.de",
  "mail.com", "email.com", "usa.com", "consultant.com",
  "zoho.com", "zohomail.com",
  "yandex.com", "yandex.ru",
  "tutanota.com", "tuta.io", "tutamail.com",
  "fastmail.com", "fastmail.fm",
  "hey.com",
  // UK ISP / consumer
  "btinternet.com", "talktalk.net", "sky.com", "virginmedia.com", "ntlworld.com",
  "blueyonder.co.uk", "tiscali.co.uk", "btopenworld.com", "o2.co.uk",
  // Other common consumer / regional webmail
  "web.de", "t-online.de", "orange.fr", "free.fr", "laposte.net", "wanadoo.fr",
  "libero.it", "virgilio.it", "alice.it",
  "naver.com", "hanmail.net", "daum.net", "qq.com", "163.com", "126.com", "sina.com",
  "rediffmail.com",
  // Disposable / throwaway
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "trashmail.com",
  "yopmail.com", "temp-mail.org", "tempmail.com", "getnada.com", "dispostable.com",
  "sharklasers.com", "throwawaymail.com", "maildrop.cc", "mailnesia.com", "fakeinbox.com",
]);

/** Parse the admin allowlist from env, lowercased. */
function envAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Default admins. Overridable by setting ADMIN_EMAILS (comma separated) in the
 * project env, which takes precedence when present.
 */
const DEFAULT_ADMIN_EMAILS = ["support@netify.com"];

export function adminEmails(): string[] {
  const env = envAdminEmails();
  return env.length > 0 ? env : DEFAULT_ADMIN_EMAILS;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

/** Static check against the compiled blocklist only (no KV). */
export function isFreeEmailDomainStatic(domain: string): boolean {
  return FREE_EMAIL_DOMAINS.has(domain.toLowerCase());
}

/**
 * Live blocked check: compiled blocklist plus any domains added from the
 * admin console. Falls back to the static set if KV is unavailable.
 */
export async function isBlockedDomainLive(domain: string): Promise<boolean> {
  const d = domain.toLowerCase();
  if (FREE_EMAIL_DOMAINS.has(d)) return true;
  try {
    const extra = await getBlocklistExtra();
    return extra.includes(d);
  } catch {
    return false;
  }
}

/**
 * Effective vendor domain map: static defaults with per-vendor KV overrides
 * layered on top. An override fully replaces that vendor's domain list, so
 * the admin editor is the source of truth once a vendor is edited.
 */
export async function effectiveVendorDomains(): Promise<Record<string, string[]>> {
  const merged: Record<string, string[]> = {};
  for (const [slug, domains] of Object.entries(VENDOR_DOMAINS)) merged[slug] = [...domains];
  try {
    const overrides = await getVendorDomainOverrides();
    for (const [slug, domains] of Object.entries(overrides)) merged[slug] = [...domains];
  } catch {
    /* KV unavailable: fall back to static */
  }
  return merged;
}

/** Resolve a vendor slug from an email domain using the live (merged) map. */
export async function vendorForEmailDomainLive(domain: string): Promise<string | null> {
  const d = domain.toLowerCase();
  const map = await effectiveVendorDomains();
  for (const [slug, domains] of Object.entries(map)) {
    if (domains.map((x) => x.toLowerCase()).includes(d)) return slug;
  }
  return null;
}

export function isNetifyDomainLive(domain: string): boolean {
  return NETIFY_DOMAINS.includes(domain.toLowerCase());
}

export function emailDomain(email: string): string | null {
  const at = email.indexOf("@");
  if (at < 1 || !email.includes(".", at)) return null;
  return email.slice(at + 1).toLowerCase();
}
