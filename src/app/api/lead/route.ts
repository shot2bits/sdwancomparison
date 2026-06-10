export const runtime = "edge";

/**
 * Lead capture: KV first (system of record), email second (best effort).
 * Works without KV or Resend configured; missing services are skipped
 * and the lead still returns ok so the user is never blocked.
 */

type LeadBody = {
  name?: string;
  email?: string;
  company?: string;
  company_url?: string; // honeypot
  shortlist_url?: string;
  criteria_summary?: string;
  top_vendors?: string[];
};

async function kvStore(lead: Record<string, unknown>) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return;
  await fetch(`${url}/lpush/shortlist_leads`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify([JSON.stringify(lead)]),
  });
}

function sendEmails(body: LeadBody) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const from = process.env.LEAD_FROM_EMAIL ?? "shortlist@mail.netify.co.uk";
  const to = process.env.LEAD_TO_EMAIL ?? "support@netify.com";
  const vendorList = (body.top_vendors ?? []).join("\n");

  const send = (payload: Record<string, unknown>) =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    }).catch((err) => console.error("Resend fail:", err));

  // Internal notification
  send({
    from,
    to,
    reply_to: body.email,
    subject: `Shortlist lead: ${body.company || body.name || "unknown"}`,
    html: `<p><strong>${body.name}</strong> (${body.email}) at ${body.company || "n/a"} built a shortlist.</p><p><strong>Criteria:</strong> ${body.criteria_summary || "defaults"}</p><pre>${vendorList}</pre><p><a href="${body.shortlist_url}">Open the shortlist</a></p>`,
  });

  // Confirmation to the buyer
  if (body.email) {
    send({
      from,
      to: body.email,
      subject: "Your Netify SASE and SD-WAN shortlist",
      html: `<p>Hello ${body.name || ""},</p><p>Here is the shortlist you built with the Netify comparison tool.</p><p><strong>Criteria:</strong> ${body.criteria_summary || "default scoring"}</p><pre>${vendorList}</pre><p><a href="${body.shortlist_url}">Reopen your shortlist</a> at any time; the link encodes your exact filters.</p><p>Want competitive responses from these vendors? Reply to this email or use the Netify RFP Builder.</p><p>Netify research team</p>`,
    });
  }
}

export async function POST(req: Request) {
  let body: LeadBody;
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  // Honeypot: silently accept and drop
  if (body.company_url) return Response.json({ ok: true });

  if (!body.email || !body.name) {
    return Response.json({ ok: false, error: "Name and email required." }, { status: 422 });
  }

  try {
    await kvStore({ ...body, ts: Date.now() });
  } catch (err) {
    console.error("KV fail:", err);
  }

  sendEmails(body);

  return Response.json({ ok: true });
}
