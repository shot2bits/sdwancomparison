import { getAllVendorSlugs, getShortlistDataset } from "@/lib/vendors";
import { BEST_PAGES } from "@/lib/best-pages";
import { COMPARE_PAIRS } from "@/lib/compare-pages";
import { SAMPLE_NOTICES } from "@/lib/sample-notices";
import { listPublicOpportunities, listArchivedPublicOpportunities, kvConfigured } from "@/lib/rfp-store";
import { SITE_URL } from "@/lib/structured-data";
import { MARKETPLACE_EXAMPLES } from "@/lib/marketplace-examples";
import { CASE_PAGE_SECTORS, RESEARCH, SECTORS, researchSlugs, providerResearch, sectorResearch } from "@/lib/workbook-research";

// Actual public sourcing content release, not the sitemap fetch time.
const SOURCING_RELEASE_LASTMOD = "2026-09-30";
function sourcingLastmod(loc: string): string {
  return loc === "https://netify.co.uk/sase-sd-wan-rfp-builder/"
    || loc === `${SITE_URL}/shortlist/`
    || loc === `${SITE_URL}/best`
    || loc.startsWith(`${SITE_URL}/best/`)
    || loc.startsWith(`${SITE_URL}/alternatives/`)
    ? `<lastmod>${SOURCING_RELEASE_LASTMOD}</lastmod>` : "";
}

// Only list research pages that actually serve. /alternatives/[slug] renders from the published shortlist dataset, so a vendor
// file outside it (fatpipe-networks, hughes) 404s.
// /alternatives/peplink/ is a dedicated static page and still serves.
const STATIC_ALTERNATIVES = new Set(["peplink"]);
function servingAlternativeSlugs(): string[] {
  const published = new Set(getShortlistDataset().map((v) => v.slug));
  return getAllVendorSlugs().filter((slug) => published.has(slug) || STATIC_ALTERNATIVES.has(slug));
}

