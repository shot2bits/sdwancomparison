/**
 * Manage-token continuity for the first redirect after an anonymous buyer's
 * project is created (Quick Understanding's bridge, DescribeWizard's
 * generate step).
 *
 * Root cause this exists to fix: every server-rendered Project page
 * (src/app/project/[id]/page.tsx and siblings) and ProjectNav.tsx derive
 * their own tab/link `?manage=` query strings purely from that request's
 * own `searchParams.manage` -- there is no client-side localStorage
 * fallback in that server-rendered navigation, by design (the manage token
 * is the buyer's private key; it can't be read from a cookie or session
 * for an anonymous draft). RfpBuilder.tsx's own client code separately
 * recovers the token from localStorage for its own API calls, which is why
 * the builder page itself works even without `?manage=` in the URL -- but
 * that recovery is local to RfpBuilder and never reaches ProjectNav's
 * server-rendered hrefs, so every other tab (Overview, Assessment, Story,
 * Timeline) still renders without the token and hits the sign-in wall.
 *
 * The fix is not in ProjectNav or the per-page `qs` logic -- both already
 * work correctly whenever `searchParams.manage` is present. It only needs
 * to be seeded once, on the very first landing after creation: that first
 * server render is what populates every ProjectNav/qs link on the page,
 * and RfpBuilder.tsx's own effect (loadProject) already adopts the token
 * into localStorage and strips it from the visible address bar via
 * history.replaceState immediately afterward -- so this seed is single-use
 * by construction, never appears in the address bar after that first
 * paint, and is never written to buyer-visible copy or logs.
 *
 * Safe by construction (does not rely on callers only ever passing a bare
 * path): if `path` already carries a `manage` parameter -- from either
 * caller, or any future one -- its value is replaced in place and no
 * second `manage` parameter is added. Every other query parameter is kept
 * exactly as it appeared (not re-encoded, not reordered relative to each
 * other), so this only ever touches the one key it owns.
 */
export function withManageToken(path: string, token: string | undefined | null): string {
  if (!token) return path;

  const hashIndex = path.indexOf("#");
  const withoutHash = hashIndex === -1 ? path : path.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : path.slice(hashIndex);

  const queryIndex = withoutHash.indexOf("?");
  const base = queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
  const rawQuery = queryIndex === -1 ? "" : withoutHash.slice(queryIndex + 1);

  // Drop any existing `manage` pair(s) -- matched on the *decoded* key, so
  // a percent-encoded key still resolves to "manage" -- rather than
  // appending blindly. Every other pair is kept as its original raw
  // string, untouched, so an existing param's own encoding is never
  // altered by round-tripping it through a different codec. Malformed
  // percent-encoding in an unrelated key falls back to a raw comparison
  // rather than throwing.
  const pairs = rawQuery.length > 0 ? rawQuery.split("&").filter((pair) => pair.length > 0) : [];
  const kept = pairs.filter((pair) => {
    const eq = pair.indexOf("=");
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    let key = rawKey;
    try {
      key = decodeURIComponent(rawKey);
    } catch {
      /* malformed encoding on this pair's key: compare the raw form */
    }
    return key !== "manage";
  });
  kept.push(`manage=${encodeURIComponent(token)}`);

  return `${base}?${kept.join("&")}${hash}`;
}
