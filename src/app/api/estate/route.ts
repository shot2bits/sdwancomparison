import { corsHeaders, preflight } from "@/lib/cors";
import { kvConfigured } from "@/lib/rfp-store";
import { newEstate, saveEstate, indicativeBands } from "@/lib/estate-store";

export const runtime = "nodejs";
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * Create a pricing estate. Open, no sign-in: drafting in the clear is the
 * point, matching the rest of the marketplace. The response carries the
 * manage_token; whoever holds it manages the estate (same model as RFP
 * drafts). Indicative bands are returned immediately, marked illustrative.
 */
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty draft is fine */ }
  try {
    const estate = newEstate(body);
    const saved = await saveEstate(estate);
    return Response.json({ estate: saved, indicative: indicativeBands(saved), illustrative: true }, { headers: cors });
  } catch {
    return Response.json({ error: "Invalid estate payload." }, { status: 422, headers: cors });
  }
}
