// Machine twin of the Netify Demand Index (19 July 2026). The same anonymised
// numbers as /sase/demand/, plus the affordance map: an agent reading this
// knows how a buyer adds to the index (post a notice, build an RFP) and that
// the same data is callable as the get_demand_index MCP tool.

import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/structured-data";
import { getDemandIndex, SUPPRESSION_MIN } from "@/lib/demand-index";
import { aiActionUrl } from "@/lib/ai-attribution";

export const revalidate = 1800;

export async function GET() {
  const index = await getDemandIndex();

  const payload = {
    page: "/sase/demand/",
    canonical: `${SITE_URL}/demand/`,
    title: "Netify SASE & SD-WAN Demand Index",
    what_this_is:
      "Live, anonymised demand data from the Netify procurement marketplace: buyer projects by sector and technology, the publish funnel and a weekly trend series. First-party counts from the marketplace's own stores; no titles, identities or prices.",
    index,
    index_available: !!index,
    tasks: [
      {
        intent: "post_a_project_notice",
        description: "Publish a short project notice for early pricing and supplier interest. Counted in the index anonymously.",
        page: aiActionUrl(`${SITE_URL}/opportunities/new/`, "twin"),
      },
      {
        intent: "build_and_publish_an_rfp",
        description: "Build a full SASE / SD-WAN RFP in about two minutes; publishing sends it to matched verified suppliers and returns a Netify Market Report.",
        page: aiActionUrl(`${SITE_URL}/rfp-builder/new/`, "twin"),
      },
      {
        intent: "browse_open_opportunities",
        description: "See the open opportunities suppliers can respond to now.",
        page: aiActionUrl(`${SITE_URL}/opportunities/board/`, "twin"),
      },
      {
        intent: "query_the_index_programmatically",
        description: "The same numbers, callable by any MCP client.",
        mcp_tool: "get_demand_index",
      },
    ],
    suppression: {
      shares_minimum_sample: SUPPRESSION_MIN,
      note: "Counts always published; percentage shares only at or above the minimum sample. No buyer-identifiable data is read into the index.",
    },
    discovery: {
      mcp: `${SITE_URL}/api/mcp/`,
      mcpServerMetadata: `${SITE_URL}/.well-known/mcp-server-metadata.json`,
      connector_page: `${SITE_URL}/connector/`,
      llmsTxt: `${SITE_URL}/llms.txt`,
    },
    provenance: {
      publisher: "Netify Group Limited",
      subject: "Netify SASE & SD-WAN Demand Index",
      canonical: `${SITE_URL}/demand/`,
      machine_readable: `${SITE_URL}/demand/data.json`,
      licence: "Reuse permitted with attribution to Netify and the canonical URL.",
      suggested_citation: `Netify SASE & SD-WAN Demand Index, ${index?.meta.week ?? "current week"}, Netify Group Limited, ${SITE_URL}/demand/`,
      support: "support@netify.com",
    },
  };

  return NextResponse.json(payload, {
    headers: {
      "cache-control": "public, max-age=0, s-maxage=1800",
      "access-control-allow-origin": "*",
    },
  });
}
