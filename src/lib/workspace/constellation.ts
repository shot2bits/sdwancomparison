/**
 * The market constellation: pure geometry for the market pane's scene.
 * Robert's verdict (23 Jul 2026): the constellation returns as the market
 * pane, under the design language's channels, never decoration. This
 * module holds only maths, shared with the fixtures, so the scene's
 * honesty is pinned:
 *
 * - ANGLE is a stable function of the slug alone. A supplier never moves
 *   angularly: under Article 14 the only movement a body makes is radial,
 *   and radial movement means its own standing changed (or the scene
 *   gained a neighbour, the same passive displacement the list showed).
 * - DISTANCE is fit. When named checks exist, radius follows rank in the
 *   evidence order. Before any check exists there is nothing to differ
 *   on, so every body sits on one honest ring: equal distance is the
 *   truthful rendering of "no evidence separates them yet".
 * - Separation nudges are radial only and deterministic, so the angle law
 *   survives collision avoidance.
 *
 * Ink, size, amber and breath are the caller's channels (recency,
 * invited, a genuinely open notice); geometry never decides them.
 */

export type ConstellationInput = {
  slug: string;
  /** Rank in the evidence order (0 is best), or null when this body is
   *  outside the ranked set (no checks yet, or not in the current fit). */
  rank: number | null;
};

export type ConstellationBody = {
  slug: string;
  angle: number; // degrees, stable per slug forever
  r: number;
  x: number;
  y: number;
};

/** Stable angle for a slug: a plain string hash onto the circle, one
 *  decimal of a degree. Deterministic across sessions and machines. */
export function slugAngle(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return (h % 3600) / 10;
}

export const RADIUS = { base: 46, step: 9, ring: 96, outer: 124, max: 132 };

/** Radius from rank: near when the evidence ranks you, the honest ring
 *  when nothing separates the field, the outer edge when the ranked set
 *  exists and you are not in it. */
export function bodyRadius(rank: number | null, ranked: boolean): number {
  if (rank !== null) return Math.min(RADIUS.outer, RADIUS.base + rank * RADIUS.step);
  return ranked ? RADIUS.outer : RADIUS.ring;
}

/** Lay out the scene. Separation is radial-only and deterministic: a body
 *  landing within minGap of an earlier body steps outward until clear. */
export function constellation(
  items: ConstellationInput[],
  ranked: boolean,
  cx: number,
  cy: number,
  minGap = 17,
): ConstellationBody[] {
  const out: ConstellationBody[] = [];
  for (const it of items) {
    const angle = slugAngle(it.slug);
    const a = (angle * Math.PI) / 180;
    let r = bodyRadius(it.rank, ranked);
    let x = cx + Math.cos(a) * r;
    let y = cy + Math.sin(a) * r;
    let guard = 0;
    while (guard++ < 14 && out.some((o) => Math.hypot(o.x - x, o.y - y) < minGap)) {
      if (r >= RADIUS.max) break;
      r = Math.min(RADIUS.max, r + 7);
      x = cx + Math.cos(a) * r;
      y = cy + Math.sin(a) * r;
    }
    out.push({ slug: it.slug, angle, r, x, y });
  }
  return out;
}
