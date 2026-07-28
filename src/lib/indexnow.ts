/**
 * IndexNow pings for the public opportunity record (the "findable and
 * citable" mechanic, 28 Jul 2026). A notice is news twice: when it opens
 * and when it closes. Search engines that speak IndexNow (Bing, Seznam,
 * Naver, Yandex) learn both moments within minutes instead of on the next
 * crawl, which is what makes the closed record citable while the market
 * conversation is still happening.
 *
 * Configuration: set INDEXNOW_KEY in the environment (any 8-128 char
 * hex/alphanumeric string). The key is served back at /sase/indexnow.txt
 * (see app/indexnow.txt/route.ts) as the protocol's ownership proof.
 * Without the key, every call is a silent no-op: the ping is an
 * accelerant, never a dependency, and it must never fail or delay a
 * publish or a close.
 */

import { SITE_URL } from "@/lib/structured-data";

const ENDPOINT = "https://api.indexnow.org/indexnow";

/** The public host the notices live on, derived from SITE_URL. */
function siteHost(): string {
  try {
    return new URL(SITE_URL).host;
  } catch {
    return "netify.co.uk";
  }
}

/**
 * Ping IndexNow with site paths (absolute URLs or SITE_URL-relative paths).
 * Fire-and-forget: resolves true when the ping was accepted, false when it
 * was skipped (no key) or failed. Never throws; callers never await more
 * than a few seconds.
 */
export async function pingIndexNow(paths: string[]): Promise<boolean> {
  const key = process.env.INDEXNOW_KEY;
  if (!key || paths.length === 0) return false;
  const urlList = paths
    .map((p) => (p.startsWith("http") ? p : `${SITE_URL}${p.startsWith("/") ? "" : "/"}${p}`))
    .slice(0, 100); // protocol allows 10,000; our events touch a handful
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: siteHost(),
        key,
        keyLocation: `${SITE_URL}/indexnow.txt`,
        urlList,
      }),
      signal: AbortSignal.timeout(4000),
    });
    return res.ok || res.status === 202;
  } catch {
    return false; // an accelerant, never a dependency
  }
}

/**
 * The URLs worth pinging when one notice changes state: the notice page,
 * its machine twin, the board and the sitemap.
 */
export function noticePingPaths(id: string): string[] {
  return [
    `/opportunities/${id}/`,
    `/opportunities/${id}/data.json`,
    `/opportunities/board/`,
    `/opportunities/board/data.json`,
    `/sitemap.xml`,
  ];
}
