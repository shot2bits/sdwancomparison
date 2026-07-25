import { MCP_TOOL_DEFINITIONS, callMcpTool } from "@/lib/mcp-tools";
import { MCP_RFP_TOOL_DEFINITIONS, RFP_TOOL_NAMES, callRfpTool } from "@/lib/mcp-rfp-tools";
import { MCP_COST_TOOL_DEFINITIONS, COST_TOOL_NAMES, callCostTool } from "@/lib/mcp-cost-tools";
import { SECURITY_TOOL_DEFINITIONS_ALL, SECURITY_TOOL_NAMES, callSecurityTool } from "@/lib/mcp-security-tools";
import { WORKSPACE_TOOL_DEFINITIONS, WORKSPACE_TOOL_NAMES, callWorkspaceTool } from "@/lib/mcp-workspace-tools";
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

/**
 * The estate's machine twins as first-class MCP resources (25 July 2026,
 * machine-layer parity with the BT estate, then past it). Fixed datasets
 * only; each read self-fetches the SAME route that renders the public twin,
 * so the resource and the page can never disagree. The advertised uri is
 * the canonical public address; the fetch goes to the SERVING origin,
 * derived per request, so reads work identically in production, preview
 * deployments and local walks instead of silently reading production from
 * everywhere. All CC BY 4.0 with attribution to Netify, stated per twin.
 * The opportunities board twin exists but stays unlisted until Robert
 * rules on the board twin regate (open verdict V-C).
 */
const ESTATE_RESOURCES = [
  {
    path: "/shortlist/data.json",
    name: "sase-shortlist",
    title: "The SASE and SD-WAN provider shortlist, machine twin",
    description:
      "The flagship providers dataset: 30 vendors graded on 40 evidenced capabilities with the default ranking, the scoring model, and the callable tools to compute bespoke shortlists. Same content as netify.co.uk/sase/shortlist/. CC BY 4.0 with attribution to Netify.",
  },
  {
    path: "/demand/data.json",
    name: "sase-demand-index",
    title: "Netify SASE & SD-WAN Demand Index, machine twin",
    description:
      "Live, anonymised first-party demand data from the Netify procurement marketplace: sector and technology mix, publish funnel, weekly trend. Cite as the Netify SASE & SD-WAN Demand Index with the week stated. CC BY 4.0 with attribution to Netify.",
  },
  {
    path: "/api/cost/data.json",
    name: "sase-cost-model",
    title: "SASE and SD-WAN cost model, machine twin",
    description:
      "The cost and TCO model behind the estimator: categories, drivers and defensible bands. Same content as the public estimator dataset. CC BY 4.0 with attribution to Netify.",
  },
] as const;

/** Templated twins: any curated comparison or ranking page as data. */
const RESOURCE_TEMPLATES = [
  {
    uriTemplate: `${SITE_URL}/compare/{pair}/data.json`,
    name: "sase-vendor-comparison",
    title: "Head-to-head vendor comparison, machine twin",
    description:
      "Any curated comparison page as data, {pair} like cato-networks-vs-zscaler. Pairs are linked from the vendors directory and the shortlist. CC BY 4.0 with attribution to Netify.",
    mimeType: "application/json",
  },
  {
    uriTemplate: `${SITE_URL}/best/{slug}/data.json`,
    name: "sase-best-ranking",
    title: "Ranked providers for a sector, size or intent, machine twin",
    description:
      "Any best-providers ranking page as data, {slug} like sd-wan-sase-providers-for-healthcare. Slugs are listed at /sase/best/. CC BY 4.0 with attribution to Netify.",
    mimeType: "application/json",
  },
] as const;

const TEMPLATE_PATTERNS: Array<{ re: RegExp; toPath: (m: RegExpMatchArray) => string }> = [
  { re: new RegExp(`^${SITE_URL}/compare/([a-z0-9-]{2,80})/data\\.json$`), toPath: (m) => `/compare/${m[1]}/data.json` },
  { re: new RegExp(`^${SITE_URL}/best/([a-z0-9-]{2,80})/data\\.json$`), toPath: (m) => `/best/${m[1]}/data.json` },
];

