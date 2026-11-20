import { COMPARE_PAIRS } from "@/lib/compare-pages";
import { SITE_URL } from "@/lib/structured-data";
import { CASE_PAGE_SECTORS, RESEARCH, SECTORS, researchSlugs, providerResearch, sectorResearch } from "@/lib/workbook-research";

export type SitemapEntry = { loc: string; priority: string; lastmod?: string | null };

/** Workbook desk research pages; each carries the date of its own evidence. */
export function researchSitemapEntries(): SitemapEntry[] {
  return [
    { loc: `${SITE_URL}/research/`, priority: "0.9", lastmod: RESEARCH.updated_date },
    { loc: `${SITE_URL}/research/list-prices/`, priority: "0.9", lastmod: RESEARCH.evidence_window.pricing_observed_to },
    ...SECTORS.map((s) => ({ loc: `${SITE_URL}/research/sectors/${s.slug}/`, priority: "0.8", lastmod: sectorResearch(s.slug).updated })),
    ...CASE_PAGE_SECTORS.map((s) => ({ loc: `${SITE_URL}/research/cases/${s}/`, priority: "0.9", lastmod: sectorResearch(s).updated })),
    ...researchSlugs().map((slug) => ({ loc: `${SITE_URL}/research/providers/${slug}/`, priority: "0.7", lastmod: providerResearch(slug).updated })),
  ];
}

/** Compare hub and every compare page. */
export function compareSitemapEntries(): SitemapEntry[] {
  return [
    { loc: `${SITE_URL}/compare/`, priority: "0.8" },
    ...COMPARE_PAIRS.map((p) => ({ loc: `${SITE_URL}/compare/${p.slug}/`, priority: "0.8" })),
  ];
}

/** Everything the research + compare sitemap lists, plus the pricing page the research pages cite. */
export function researchSitemapUrls(): SitemapEntry[] {
  return [...researchSitemapEntries(), ...compareSitemapEntries(), { loc: `${SITE_URL}/pricing/`, priority: "0.9" }];
}

export function renderUrlset(urls: SitemapEntry[]): string {
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<priority>${u.priority}</priority></url>`).join("\n")}
</urlset>
`;
}
