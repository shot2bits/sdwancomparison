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
  listAllRfpIds,
  getProjectsBulk,
  kvMgetJson,
  listDraftLinkLeads,
  getBuyerAllowlist,
  addBuyerAllowDomain,
  getRejectStats,
  listConnections,
  getConnection,
  saveConnection,
} from "@/lib/rfp-store";
import { SITE_URL } from "@/lib/structured-data";
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

  const [sessions, effective, overrides, blocklistExtra, pending, claims, opportunities, signups, rfpIds, leads, buyerAllowlist, rejectStats] = await Promise.all([
    listSessions(),
    effectiveVendorDomains(),
    getVendorDomainOverrides(),
    getBlocklistExtra(),
    listPendingRequests(),
    listVendorClaims(),
    listOpportunities(),
    listSignups(),
    listAllRfpIds(),
    listDraftLinkLeads(),
    getBuyerAllowlist(),
    getRejectStats(),
  ]);

  const vendors = Object.keys(effective)
    .sort()
    .map((slug) => ({ slug, domains: effective[slug], customised: Object.prototype.hasOwnProperty.call(overrides, slug) }));

  // Buyer funnel: every RFP (anonymous drafts included), with the draft-link
  // email captures and supplier response counts, so the console answers
  // "signup, create, publish, responses" at a glance.
  const projects = await getProjectsBulk(rfpIds);
  const contacts = await kvMgetJson<string>(projects.map((p) => `rfp:${p.id}:contact_email`));
  const publishedProjects = projects.filter((p) => p.status === "published");
  const responseLists = await kvMgetJson<unknown[]>(publishedProjects.map((p) => `rfp:${p.id}:responses`));
  const responsesByRfp = new Map<string, number>();
  publishedProjects.forEach((p, i) => responsesByRfp.set(p.id, Array.isArray(responseLists[i]) ? responseLists[i]!.length : 0));

  const rfps = projects
    .map((p, i) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      owner_email: p.owner_email || null,
      contact_email: contacts[i] ?? null,
      organisation: p.buyer.organisation || null,
      sector: p.buyer.sector,
      scope: p.buyer.product_scope,
      sections: p.rfp_sections.filter((s) => s.included).length,
      questions: p.rfp_sections.filter((s) => s.included).reduce((n, s) => n + s.questions.length, 0),
      invited_vendors: p.invited_vendors.length,
      responses: responsesByRfp.get(p.id) ?? 0,
      created: p.created,
      updated: p.updated,
    }))
    .sort((a, b) => b.updated - a.updated)
    .slice(0, 200);

  // Brokering queue (deal room slice 1): until suppliers register, the Netify
  // team delivers the private response links. Recent published RFPs with per
  // supplier link, viewed and forwarded state, newest first.
  const brokerSource = publishedProjects
    .filter((p) => !(p.owner_email ?? "").toLowerCase().endsWith("@netify.com"))
    .sort((a, b) => b.updated - a.updated)
    .slice(0, 25);
  const brokerConns = await Promise.all(brokerSource.map((p) => listConnections(p.id)));
  const broker_queue = brokerSource.map((p, i) => ({
    rfp_id: p.id,
    title: p.title,
    owner_email: p.owner_email || null,
    sector: p.buyer.sector,
    response_deadline: p.response_deadline ?? null,
    updated: p.updated,
    suppliers: (brokerConns[i] ?? []).map((c) => ({
      vendor_slug: c.vendor_slug,
      vendor_name: c.vendor_name,
      status: c.status,
      viewed_at: c.viewed_at ?? null,
      forwarded_at: c.forwarded_at ?? null,
      respond_url: `${SITE_URL}/rfp-builder/supplier/${c.token}`,
    })),
  }));

  const owned = projects.filter((p) => p.owner_email);
  const funnel = {
    buyer_accounts: signups.filter((u) => u.roles.includes("buyer")).length,
    accounts_with_rfp: new Set(owned.map((p) => p.owner_email.toLowerCase())).size,
    rfps_total: projects.length,
    rfps_account_owned: owned.length,
    rfps_anonymous: projects.length - owned.length,
    rfps_published: publishedProjects.length,
    supplier_responses: Array.from(responsesByRfp.values()).reduce((n, c) => n + c, 0),
    draft_link_captures: leads.length,
  };

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
      funnel,
      broker_queue,
      rfps,
      draft_link_leads: leads.slice(0, 50),
      buyer_allowlist: buyerAllowlist,
      reject_stats: rejectStats,
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
      case "approve_pending_buyer": {
        // Academic (or other reviewed) domain approved for BUYER sign-in:
        // allowlist it and clear the queue entry. The requester signs in
        // normally from then on.
        const domain = String(body.domain ?? "").trim().toLowerCase();
        if (!domain) return Response.json({ error: "domain required." }, { status: 422, headers: cors });
        await addBuyerAllowDomain(domain);
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
      case "mark_forwarded": {
        // Brokering queue: record that the team delivered a supplier's
        // private link during the pre-registration phase.
        const rfpId = String(body.rfp_id ?? "");
        const vendorSlug = String(body.vendor_slug ?? "");
        if (!rfpId || !vendorSlug) return Response.json({ error: "rfp_id and vendor_slug required." }, { status: 422, headers: cors });
        const conn = await getConnection(rfpId, vendorSlug);
        if (!conn) return Response.json({ error: "Connection not found." }, { status: 404, headers: cors });
        const saved = await saveConnection({ ...conn, forwarded_at: Date.now() });
        return Response.json({ ok: true, forwarded_at: saved.forwarded_at }, { headers: cors });
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
