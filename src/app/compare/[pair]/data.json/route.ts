import { COMPARE_PAIRS, getComparePair } from "@/lib/compare-pages";
import { FEATURES, getShortlistDataset } from "@/lib/vendors";
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
  return Response.json(
    {
      page: `${SITE_URL}/compare/${pair}`,
      evaluate: {
        description: "Create a structured RFP that pre-loads these vendors for an evidence-graded, side-by-side evaluation. Free; matched suppliers respond with pricing private to the buyer.",
        url: `${SITE_URL}/rfp-builder/new/?vendors=${cp.a},${cp.b}&utm_source=ai_assistant&utm_medium=twin`,
        mcp_tools: ["score_vendor_fit", "build_sase_shortlist"],
      },
      comparison: c,
      citation: `Cite as: Netify, "${c?.names[cp.a]} vs ${c?.names[cp.b]} (2026)", ${SITE_URL}/compare/${pair}`,
    },
    { headers: { "X-Robots-Tag": "noindex" } },
  );
}
