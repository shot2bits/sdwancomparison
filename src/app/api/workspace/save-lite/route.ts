/**
 * Save-lite lead capture (W0 slice 3, spec v1.3 section 4): "Want to save
 * this? Email, company, continue" at the draft's first useful moment. The
 * sign-in itself is the EXISTING magic-link machinery (the page calls
 * /api/auth/request); this endpoint only records the capture on a leads
 * list, exactly like the wizard's draft-link capture. The company name
 * NEVER enters a project object in W0: published notices are anonymous,
 * and nothing here can leak into a supplier-facing surface.
 *
 * Business-email policy applies (Robert's ruling: no webmail ever); a
 * rejected domain records nothing.
 */

import { corsHeaders, preflight } from "@/lib/cors";
import { emailDomain, isBlockedDomainLive } from "@/lib/access-control";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  let body: { email?: string; company?: string; facts?: number } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }
  const email = String(body.email ?? "").trim().toLowerCase();
  const domain = emailDomain(email);
  if (!domain) return Response.json({ error: "Enter a valid email." }, { status: 422, headers: cors });
  if (await isBlockedDomainLive(domain)) {
    return Response.json(
      { error: "Suppliers respond to verified work emails, so saving needs one too." },
      { status: 422, headers: cors },
    );
  }
  const company = String(body.company ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, 120);
  try {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (url && token) {
      await fetch(`${url}/lpush/workspace_savelite_leads`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify([
          JSON.stringify({ email, company, facts: Number(body.facts) || 0, created: Date.now(), source: "workspace" }),
        ]),
      });
    }
  } catch {
    /* best effort: the magic link is the thing that must not fail */
  }
  return Response.json({ ok: true }, { headers: cors });
}
