import { consumeMagicToken, createSession, kvConfigured, markSignupSeen, getProject, saveProject } from "@/lib/rfp-store";
import { executePublish } from "@/lib/rfp-publish";
import { sessionCookieHeader, notifyNewSignup } from "@/lib/auth";

export const runtime = "nodejs";

/** Exchange a magic token for a session cookie. */
export async function POST(req: Request) {
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503 });
  let body: { token?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const payload = body.token ? await consumeMagicToken(body.token) : null;
  if (!payload) return Response.json({ error: "This sign-in link is invalid or has expired." }, { status: 401 });
  const session = await createSession(payload);
  // Server-side draft claim and submit: if this sign-in link was requested
  // from a specific draft, attach it to the verified email now, and when the
  // draft carries a wizard-submit intent (pending_submit), complete the
  // submission here too. Device-independent, unlike the localStorage flags:
  // the person who pressed "Generate and submit" gets their draft claimed
  // AND submitted whichever device they open the email on, exactly what the
  // "Confirm and submit your RFP" email promises. Never claims over an
  // existing owner, never publishes someone else's draft, never blocks
  // sign-in.
  try {
    if (payload.rfp_id && payload.role !== "supplier") {
      let project = await getProject(payload.rfp_id);
      if (project && !project.owner_email) {
        project.owner_email = payload.email;
        project = await saveProject(project);
      }
      if (
        project &&
        project.pending_submit &&
        project.status !== "published" &&
        project.owner_email === payload.email
      ) {
        await executePublish(project, payload.email, project.pending_submit);
      }
    }
  } catch { /* non-fatal */ }
  // Alert the Netify team the first time a buyer or supplier signs in. Best
  // effort and never blocks sign-in: a notification failure must not stop a
  // legitimate user getting their session.
  try {
    if ((payload.role === "buyer" || payload.role === "supplier") && (await markSignupSeen(payload.email, payload.role))) {
      await notifyNewSignup(payload.email, payload.role, { attr: payload.attr, rfp_attached: Boolean(payload.rfp_id) });
    }
  } catch { /* non-fatal */ }
  return Response.json(
    { ok: true, role: session.role, email: session.email, vendor_slug: session.vendor_slug },
    { headers: { "set-cookie": sessionCookieHeader(session.token) } },
  );
}
