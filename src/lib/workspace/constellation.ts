/**
 * The Netify SASE Constellation: pure geometry and colour law for the
 * market scene. Robert's verdicts (23 Jul 2026): the constellation is the
 * market pane; then promoted to a named band on the main page, marketed
 * as the Netify SASE Constellation, with per-vendor colour and the
 * capability evidence drawn as lines. This module holds only maths and
 * fixed assignments, shared with the fixtures, so the scene's honesty is
 * pinned:
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
 * - COLOUR follows the vendor, never its rank: a fixed hue per slug from
 *   a colourblind-validated palette that deliberately avoids the two
 *   reserved meanings (amber is the market and invited; emerald is advice
 *   that costs Netify). Names are always printed beside bodies, so colour
 *   is never the only identity (the relief rule for the one low-contrast
 *   pink is satisfied by those permanent labels).
 * - CAPABILITY NODES are the named checks the buyer's own facts created,
 *   evenly placed on an inner ring in stable id order; evidence lines run
 *   vendor to capability only where the dataset grades it (no evidence,
 *   no line), solid for a full grade, dashed for a partial one.
 *
 * Ink recency, invited amber, breath on a genuinely open notice stay the
 * caller's channels; geometry never decides them.
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

export type ConstellationOpts = {
  base: number;
  step: number;
  ring: number;
  outer: number;
  max: number;
  /** Vertical squash for wide scenes (an ellipse). Ordering along any one
   *  angle is unchanged, so distance-is-fit survives per direction. */
  ky: number;
};

/** Stable angle for a slug: a plain string hash onto the circle, one
 *  decimal of a degree. Deterministic across sessions and machines. */
export function slugAngle(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return (h % 3600) / 10;
}

/** The rail-sized scene (kept for compatibility and small echoes). */
export const RADIUS: ConstellationOpts = { base: 46, step: 9, ring: 96, outer: 124, max: 132, ky: 1 };

/** The main-page band: the Netify SASE Constellation's own proportions. */
export const BAND: ConstellationOpts = { base: 150, step: 11, ring: 210, outer: 258, max: 286, ky: 0.62 };

/** Radius from rank: near when the evidence ranks you, the honest ring
 *  when nothing separates the field, the outer edge when the ranked set
 *  exists and you are not in it. */
export function bodyRadius(rank: number | null, ranked: boolean, o: ConstellationOpts = RADIUS): number {
  if (rank !== null) return Math.min(o.outer, o.base + rank * o.step);
  return ranked ? o.outer : o.ring;
}

/** Lay out the scene. Separation is radial-only and deterministic: a body
 *  landing within minGap of an earlier body steps outward until clear. */
