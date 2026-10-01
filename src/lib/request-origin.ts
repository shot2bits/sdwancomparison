/** Explicit public origins survive the apex-to-SASE rewrite. Never trust forwarded
 * host headers or arbitrary *.vercel.app domains to authorise browser mutations. */
export function requestOriginAllowed(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // Existing non-browser/server client contract.
  try {
    if (new URL(origin).origin !== origin) return false;
    const allowed = new Set([new URL(req.url).origin]);
    if (process.env.VERCEL_ENV === 'production') {
      for (const site of ['https://netify.co.uk','https://www.netify.co.uk','https://sase.netify.co.uk','https://app.netify.co.uk']) allowed.add(site);
    }
    if (['production','preview'].includes(process.env.VERCEL_ENV ?? '')) {
      for (const host of [process.env.VERCEL_URL,process.env.VERCEL_BRANCH_URL]) {
        if (host && /^[a-z0-9.-]+\.vercel\.app$/i.test(host)) allowed.add(`https://${host}`);
      }
    }
    return allowed.has(origin);
  } catch { return false; }
}
