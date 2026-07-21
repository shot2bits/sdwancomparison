/**
 * Live Sourcing Workspace: extraction health (W0 slice 1). Reports whether
 * the model key is configured and, on request (?ping=1), whether a minimal
 * one-token model round trip succeeds. No secrets are read back, echoed or
 * logged; the ping costs a fraction of a penny and only runs when asked,
 * so crawlers hitting the bare endpoint cost nothing.
 */

import { corsHeaders } from "@/lib/cors";
import { WORKSPACE_EXTRACT_MODEL } from "@/lib/workspace/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cors = corsHeaders(req);
  const keyConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
  const url = new URL(req.url);
  let modelReachable: boolean | null = null;
  let detail = "";

  if (keyConfigured && url.searchParams.get("ping") === "1") {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY as string,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: WORKSPACE_EXTRACT_MODEL,
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        }),
        signal: ctrl.signal,
      });
      modelReachable = res.ok;
      if (!res.ok) detail = `API answered ${res.status}`;
    } catch (e) {
      modelReachable = false;
      detail = e instanceof Error && e.name === "AbortError" ? "timeout" : "network error";
    } finally {
      clearTimeout(timer);
    }
  }

  return Response.json(
    {
      key_configured: keyConfigured,
      model: WORKSPACE_EXTRACT_MODEL,
      model_reachable: modelReachable,
      ...(detail ? { detail } : {}),
      checked_at: new Date().toISOString(),
    },
    { headers: cors },
  );
}
