import { corsHeaders, preflight } from "@/lib/cors";
import { kvConfigured } from "@/lib/rfp-store";
import { isBlockedDomainLive, emailDomain } from "@/lib/access-control";
import { getEstate, saveEstate, seedBids } from "@/lib/estate-store";
import { PRICING_TERMS_VERSION, PRICING_TERMS_TEXT } from "@/lib/estate-types";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function OPTIONS(req: Request) { return preflight(req); }

/**
 * Submit an estate for firm bids. Indicative pricing upstream is in the
 * clear and needs nothing; THIS is the identity-and-terms moment:
 * business name, first and last name, a business email (webmail rejected),
 * and explicit acceptance that invited providers populate pricing directly
 * in the portal and may contact the buyer with clarifying questions.
 * The consent record (version + timestamp) is stored on the estate.
 */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const { id } = await ctx.params;
  const estate = await getEstate(id);
  if (!estate) return Response.json({ error: "Estate not found." }, { status: 404, headers: cors });

  let body: {
    manage_token?: string;
    business_name?: string;
    first_name?: string;
    last_name?: string;
    contact_email?: string;
    accept_terms?: boolean;
  } = {};
  try { body = await req.json(); } catch { /* token can come via query */ }
  const url = new URL(req.url);
  const token = String(body.manage_token ?? url.searchParams.get("manage") ?? "");
  if (token !== estate.manage_token) return Response.json({ error: "Manage key required." }, { status: 401, headers: cors });
  if (estate.sites.length === 0) return Response.json({ error: "Add at least one site before submitting." }, { status: 422, headers: cors });
  if (estate.status === "submitted") {
    return Response.json({ estate, note: "Already submitted; bids unchanged." }, { headers: cors });
  }

  const businessName = String(body.business_name ?? "").trim();
  const firstName = String(body.first_name ?? "").trim();
  const lastName = String(body.last_name ?? "").trim();
  const email = String(body.contact_email ?? "").trim().toLowerCase();
  if (!businessName || !firstName || !lastName || !email.includes("@")) {
    return Response.json(
      { error: "Submitting for firm pricing needs your business name, first name, last name and business email. Indicative pricing stays open without them.", terms_version: PRICING_TERMS_VERSION, terms_text: PRICING_TERMS_TEXT },
      { status: 422, headers: cors },
    );
  }
  const domain = emailDomain(email);
  if (!domain || (await isBlockedDomainLive(domain))) {
    return Response.json({ error: "Please use your organisation email. Free and personal email addresses are not accepted." }, { status: 422, headers: cors });
  }
  if (body.accept_terms !== true) {
    return Response.json(
      { error: "Please accept the submission terms.", terms_version: PRICING_TERMS_VERSION, terms_text: PRICING_TERMS_TEXT },
      { status: 422, headers: cors },
    );
  }

  const saved = await saveEstate(seedBids({
    ...estate,
    business_name: businessName,
    first_name: firstName,
    last_name: lastName,
    contact_email: email,
    consent: { version: PRICING_TERMS_VERSION, agreed_at: Date.now() },
  }));
  return Response.json({ estate: saved, bids_seeded: saved.bids.length, terms_version: PRICING_TERMS_VERSION }, { headers: cors });
}
