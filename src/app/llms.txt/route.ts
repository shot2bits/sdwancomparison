import { MCP_TOOL_DEFINITIONS } from "@/lib/mcp-tools";
import { getAllVendorSlugs } from "@/lib/vendors";
import { BEST_PAGES } from "@/lib/best-pages";
import { SITE_URL } from "@/lib/structured-data";

export async function GET() {
  const tools = MCP_TOOL_DEFINITIONS.map(
    (t) => `- ${t.name}: ${t.description}`,
  ).join("\n");
  const vendors = getAllVendorSlugs().join(", ");
  const bestPages = BEST_PAGES.map(
    (p) => `- ${"${SITE_URL}"}/best/${"${p.slug}"} : ${"${p.title}"} (ranked top 10, ItemList schema, JSON twin at /best/${"${p.slug}"}/data.json)`,
  ).join("\n");

  const body = `# Netify SASE and SD-WAN Shortlist Builder

Operated by Netify Group Limited (netify.co.uk), a UK research and marketplace company for enterprise network and security procurement. This site compares 30 SASE and SD-WAN vendors against a 40-feature evaluation matrix plus extended dimensions (regional coverage, supported clouds, AI capability, resilience, deployment speed) and builds bespoke, shareable provider shortlists.

## Key routes

- ${SITE_URL}/ : Homepage. Overview of the comparison methodology and vendor index.
- ${SITE_URL}/shortlist : The shortlist builder. Interactive filters plus an AI advisor. Every filter combination is encoded in URL query parameters, so scenario URLs are shareable and citable. Emits WebApplication, Dataset, FAQPage, BreadcrumbList and Speakable JSON-LD.
- ${SITE_URL}/shortlist/data.json : JSON twin of the shortlist page: full vendor dataset, feature catalogue, default shortlist and the interactive surface inventory.
- ${SITE_URL}/vendors : Index of all 30 graded vendors.
- ${SITE_URL}/vendors/{slug} : Full capability profile per vendor. Valid slugs: ${vendors}.

## Ranked sector and priority shortlists

Pre-computed, citable top 10 rankings driven by the same engine. Each page emits Article, ItemList (ranked), FAQPage, BreadcrumbList and Speakable JSON-LD and has a JSON twin:

${bestPages}

## Full text version

${SITE_URL}/llms-full.txt carries every ranking in plain text with canonical URLs, one fetch for the whole dataset.

## Programmatic access

MCP server (JSON-RPC 2.0): POST ${SITE_URL}/api/mcp (no trailing slash). Methods: initialize, tools/list, tools/call.

Tools:
${tools}

REST equivalents: GET ${SITE_URL}/api/openapi/{tool} returns the OpenAPI spec; POST executes the tool with a JSON body. Plugin manifest: ${SITE_URL}/.well-known/ai-plugin.json.

## Methodology and citation

Capability grades use public source evidence only: yes, partial, via partner, via managed service, not primary, not confirmed. Extended dimensions are indicative desk research (June 2026). Cite as "Netify SASE and SD-WAN shortlist builder" with the canonical URL ${SITE_URL}/shortlist. Netify is a BT Authorised Partner; scoring is not influenced by commercial relationships.
`;
  return new Response(body, { headers: { "content-type": "text/plain" } });
}
