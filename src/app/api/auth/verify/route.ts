import { consumeMagicToken, createSession, kvConfigured, kvGetJson, kvSetJson, kvRaw, markSignupSeen, getProject, saveProject } from "@/lib/rfp-store";
import { executePublish, SavedUnpublishedError } from "@/lib/rfp-publish";
import { sessionCookieHeader, notifyNewSignup } from "@/lib/auth";
import { isMarketUnlocked } from "@/lib/market-unlock";
import { MARKETPLACE_PUBLICATION_CONSENT_TEXT, MARKETPLACE_PUBLICATION_CONSENT_VERSION, publicationCompleted } from "@/lib/publication-policy";

export const runtime = "nodejs";

/**
 * Resolve a same-screen 6-digit code to its magic token (18 July 2026).
 * The code is an alternative carrier for the SAME token the email link holds,
 * so consuming it inherits draft claim, pending submit and session creation.
 * 5 attempts, then the code is destroyed; expiry checked server-side.
 */
async function tokenFromCode(email: string, code: string): Promise<string | null> {
  const codeKey = `auth:code:${email.trim().toLowerCase()}`;
  const rec = await kvGetJson<{ token: string; code: string; attempts: number; expires: number }>(codeKey);
  if (!rec || !rec.code || Date.now() > rec.expires) return null;
  if (rec.attempts >= 5) { await kvRaw(["DEL", codeKey]); return null; }
  if (rec.code === code) {
    await kvRaw(["DEL", codeKey]); // single use, like the link
    return rec.token;
  }
  await kvSetJson(codeKey, { ...rec, attempts: rec.attempts + 1 });
  return null;
}

/** Exchange a magic token (or a same-screen code) for a session cookie. */
export async function POST(req: Request) {
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503 });
  let body: { token?: string; code?: string; email?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  let token = body.token ?? null;
  if (!token && body.code && body.email) {
    token = await tokenFromCode(body.email, body.code.trim());
    if (!token) return Response.json({ error: "That code is not right or has expired. Check the 6 digits in the email, or click the email link instead." }, { status: 401 });
  }
  const payload = token ? await consumeMagicToken(token) : null;
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
  // Carried to the response so the client can say what happened to a
  // pending submit (Rulings One and Two, 29 Jul 2026): the sign-in itself
  // always succeeds when the token is good, because the email round trip
  // completed; the publish outcome is a separate fact.
  let publishOutcome: { state: string; message?: string; return_url?: string } | null = null;
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
        const pendingSubmit = project.pending_submit;
        if (project.consent?.version === MARKETPLACE_PUBLICATION_CONSENT_VERSION && !(project.consents ?? []).some((item) => item.action === "marketplace.publish" && item.granted_by === payload.email)) {
          project = await saveProject({ ...project, consents: [...(project.consents ?? []), { at: project.consent.agreed_at, action: "marketplace.publish", granted_by: payload.email, via: "web", text: MARKETPLACE_PUBLICATION_CONSENT_TEXT }] });
        }
        const result = await executePublish(project, payload.email, pendingSubmit);
        const unlocked = await isMarketUnlocked(project.id);
        publishOutcome = publicationCompleted({ publicBoardOpportunityId: result.board.opportunity_id, marketUnlockValid: unlocked })
          ? { state: "published" }
          : { state: "saved_unpublished", message: result.board.reason ?? "The board publication did not complete. Nothing was sent.", return_url: `/sase/rfp-builder/${project.id}/` };
      }
    }
  } catch (e) {
    // The saved-unpublished outcome is a first-class answer, not a silent
    // failure: the requirement is saved, the lead is captured, and the
    // buyer must be told why nothing published (Ruling One). Every other
    // publish failure stays non-fatal to sign-in exactly as before.
    if (e instanceof SavedUnpublishedError) {
      publishOutcome = { state: "saved_unpublished", message: e.message, return_url: e.return_url };
    }
  }
  // Alert the Netify team the first time a buyer or supplier signs in. Best
  // effort and never blocks sign-in: a notification failure must not stop a
  // legitimate user getting their session.
  try {
    if ((payload.role === "buyer" || payload.role === "supplier") && (await markSignupSeen(payload.email, payload.role))) {
      await notifyNewSignup(payload.email, payload.role, { attr: payload.attr, rfp_attached: Boolean(payload.rfp_id) });
    }
  } catch { /* non-fatal */ }
  return Response.json(
    { ok: true, role: session.role, email: session.email, vendor_slug: session.vendor_slug, ...(publishOutcome ? { publish_outcome: publishOutcome } : {}) },
    { headers: { "set-cookie": sessionCookieHeader(session.token) } },
  );
}
