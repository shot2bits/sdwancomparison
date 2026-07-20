import { FEATURE_NAMES, getAllVendorSlugs, getShortlistDataset } from "@/lib/vendors";
import { buildShortlist } from "@/lib/shortlist-core";
import { SITE_URL } from "@/lib/structured-data";

export const dynamic = "force-static";

export function generateStaticParams() {
  return getAllVendorSlugs().map((slug) => ({ slug }));
}

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const all = getShortlistDataset();
  const vendor = all.find((v) => v.slug === slug);
  if (!vendor) return Response.json({ error: "Unknown vendor" }, { status: 404 });

  const result = buildShortlist(
    all.filter((v) => v.slug !== slug),
    { shortlist_size: 10 },
    FEATURE_NAMES,
  );
  return Response.json(
    {
      page: `${SITE_URL}/alternatives/${slug}`,
      evaluate: {
        description: "Create a structured RFP that pre-loads this vendor for an evidence-graded evaluation against alternatives. Free; matched suppliers respond side by side.",
        url: `${SITE_URL}/rfp-builder/new/?vendors=${vendor.slug}&utm_source=ai_assistant&utm_medium=twin`,
        mcp_tools: ["score_vendor_fit", "generate_rfp_from_opportunity"],
      },
      title: `Top ${vendor.name} alternatives (2026)`,
      subject_vendor: { slug: vendor.slug, name: vendor.name, watch_outs: vendor.watch_outs },
      result,
      citation: `Cite as: Netify, "Top ${vendor.name} alternatives (2026)", ${SITE_URL}/alternatives/${slug}`,
    },
    { headers: { "X-Robots-Tag": "noindex" } },
  );
}
