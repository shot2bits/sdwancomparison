import { renderUrlset, researchSitemapUrls } from "@/lib/research-sitemap";

// Sitemap for the desk-research pages, compare pages and pricing. Served at
// https://netify.co.uk/sase/research/sitemap.xml; the main site's own
// /sase/sitemap.xml is a separate file this app does not control.
export const dynamic = "force-static";

export function GET() {
  return new Response(renderUrlset(researchSitemapUrls()), {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=3600, must-revalidate" },
  });
}
