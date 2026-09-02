import { MCP_TOOL_DEFINITIONS } from "@/lib/mcp-tools";
import { MCP_RFP_TOOL_DEFINITIONS } from "@/lib/mcp-rfp-tools";
import { MCP_COST_TOOL_DEFINITIONS } from "@/lib/mcp-cost-tools";
import { SECURITY_TOOL_DEFINITIONS_ALL } from "@/lib/mcp-security-tools";
import { WORKSPACE_TOOL_DEFINITIONS } from "@/lib/mcp-workspace-tools";
import { SITE_URL } from "@/lib/structured-data";

const allTools = [
  ...MCP_TOOL_DEFINITIONS,
  ...MCP_RFP_TOOL_DEFINITIONS,
  ...MCP_COST_TOOL_DEFINITIONS,
  ...SECURITY_TOOL_DEFINITIONS_ALL,
  ...WORKSPACE_TOOL_DEFINITIONS,
];

export async function GET() {
  return Response.json({
    openapi: "3.1.0",
    info: {
      title: "Netify SASE and SD-WAN agent tools",
      description: "The public MCP contract and REST mirrors for Netify SASE and SD-WAN research, comparison and procurement.",
      version: "2.0.0",
    },
    servers: [{ url: SITE_URL }],
    paths: {
      "/api/mcp/": {
        post: {
          operationId: "mcpJsonRpc",
          description: "JSON-RPC 2.0 MCP endpoint. Use initialize, tools/list and tools/call. The trailing slash is required.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object" } } },
          },
          responses: { "200": { description: "MCP JSON-RPC response." } },
        },
      },
      ...Object.fromEntries(MCP_TOOL_DEFINITIONS.map((tool) => [
        `/api/openapi/${tool.name}/`,
        {
          post: {
            operationId: tool.name,
            description: tool.description,
            requestBody: {
              required: true,
              content: { "application/json": { schema: tool.inputSchema } },
            },
            responses: { "200": { description: "Tool result as JSON." } },
          },
        },
      ])),
    },
    "x-mcp": {
      endpoint: `${SITE_URL}/api/mcp/`,
      protocol: "JSON-RPC 2.0 over Streamable HTTP",
      tools: allTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    },
  }, {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
  });
}