/** Resolve an advertised resource uri to an app path, or null if unknown. */
function resourcePathFor(uri: string): string | null {
  const fixed = ESTATE_RESOURCES.find((r) => `${SITE_URL}${r.path}` === uri);
  if (fixed) return fixed.path;
  for (const t of TEMPLATE_PATTERNS) {
    const m = uri.match(t.re);
    if (m) return t.toPath(m);
  }
  return null;
}

/** Serve-time merge of titles and behaviour annotations onto the tool definitions. */
function annotatedTools() {
  return [...MCP_TOOL_DEFINITIONS, ...MCP_RFP_TOOL_DEFINITIONS, ...MCP_COST_TOOL_DEFINITIONS, ...SECURITY_TOOL_DEFINITIONS_ALL, ...WORKSPACE_TOOL_DEFINITIONS].map((t) => {
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
        capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
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
      if (!COST_TOOL_NAMES.has(name) && !RFP_TOOL_NAMES.has(name) && !PLAIN_TOOL_NAMES.has(name) && !SECURITY_TOOL_NAMES.has(name) && !WORKSPACE_TOOL_NAMES.has(name)) {
        return rpcError(body.id, -32602, `Unknown tool: ${name}`);
      }
      const result = WORKSPACE_TOOL_NAMES.has(name)
        ? await callWorkspaceTool(name, args)
        : SECURITY_TOOL_NAMES.has(name)
          ? await callSecurityTool(name, args)
          : COST_TOOL_NAMES.has(name)
            ? await callCostTool(name, args)
            : RFP_TOOL_NAMES.has(name)
              ? await callRfpTool(name, args)
              : await callMcpTool(name, args);
      // Audit fix (19 July 2026): handlers signal failure as { error: ... }.
      // Surface that as isError so agents can branch without parsing prose.
      const failed = !!result && typeof result === "object" && (result as Record<string, unknown>).error != null;
      return rpcResult(body.id, {
        content: [{ type: "text", text: JSON.stringify(result) }],
        ...(failed ? { isError: true } : {}),
      }, protocol);
    }
    case "resources/list":
      return rpcResult(body.id, {
        resources: ESTATE_RESOURCES.map((r) => ({
          uri: `${SITE_URL}${r.path}`,
          name: r.name,
          title: r.title,
          description: r.description,
          mimeType: "application/json",
        })),
      }, protocol);
    case "resources/templates/list":
      return rpcResult(body.id, { resourceTemplates: [...RESOURCE_TEMPLATES] }, protocol);
    case "resources/read": {
      const uri = body.params?.uri;
      if (!uri || typeof uri !== "string") {
        return rpcError(body.id, -32602, "Invalid params: missing uri");
      }
      const path = resourcePathFor(uri);
      if (!path) {
        return rpcError(body.id, -32002, `Resource not found: ${uri}`);
      }
      // Self-fetch the twin from the origin THIS request arrived on, so the
      // read serves the same bytes as the page in every environment.
      try {
        const origin = new URL(req.url).origin;
        const res = await fetch(`${origin}/sase${path}`, { headers: { accept: "application/json" } });
        if (res.status === 404) {
          return rpcError(body.id, -32002, `Resource not found: ${uri}`);
        }
        if (!res.ok) {
          return rpcError(body.id, -32000, `Resource fetch failed: ${res.status}`);
        }
        const text = await res.text();
        return rpcResult(body.id, {
          contents: [{ uri, mimeType: "application/json", text }],
        }, protocol);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return rpcError(body.id, -32000, `Resource fetch error: ${message}`);
      }
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
    resources: ESTATE_RESOURCES.map((r) => ({ uri: `${SITE_URL}${r.path}`, name: r.name })),
    resourceTemplates: RESOURCE_TEMPLATES.map((t) => t.uriTemplate),
    resource_licence: "CC BY 4.0 with attribution to Netify; each twin states it.",
    usage: "POST JSON-RPC: methods initialize, tools/list, tools/call, resources/list, resources/templates/list, resources/read, ping.",
  }, { headers: MCP_CORS });
}
