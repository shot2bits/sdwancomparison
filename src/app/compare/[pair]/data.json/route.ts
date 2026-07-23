import { COMPARE_PAIRS, getComparePair } from "@/lib/compare-pages";
import { FEATURES, getShortlistDataset, getVendor } from "@/lib/vendors";
import { deriveContinuationComparison } from "@/lib/continuation/derive";
import { continuationForTwin } from "@/lib/continuation/types";
import { buildComparison } from "@/lib/shortlist-core";
import { SITE_URL } from "@/lib/structured-data";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return COMPARE_PAIRS.map((p) => ({ pair: p.slug }));
}

type Ctx = { params: Promise<{ pair: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { pair } = await ctx.params;
  const cp = getComparePair(pair);
  if (!cp) return Response.json({ error: "Unknown pair" }, { status: 404 });
  const c = buildComparison(
    getShortlistDataset(),
    [cp.a, cp.b],
    FEATURES.map((f) => ({ id: f.id, name: f.name, category: f.category })),
  );
  /* DEF wave one (One Door): the twin's action is the same Continuation
     the page renders; the old rfp-builder evaluate block retires so humans
     and agents observe identical truth. Omitted entirely on null. */
  const cont = deriveContinuationComparison(getVendor(cp.a), getVendor(cp.b));
  return Response.json(
    {
      page: `${SITE_URL}/compare/${pair}`,
      ...(cont ? { continuation: continuationForTwin(cont) } : {}),
      comparison: c,
      citation: `Cite as: Netify, "${c?.names[cp.a]} vs ${c?.names[cp.b]} (2026)", ${SITE_URL}/compare/${pair}`,
    },
    { headers: { "X-Robots-Tag": "noindex" } },
  );
}
