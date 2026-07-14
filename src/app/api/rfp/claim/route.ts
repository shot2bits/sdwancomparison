import { corsHeaders, preflight } from "@/lib/cors";
import { sessionFromRequest } from "@/lib/auth";
import { getProject, saveProject, indexRfpForBuyer, kvConfigured } from "@/lib/rfp-store";

export const runtime = "nodejs";
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * Attach anonymous drafts to the signed-in buyer's account. The browser that
 * built a draft holds its manage_token in localStorage; presenting the pair
 * (id + manage_token) proves creation, so the draft adopts the session email
 * as owner and joins the account index. Idempotent, and it never reassigns an
 * RFP that already belongs to a different account.
 *
 * This is the join between the anonymous builder funnel and the account
 * funnel. Without it buyers who draft first and sign in second look like
 * empty accounts while their work sits orphaned (14 July 2026 finding: 339
 * anonymous drafts, zero real-buyer-owned RFPs).
 */
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const session = await sessionFromRequest(req);
  if (!session || (session.role !== "buyer" && session.role !== "netify")) {
    return Response.json({ error: "Sign in to claim your drafts.", auth_required: true }, { status: 401, headers: cors });
  }

  let body: { drafts?: { id?: string; manage_token?: string }[] } = {};
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }
  const drafts = Array.isArray(body.drafts) ? body.drafts.slice(0, 25) : [];

  const email = session.email.toLowerCase();
  const claimed: { id: string; title: string; status: string; updated: number }[] = [];
  for (const d of drafts) {
    const id = typeof d?.id === "string" ? d.id : "";
    const token = typeof d?.manage_token === "string" ? d.manage_token : "";
    if (!/^rfp_[A-Za-z0-9]+$/.test(id) || !token) continue;
    const p = await getProject(id);
    if (!p || !p.manage_token || p.manage_token !== token) continue;
    const owner = (p.owner_email ?? "").toLowerCase();
    if (owner && owner !== email) continue; // never reassign someone else's RFP
    try {
      if (!owner) await saveProject({ ...p, owner_email: email });
      await indexRfpForBuyer(email, p.id);
      claimed.push({ id: p.id, title: p.title, status: p.status, updated: p.updated });
    } catch { /* best effort per draft */ }
  }

  return Response.json({ ok: true, claimed }, { headers: cors });
}
