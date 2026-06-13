import { consumeMagicToken, createSession, kvConfigured } from "@/lib/rfp-store";
import { sessionCookieHeader } from "@/lib/auth";

export const runtime = "nodejs";

/** Exchange a magic token for a session cookie. */
export async function POST(req: Request) {
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503 });
  let body: { token?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const payload = body.token ? await consumeMagicToken(body.token) : null;
  if (!payload) return Response.json({ error: "This sign-in link is invalid or has expired." }, { status: 401 });
  const session = await createSession(payload);
  return Response.json(
    { ok: true, role: session.role, email: session.email, vendor_slug: session.vendor_slug },
    { headers: { "set-cookie": sessionCookieHeader(session.token) } },
  );
}
