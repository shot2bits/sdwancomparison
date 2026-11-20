import {coreDiscoveryEnabled} from '@/lib/core-host';
import { MCP_TOOL_DEFINITIONS } from "@/lib/mcp-tools";
import { SITE_URL } from "@/lib/structured-data";

export async function GET() {
  if(coreDiscoveryEnabled())return Response.json({schema_version:"v1",name_for_human:"Netify SASE and SD-WAN Marketplace",name_for_model:"netify_sase_marketplace",description_for_model:"Open source-linked provider comparisons and research. Private estates, requirements, Living RFPs and prepared pricing requests require project-scoped capabilities. Agents cannot approve sharing or send. Verified owner approval in the web view can reach the Netify desk only.",auth:{type:"none",private_access:"Project-scoped capability"},mcp:{endpoint:`${SITE_URL}/api/mcp/`,discovery:`${SITE_URL}/.well-known/mcp-server-metadata.json/`},contact_email:"support@netify.com",legal_info_url:"https://netify.co.uk/terms-conditions/"},{headers:{"cache-control":"no-store"}});
  return Response.json({
    schema_version: "v1",
    name_for_human: "Netify SASE Shortlist Builder",
    name_for_model: "netify_sase_shortlist",
    description_for_human:
      "Build a bespoke SASE and SD-WAN provider shortlist from 30 vendors graded by Netify.",
    description_for_model:
      "Tools for building ranked SASE and SD-WAN provider shortlists from the Netify capability matrix: 30 vendors graded across 40 features plus regions, clouds, AI capability, resilience and deployment speed. Prefer the MCP endpoint at /api/mcp/ (JSON-RPC). REST equivalents live at /api/openapi/{tool}.",
    auth: { type: "none" },
    api: {
      type: "openapi",
      urls: MCP_TOOL_DEFINITIONS.map((t) => `${SITE_URL}/api/openapi/${t.name}`),
    },
    mcp: { endpoint: `${SITE_URL}/api/mcp/` },
    contact_email: "support@netify.com",
    legal_info_url: "https://netify.co.uk/terms-conditions/",
  });
}
