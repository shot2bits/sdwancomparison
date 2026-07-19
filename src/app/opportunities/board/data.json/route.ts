import { listPublicOpportunities, listArchivedPublicOpportunities, kvConfigured } from "@/lib/rfp-store";
import { SAMPLE_NOTICES } from "@/lib/sample-notices";
import { SITE_URL } from "@/lib/structured-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Machine-readable twin of the public opportunity board. No pricing amounts,
 * no buyer contact details. Live opportunities and sample notices are kept in
 * separate arrays so agents never mistake worked examples for real demand.
 */
export async function GET() {
  const [opportunities, archived] = kvConfigured()
    ? await Promise.all([listPublicOpportunities(), listArchivedPublicOpportunities(12)])
    : [[], []];
  return Response.json({
    "@context": "https://schema.org",
    title: "Live SASE, SSE and SD-WAN opportunity board",
    url: `${SITE_URL}/opportunities/board`,
    description: "Open buyer opportunities. Verified vendors respond and quote. Pricing amounts are private to the posting buyer.",
    generated: new Date().toISOString(),
    methodology_version: "sase-marketplace-2026.1",
    count: opportunities.length,
    opportunities: opportunities.map((o) => ({
      ...o,
      notice_url: `${SITE_URL}/opportunities/${o.id}/`,
      data_url: `${SITE_URL}/opportunities/${o.id}/data.json`,
    })),
    archived: archived.map((o) => ({
      ...o,
      notice_url: `${SITE_URL}/opportunities/${o.id}/`,
      data_url: `${SITE_URL}/opportunities/${o.id}/data.json`,
    })),
    samples: SAMPLE_NOTICES.map((s) => ({
      is_sample: true,
      note: "Sample project notice: a worked example, not a live opportunity.",
      title: s.title,
      notice_url: `${SITE_URL}/opportunities/${s.slug}/`,
      data_url: `${SITE_URL}/opportunities/${s.slug}/data.json`,
    })),
    how_to_respond: "Suppliers browse without signing in and sign in with a verified work email to respond. Agents can use the marketplace MCP at /sase/api/mcp/ (list_opportunities, opportunity_respond).",
    how_to_post: `Buyers draft and preview a project notice in the clear at ${SITE_URL}/opportunities/new/ and sign in to publish.`,
  });
}
