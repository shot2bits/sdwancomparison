import { corsHeaders, preflight } from "@/lib/cors";
import { listOpportunities, kvConfigured } from "@/lib/rfp-store";
import { sessionFromRequest } from "@/lib/auth";

export const runtime = "nodejs";
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * The signed-in buyer's opportunities, WITH manage tokens.
 *
 * This is the account-based recovery path: buyer_token was previously only
 * available in the browser that published (localStorage), so a cleared cache
 * or a different device meant losing manage access. Publishing stores
 * owner_email on the opportunity; this endpoint lets the same signed-in
 * account recover its rooms anywhere. Session required; never CORS-exposed
 * beyond the standard allowlist; returns nothing for other owners.
 */
export async function GET(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const session = await sessionFromRequest(req);
  if (!session?.email) return Response.json({ error: "Sign in to see your opportunities.", auth_required: true }, { status: 401, headers: cors });

  const all = await listOpportunities();
  const mine = all
    .filter((o) => o.owner_email && o.owner_email.toLowerCase() === session.email.toLowerCase())
    .sort((a, b) => b.updated - a.updated)
    .map((o) => ({
      id: o.id,
      title: o.title,
      status: o.status,
      visibility: o.visibility,
      response_mode: o.response_mode,
      created: o.created,
      updated: o.updated,
      bid_count: o.feed.filter((f) => f.type === "pricing").length,
      comment_count: o.feed.filter((f) => f.type === "comment").length,
      buyer_token: o.buyer_token,
    }));
  return Response.json({ opportunities: mine, count: mine.length }, { headers: cors });
}
