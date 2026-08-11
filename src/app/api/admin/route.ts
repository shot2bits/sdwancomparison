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
  getOpportunity,
  saveOpportunity,
  listSignups,
  deleteUser,
  listAllRfpIds,
  getProjectsBulk,
  kvMgetJson,
  kvGetJson,
  listDraftLinkLeads,
  getBuyerAllowlist,
  addBuyerAllowDomain,
  getRejectStats,
  listConnections,
  getConnection,
  saveConnection,
} from "@/lib/rfp-store";
import { SITE_URL } from "@/lib/structured-data";
import { getBounces } from "@/lib/email-bounces";
import { recoverUnlistedPublish } from "@/lib/rfp-publish";
import { SECTORS, REGIONS } from "@/lib/notice-options";
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

  // Confirmed delivery bounces (11 Aug 2026, fed by /api/webhooks/resend):
  // one bulk lookup against every owner/contact address on the page, so
  // "stuck at the email step" stops being one undifferentiated number and
  // becomes "actually undeliverable" vs "just hasn't clicked yet".
  const bounceAddrs = projects.flatMap((p, i) => [p.owner_email || "", contacts[i] ?? ""]).filter(Boolean);
  const bouncesByAddr = await getBounces(bounceAddrs);

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
      // Funnel diagnostics: consented = the wizard agreement was signed;
      // pending_submit = submit was pressed but the magic link has not been
      // clicked yet (verify clears it on execution). A draft stuck with
      // pending_submit true is a buyer lost at the email step.
      consented: Boolean(p.consent),
      pending_submit: Boolean(p.pending_submit),
      // bounced = the owner or contact address has a confirmed delivery
      // failure on file. True positive, not a guess: a pending_submit row
      // with bounced false just hasn't clicked yet; with bounced true, the
      // link never had a chance to arrive.
      bounced: Boolean(
        (p.owner_email && bouncesByAddr.has(p.owner_email.toLowerCase().trim())) ||
        (contacts[i] && bouncesByAddr.has(contacts[i]!.toLowerCase().trim())),
      ),
      created: p.created,
      updated: p.updated,
    }))
    .sort((a, b) => b.updated - a.updated)
    .slice(0, 200);

  // Brokering queue (deal room slice 1): until suppliers register, the Netify
  // team delivers the private response links. Recent published RFPs with per
  // supplier link, viewed and forwarded state, newest first.
  const brokerSource = publishedProjects
    .filter((p) => {
      const owner = (p.owner_email ?? "").toLowerCase();
      // Accountable, recent publishes only: the new submit flow always has
      // an owner, so ownerless test-era publishes stay out of the queue.
      return owner !== "" && !owner.endsWith("@netify.com") && Date.now() - p.updated < 30 * 86400000;
    })
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

  // Harry's list (Robert's ruling, 29 Jul 2026): every publish outcome,
  // published or saved-unpublished, with contact, derived company,
  // verification evidence, requirement depth and working state. Private to
  // this console; nothing here reaches any public surface.
  const titleById = new Map(projects.map((p) => [p.id, p.title]));
  const publishLeadsRaw = (await kvGetJson<Array<Record<string, unknown>>>("publish:leads").catch(() => null)) ?? [];
  const publish_leads = publishLeadsRaw
    .slice(-100)
    .reverse()
    .map((e) => ({ ...e, title: titleById.get(String(e.rfp_id ?? "")) ?? null }));

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
      publish_leads,
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
      case "close_opportunity": {
        // Moderation close (Robert's ruling, 23 Jul 2026, the H TEST notice):
        // ends an open notice without destroying it. The record keeps its
        // page and feed and moves to the board's closed archive; Remove
        // stays the tool for content that should never have existed.
        // closed_at stamps the close moment (closed-forever, 29 Jul 2026).
        const id = String(body.id ?? "");
        if (!id) return Response.json({ error: "id required." }, { status: 422, headers: cors });
        const opp = await getOpportunity(id);
        if (!opp) return Response.json({ error: "Opportunity not found." }, { status: 404, headers: cors });
        if (opp.status !== "open") return Response.json({ ok: true, status: opp.status }, { headers: cors });
        const saved = await saveOpportunity({ ...opp, status: "closed", closed_at: opp.closed_at ?? Date.now(), updated: Date.now() });
        return Response.json({ ok: true, status: saved.status }, { headers: cors });
      }
      case "backfill_notice_shapes": {
        // Harry's N2 retest (29 Jul 2026): the What-suppliers-answer section
        // was absent on every notice he could open, because rfp_shape is
        // stamped at listing time and every live notice predates the stamp
        // (observed: 1 of 15 notices carried a shape). This recomputes the
        // shape for notices that have a source RFP and no shape, with the
        // same counting rule the publish path uses: sections that carry
        // active questions, titles and counts only, never the questions.
        const all = await listOpportunities();
        const missing = all.filter((o) => o.source_rfp_id && (!o.rfp_shape || o.rfp_shape.sections.length === 0));
        const batch = missing.slice(0, Math.min(Math.max(Number(body.limit ?? 10), 1), 20));
        const rfps = await getProjectsBulk(batch.map((o) => o.source_rfp_id));
        const results: Array<{ opp_id: string; outcome: string }> = [];
        for (let i = 0; i < batch.length; i++) {
          const o = batch[i];
          const p = rfps[i];
          if (!p) { results.push({ opp_id: o.id, outcome: "source RFP not found" }); continue; }
          const active = p.rfp_sections.filter((s) => s.included && s.questions.some((q) => q.priority !== "optional"));
          const total = active.reduce((n, s) => n + s.questions.filter((q) => q.priority !== "optional").length, 0);
          if (active.length === 0 || total === 0) { results.push({ opp_id: o.id, outcome: "source RFP has no active questions" }); continue; }
          await saveOpportunity({
            ...o,
            rfp_shape: {
              version: p.methodology_version,
              total,
              sections: active.map((s) => ({ title: s.category, questions: s.questions.filter((q) => q.priority !== "optional").length })),
            },
          });
          results.push({ opp_id: o.id, outcome: `stamped ${total} questions across ${active.length} sections` });
        }
        return Response.json(
          { ok: true, missing_total: missing.length, processed_now: batch.length, remaining: missing.length - batch.length, results },
          { headers: cors },
        );
      }
      case "recover_unlisted": {
        // The thirty-two (Robert's ruling, 29 Jul 2026): historic publishes
        // that never reached the board relist through the same verification
        // chain and quality gate as a fresh publish, in small batches
        // because the chain does network work per record. Records already on
        // the internal list are skipped so repeated clicks converge; retry
        // reprocesses everything. Invites are never re-run.
        const limit = Math.min(Math.max(Number(body.limit ?? 5), 1), 10);
        const ids = await listAllRfpIds();
        const projects = await getProjectsBulk(ids);
        const PUBLISHED = new Set(["published", "qa", "evaluation"]);
        const published = projects.filter((p) => PUBLISHED.has(p.status) && p.test !== true);
        const mappings = await kvMgetJson<string>(published.map((p) => `rfp:${p.id}:board_opp`));
        const unlisted = published.filter((_, i) => !mappings[i]);
        const leads = (await kvGetJson<Array<{ rfp_id?: string }>>("publish:leads").catch(() => null)) ?? [];
        const processed = new Set(leads.map((l) => String(l.rfp_id ?? "")));
        const queue = unlisted.filter((p) => body.retry === true || !processed.has(p.id));
        const contacts = await kvMgetJson<string>(queue.map((p) => `rfp:${p.id}:contact_email`));
        const batch = queue.slice(0, limit);
        const results = [];
        for (let i = 0; i < batch.length; i++) {
          const r = await recoverUnlistedPublish(batch[i], contacts[i] ?? null);
          results.push({ rfp_id: batch[i].id, title: batch[i].title, ...r });
        }
        return Response.json(
          { ok: true, unlisted_total: unlisted.length, processed_now: batch.length, remaining: queue.length - batch.length, results },
          { headers: cors },
        );
      }
      case "edit_opportunity": {
        // The generic-notice rewrite tool (Robert's ruling, 28 Jul 2026:
        // test records stay on the board and read as credible, generic
        // notices; and Harry's duplicate-Healthcare filter finding traced
        // to sector values stored as labels on some records). Title, sector
        // and regions only; sector normalises to its slug on the way in so
        // one label can never render twice. Nothing else is editable here:
        // feeds, bids and provenance stay exactly as posted.
        const id = String(body.id ?? "");
        if (!id) return Response.json({ error: "id required." }, { status: 422, headers: cors });
        const opp = await getOpportunity(id);
        if (!opp) return Response.json({ error: "Opportunity not found." }, { status: 404, headers: cors });
        const patch: { title?: string; buyer_sector?: string; regions?: string[] } = {};
        if (typeof body.title === "string" && body.title.trim()) {
          const t = body.title.replace(/\s+/g, " ").trim();
          if (t.length < 8 || t.length > 140) return Response.json({ error: "Title must be 8 to 140 characters." }, { status: 422, headers: cors });
          patch.title = t;
        }
        if (typeof body.buyer_sector === "string" && body.buyer_sector.trim()) {
          const raw = body.buyer_sector.trim();
          const match = SECTORS.find((s) => s.key === raw) ?? SECTORS.find((s) => s.label.toLowerCase() === raw.toLowerCase());
          if (!match) return Response.json({ error: `Unknown sector "${raw}". Use a key or label from the sector catalogue.` }, { status: 422, headers: cors });
          patch.buyer_sector = match.key;
        }
        if (Array.isArray(body.regions) && body.regions.length) {
          const keys = body.regions.map(String);
          const bad = keys.filter((k) => !REGIONS.some((r) => r.key === k));
          if (bad.length) return Response.json({ error: `Unknown regions: ${bad.join(", ")}.` }, { status: 422, headers: cors });
          patch.regions = keys;
        }
        if (!Object.keys(patch).length) return Response.json({ error: "Nothing to change: send title, buyer_sector or regions." }, { status: 422, headers: cors });
        const saved = await saveOpportunity({ ...opp, ...patch, updated: Date.now() });
        return Response.json({ ok: true, id: saved.id, title: saved.title, buyer_sector: saved.buyer_sector, regions: saved.regions }, { headers: cors });
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
