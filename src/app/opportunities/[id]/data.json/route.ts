import { getOpportunity, kvConfigured } from "@/lib/rfp-store";
import { toPublicOpportunity } from "@/lib/opportunity-types";
import { getSampleNotice } from "@/lib/sample-notices";
import { SITE_URL } from "@/lib/structured-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Machine-readable twin of a public project notice. Public projection only:
 * no pricing amounts, no buyer tokens, no contact details. Sample notices are
 * served with is_sample: true so agents never mistake them for live demand.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const sample = getSampleNotice(id);
  if (sample) {
    return Response.json({
      "@context": "https://schema.org",
      is_sample: true,
      note: "Sample project notice: a worked example, not a live opportunity.",
      url: `${SITE_URL}/opportunities/${id}`,
      canonical: `${SITE_URL}/opportunities/${id}/`,
      generated: new Date().toISOString(),
      opportunity: sample,
    });
  }

  if (!kvConfigured()) return Response.json({ error: "Not found." }, { status: 404 });
  const opp = await getOpportunity(id);
  if (!opp) return Response.json({ error: "Not found." }, { status: 404 });
  if (opp.visibility !== "public") return Response.json({ error: "Not found." }, { status: 404 });

  return Response.json({
    "@context": "https://schema.org",
    is_sample: false,
    url: `${SITE_URL}/opportunities/${id}`,
    canonical: `${SITE_URL}/opportunities/${id}/`,
    generated: new Date().toISOString(),
    opportunity: toPublicOpportunity(opp),
    note: "Public projection. Supplier pricing amounts and buyer contact details are private. Respond via supplier sign-in or the marketplace MCP at /api/mcp.",
  });
}
