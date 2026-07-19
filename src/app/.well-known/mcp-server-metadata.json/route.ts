import { SITE_URL } from "@/lib/structured-data";

/**
 * MCP server discovery metadata (18 July 2026, assistant connector work).
 * A stable, machine-readable description of the Netify MCP server for
 * assistant platforms, directories and agent crawlers.
 */
export async function GET() {
  return Response.json(
    {
      name: "netify-sase-marketplace",
      title: "Netify SASE & SD-WAN Marketplace",
      description:
        "Compare 30 evidence-graded SASE and SD-WAN vendors, build ranked shortlists, estimate cost and TCO bands, create and publish RFPs to matched verified suppliers, and respond to RFPs as a supplier. Research, drafting and estimating need no authentication; actions that reach named suppliers are token-gated.",
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