export async function GET() {
  // Public notices are crawlable pages; include them best-effort so the
  // sitemap never fails if KV is unavailable. Closed notices are published
  // forever (Robert's ruling, 28 Jul 2026): a notice that entered the public
  // record never leaves this sitemap — it would previously drop out on close,
  // which contradicted the permanent-record promise. Archived notices carry a
  // lower priority than open ones; the pages themselves stay indexable.
  let liveNotices: { loc: string; priority: string }[] = [];
  let archivedNotices: { loc: string; priority: string }[] = [];
  try {
    if (kvConfigured()) {
      const [open, archived] = await Promise.all([
        listPublicOpportunities(),
        listArchivedPublicOpportunities(10000),
      ]);
      liveNotices = open.map((o) => ({
        loc: `${SITE_URL}/opportunities/${o.id}`,
        priority: "0.8",
      }));
      archivedNotices = archived.map((o) => ({
        loc: `${SITE_URL}/opportunities/${o.id}`,
        priority: "0.5",
      }));
    }
  } catch {
    /* sitemap stays valid without live notices */
  }
  // Workbook desk research pages carry the date of their own evidence.
  const research: { loc: string; priority: string; lastmod?: string | null }[] = [
    { loc: `${SITE_URL}/research/`, priority: "0.9", lastmod: RESEARCH.updated_date },
    { loc: `${SITE_URL}/research/list-prices/`, priority: "0.9", lastmod: RESEARCH.evidence_window.pricing_observed_to },
    ...SECTORS.map((s) => ({ loc: `${SITE_URL}/research/sectors/${s.slug}/`, priority: "0.8", lastmod: sectorResearch(s.slug).updated })),
    ...CASE_PAGE_SECTORS.map((s) => ({ loc: `${SITE_URL}/research/cases/${s}/`, priority: "0.9", lastmod: sectorResearch(s).updated })),
    ...researchSlugs().map((slug) => ({ loc: `${SITE_URL}/research/providers/${slug}/`, priority: "0.7", lastmod: providerResearch(slug).updated })),
  ];
  const urls: { loc: string; priority: string; lastmod?: string | null }[] = [
    { loc: "https://netify.co.uk/sase-sd-wan-rfp-builder/", priority: "1.0" },
    { loc: `${SITE_URL}/`, priority: "1.0" },
    { loc: `${SITE_URL}/how-it-works`, priority: "0.9" },
    { loc: `${SITE_URL}/for-suppliers`, priority: "0.8" },
    { loc: `${SITE_URL}/shortlist/`, priority: "1.0" },
    { loc: `${SITE_URL}/shortlist/cite.bib`, priority: "0.5" },
    { loc: `${SITE_URL}/shortlist/research-methodology/`, priority: "0.7" },
    { loc: `${SITE_URL}/shortlist/sd-wan-vendors/`, priority: "0.9" },
    { loc: `${SITE_URL}/shortlist/sase-vendors/`, priority: "0.9" },
    { loc: `${SITE_URL}/shortlist/managed-sd-wan/`, priority: "0.9" },
    // /workspace/ and the wizard's entry surfaces 301 now (One Door,
    // 23 Jul 2026): a sitemap must never list redirecting URLs, so only
    // the serving research surfaces below remain.
    { loc: `${SITE_URL}/rfp-builder/questions`, priority: "0.9" },
    { loc: `${SITE_URL}/rfp-builder/sample-rfp`, priority: "0.9" },
    { loc: `${SITE_URL}/examples/sase-rfp/`, priority: "0.9" },
    { loc: `${SITE_URL}/pricing/`, priority: "0.9" },
    { loc: `${SITE_URL}/cost-estimator`, priority: "0.8" },
    { loc: `${SITE_URL}/circuit-pricing/`, priority: "0.9" },
    { loc: `${SITE_URL}/connector`, priority: "0.8" },
    { loc: `${SITE_URL}/demand`, priority: "0.8" },
    { loc: `${SITE_URL}/opportunities`, priority: "0.9" },
    { loc: `${SITE_URL}/opportunities/new`, priority: "0.9" },
    { loc: `${SITE_URL}/opportunities/board`, priority: "0.9" },
    // The citable vetting standard behind the four promises (approved
    // 29 Jul 2026): the promise copy links here, so the page is public
    // record, not an internal note.
    { loc: `${SITE_URL}/supplier-vetting-standard`, priority: "0.7" },
    ...SAMPLE_NOTICES.map((s) => ({
      loc: `${SITE_URL}/opportunities/${s.slug}`,
      priority: "0.7",
    })),
    ...liveNotices,
    ...archivedNotices,
    { loc: "https://netify.co.uk/marketplace/", priority: "0.9" },
    ...Object.keys(MARKETPLACE_EXAMPLES).map((slug) => ({ loc: `${SITE_URL}/examples/${slug}`, priority: "0.8" })),
    // The /best/ INDEX was missing while all 20 children were listed
    // (25 Jul): it is the hub Bing cites most from, so it belongs here.
    { loc: `${SITE_URL}/best`, priority: "0.9" },
    ...BEST_PAGES.map((p) => ({
      loc: `${SITE_URL}/best/${p.slug}`,
      priority: "0.9",
    })),
    ...servingAlternativeSlugs().map((slug) => ({
      loc: `${SITE_URL}/alternatives/${slug}`,
      priority: "0.7",
    })),
    // The /compare/ INDEX was missing while all 25 children were listed,
    // the same gap /best/'s index had until 2 Jul 2026 (see the comment
    // above) -- found again by Harry Yelland's 10 Aug 2026 platform test.
    { loc: `${SITE_URL}/compare`, priority: "0.8" },
    ...COMPARE_PAIRS.map((p) => ({
      loc: `${SITE_URL}/compare/${p.slug}`,
      priority: "0.8",
    })),
    ...research,
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url><loc>${u.loc.endsWith("/") || /\.[a-z]+$/i.test(u.loc) ? u.loc : u.loc + "/"}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : sourcingLastmod(u.loc)}<priority>${u.priority}</priority></url>`,
  )
  .join("\n")}
</urlset>`;
  return new Response(xml, { headers: { "content-type": "application/xml" } });
}
