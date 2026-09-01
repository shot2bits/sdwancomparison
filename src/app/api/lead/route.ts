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
  top_vendors?: Array<string | {
    rank?: number;
    name?: string;
    score?: number;
    marketplace_url?: string | null;
  }>;
};

const RFP_BUILDER_URL = "https://netify.co.uk/sase-sd-wan-rfp-builder/";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeNetifyUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "https:" && url.hostname === "netify.co.uk" ? url.toString() : null;
  } catch {
    return null;
  }
}

function vendorText(vendors: LeadBody["top_vendors"]): string {
  return (vendors ?? []).map((vendor) => {
    if (typeof vendor === "string") return vendor;
    return `${vendor.rank ?? ""}. ${vendor.name ?? "Provider"} (${vendor.score ?? "not scored"})`;
  }).join("\n");
}

function vendorHtml(vendors: LeadBody["top_vendors"]): string {
  const items = (vendors ?? []).map((vendor) => {
    if (typeof vendor === "string") return `<li>${escapeHtml(vendor)}</li>`;
    const label = `${vendor.rank ?? ""}. ${vendor.name ?? "Provider"} (${vendor.score ?? "not scored"})`;
    const url = safeNetifyUrl(vendor.marketplace_url);
    return `<li>${url ? `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>` : escapeHtml(label)}</li>`;
  });
  return `<ol>${items.join("")}</ol>`;
}

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
  const vendorList = vendorText(body.top_vendors);
  const linkedVendorList = vendorHtml(body.top_vendors);
  const shortlistUrl = safeNetifyUrl(body.shortlist_url) ?? "https://netify.co.uk/sase/shortlist/";

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
    html: `<p><strong>${escapeHtml(body.name)}</strong> (${escapeHtml(body.email)}) at ${escapeHtml(body.company || "n/a")} built a shortlist.</p><p><strong>Criteria:</strong> ${escapeHtml(body.criteria_summary || "defaults")}</p><pre>${escapeHtml(vendorList)}</pre><p><a href="${escapeHtml(shortlistUrl)}">Open the shortlist</a></p>`,
  });

  // Confirmation to the buyer
  if (body.email) {
    send({
      from,
      to: body.email,
      subject: "Your Netify SASE and SD-WAN shortlist",
      html: `<p>Hello ${escapeHtml(body.name || "")},</p><p>Here is the SASE and SD-WAN shortlist you built with Netify.</p><p><strong>Your requirements:</strong> ${escapeHtml(body.criteria_summary || "default scoring")}</p>${linkedVendorList}<p><a href="${escapeHtml(shortlistUrl)}"><strong>Reopen this shortlist</strong></a></p><p>This link restores the requirements and ranking used for this shortlist.</p><h2>Turn the shortlist into an RFP</h2><p>Use the <a href="${RFP_BUILDER_URL}">Netify SASE and SD-WAN RFP Builder</a> to document your requirements, publish an anonymous opportunity and invite suitable providers to respond.</p><p>Netify is an independent SASE and SD-WAN research and comparison service. It helps buyers compare providers, document requirements and collect supplier responses in one structured process.</p><p>Netify research team</p>`,
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
