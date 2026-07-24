import { sessionFromRequest, notifyCompanyAdded } from "@/lib/auth";
import { kvConfigured } from "@/lib/rfp-store";
import { getBuyerProfile, saveBuyerProfile } from "@/lib/buyer-profile";
import { COMPANY_NAME_REFUSAL, companyReadsAsPersonalName } from "@/lib/company-name-check";

export const runtime = "nodejs";

/**
 * The signed-in buyer's own internal profile (24 July 2026): name arrives
 * from LinkedIn at sign-in, company from the welcome step's one question.
 * Session-scoped both ways; a buyer can only ever read or write their own
 * record. Internal to the Netify team beyond that: nothing here reaches
 * suppliers, positions or the board (the anonymity law governs those).
 */
export async function GET(req: Request) {
  const s = await sessionFromRequest(req);
  if (!s || s.role === "supplier") return Response.json({ error: "Sign in first." }, { status: 401 });
  const p = kvConfigured() ? await getBuyerProfile(s.email) : null;
  return Response.json({ email: s.email, name: p?.name ?? "", company: p?.company ?? "" });
}

/** Set the company (and optionally correct the name). First company set
 *  sends the team the compact follow-up so "who" becomes "who at which
 *  company". Best effort throughout, with one refusal (Robert, 24 July,
 *  after "Sam White" arrived from Samuel White): a company that is just
 *  the buyer's own name is not an answer. Refused here as well as in the
 *  browser, same rule and same words, so a bypassed client gains nothing. */
export async function POST(req: Request) {
  const s = await sessionFromRequest(req);
  if (!s || s.role === "supplier") return Response.json({ error: "Sign in first." }, { status: 401 });
  if (!kvConfigured()) return Response.json({ ok: true, stored: false });
  let body: { company?: string; name?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const company = typeof body.company === "string" ? body.company.trim().slice(0, 120) : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  if (!company && !name) return Response.json({ ok: true, stored: false });
  const before = await getBuyerProfile(s.email);
  if (company && companyReadsAsPersonalName(company, before?.name || name)) {
    return Response.json({ error: COMPANY_NAME_REFUSAL, reason: "personal_name" }, { status: 422 });
  }
  const saved = await saveBuyerProfile(s.email, {
    ...(company ? { company } : {}),
    ...(name ? { name } : {}),
  });
  // One follow-up, only when a company lands for the first time.
  try {
    if (company && !before?.company) {
      await notifyCompanyAdded(s.email, saved?.name ?? name ?? undefined, company);
    }
  } catch { /* non-fatal */ }
  return Response.json({ ok: true, stored: Boolean(saved) });
}
