/**
 * RFP ownership checks, used by every buyer-side (mutating or private-reading)
 * RFP route. The rule, in order:
 *
 *   1. manage_token — the credential issued once at creation. Held by the
 *      creating browser (localStorage) and by authorised agents. Accepted from
 *      the JSON body (`manage_token`), the `x-manage-token` header, or the
 *      `?manage=` query parameter (used by server-rendered pages like preview).
 *   2. Netify admin session — can always act.
 *   3. Buyer session whose email matches the RFP's `owner_email`.
 *
 * A buyer session alone is NOT enough: before this helper existed, any
 * signed-in buyer could edit any RFP by id, which is how suppliers following a
 * share link could modify the buyer's RFP. Possession of the id (which is in
 * every supplier link) grants nothing.
 */

import { sessionFromRequest } from "@/lib/auth";
import type { ProjectDetails } from "@/lib/rfp-types";

type AnySession = { email: string; role: string } | null;

/** Pull a manage token from wherever the caller put it. */
export function manageTokenFrom(req: Request, body?: Record<string, unknown> | null): string {
  const fromBody = body && typeof body.manage_token === "string" ? body.manage_token : "";
  if (fromBody) return fromBody;
  const fromHeader = req.headers.get("x-manage-token") ?? "";
  if (fromHeader) return fromHeader;
  try {
    return new URL(req.url).searchParams.get("manage") ?? "";
  } catch {
    return "";
  }
}

export function ownerBySession(project: ProjectDetails, session: AnySession): boolean {
  if (!session) return false;
  if (session.role === "netify") return true;
  if (session.role !== "buyer") return false;
  return Boolean(project.owner_email) && session.email.toLowerCase() === project.owner_email.toLowerCase();
}

export type RfpAccess = { ok: boolean; viaToken: boolean; session: AnySession };

/**
 * Is this request authorised to act as the RFP's owner?
 * Pass the parsed body when the route has one, so a body-carried
 * manage_token is honoured without re-reading the stream.
 */
export async function requireRfpOwner(
  req: Request,
  project: ProjectDetails,
  body?: Record<string, unknown> | null,
): Promise<RfpAccess> {
  const token = manageTokenFrom(req, body);
  const viaToken = Boolean(project.manage_token) && token === project.manage_token;
  if (viaToken) {
    // Session is still useful (e.g. to adopt ownership onto an account).
    const session = await sessionFromRequest(req);
    return { ok: true, viaToken: true, session };
  }
  const session = await sessionFromRequest(req);
  return { ok: ownerBySession(project, session), viaToken: false, session };
}

/** The standard 401 body for owner-gated RFP routes. */
export function ownerRequired(actionLabel: string, cors: Record<string, string>): Response {
  return Response.json(
    {
      error: `${actionLabel} is limited to this RFP's owner. Sign in with the email that created it, or pass the RFP manage_token (issued once at creation). Suppliers: use your response link instead.`,
      auth_required: true,
      owner_only: true,
    },
    { status: 401, headers: cors },
  );
}
