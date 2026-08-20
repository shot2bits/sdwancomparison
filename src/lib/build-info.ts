/**
 * The build stamp — Robert, 20 Aug 2026: "include a version number on the
 * page so I can see whether the page is cached or not."
 *
 * WHY IT HAS TO BE BAKED IN, NOT COMPUTED. The whole point is to detect a
 * STALE page. A value computed at request time (a header, a runtime date)
 * would be fresh even when the HTML around it is months old, which is the
 * opposite of useful. These two constants are inlined by Next at BUILD
 * time (see next.config.ts's `env` block), so a cached page carries the
 * stamp of the build that produced it and disagrees, visibly, with a
 * freshly-served one.
 *
 * PURE: no React, no I/O (Article 17).
 */

/** The commit this bundle was built from. Vercel supplies
 *  VERCEL_GIT_COMMIT_SHA; "dev" locally, where there is no build to
 *  identify and nothing is cached anyway. */
export const BUILD_SHA: string = (process.env.NEXT_PUBLIC_BUILD_SHA || "dev").slice(0, 7);

/** When the bundle was built, ISO-8601 UTC. Empty only if the config
 *  block failed to set it, which is worth showing as a gap rather than
 *  papering over with `new Date()` — see the note above about why a
 *  request-time value would defeat the purpose. */
export const BUILD_TIME: string = process.env.NEXT_PUBLIC_BUILD_TIME || "";

/** One short line, shared by every surface that shows it so the wording
 *  cannot drift: "build 1a62e9b · 20 Aug 12:34 UTC". */
export function buildStamp(): string {
  if (!BUILD_TIME) return `build ${BUILD_SHA}`;
  const d = new Date(BUILD_TIME);
  if (Number.isNaN(d.getTime())) return `build ${BUILD_SHA}`;
  const stamp = d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  });
  return `build ${BUILD_SHA} · ${stamp} UTC`;
}
