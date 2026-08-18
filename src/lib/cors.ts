/**
 * CORS for the agentic APIs. The manufacturing tool on netify.co.uk (and
 * any future main-site embeds) calls the shortlist engine cross-origin.
 */

const ALLOWED_ORIGINS = new Set([
  "https://netify.co.uk",
  "https://www.netify.co.uk",
]);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  if (!ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}
