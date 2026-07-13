/**
 * POST /sase/api/cost/estimate
 *
 * SASE TCO estimate from the pre-built estimator engine (Methodology
 * v2026.1, lib/estimator). The engine is pure and deterministic; all
 * economics live in the calibration file, which is flagged
 * assumptionReviewRequired for human sign-off. Invalid input returns 400
 * with the Zod issues. Modest per-IP rate limit via KV; when KV is not
 * configured (local dev) the limiter allows the request.
 */
import { corsHeaders, preflight } from "@/lib/cors";
import { estimate, EstimateInput } from "@/lib/estimator/engine";
import { kvConfigured, kvRaw } from "@/lib/rfp-store";

export const runtime = "nodejs";

const LIMIT_PER_MINUTE = 30;

async function rateLimited(req: Request): Promise<boolean> {
  if (!kvConfigured()) return false;
  const ip =
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown-ip";
  const minute = Math.floor(Date.now() / 60_000);
  const key = `cost:estimate:rl:${ip}:${minute}`;
  try {
    const count = (await kvRaw(["INCR", key])) as number;
    if (count === 1) await kvRaw(["EXPIRE", key, 90]);
    return count > LIMIT_PER_MINUTE;
  } catch {
    return false; // limiter is best effort, never blocks on KV failure
  }
}

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);

  if (await rateLimited(req)) {
    return Response.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429, headers: { ...cors, "Retry-After": "60" } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400, headers: cors });
  }

  const parsed = EstimateInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid estimate input.", issues: parsed.error.issues.slice(0, 10) },
      { status: 400, headers: cors },
    );
  }

  const result = estimate(parsed.data);
  return Response.json(result, {
    headers: { ...cors, "Cache-Control": "no-store" },
  });
}