export function constellation(
  items: ConstellationInput[],
  ranked: boolean,
  cx: number,
  cy: number,
  minGap = 17,
  opts: ConstellationOpts = RADIUS,
): ConstellationBody[] {
  const out: ConstellationBody[] = [];
  for (const it of items) {
    const angle = slugAngle(it.slug);
    const a = (angle * Math.PI) / 180;
    let r = bodyRadius(it.rank, ranked, opts);
    let x = cx + Math.cos(a) * r;
    let y = cy + Math.sin(a) * r * opts.ky;
    let guard = 0;
    while (guard++ < 14 && out.some((o) => Math.hypot(o.x - x, o.y - y) < minGap)) {
      if (r >= opts.max) break;
      r = Math.min(opts.max, r + 7);
      x = cx + Math.cos(a) * r;
      y = cy + Math.sin(a) * r * opts.ky;
    }
    out.push({ slug: it.slug, angle, r, x, y });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Colour: fixed per vendor, validated, reserved meanings kept         */
/* ------------------------------------------------------------------ */

/** Nine hues, validated 23 Jul 2026 with the palette checker on the white
 *  surface (lightness band, chroma floor, adjacent CVD ΔE 15.0 worst,
 *  normal-vision ΔE 24.5 worst, all PASS; the pink carries a contrast
 *  WARN whose relief is the permanent printed name beside every body).
 *  Deliberately excludes the amber and emerald neighbourhoods: amber
 *  stays the market and invited, emerald stays advice that costs Netify. */
export const VENDOR_PALETTE = [
  "#2a78d6", // blue
  "#e34948", // red
  "#0891b2", // cyan
  "#7c3aed", // violet
  "#e87ba4", // pink
  "#1d4ed8", // deep blue
  "#be123c", // crimson
  "#d946ef", // fuchsia
  "#4a3aa7", // indigo
];

/** A vendor's hue: a stable function of the slug alone, decorrelated from
 *  the angle hash. Colour follows the entity, never its rank. */
export function vendorHue(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 53 + slug.charCodeAt(i)) >>> 0;
  return VENDOR_PALETTE[h % VENDOR_PALETTE.length];
}

/* ------------------------------------------------------------------ */
/* Capability nodes: the buyer's named checks, placed on an inner ring */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Label placement: names are the identity, so they may never overlap  */
/* ------------------------------------------------------------------ */

export type LabelItem = {
  slug: string;
  x: number;
  y: number;
  anchor: "start" | "end" | "middle";
  len: number;
  /** Distance from x to the text's near edge for start/end anchors (the
   *  body's radius plus the gap the renderer uses). */
  gap?: number;
};

/** A fixed thing a label must never cross: a body, a diamond, the centre.
 *  The id lets a label ignore its own anchor. */
export type LabelObstacle = { id: string; x: number; y: number; half: number };

/** Deterministic label de-collision (Robert, 23 Jul: "the text cannot
 *  bleed out, it must not overlap"): labels are placed in the given
 *  order; a label whose estimated box intersects an earlier label OR any
 *  obstacle steps vertically (down, up, further down…) until clear.
 *  Bodies never move for labels: positions are the truth, names are the
 *  furniture. Pure, so the same scene always reads the same way. */
export function labelOffsets(
  items: LabelItem[],
  obstacles: LabelObstacle[] = [],
  fontW = 4.7,
  h = 11,
): Record<string, number> {
  const placed: Array<{ x1: number; x2: number; y1: number; y2: number }> = [];
  const out: Record<string, number> = {};
  for (const it of items) {
    const w = it.len * fontW + 6;
    const g = it.gap ?? 0;
    let x1: number, x2: number;
    if (it.anchor === "middle") { x1 = it.x - w / 2; x2 = it.x + w / 2; }
    else if (it.anchor === "end") { x2 = it.x - g; x1 = x2 - w; }
    else { x1 = it.x + g; x2 = x1 + w; }
    const obs = obstacles.filter((o) => o.id !== it.slug);
    const hits = (yy: number) =>
      placed.some((p) => x1 < p.x2 && x2 > p.x1 && yy - h / 2 < p.y2 && yy + h / 2 > p.y1) ||
      obs.some((o) => x1 < o.x + o.half && x2 > o.x - o.half && yy - h / 2 < o.y + o.half && yy + h / 2 > o.y - o.half);
    let dy = 0;
    let step = 0;
    while (step < 10 && hits(it.y + dy)) {
      step++;
      dy = (step % 2 === 1 ? 1 : -1) * Math.ceil(step / 2) * h;
    }
    placed.push({ x1, x2, y1: it.y + dy - h / 2, y2: it.y + dy + h / 2 });
    out[it.slug] = dy;
  }
  return out;
}

export type CapNode = { id: string; label: string; angle: number; x: number; y: number };

/** Place the named checks evenly on a ring in stable id order, starting
 *  at twelve o'clock. Order is the check id, never the arrival order, so
 *  a capability keeps its seat while it exists. */
export function capabilityRing(
  checks: Array<{ id: string; label: string }>,
  cx: number,
  cy: number,
  r: number,
  ky = 1,
): CapNode[] {
  const sorted = [...checks].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const n = sorted.length;
  if (n === 0) return [];
  return sorted.map((c, i) => {
    const angle = -90 + (360 / n) * i;
    const a = (angle * Math.PI) / 180;
    return { id: c.id, label: c.label, angle, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * ky };
  });
}
