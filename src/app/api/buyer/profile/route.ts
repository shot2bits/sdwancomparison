import { sessionFromRequest, notifyCompanyAdded, notifyNewSignup } from "@/lib/auth";
import { kvConfigured, markSignupSeen } from "@/lib/rfp-store";
import { getBuyerProfile, saveBuyerProfile } from "@/lib/buyer-profile";
import { COMPANY_NAME_REFUSAL, companyReadsAsPersonalName } from "@/lib/company-name-check";

export const runtime = "nodejs";

/**
 * The signed-in buyer's own internal profile (24 July 2026). The LinkedIn
 * lane and its welcome step, which used to feed this record, were removed
 * on Robert's ruling of 29 July 2026 (business email only); the API stays
 * so historic profiles remain readable and any future surface can ask.
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

/** Set the company (and optionally correct the name). The first company
 *  set announces the buyer: the complete New Buyer alert when this is the
 *  address's first announcement, the compact follow-up when the team has
 *  heard of them already. Best effort throughout, with one refusal (Robert, 24 July,
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
  // One alert per buyer, at the completion moment (Robert's ruling, 24
  // July, third of the evening): the first company landing announces the
  // buyer, carrying whatever sign-in attribution was stored. A buyer
  // announced earlier (an RFP carried at sign-in, or the pre-ruling era)
  // gets the compact company follow-up instead, never a second announcement.
  try {
    if (company && !before?.company) {
      if (await markSignupSeen(s.email, "buyer")) {
        await notifyNewSignup(s.email, "buyer", {
          attr: {
            ref: before?.signup_attr?.ref ?? "",
            landing: before?.signup_attr?.landing ?? "",
            page: "",
            country: before?.signup_attr?.country ?? "",
          },
          rfp_attached: false,
          profile: { name: saved?.name ?? name ?? undefined, company },
        });
      } else {
        await notifyCompanyAdded(s.email, saved?.name ?? name ?? undefined, company);
      }
    }
  } catch { /* non-fatal */ }
  return Response.json({ ok: true, stored: Boolean(saved) });
}
