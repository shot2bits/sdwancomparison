"use client";

import { useCallback, useEffect, useState } from "react";
import SignIn from "@/components/SignIn";

type SessionInfo = { authenticated: boolean; role?: string; email?: string; admin?: boolean };
type AdminSession = { token: string; role: string; email: string; vendor_slug: string | null; created: number; expires: number };
type UserRow = { email: string; roles: string[]; sessions: number };
type VendorRow = { slug: string; domains: string[]; customised: boolean };
type Pending = { domain: string; email: string; created: number; count: number; role?: "supplier" | "buyer" };
type Claim = { slug: string; status: "pending" | "approved" | "rejected"; email: string; domain: string; requested: number; decided?: number; decided_by?: string };
type OppRow = {
  id: string; title: string; status: string; visibility: string; scope: string[];
  buyer_org: string; buyer_visibility: string; owner_email: string; source_rfp_id: string;
  created: number; bid_count: number;
};
type Funnel = {
  buyer_accounts: number; accounts_with_rfp: number; rfps_total: number;
  rfps_account_owned: number; rfps_anonymous: number; rfps_published: number;
  supplier_responses: number; draft_link_captures: number;
};
type RfpRow = {
  id: string; title: string; status: string; owner_email: string | null; contact_email: string | null;
  organisation: string | null; sector: string | null; scope: string; sections: number; questions: number;
  invited_vendors: number; responses: number; created: number; updated: number;
};
type DraftLead = { rfp_id: string; email: string; ts: number };
/** Harry's list (Robert's ruling, 29 Jul 2026): every publish outcome with
 *  its evidence. Private to this console. */
type PublishLead = {
  at: number;
  state: "published" | "saved_unpublished" | string;
  rfp_id: string;
  email: string;
  title?: string | null;
  reason?: string;
  board_opportunity_id?: string;
  requirement_depth?: { questions: number; sections: number };
  verification?: {
    domain?: string;
    passed?: boolean;
    failed_check?: string | null;
    derived_company?: string | null;
    mx?: { pass: boolean; records: number };
    website?: { pass: boolean; status: number | null };
    companies_house?: Record<string, unknown> | null;
  } | null;
};
type Overview = {
  admin_email: string;
  sessions: AdminSession[];
  users: UserRow[];
  vendors: VendorRow[];
  blocklist: { builtin_count: number; custom: string[] };
  pending: Pending[];
  claims: Claim[];
  opportunities: OppRow[];
  funnel?: Funnel;
  broker_queue?: BrokerRfp[];
  publish_leads?: PublishLead[];
  rfps?: RfpRow[];
  draft_link_leads?: DraftLead[];
  buyer_allowlist?: string[];
  reject_stats?: { month: string; entries: { domain: string; reason: string; count: number }[] };
};

type BrokerSupplier = { vendor_slug: string; vendor_name: string; status: string; viewed_at: number | null; forwarded_at: number | null; respond_url: string };
type BrokerRfp = { rfp_id: string; title: string; owner_email: string | null; sector: string | null; response_deadline: number | null; updated: number; suppliers: BrokerSupplier[] };

