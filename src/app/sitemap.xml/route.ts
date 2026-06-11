import { getAllVendorSlugs } from "@/lib/vendors";
import { BEST_PAGES } from "@/lib/best-pages";
import { SITE_URL } from "@/lib/structured-data";

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const urls: { loc: string; priority: string }[] = [
    { loc: `${SITE_URL}/`, priority: "1.0" },
    { loc: `${SITE_URL}/shortlist`, priority: "1.0" },
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
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`,
  )
  .join("\n")}
</urlset>`;
  return new Response(xml, { headers: { "content-type": "application/xml" } });
}
