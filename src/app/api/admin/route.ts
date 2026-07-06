import { corsHeaders, preflight } from "@/lib/cors";
import { sessionFromRequest } from "@/lib/auth";
import {
  kvConfigured,
  listSessions,
  deleteSession,
  getVendorDomainOverrides,
  setVendorDomainOverride,
  getBlocklistExtra,
  addBlocklistDomain,
  removeBlocklistDomain,
  listPendingRequests,
  clearPendingRequest,
  listVendorClaims,
  decideVendorClaim,
  listOpportunities,
  deleteOpportunity,
  listSignups,
  deleteUser,
} from "@/lib/rfp-store";
import {
  isAdminEmail,
  effectiveVendorDomains,
  FREE_EMAIL_DOMAINS,
  emailDomain,
} from "@/lib/access-control";
import type { AuthSession } from "@/lib/rfp-store";

export const runtime = "nodejs";
export async function OPTIONS(req: Request) { return preflight(req); }

/** Resolve an admin session or return a 401/403 Response. */
async function requireAdmin(req: Request, cors: Record<string, string>): Promise<AuthSession | Response> {
  const session = await sessionFromRequest(req);
  if (!session) return Response.json({ error: "Sign in required.", auth_required: true }, { status: 401, headers: cors });
  if (!isAdminEmail(session.email)) return Response.json({ error: "Admin access only." }, { status: 403, headers: cors });
  return session;
}

/** Admin overview: live sessions, vendor domains, blocklist, pending requests. */
export async function GET(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const auth = await requireAdmin(req, cors);
  if (auth instanceof Response) return auth;

  const [sessions, effective, overrides, blocklistExtra, pending, claims, opportunities, signups] = await Promise.all([
    listSessions(),
    effectiveVendorDomains(),
    getVendorDomainOverrides(),
    getBlocklistExtra(),
    listPendingRequests(),
    listVendorClaims(),
    listOpportunities(),
    listSignups(),
  ]);

  const vendors = Object.keys(effective)
    .sort()
    .map((slug) => ({ slug, domains: effective[slug], customised: Object.prototype.hasOwnProperty.call(overrides, slug) }));

  return Response.json(
    {
      ok: true,
      admin_email: auth.email,
      sessions: sessions.map((s) => ({ token: s.token, role: s.role, email: s.email, vendor_slug: s.vendor_slug, created: s.created, expires: s.expires })),
      users: signups.map((u) => ({
        email: u.email,
        roles: u.roles,
        sessions: sessions.filter((s) => s.email.toLowerCase() === u.email).length,
      })),
      vendors,
      blocklist: { builtin_count: FREE_EMAIL_DOMAINS.size, custom: blocklistExtra },
      pending,
      claims,
      // Moderation view: every notice on (or off) the board, including closed
      // and unlisted ones, so anything inappropriate can be removed.
      opportunities: opportunities.slice(0, 200).map((o) => ({
        id: o.id,
        title: o.title,
        status: o.status,
        visibility: o.visibility,
        scope: o.scope,
        buyer_org: o.buyer_org,
        buyer_visibility: o.buyer_visibility,
        owner_email: o.owner_email,
        source_rfp_id: o.source_rfp_id,
        created: o.created,
        bid_count: o.feed.filter((f) => f.type === "pricing").length,
      })),
    },
    { headers: cors },
  );
}

/** Admin actions. Body: { action, ... }. */
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const auth = await requireAdmin(req, cors);
  if (auth instanceof Response) return auth;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }
  const action = String(body.action ?? "");

  try {
    switch (action) {
      case "revoke_session": {
        const token = String(body.token ?? "");
        if (!token) return Response.json({ error: "token required." }, { status: 422, headers: cors });
        await deleteSession(token);
        return Response.json({ ok: true }, { headers: cors });
      }
      case "set_vendor_domains": {
        const slug = String(body.slug ?? "");
        const domains = Array.isArray(body.domains) ? (body.domains as unknown[]).map((d) => String(d)) : [];
        if (!slug) return Response.json({ error: "slug required." }, { status: 422, headers: cors });
        await setVendorDomainOverride(slug, domains);
        return Response.json({ ok: true }, { headers: cors });
      }
      case "add_blocklist": {
        const d = emailDomain(`x@${String(body.domain ?? "")}`) ?? String(body.domain ?? "").trim().toLowerCase();
        if (!d) return Response.json({ error: "domain required." }, { status: 422, headers: cors });
        const list = await addBlocklistDomain(d);
        return Response.json({ ok: true, custom: list }, { headers: cors });
      }
      case "remove_blocklist": {
        const list = await removeBlocklistDomain(String(body.domain ?? ""));
        return Response.json({ ok: true, custom: list }, { headers: cors });
      }
      case "approve_pending": {
        const domain = String(body.domain ?? "").trim().toLowerCase();
        const slug = String(body.slug ?? "");
        if (!domain || !slug) return Response.json({ error: "domain and slug required." }, { status: 422, headers: cors });
        const effective = await effectiveVendorDomains();
        const merged = Array.from(new Set([...(effective[slug] ?? []), domain]));
        await setVendorDomainOverride(slug, merged);
        await clearPendingRequest(domain);
        return Response.json({ ok: true }, { headers: cors });
      }
      case "reject_pending": {
        const domain = String(body.domain ?? "").trim().toLowerCase();
        if (!domain) return Response.json({ error: "domain required." }, { status: 422, headers: cors });
        await clearPendingRequest(domain);
        if (body.block === true) await addBlocklistDomain(domain);
        return Response.json({ ok: true }, { headers: cors });
      }
      case "delete_opportunity": {
        const id = String(body.id ?? "");
        if (!id) return Response.json({ error: "id required." }, { status: 422, headers: cors });
        const removed = await deleteOpportunity(id);
        if (!removed) return Response.json({ error: "Opportunity not found." }, { status: 404, headers: cors });
        return Response.json({ ok: true }, { headers: cors });
      }
      case "approve_claim":
      case "reject_claim": {
        const slug = String(body.slug ?? "");
        if (!slug) return Response.json({ error: "slug required." }, { status: 422, headers: cors });
        const c = await decideVendorClaim(slug, action === "approve_claim", auth.email);
        if (!c) return Response.json({ error: "No claim found for that vendor." }, { status: 404, headers: cors });
        return Response.json({ ok: true, claim: c }, { headers: cors });
      }
      case "delete_user": {
        const email = String(body.email ?? "").trim().toLowerCase();
        const confirm = String(body.confirm ?? "").trim().toLowerCase();
        if (!email) return Response.json({ error: "email required." }, { status: 422, headers: cors });
        if (!confirm || confirm !== email) {
          return Response.json({ error: "confirm must match the account email exactly." }, { status: 422, headers: cors });
        }
        const summary = await deleteUser(email, { deleteRfps: body.delete_rfps === true });
        return Response.json({ ok: true, ...summary }, { headers: cors });
      }
      default:
        return Response.json({ error: "Unknown action." }, { status: 422, headers: cors });
    }
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Action failed." }, { status: 500, headers: cors });
  }
}
