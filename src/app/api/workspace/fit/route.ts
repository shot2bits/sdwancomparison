/**
 * Live Sourcing Workspace: the likely-best-fit list (W0 slice 2, spec v1.3
 * section 3 point 5). Thin HTTP wrapper over lib/workspace/fit.ts, which
 * the workspace_cycle MCP tool shares, so the page and an agent read the
 * same evidence. Open and side-effect free; response is cacheable.
 */

import { corsHeaders, preflight } from "@/lib/cors";
import { workspaceFit } from "@/lib/workspace/fit";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: Request) {
  const cors = corsHeaders(req);
  const url = new URL(req.url);
  const result = workspaceFit({
    buying: url.searchParams.get("buying") ?? "",
    regions: (url.searchParams.get("regions") ?? "").split(".").filter(Boolean),
    model: url.searchParams.get("model") ?? "any",
    include: (url.searchParams.get("include") ?? "").split(",").filter(Boolean),
  });
  return Response.json(
    { ok: true, ...result },
    { headers: { ...cors, "cache-control": "public, max-age=300, stale-while-revalidate=3600" } },
  );
}
