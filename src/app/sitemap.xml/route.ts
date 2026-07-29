import { getAllVendorSlugs } from "@/lib/vendors";
import { BEST_PAGES } from "@/lib/best-pages";
import { COMPARE_PAIRS } from "@/lib/compare-pages";
import { SAMPLE_NOTICES } from "@/lib/sample-notices";
import { listPublicOpportunities, listArchivedPublicOpportunities, kvConfigured } from "@/lib/rfp-store";
import { SITE_URL } from "@/lib/structured-data";

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
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
  const urls: { loc: string; priority: string }[] = [
    { loc: `${SITE_URL}/`, priority: "1.0" },
    { loc: `${SITE_URL}/how-it-works`, priority: "0.9" },
    { loc: `${SITE_URL}/for-suppliers`, priority: "0.8" },
    { loc: `${SITE_URL}/shortlist`, priority: "1.0" },
    // /workspace/ and the wizard's entry surfaces 301 now (One Door,
    // 23 Jul 2026): a sitemap must never list redirecting URLs, so only
    // the serving research surfaces below remain.
    { loc: `${SITE_URL}/rfp-builder/questions`, priority: "0.9" },
    { loc: `${SITE_URL}/rfp-builder/sample-rfp`, priority: "0.9" },
    { loc: `${SITE_URL}/cost-estimator`, priority: "0.8" },
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
    { loc: `${SITE_URL}/vendors`, priority: "0.9" },
    // The /best/ INDEX was missing while all 20 children were listed
    // (25 Jul): it is the hub Bing cites most from, so it belongs here.
    { loc: `${SITE_URL}/best`, priority: "0.9" },
    ...BEST_PAGES.map((p) => ({
      loc: `${SITE_URL}/best/${p.slug}`,
      priority: "0.9",
    })),
    ...getAllVendorSlugs().map((slug) => ({
      loc: `${SITE_URL}/vendors/${slug}`,
      priority: "0.8",
    })),
    ...getAllVendorSlugs().map((slug) => ({
      loc: `${SITE_URL}/alternatives/${slug}`,
      priority: "0.7",
    })),
    ...COMPARE_PAIRS.map((p) => ({
      loc: `${SITE_URL}/compare/${p.slug}`,
      priority: "0.8",
    })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url><loc>${u.loc.endsWith("/") ? u.loc : u.loc + "/"}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`,
  )
  .join("\n")}
</urlset>`;
  return new Response(xml, { headers: { "content-type": "application/xml" } });
}
