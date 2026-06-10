import { BEST_PAGES, getBestPage } from "@/lib/best-pages";
import { FEATURE_NAMES, getShortlistDataset } from "@/lib/vendors";
import { buildShortlist, encodeScenario } from "@/lib/shortlist-core";
import { SITE_URL } from "@/lib/structured-data";

export const dynamic = "force-static";

export function generateStaticParams() {
  return BEST_PAGES.map((p) => ({ slug: p.slug }));
}

type Ctx = { params: Promise<{ slug: string }> };

/** JSON twin of each /best/[slug] listicle page. */
export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const page = getBestPage(slug);
  if (!page) return Response.json({ error: "Unknown page" }, { status: 404 });

  const result = buildShortlist(getShortlistDataset(), page.input, FEATURE_NAMES);
  return Response.json(
    {
      page: `${SITE_URL}/best/${page.slug}`,
      title: page.title,
      description: page.metaDescription,
      publisher: "Netify Group Limited",
      last_reviewed: "2026-06-10",
      criteria: page.input,
      interactive_equivalent: `${SITE_URL}/shortlist?${encodeScenario(result.input)}`,
      result,
      faqs: page.faqs,
      citation: `Cite as: Netify ranked shortlist, ${page.title}, ${SITE_URL}/best/${page.slug}`,
    },
    { headers: { "X-Robots-Tag": "noindex" } },
  );
}
