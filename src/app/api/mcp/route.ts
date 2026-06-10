import { MCP_TOOL_DEFINITIONS, callMcpTool } from "@/lib/mcp-tools";

/**
 * MCP server: JSON-RPC 2.0 over HTTP POST.
 * Canonical endpoint: /api/mcp (no trailing slash; this app does not use
 * trailing slashes). Some MCP clients do not follow 308 redirects on POST,
 * so always document the slash-less form.
 */

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: { name?: string; arguments?: unknown; [k: string]: unknown };
};

function rpcResult(id: string | number | null | undefined, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, result });
}

function rpcError(id: string | number | null | undefined, code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

export async function POST(req: Request) {
  let body: JsonRpcRequest;
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  switch (body.method) {
    case "initialize":
      return rpcResult(body.id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "netify-sase-shortlist", version: "1.0.0" },
      });
    case "notifications/initialized":
      return new Response(null, { status: 202 });
    case "tools/list":
      return rpcResult(body.id, { tools: MCP_TOOL_DEFINITIONS });
    case "tools/call": {
      const name = body.params?.name ?? "";
      const result = callMcpTool(name, body.params?.arguments);
      return rpcResult(body.id, {
        content: [{ type: "text", text: JSON.stringify(result) }],
      });
    }
    case "ping":
      return rpcResult(body.id, {});
    default:
      return rpcError(body.id, -32601, `Method not found: ${body.method}`);
  }
}

export async function GET() {
  return Response.json({
    name: "netify-sase-shortlist",
    transport: "http",
    protocol: "JSON-RPC 2.0 (MCP)",
    endpoint: "/api/mcp",
    tools: MCP_TOOL_DEFINITIONS.map((t) => t.name),
    usage: "POST JSON-RPC: methods initialize, tools/list, tools/call.",
  });
}
