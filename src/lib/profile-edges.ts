/**
 * Derived edges for a supplier profile (final architecture §4.2: every
 * canonical page type has defined outbound edges, all generated from the
 * datasets, none authored twice).
 *
 * Everything here is deterministic and computed at static generation:
 * head-to-heads from the curated pairs, best-for appearances by running
 * the same shortlist engine that renders those pages, close peers from
 * the vendor group taxonomy, research from the mentions dataset.
 */
import { BEST_PAGES } from "@/lib/best-pages";
import { getPairsFor } from "@/lib/compare-pages";
import { getMentionsFor, type ResearchMention } from "@/lib/mentions";
import { buildShortlist } from "@/lib/shortlist-core";
import {
  FEATURE_NAMES,
  getAllVendors,
  getShortlistDataset,
  getVendorGroup,
} from "@/lib/vendors";

export type BestAppearance = { slug: string; title: string; rank: number };
export type PeerLink = { slug: string; name: string };
export type PairLink = { slug: string; otherSlug: string; otherName: string };

/** Best-for pages whose ranked shortlist actually features the supplier,
 *  with its rank on each. Runs the pages' own engine, so the edge can
 *  never claim an appearance the page does not render. */
export function getBestAppearances(vendorSlug: string): BestAppearance[] {
  const dataset = getShortlistDataset();
  const out: BestAppearance[] = [];
  for (const page of BEST_PAGES) {
    const result = buildShortlist(dataset, page.input, FEATURE_NAMES);
    const hit = result.shortlist.find((v) => v.slug === vendorSlug);
    if (hit) out.push({ slug: page.slug, title: page.title, rank: hit.rank });
  }
  return out.sort((a, b) => a.rank - b.rank);
}

/** Head-to-heads involving the supplier, labelled by the other side. */
export function getHeadToHeads(vendorSlug: string): PairLink[] {
  const names = new Map(getAllVendors().map((v) => [v.slug, v.name]));
  return getPairsFor(vendorSlug).map((p) => {
    const other = p.a === vendorSlug ? p.b : p.a;
    return { slug: p.slug, otherSlug: other, otherName: names.get(other) ?? other };
  });
}

/** Close peers: same vendor group, curated taxonomy, capped and stable. */
export function getClosePeers(vendorSlug: string, limit = 5): PeerLink[] {
  const all = getAllVendors();
  const self = all.find((v) => v.slug === vendorSlug);
  if (!self) return [];
  const group = getVendorGroup(self);
  return all
    .filter((v) => v.slug !== vendorSlug && getVendorGroup(v) === group)
    .slice(0, limit)
    .map((v) => ({ slug: v.slug, name: v.name }));
}

export function getResearchFor(vendorSlug: string): ResearchMention[] {
  return getMentionsFor(vendorSlug);
}
