import { getAllVendorSlugs } from "@/lib/vendors";
import { BEST_PAGES } from "@/lib/best-pages";
import { COMPARE_PAIRS } from "@/lib/compare-pages";
import { SAMPLE_NOTICES } from "@/lib/sample-notices";
import { listPublicOpportunities, kvConfigured } from "@/lib/rfp-store";
import { SITE_URL } from "@/lib/structured-data";

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  // Live public notices are crawlable pages; include them best-effort so the
  // sitemap never fails if KV is unavailable.
  let liveNotices: { loc: string; priority: string }[] = [];
  try {
    if (kvConfigured()) {
      liveNotices = (await listPublicOpportunities()).map((o) => ({
        loc: `${SITE_URL}/opportunities/${o.id}`,
        priority: "0.8",
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
    { loc: `${SITE_URL}/rfp-builder`, priority: "0.9" },
    { loc: `${SITE_URL}/rfp-builder/start`, priority: "0.8" },
    { loc: `${SITE_URL}/rfp-builder/sase`, priority: "0.9" },
    { loc: `${SITE_URL}/rfp-builder/sd-wan`, priority: "0.9" },
    { loc: `${SITE_URL}/rfp-builder/sse`, priority: "0.9" },
    { loc: `${SITE_URL}/opportunities`, priority: "0.9" },
    { loc: `${SITE_URL}/opportunities/new`, priority: "0.9" },
    { loc: `${SITE_URL}/opportunities/board`, priority: "0.9" },
    ...SAMPLE_NOTICES.map((s) => ({
      loc: `${SITE_URL}/opportunities/${s.slug}`,
      priority: "0.7",
    })),
    ...liveNotices,
    { loc: `${SITE_URL}/vendors`, priority: "0.9" },
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
