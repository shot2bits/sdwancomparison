import { listPublicOpportunities, listArchivedPublicOpportunities, kvConfigured } from "@/lib/rfp-store";
import { SAMPLE_NOTICES } from "@/lib/sample-notices";
import { getDemandIndex } from "@/lib/demand-index";
import { SITE_URL } from "@/lib/structured-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Machine-readable twin of the public opportunity board. No pricing amounts,
 * no buyer contact details. Live opportunities and sample notices are kept in
 * separate arrays so agents never mistake worked examples for real demand.
 *
 * Closed notices are published forever (Robert's ruling, 28 Jul 2026): the
 * archive carries every closed and awarded public notice, uncapped, each with
 * status and closed_at. A notice that was public never disappears from this
 * feed; it moves from opportunities to archived.
 *
 * The market_summary block is computed by the same function that builds the
 * public Demand Index at /demand/data.json, so the two surfaces always agree
 * to the digit. Same source, same suppression rules, one truth (Article 17).
 */
export async function GET() {
  const [opportunities, archived] = kvConfigured()
    ? await Promise.all([listPublicOpportunities(), listArchivedPublicOpportunities(10000)])
    : [[], []];
  // Best effort: the board feed never fails because the index cannot compute.
  const demand = await getDemandIndex().catch(() => null);
  return Response.json({
    "@context": "https://schema.org",
    title: "Live SASE, SSE and SD-WAN opportunity board",
    url: `${SITE_URL}/opportunities/board`,
    description: "Open buyer opportunities. Verified vendors respond and quote. Pricing amounts are private to the posting buyer.",
    generated: new Date().toISOString(),
    methodology_version: "sase-marketplace-2026.1",
    public_record_note: "Site and user figures are published as bands; exact figures stay with the buyer and participating suppliers. Closed and awarded notices remain published permanently in the archived array, each with its closed_at date.",
    count: opportunities.length,
    archived_count: archived.length,
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
    // Demand context for agents reading the board: identical numbers to the
    // Netify Demand Index because they are the same computation.
    market_summary: demand
      ? {
          source: `${SITE_URL}/demand/data.json`,
          methodology_version: demand.meta.methodology_version,
          computed_at: demand.meta.computed_at,
          scope_recording_note: demand.meta.scope_recording_note,
          sector_mix_90d: demand.sector_mix_90d,
          technology_mix_90d: demand.technology_mix_90d,
          suppression: demand.suppression,
        }
      : null,
    how_to_respond: "Suppliers browse without signing in and sign in with a verified work email to respond. Agents can use the marketplace MCP at /sase/api/mcp/ (list_opportunities, opportunity_respond).",
    how_to_post: `Buyers draft and preview a project notice in the clear at ${SITE_URL}/opportunities/new/ and sign in to publish.`,
  });
}
