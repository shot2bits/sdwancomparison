import { corsHeaders, preflight } from "@/lib/cors";
import { kvConfigured } from "@/lib/rfp-store";
import { partnerEmail } from "@/lib/partner-auth";
import { generatePartnerDigest } from "@/lib/partner-agent";

export const runtime = "nodejs";
export async function OPTIONS(req: Request) { return preflight(req); }

/** Manual "Generate partner digest". R1 only; the scheduled run loop is R2.
 *  Produces a partner-only digest of recommended next actions. Sends nothing. */
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const email = await partnerEmail(req);
  if (!email) return Response.json({ error: "Sign in to generate your digest.", auth_required: true }, { status: 401, headers: cors });

  const digest = await generatePartnerDigest(email, "manual");
  return Response.json({ ok: true, digest }, { headers: cors });
}
