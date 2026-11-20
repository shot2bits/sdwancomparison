import {coreDiscoveryEnabled} from '@/lib/core-host';
import {BUYER_TOOLS,BUYER_RESOURCES,BUYER_CORE_VERSION} from '@/lib/core-buyer-tools';
import {MARKET_TOOL_VIEWS} from '@/lib/marketplace-tools';
import { SITE_URL } from "@/lib/structured-data";

/**
 * MCP server discovery metadata (18 July 2026, assistant connector work).
 * A stable, machine-readable description of the Netify MCP server for
 * assistant platforms, directories and agent crawlers.
 */
export async function GET() {
  if(coreDiscoveryEnabled())return Response.json({name:"netify-sase-marketplace",publisher:"Netify Group Limited",version:BUYER_CORE_VERSION,endpoint:`${SITE_URL}/api/mcp/`,transport:"streamable-http",protocolVersions:["2025-11-25","2025-06-18","2025-03-26","2024-11-05"],authentication:{public_reads:"No authentication. Marketplace research tools are open.",private_projects:"Project-scoped view or edit capability. Owner sessions are web only."},tools:[...BUYER_TOOLS,...MARKET_TOOL_VIEWS],connect_page:`${SITE_URL}/connect/`,openapi:`${SITE_URL}/openapi.json`,resources:BUYER_RESOURCES,web_project:`${new URL(SITE_URL).origin}/marketplace/`,agent_dispatch:false,approval:"Verified owner approves the exact version in the web view for Netify desk review only. No automated supplier contact or publication.",provisional_modelling_endpoint:`${SITE_URL}/api/research-mcp/`},{headers:{"cache-control":"no-store","Access-Control-Allow-Origin":"*"}});
  return Response.json(
    {
      name: "netify-sase-marketplace",
      title: "Netify SASE & SD-WAN Marketplace",
      description:
        "Compare 30 evidence-graded SASE and SD-WAN vendors, build ranked shortlists, estimate cost and TCO bands, create and publish RFPs to matched verified vendors and service providers, and respond to RFPs as a vendor. Research, drafting and estimating need no authentication; actions that reach named vendors are token-gated.",
      endpoint: `${SITE_URL}/api/mcp/`,
      transport: "streamable-http",
      protocolVersions: ["2025-06-18", "2025-03-26", "2024-11-05"],
      authentication: { type: "none", notes: "Write actions are token-gated per tool; publishing requires buyer sign-in on the website." },
      documentation: `${SITE_URL}/connector`,
      llms_txt: `${SITE_URL.replace(/\/sase$/, "")}/sase/llms.txt`,
      capabilities_catalogue: `${SITE_URL}/capabilities.json`,
      publisher: {
        name: "Netify Group Limited",
        url: "https://netify.co.uk/",
        support: "support@netify.com",
        privacy_policy: "https://netify.co.uk/privacy-policy/",
        terms: "https://netify.co.uk/terms-conditions/",
      },
    },
    { headers: { "Access-Control-Allow-Origin": "*", "cache-control": "public, max-age=3600" } },
  );
}