function when(ms: number): string {
  return new Date(ms).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AdminClient() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /* The board rewrite panel (Robert's ruling, 28 Jul 2026). */
  const [oppEditing, setOppEditing] = useState<string | null>(null);
  const [oppTitle, setOppTitle] = useState("");
  const [oppSector, setOppSector] = useState("");
  const [oppRegions, setOppRegions] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [newBlock, setNewBlock] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");

  useEffect(() => { fetch("/sase/api/auth/session").then((r) => r.json()).then(setSession).catch(() => setSession({ authenticated: false })); }, []);

  const load = useCallback(async () => {
    setError(null);
    const r = await fetch("/sase/api/admin");
    if (r.status === 401 || r.status === 403) { setData(null); return; }
    if (!r.ok) { setError("Could not load admin data."); return; }
    const d = (await r.json()) as Overview;
    setData(d);
    setEdits(Object.fromEntries(d.vendors.map((v) => [v.slug, v.domains.join(", ")])));
  }, []);

  useEffect(() => { if (session?.authenticated && session.admin) load(); }, [session, load]);

  async function act(payload: Record<string, unknown>) {
    setBusy(true); setError(null); setNotice(null);
    try {
      const r = await fetch("/sase/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok) throw new Error(typeof d.error === "string" ? d.error : "Action failed.");
      if (payload.action === "delete_user") {
        setNotice(`Deleted ${String(payload.email)}. Sessions revoked: ${Number(d.sessions_deleted ?? 0)}, RFPs deleted: ${Number(d.rfps_deleted ?? 0)}, board opportunities deleted: ${Number(d.opportunities_deleted ?? 0)}.`);
      }
      if (payload.action === "recover_unlisted") {
        const results = Array.isArray(d.results) ? (d.results as Array<{ state?: string }>) : [];
        const listed = results.filter((r) => r.state === "published").length;
        setNotice(`Recovery batch: ${listed} listed, ${results.length - listed} saved unpublished, ${Number(d.remaining ?? 0)} still to process of ${Number(d.unlisted_total ?? 0)} unlisted.`);
      }
      if (payload.action === "backfill_notice_shapes") {
        setNotice(`Shape backfill: ${Number(d.processed_now ?? 0)} processed, ${Number(d.remaining ?? 0)} still to process of ${Number(d.missing_total ?? 0)} missing a shape.`);
      }
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Action failed."); }
    finally { setBusy(false); }
  }

  if (session && (!session.authenticated || !session.admin)) {
    return (
      <div className="space-y-4">
        {session.authenticated && !session.admin && (
          <p className="text-sm text-red-700">Signed in as {session.email}, which is not an admin account.</p>
        )}
        <SignIn role="buyer" prompt="Sign in with your Netify admin email to manage the marketplace." />
      </div>
    );
  }

  if (!session || !data) return <p className="text-sm text-[var(--ink-600)]">Loading admin console...</p>;

  const card = "rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5";
  const h2 = "text-xl font-semibold mb-1";
  const sub = "text-sm text-[var(--ink-600)] mb-4";
  const btn = "px-3 py-1.5 text-sm rounded-full border border-[var(--ink-300,#ccc)] hover:bg-[var(--ink-100,#f5f5f5)] transition-colors disabled:opacity-50";
  const btnAmber = "px-3 py-1.5 text-sm rounded-full bg-amber-500 text-zinc-950 font-medium hover:bg-amber-400 transition-colors disabled:opacity-50";

  const vendors = data.vendors.filter((v) => v.slug.includes(vendorFilter.trim().toLowerCase()));

  return (
    <div className="space-y-8">
      <p className="text-sm text-[var(--ink-600)]">Signed in as <strong>{data.admin_email}</strong>. <button onClick={load} className="underline" disabled={busy}>Refresh</button></p>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {notice && <p className="text-sm text-emerald-700">{notice}</p>}

      {/* Brokering queue: until suppliers register, the team delivers the
          private response links. Copy, send, mark forwarded. */}
      {(data.broker_queue ?? []).length > 0 && (
        <section className={card}>
          <h2 className={h2}>Brokering queue</h2>
          <p className={sub}>Every published RFP with its response links. Copy the link, send it to the vendor contact, then mark it forwarded so the team can see delivery state at a glance.</p>
          <div className="space-y-4">
            {(data.broker_queue ?? []).map((b) => (
              <div key={b.rfp_id} className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-3">
                <p className="text-sm font-medium">
                  {b.title} <span className="text-[var(--ink-500)] font-normal">· {b.owner_email ?? "anonymous"}{b.sector ? ` · ${b.sector}` : ""}{b.response_deadline ? ` · closes ${when(b.response_deadline)}` : ""}</span>
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {b.suppliers.map((s) => (
                    <li key={s.vendor_slug} className="flex flex-wrap items-center gap-2">
                      <span className="min-w-40">{s.vendor_name}</span>
                      <span className="text-xs uppercase tracking-wide text-[var(--ink-500)]">{s.forwarded_at ? "forwarded" : "not forwarded"}{s.viewed_at ? " · viewed" : ""} · {s.status}</span>
                      <button className={btn} onClick={() => { navigator.clipboard.writeText(s.respond_url).catch(() => {}); setNotice(`Link copied for ${s.vendor_name}.`); }}>Copy link</button>
                      {!s.forwarded_at && <button className={btnAmber} disabled={busy} onClick={() => act({ action: "mark_forwarded", rfp_id: b.rfp_id, vendor_slug: s.vendor_slug })}>Mark forwarded</button>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Harry's list (Robert's ruling, 29 Jul 2026): every publish outcome,
          published or saved-unpublished, with contact, derived company,
          verification evidence and requirement depth. The recover button
          works through historic publishes that never reached the board, in
          small batches, through the same chain as a fresh publish. */}
      <section className={card}>
        <h2 className={h2}>Publish leads</h2>
        <p className={sub}>Every notice published or saved unpublished, with the buyer contact, the derived company, the verification evidence and the requirement depth. Nothing here is public. Recovery lists historic publishes that never reached the board where a business email verifies; the rest land here as saved unpublished with the reason.</p>
        <div className="flex flex-wrap gap-2">
          <button className={btnAmber} disabled={busy} onClick={() => act({ action: "recover_unlisted", limit: 5 })}>Recover unlisted publishes (batch of 5)</button>
          {/* Harry's N2 retest (29 Jul 2026): historic notices predate the
              rfp_shape stamp, so their What-suppliers-answer section was
              absent. This works through them in batches. */}
          <button className={btn} disabled={busy} onClick={() => act({ action: "backfill_notice_shapes", limit: 10 })}>Backfill notice shapes (batch of 10)</button>
        </div>
        {(data.publish_leads ?? []).length > 0 && (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[var(--ink-500)] border-b border-[var(--ink-200,#e5e5e5)]">
                <th className="py-2 pr-4">State</th><th className="py-2 pr-4">Requirement</th><th className="py-2 pr-4">Contact</th><th className="py-2 pr-4">Derived company</th><th className="py-2 pr-4">Evidence</th><th className="py-2 pr-4">Depth</th><th className="py-2 pr-4">When</th>
              </tr></thead>
              <tbody>
                {(data.publish_leads ?? []).slice(0, 60).map((l) => {
                  const v = l.verification;
                  const ch = v?.companies_house && typeof v.companies_house === "object" && "company_number" in v.companies_house
                    ? `CH ${String((v.companies_house as Record<string, unknown>).company_number)}`
                    : null;
                  const evidence = v
                    ? [v.mx ? `MX ${v.mx.pass ? "pass" : "fail"}` : null, v.website ? `web ${v.website.pass ? "pass" : "fail"}` : null, ch].filter(Boolean).join(" · ")
                    : "none";
                  return (
                    <tr key={`${l.rfp_id}-${l.at}`} className="border-b border-[var(--ink-100,#f0f0f0)] align-top">
                      <td className="py-2 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${l.state === "published" ? "bg-[var(--ink-100,#f0f0f0)] text-[var(--ink-700)]" : "bg-amber-50 text-amber-800"}`}>
                          {l.state === "published" ? "Published" : "Saved unpublished"}
                        </span>
                        {l.reason && <p className="mt-1 text-xs text-[var(--ink-500)] max-w-56">{l.reason}</p>}
                      </td>
                      <td className="py-2 pr-4">
                        <a href={`/sase/rfp-builder/${l.rfp_id}/`} className="underline" target="_blank" rel="noreferrer">{l.title || l.rfp_id}</a>
                        {l.board_opportunity_id && (
                          <a href={`/sase/opportunities/${l.board_opportunity_id}/`} className="ml-2 text-xs underline" target="_blank" rel="noreferrer">notice</a>
                        )}
                      </td>
                      <td className="py-2 pr-4">{l.email || "none"}</td>
                      <td className="py-2 pr-4">{v?.derived_company ?? ""}</td>
                      <td className="py-2 pr-4 text-xs text-[var(--ink-600)]">{evidence}</td>
                      <td className="py-2 pr-4 text-xs">{l.requirement_depth ? `${l.requirement_depth.questions}q / ${l.requirement_depth.sections}s` : ""}</td>
                      <td className="py-2 pr-4 text-xs">{when(l.at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Buyer funnel: the four stages that matter */}
      {data.funnel && (
        <section className={card}>
          <h2 className={h2}>Buyer funnel</h2>
          <p className={sub}>Sign up, create an RFP, publish to the marketplace, get vendor responses. Everything below feeds one of these four numbers.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
            {([
              ["Buyer accounts", data.funnel.buyer_accounts],
              ["Accounts with an RFP", data.funnel.accounts_with_rfp],
              ["RFPs published", data.funnel.rfps_published],
              ["Vendor responses", data.funnel.supplier_responses],
            ] as const).map(([label, value]) => (
              <div key={label} className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-3 text-center">
                <div className="text-2xl font-semibold">{value}</div>
                <div className="text-xs text-[var(--ink-500)]">{label}</div>
              </div>
            ))}
          </div>
          <p className={sub}>
            {data.funnel.rfps_total} RFPs stored in total: {data.funnel.rfps_account_owned} owned by accounts, {data.funnel.rfps_anonymous} anonymous drafts with no account attached.{" "}
            {data.funnel.draft_link_captures} draft-link email capture{data.funnel.draft_link_captures === 1 ? "" : "s"} (buyers who typed an email to save a draft, one stage before sign-up).
          </p>
          {(data.rfps ?? []).length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[var(--ink-500)] border-b border-[var(--ink-200,#e5e5e5)]">
                  <th className="py-2 pr-4">RFP</th><th className="py-2 pr-4">Who</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Questions</th><th className="py-2 pr-4">Invited</th><th className="py-2 pr-4">Responses</th><th className="py-2 pr-4">Updated</th>
                </tr></thead>
                <tbody>
                  {(data.rfps ?? []).slice(0, 60).map((r) => (
                    <tr key={r.id} className="border-b border-[var(--ink-100,#f0f0f0)]">
                      <td className="py-2 pr-4">
                        <a href={`/sase/rfp-builder/${r.id}/`} className="underline" target="_blank" rel="noreferrer">{r.title || r.id}</a>
                        {r.organisation && <span className="ml-2 text-xs text-[var(--ink-500)]">{r.organisation}</span>}
                      </td>
                      <td className="py-2 pr-4 text-[var(--ink-500)]">
                        {r.owner_email ?? (r.contact_email ? `${r.contact_email} (capture)` : "anonymous")}
                      </td>
                      <td className="py-2 pr-4">{r.status}</td>
                      <td className="py-2 pr-4">{r.questions}<span className="text-[var(--ink-500)]"> in {r.sections}</span></td>
                      <td className="py-2 pr-4">{r.invited_vendors}</td>
                      <td className="py-2 pr-4">{r.responses}</td>
                      <td className="py-2 pr-4 text-[var(--ink-500)]">{when(r.updated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data.rfps ?? []).length > 60 && <p className="mt-2 text-xs text-[var(--ink-500)]">Showing the 60 most recently updated of {(data.rfps ?? []).length}.</p>}
            </div>
          )}
          {(data.draft_link_leads ?? []).length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold mb-1">Draft-link email captures</h3>
              <div className="flex flex-wrap gap-2">
                {(data.draft_link_leads ?? []).map((l, i) => (
                  <span key={`${l.rfp_id}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-[var(--ink-300,#ccc)] px-3 py-1 text-xs">
                    {l.email} · {when(l.ts)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Pending access requests */}
      <section className={card}>
        <h2 className={h2}>Pending access requests</h2>
        <p className={sub}>Business domains that tried vendor sign-in but are not yet mapped to a vendor. Approve to add the domain to a vendor, or reject (optionally blocking it).</p>
        {data.pending.length === 0 ? (
          <p className="text-sm text-[var(--ink-500)]">No pending requests.</p>
        ) : (
          <div className="space-y-3">
            {data.pending.map((p) => (
              <PendingRow key={p.domain} p={p} vendors={data.vendors} busy={busy} act={act} when={when} btn={btn} btnAmber={btnAmber} />
            ))}
          </div>
        )}
      </section>

      {/* Profile claims */}
      <section className={card}>
        <h2 className={h2}>Profile claims</h2>
        <p className={sub}>Companies claiming ownership of their own profile. Approve to let that company bid, quote and respond as the vendor; reject to revoke. Netify staff can act for any vendor regardless of claim status.</p>
        {data.claims.length === 0 ? (
          <p className="text-sm text-[var(--ink-500)]">No profile claims yet.</p>
        ) : (
          <div className="space-y-3">
            {data.claims.map((c) => (
              <div key={c.slug} className="flex flex-wrap items-center gap-2 border-b border-[var(--ink-100,#f0f0f0)] pb-3">
                <span className="text-sm">
                  <strong>{c.slug}</strong>{" "}
                  <span className={c.status === "approved" ? "text-emerald-700" : c.status === "pending" ? "text-amber-700" : "text-red-700"}>{c.status}</span>{" "}
                  <span className="text-[var(--ink-500)]">({c.email}, {c.domain}, {when(c.requested)})</span>
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  {c.status !== "approved" && <button className={btnAmber} disabled={busy} onClick={() => act({ action: "approve_claim", slug: c.slug })}>Approve</button>}
                  {c.status !== "rejected" && <button className={btn} disabled={busy} onClick={() => act({ action: "reject_claim", slug: c.slug })}>Reject</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Opportunity board moderation */}
      <section className={card}>
        <h2 className={h2}>Opportunity board ({(data.opportunities ?? []).length})</h2>
        <p className={sub}>Every notice, including closed and unlisted ones. Close ends an open notice cleanly: it leaves the live board and joins the closed archive, page and record intact (test posts, stale needs). Remove permanently deletes: the public page 404s and vendor room links stop working. Use Remove only when something inappropriate or commercially sensitive was posted by mistake.</p>
        {(data.opportunities ?? []).length === 0 ? (
          <p className="text-sm text-[var(--ink-500)]">No opportunities posted yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[var(--ink-500)] border-b border-[var(--ink-200,#e5e5e5)]">
                <th className="py-2 pr-4">Title</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Posted by</th><th className="py-2 pr-4">Bids</th><th className="py-2 pr-4">Created</th><th className="py-2"></th>
              </tr></thead>
              <tbody>
                {(data.opportunities ?? []).map((o) => (
                  <tr key={o.id} className="border-b border-[var(--ink-100,#f0f0f0)]">
                    <td className="py-2 pr-4">
                      <a href={`/sase/opportunities/${o.id}/`} className="underline" target="_blank" rel="noreferrer">{o.title || o.id}</a>
                      {o.source_rfp_id && <span className="ml-2 rounded-full bg-[var(--ink-100,#f0f0f0)] px-2 py-0.5 text-xs">from RFP</span>}
                    </td>
                    <td className="py-2 pr-4">{o.status}{o.visibility !== "public" && <span className="text-[var(--ink-500)]"> · {o.visibility}</span>}</td>
                    <td className="py-2 pr-4 text-[var(--ink-500)]">{o.owner_email || o.buyer_org || "anonymous"}</td>
                    <td className="py-2 pr-4">{o.bid_count}</td>
                    <td className="py-2 pr-4 text-[var(--ink-500)]">{when(o.created)}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <button
                          className={btn}
                          disabled={busy}
                          onClick={() => {
                            if (oppEditing === o.id) { setOppEditing(null); return; }
                            setOppEditing(o.id); setOppTitle(o.title || ""); setOppSector(""); setOppRegions("");
                          }}
                        >{oppEditing === o.id ? "Cancel" : "Edit"}</button>
                        {o.status === "open" && (
                          <button
                            className={btn}
                            disabled={busy}
                            onClick={() => act({ action: "close_opportunity", id: o.id })}
                          >Close</button>
                        )}
                        <button
                          className={btn}
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm(`Permanently remove "${o.title || o.id}" from the board? This cannot be undone.`)) {
                              act({ action: "delete_opportunity", id: o.id });
                            }
                          }}
                        >Remove</button>
                      </div>
                      {/* The rewrite panel (Robert's ruling, 28 Jul 2026: board
                          records read as credible generic notices). Empty
                          fields keep their current values; sector accepts a
                          key or a label and stores the slug. */}
                      {oppEditing === o.id && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-sm border border-[var(--ink-200,#e5e5e5)] bg-[var(--ink-50,#fafafa)] p-2">
                          <input value={oppTitle} onChange={(e) => setOppTitle(e.target.value)} placeholder="Title" className="min-w-64 flex-1 rounded-sm border border-[var(--ink-300,#ccc)] p-1.5 text-xs" />
                          <input value={oppSector} onChange={(e) => setOppSector(e.target.value)} placeholder="Sector key or label (empty keeps)" className="w-56 rounded-sm border border-[var(--ink-300,#ccc)] p-1.5 text-xs" />
                          <input value={oppRegions} onChange={(e) => setOppRegions(e.target.value)} placeholder="Region keys, comma separated (empty keeps)" className="w-64 rounded-sm border border-[var(--ink-300,#ccc)] p-1.5 text-xs" />
                          <button
                            className={btn}
                            disabled={busy}
                            onClick={async () => {
                              const regions = oppRegions.split(",").map((s) => s.trim()).filter(Boolean);
                              await act({
                                action: "edit_opportunity",
                                id: o.id,
                                ...(oppTitle.trim() && oppTitle.trim() !== o.title ? { title: oppTitle.trim() } : {}),
                                ...(oppSector.trim() ? { buyer_sector: oppSector.trim() } : {}),
                                ...(regions.length ? { regions } : {}),
                              });
                              setOppEditing(null);
                            }}
                          >Save</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Active sessions */}
      <section className={card}>
        <h2 className={h2}>Active sessions ({data.sessions.length})</h2>
        <p className={sub}>Everyone currently signed in. Revoke to sign a user out immediately.</p>
        {data.sessions.length === 0 ? (
          <p className="text-sm text-[var(--ink-500)]">No active sessions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[var(--ink-500)] border-b border-[var(--ink-200,#e5e5e5)]">
                <th className="py-2 pr-4">Email</th><th className="py-2 pr-4">Role</th><th className="py-2 pr-4">Vendor</th><th className="py-2 pr-4">Since</th><th className="py-2"></th>
              </tr></thead>
              <tbody>
                {data.sessions.map((s) => (
                  <tr key={s.token} className="border-b border-[var(--ink-100,#f0f0f0)]">
                    <td className="py-2 pr-4">{s.email}</td>
                    <td className="py-2 pr-4">{s.role}</td>
                    <td className="py-2 pr-4">{s.vendor_slug ?? "-"}</td>
                    <td className="py-2 pr-4 text-[var(--ink-500)]">{when(s.created)}</td>
                    <td className="py-2"><button className={btn} disabled={busy} onClick={() => act({ action: "revoke_session", token: s.token })}>Revoke</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Registered users */}
      <section className={card}>
        <h2 className={h2}>Registered users ({(data.users ?? []).length})</h2>
        <p className={sub}>Everyone who has completed a first sign-in. Deleting an account removes the sign-up record and revokes its sessions, so the same email can sign up again as a brand-new user. Tick the box to also erase their RFPs and board opportunities. Admin rights come from the admin email list, so deleting an admin account does not remove admin access.</p>
        {(data.users ?? []).length === 0 ? (
          <p className="text-sm text-[var(--ink-500)]">No registered users yet.</p>
        ) : (
          <div className="space-y-3">
            {(data.users ?? []).map((u) => (
              <UserAccountRow key={u.email} u={u} busy={busy} act={act} btn={btn} btnAmber={btnAmber} />
            ))}
          </div>
        )}
      </section>

      {/* Vendor domains */}
      <section className={card}>
        <h2 className={h2}>Vendor email domains</h2>
        <p className={sub}>Who can sign in as each vendor. Comma separated. Changes take effect immediately, no redeploy. A customised vendor is marked.</p>
        <input value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} placeholder="Filter vendors..." className="border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm mb-4 w-full max-w-xs" />
        <div className="space-y-2">
          {vendors.map((v) => (
            <div key={v.slug} className="flex flex-wrap items-center gap-2">
              <span className="w-56 shrink-0 text-sm font-medium">{v.slug}{v.customised && <span className="ml-2 text-xs text-amber-600">customised</span>}</span>
              <input
                value={edits[v.slug] ?? ""}
                onChange={(e) => setEdits((p) => ({ ...p, [v.slug]: e.target.value }))}
                className="flex-1 min-w-[16rem] border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm"
              />
              <button className={btnAmber} disabled={busy} onClick={() => act({ action: "set_vendor_domains", slug: v.slug, domains: (edits[v.slug] ?? "").split(",").map((d) => d.trim()).filter(Boolean) })}>Save</button>
            </div>
          ))}
        </div>
      </section>

      {/* Blocklist */}
      <section className={card}>
        <h2 className={h2}>Blocked email domains</h2>
        <p className={sub}>{data.blocklist.builtin_count} free and disposable domains are blocked by default (gmail, hotmail, yahoo and similar). Add your own below. These apply to every sign-in.</p>
        <div className="flex gap-2 mb-4 max-w-md">
          <input value={newBlock} onChange={(e) => setNewBlock(e.target.value)} placeholder="domain.com" className="flex-1 border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm" />
          <button className={btnAmber} disabled={busy || !newBlock.trim()} onClick={() => { act({ action: "add_blocklist", domain: newBlock.trim() }); setNewBlock(""); }}>Block</button>
        </div>
        {data.blocklist.custom.length === 0 ? (
          <p className="text-sm text-[var(--ink-500)]">No custom blocked domains yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.blocklist.custom.map((d) => (
              <span key={d} className="inline-flex items-center gap-2 text-sm border border-[var(--ink-300,#ccc)] rounded-full px-3 py-1">
                {d}<button className="text-[var(--ink-500)] hover:text-red-700" disabled={busy} onClick={() => act({ action: "remove_blocklist", domain: d })}>×</button>
              </span>
            ))}
          </div>
        )}
        {(data.buyer_allowlist ?? []).length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-semibold mb-1">Approved buyer domains (academic review)</p>
            <div className="flex flex-wrap gap-2">
              {(data.buyer_allowlist ?? []).map((d) => (
                <span key={d} className="inline-flex items-center text-sm border border-emerald-300 rounded-full px-3 py-1">{d}</span>
              ))}
            </div>
          </div>
        )}
        {(data.reject_stats?.entries ?? []).length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-semibold mb-1">Auto-rejected sign-ins, {data.reject_stats?.month}</p>
            <p className="text-xs text-[var(--ink-500)] mb-2">Domain counts only; no email addresses are stored, so there is no personal data here.</p>
            <div className="flex flex-wrap gap-2">
              {(data.reject_stats?.entries ?? []).slice(0, 30).map((e) => (
                <span key={`${e.reason}:${e.domain}`} className="inline-flex items-center gap-1 text-sm border border-[var(--ink-300,#ccc)] rounded-full px-3 py-1">
                  {e.domain} <span className="text-[var(--ink-500)]">x{e.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function PendingRow({ p, vendors, busy, act, when, btn, btnAmber }: {
  p: Pending; vendors: VendorRow[]; busy: boolean;
  act: (payload: Record<string, unknown>) => void;
  when: (ms: number) => string; btn: string; btnAmber: string;
}) {
  const [slug, setSlug] = useState(vendors[0]?.slug ?? "");
  const buyer = p.role === "buyer";
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--ink-100,#f0f0f0)] pb-3">
      <span className="text-sm">
        <strong>{p.domain}</strong>{" "}
        {buyer && <span className="rounded-full bg-[var(--ink-100,#f0f0f0)] px-2 py-0.5 text-xs">buyer, academic review</span>}{" "}
        <span className="text-[var(--ink-500)]">({p.email}, {p.count}x, {when(p.created)})</span>
      </span>
      <div className="flex items-center gap-2 ml-auto">
        {buyer ? (
          <button className={btnAmber} disabled={busy} onClick={() => act({ action: "approve_pending_buyer", domain: p.domain })}>Approve buyer domain</button>
        ) : (
          <>
            <select value={slug} onChange={(e) => setSlug(e.target.value)} className="border border-[var(--ink-300,#ccc)] rounded-sm p-1.5 text-sm">
              {vendors.map((v) => <option key={v.slug} value={v.slug}>{v.slug}</option>)}
            </select>
            <button className={btnAmber} disabled={busy || !slug} onClick={() => act({ action: "approve_pending", domain: p.domain, slug })}>Approve</button>
          </>
        )}
        <button className={btn} disabled={busy} onClick={() => act({ action: "reject_pending", domain: p.domain })}>Reject</button>
        <button className={btn} disabled={busy} onClick={() => act({ action: "reject_pending", domain: p.domain, block: true })}>Reject + block</button>
      </div>
    </div>
  );
}

function UserAccountRow({ u, busy, act, btn, btnAmber }: {
  u: UserRow; busy: boolean;
  act: (payload: Record<string, unknown>) => void;
  btn: string; btnAmber: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [withRfps, setWithRfps] = useState(false);
  const ready = confirmText.trim().toLowerCase() === u.email.toLowerCase();
  return (
    <div className="border-b border-[var(--ink-100,#f0f0f0)] pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">
          <strong>{u.email}</strong>{" "}
          <span className="text-[var(--ink-500)]">({u.roles.join(", ")} · {u.sessions} active session{u.sessions === 1 ? "" : "s"})</span>
        </span>
        {!open && (
          <div className="flex items-center gap-2 ml-auto">
            <button className={btn} disabled={busy} onClick={() => { setOpen(true); setConfirmText(""); setWithRfps(false); }}>Delete account…</button>
          </div>
        )}
      </div>
      {open && (
        <div className="mt-3 max-w-xl space-y-3 rounded-sm border border-red-300 p-3">
          <p className="text-sm text-red-700">This deletes the account record for <strong>{u.email}</strong> and signs it out everywhere. It cannot be undone. Type the email to confirm.</p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type the email to confirm"
            className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={withRfps} onChange={(e) => setWithRfps(e.target.checked)} />
            Also delete their RFPs and board opportunities
          </label>
          <div className="flex items-center gap-2">
            <button
              className={btnAmber}
              disabled={busy || !ready}
              onClick={() => { act({ action: "delete_user", email: u.email, confirm: confirmText.trim(), delete_rfps: withRfps }); setOpen(false); setConfirmText(""); }}
            >Delete</button>
            <button className={btn} disabled={busy} onClick={() => { setOpen(false); setConfirmText(""); setWithRfps(false); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
