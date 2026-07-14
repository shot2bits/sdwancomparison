import { addOptout, verifyUnsubscribe } from "@/lib/email-optout";
import { kvConfigured } from "@/lib/rfp-store";

export const runtime = "nodejs";

/**
 * One-click unsubscribe. GET serves the link in email footers; POST serves
 * RFC 8058 one-click (the List-Unsubscribe-Post header), which mail clients
 * call without showing a page. Both are idempotent. The signature ties the
 * link to the address it was sent to, so nobody can unsubscribe anyone else.
 */

function page(title: string, body: string): Response {
  return new Response(
    `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;max-width:34rem;margin:4rem auto;padding:0 1.25rem;color:#1c1c1c;line-height:1.6"><h1 style="font-size:1.35rem">${title}</h1>${body}</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

async function handle(req: Request): Promise<Response> {
  if (!kvConfigured()) return page("Something went wrong", "<p>Please email support@netify.com and we will remove you by hand.</p>");
  const url = new URL(req.url);
  const email = (url.searchParams.get("e") ?? "").toLowerCase().trim();
  const sig = url.searchParams.get("t") ?? "";
  if (!verifyUnsubscribe(email, sig)) {
    return page("This link is not valid", "<p>The unsubscribe link appears incomplete or altered. Email support@netify.com and we will remove you by hand.</p>");
  }
  await addOptout(email);
  return page(
    "You are unsubscribed",
    `<p><strong>${email}</strong> will no longer receive reminder or feature emails from the Netify RFP Builder and Marketplace.</p><p>You will still receive emails you request directly, such as sign-in links, and activity alerts on projects you publish.</p><p style="color:#666;font-size:0.9rem">Changed your mind? Email support@netify.com.</p>`,
  );
}

export async function GET(req: Request) { return handle(req); }
export async function POST(req: Request) { return handle(req); }
