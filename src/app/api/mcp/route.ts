import { MCP_TOOL_DEFINITIONS, callMcpTool } from "@/lib/mcp-tools";
import { MCP_RFP_TOOL_DEFINITIONS, RFP_TOOL_NAMES, callRfpTool } from "@/lib/mcp-rfp-tools";
import { MCP_COST_TOOL_DEFINITIONS, COST_TOOL_NAMES, callCostTool } from "@/lib/mcp-cost-tools";
import { TOOL_ANNOTATIONS, SERVER_INSTRUCTIONS } from "@/lib/mcp-annotations";
import { SITE_URL } from "@/lib/structured-data";

const PLAIN_TOOL_NAMES = new Set<string>(MCP_TOOL_DEFINITIONS.map((t) => t.name));

/**
 * MCP server: JSON-RPC 2.0 over Streamable HTTP (stateless).
 * Canonical endpoint: /api/mcp (no trailing slash; this app does not use
 * trailing slashes). Some MCP clients do not follow 308 redirects on POST,
 * so always document the slash-less form.
 *
 * Directory-grade upgrades (18 July 2026, assistant connector work):
 *  - Protocol version negotiation: echoes any supported client version
 *    (2024-11-05, 2025-03-26, 2025-06-18), otherwise offers the newest.
 *  - initialize returns server `instructions` so assistants know what this
 *    server is for and how the open-versus-identified access model works.
 *  - Every tool is served with a human `title` and behaviour `annotations`
 *    (readOnlyHint / destructiveHint / openWorldHint / idempotentHint) via
 *    the overlay in lib/mcp-annotations - required by the Claude connectors
 *    directory and the ChatGPT Apps SDK review.
 *  - Open CORS on this route only: assistant web clients call cross-origin.
 *    Safe because every write tool is token-gated inside the tool itself.
 *  - Stateless Streamable HTTP: POST returns application/json; GET without
 *    an SSE Accept returns discovery JSON for humans; GET asking for an SSE
 *    stream receives 405 (permitted for stateless servers).
 */

const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const MCP_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, mcp-protocol-version, mcp-session-id, authorization",
  "Access-Control-Expose-Headers": "mcp-protocol-version",
  "Access-Control-Max-Age": "86400",
};

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: { name?: string; arguments?: unknown; protocolVersion?: string; [k: string]: unknown };
};

function rpcResult(id: string | number | null | undefined, result: unknown, protocol: string) {
  return Response.json(
    { jsonrpc: "2.0", id: id ?? null, result },
    { headers: { ...MCP_CORS, "mcp-protocol-version": protocol } },
  );
}

function rpcError(id: string | number | null | undefined, code: number, message: string) {
  return Response.json(
    { jsonrpc: "2.0", id: id ?? null, error: { code, message } },
    { headers: MCP_CORS },
  );
}

/** Serve-time merge of titles and behaviour annotations onto the tool definitions. */
function annotatedTools() {
  return [...MCP_TOOL_DEFINITIONS, ...MCP_RFP_TOOL_DEFINITIONS, ...MCP_COST_TOOL_DEFINITIONS].map((t) => {
    const extra = TOOL_ANNOTATIONS[t.name as string];
    return extra ? { ...t, title: extra.title, annotations: extra.annotations } : t;
  });
}

export const runtime = "nodejs";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: MCP_CORS });
}

export async function POST(req: Request) {
  let body: JsonRpcRequest;
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  // Negotiate: honour the client's requested protocol when we support it.
  const requested = String(body.params?.protocolVersion ?? req.headers.get("mcp-protocol-version") ?? "");
  const protocol = SUPPORTED_PROTOCOLS.includes(requested) ? requested : SUPPORTED_PROTOCOLS[0];

  switch (body.method) {
    case "initialize":
      return rpcResult(body.id, {
        protocolVersion: protocol,
        capabilities: { tools: { listChanged: false } },
        serverInfo: {
          name: "netify-sase-marketplace",
          title: "Netify SASE & SD-WAN Marketplace",
          version: "2.0.0",
        },
        instructions: SERVER_INSTRUCTIONS,
      }, protocol);
    case "notifications/initialized":
      return new Response(null, { status: 202, headers: MCP_CORS });
    case "tools/list":
      return rpcResult(body.id, { tools: annotatedTools() }, protocol);
    case "tools/call": {
      const name = body.params?.name ?? "";
      const args = (body.params?.arguments ?? {}) as Record<string, unknown>;
      // Audit fix (19 July 2026): unknown tools are a protocol error, not a
      // 200 result an agent has to text-parse.
      if (!COST_TOOL_NAMES.has(name) && !RFP_TOOL_NAMES.has(name) && !PLAIN_TOOL_NAMES.has(name)) {
        return rpcError(body.id, -32602, `Unknown tool: ${name}`);
      }
      const result = COST_TOOL_NAMES.has(name)
        ? await callCostTool(name, args)
        : RFP_TOOL_NAMES.has(name)
          ? await callRfpTool(name, args)
          : callMcpTool(name, args);
      // Audit fix (19 July 2026): handlers signal failure as { error: ... }.
      // Surface that as isError so agents can branch without parsing prose.
      const failed = !!result && typeof result === "object" && (result as Record<string, unknown>).error != null;
      return rpcResult(body.id, {
        content: [{ type: "text", text: JSON.stringify(result) }],
        ...(failed ? { isError: true } : {}),
      }, protocol);
    }
    case "ping":
      return rpcResult(body.id, {}, protocol);
    default:
      return rpcError(body.id, -32601, `Method not found: ${body.method}`);
  }
}

export async function GET(req: Request) {
  // Stateless server: no server-initiated SSE stream is offered.
  if ((req.headers.get("accept") ?? "").includes("text/event-stream")) {
    return new Response("SSE streams are not offered; POST JSON-RPC to this endpoint.", { status: 405, headers: MCP_CORS });
  }
  return Response.json({
    name: "netify-sase-marketplace",
    title: "Netify SASE & SD-WAN Marketplace",
    transport: "streamable-http (stateless)",
    protocol: "JSON-RPC 2.0 (MCP)",
    protocolVersions: SUPPORTED_PROTOCOLS,
    endpoint: `${SITE_URL}/api/mcp`,
    connector_page: `${SITE_URL}/connector`,
    authentication: "none for research, drafting and estimating; write actions that reach named suppliers are token-gated per tool",
    tools: annotatedTools().map((t) => t.name),
    usage: "POST JSON-RPC: methods initialize, tools/list, tools/call, ping.",
  }, { headers: MCP_CORS });
}
