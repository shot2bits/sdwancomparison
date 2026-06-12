import { MCP_TOOL_DEFINITIONS, callMcpTool } from "@/lib/mcp-tools";
import { SITE_URL } from "@/lib/structured-data";
import { corsHeaders, preflight } from "@/lib/cors";

/**
 * REST equivalent of the MCP tools.
 * GET returns the OpenAPI spec for the tool; POST executes it.
 */

type Ctx = { params: Promise<{ tool: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { tool } = await ctx.params;
  const def = MCP_TOOL_DEFINITIONS.find((t) => t.name === tool);
  if (!def) {
    return Response.json({ error: `Unknown tool: ${tool}` }, { status: 404 });
  }
  return Response.json({
    openapi: "3.1.0",
    info: {
      title: `Netify tool: ${def.name}`,
      description: def.description,
      version: "1.0.0",
    },
    servers: [{ url: SITE_URL }],
    paths: {
      [`/api/openapi/${def.name}`]: {
        post: {
          operationId: def.name,
          description: def.description,
          requestBody: {
            required: true,
            content: { "application/json": { schema: def.inputSchema } },
          },
          responses: {
            "200": {
              description: "Tool result as JSON.",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
    },
  });
}

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request, ctx: Ctx) {
  const { tool } = await ctx.params;
  const def = MCP_TOOL_DEFINITIONS.find((t) => t.name === tool);
  if (!def) {
    return Response.json({ error: `Unknown tool: ${tool}` }, { status: 404, headers: corsHeaders(req) });
  }
  let args: unknown = {};
  try {
    args = await req.json();
  } catch {
    // empty body is acceptable for zero-argument tools
  }
  return Response.json(callMcpTool(tool, args), { headers: corsHeaders(req) });
}
