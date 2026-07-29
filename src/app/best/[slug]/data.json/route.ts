import { BEST_PAGES, getBestPage } from "@/lib/best-pages";
import { FEATURE_NAMES, getShortlistDataset, getAllVendors } from "@/lib/vendors";
import { buildShortlist, encodeScenario, SECTOR_LABELS } from "@/lib/shortlist-core";
import { deriveContinuationSector } from "@/lib/continuation/derive";
import { continuationForTwin } from "@/lib/continuation/types";
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
  /* DEF wave one: the twin carries the same continuation the page renders,
     or omits the key entirely when derivation returns null. One truth. */
  const cont = deriveContinuationSector({
    sectorKey: page.input.sector as string | undefined,
    sectorLabel: page.input.sector ? SECTOR_LABELS[page.input.sector] : undefined,
    pageTitle: page.title,
    pins: result.shortlist.slice(0, 5).map((v) => v.slug),
  });
  return Response.json(
    {
      page: `${SITE_URL}/best/${page.slug}`,
      title: page.title,
      description: page.metaDescription,
      publisher: "Netify Group Limited",
      // Derived from the vendor records, never typed (29 Jul 2026).
      last_reviewed:
        getAllVendors()
          .map((v) => v.last_verified)
          .sort()
          .slice(-1)[0] ?? "2026-06-10",
      criteria: page.input,
      interactive_equivalent: `${SITE_URL}/shortlist?${encodeScenario(result.input)}`,
      result,
      faqs: page.faqs,
      citation: `Cite as: Netify ranked shortlist, ${page.title}, ${SITE_URL}/best/${page.slug}`,
      ...(cont ? { continuation: continuationForTwin(cont) } : {}),
    },
    { headers: { "X-Robots-Tag": "noindex" } },
  );
}
