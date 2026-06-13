"use client";

import { useCallback, useEffect, useState } from "react";
import SignIn from "@/components/SignIn";

type SessionInfo = { authenticated: boolean; role?: string; email?: string; admin?: boolean };
type AdminSession = { token: string; role: string; email: string; vendor_slug: string | null; created: number; expires: number };
type VendorRow = { slug: string; domains: string[]; customised: boolean };
type Pending = { domain: string; email: string; created: number; count: number };
type Overview = {
  admin_email: string;
  sessions: AdminSession[];
  vendors: VendorRow[];
  blocklist: { builtin_count: number; custom: string[] };
  pending: Pending[];
};

function when(ms: number): string {
  return new Date(ms).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AdminClient() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [newBlock, setNewBlock] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");

  useEffect(() => { fetch("/api/auth/session").then((r) => r.json()).then(setSession).catch(() => setSession({ authenticated: false })); }, []);

  const load = useCallback(async () => {
    setError(null);
    const r = await fetch("/api/admin");
    if (r.status === 401 || r.status === 403) { setData(null); return; }
    if (!r.ok) { setError("Could not load admin data."); return; }
    const d = (await r.json()) as Overview;
    setData(d);
    setEdits(Object.fromEntries(d.vendors.map((v) => [v.slug, v.domains.join(", ")])));
  }, []);

  useEffect(() => { if (session?.authenticated && session.admin) load(); }, [session, load]);

  async function act(payload: Record<string, unknown>) {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? "Action failed."); }
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

      {/* Pending access requests */}
      <section className={card}>
        <h2 className={h2}>Pending access requests</h2>
        <p className={sub}>Business domains that tried supplier sign-in but are not yet mapped to a vendor. Approve to add the domain to a vendor, or reject (optionally blocking it).</p>
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

      {/* Vendor domains */}
      <section className={card}>
        <h2 className={h2}>Supplier email domains</h2>
        <p className={sub}>Who can sign in as each supplier. Comma separated. Changes take effect immediately, no redeploy. A customised vendor is marked.</p>
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
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--ink-100,#f0f0f0)] pb-3">
      <span className="text-sm"><strong>{p.domain}</strong> <span className="text-[var(--ink-500)]">({p.email}, {p.count}x, {when(p.created)})</span></span>
      <div className="flex items-center gap-2 ml-auto">
        <select value={slug} onChange={(e) => setSlug(e.target.value)} className="border border-[var(--ink-300,#ccc)] rounded-sm p-1.5 text-sm">
          {vendors.map((v) => <option key={v.slug} value={v.slug}>{v.slug}</option>)}
        </select>
        <button className={btnAmber} disabled={busy || !slug} onClick={() => act({ action: "approve_pending", domain: p.domain, slug })}>Approve</button>
        <button className={btn} disabled={busy} onClick={() => act({ action: "reject_pending", domain: p.domain })}>Reject</button>
        <button className={btn} disabled={busy} onClick={() => act({ action: "reject_pending", domain: p.domain, block: true })}>Reject + block</button>
      </div>
    </div>
  );
}
