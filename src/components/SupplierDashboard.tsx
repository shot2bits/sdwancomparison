"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import SignIn from "@/components/SignIn";
import { OPP_SCOPE_LABELS, type OppScope } from "@/lib/opportunity-types";

type Session = { authenticated: boolean; role?: string; email?: string; vendor_slug?: string | null; admin?: boolean };
type Opp = { id: string; title: string; scope: string[]; regions: string[]; sites: number | null; engagement_type: string; auction_format: string; eligibility: string; bid_count: number; room_token: string };

function vendorTitle(slug: string): string {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export default function SupplierDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<{ invited: Opp[]; open: Opp[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claim, setClaim] = useState<{ status: string; vendor_slug: string | null } | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => { fetch("/sase/api/auth/session").then((r) => r.json()).then(setSession).catch(() => setSession({ authenticated: false })); }, []);

  const load = useCallback(async () => {
    const r = await fetch("/sase/api/supplier/opportunities");
    if (!r.ok) { if (r.status !== 401 && r.status !== 403) setError("Could not load opportunities."); return; }
    const d = await r.json();
    setData({ invited: d.invited ?? [], open: d.open ?? [] });
  }, []);

  useEffect(() => {
    if (session?.authenticated && session.role !== "buyer") {
      load();
      fetch("/sase/api/supplier/claim").then((r) => r.json()).then((d) => setClaim({ status: d.status, vendor_slug: d.vendor_slug })).catch(() => {});
    }
  }, [session, load]);

  async function claimProfile() {
    setClaiming(true); setError(null);
    try {
      const r = await fetch("/sase/api/supplier/claim", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Could not submit claim.");
      setClaim({ status: d.status, vendor_slug: d.vendor_slug ?? session?.vendor_slug ?? null });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not submit claim."); }
    finally { setClaiming(false); }
  }

  if (session && (!session.authenticated || session.role === "buyer")) {
    return (
      <div className="space-y-4 max-w-md">
        {session.authenticated && session.role === "buyer" && <p className="text-sm text-red-700">You are signed in as a buyer. Use a vendor work email to access the vendor dashboard.</p>}
        <SignIn role="supplier" prompt="Sign in with your work email to see opportunities you can bid on. We verify your domain against the listed vendor." />
      </div>
    );
  }
  if (!session) return <p className="text-sm text-[var(--ink-600)]">Loading...</p>;

  const slug = session.vendor_slug;
  const card = "rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5";

  const OppCard = ({ o, invited }: { o: Opp; invited: boolean }) => (
    <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4">
      <div className="flex items-center gap-2 mb-1 text-xs">
        <span className="rounded-full bg-[var(--ink-100,#f0f0f0)] px-2 py-0.5 font-medium uppercase tracking-wide text-[var(--ink-600)]">{o.engagement_type === "auction" ? (o.auction_format === "timed" ? "Timed auction" : "Auction") : "Quote room"}</span>
        {invited ? <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">Invited</span> : <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">Open to bid</span>}
      </div>
      <p className="font-medium leading-snug mb-1">{o.title}</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {o.scope.map((s) => <span key={s} className="rounded-full border border-[var(--ink-200,#e5e5e5)] px-2 py-0.5 text-xs text-[var(--ink-700)]">{OPP_SCOPE_LABELS[s as OppScope] ?? s}</span>)}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--ink-500)]">{o.regions.join(", ").toUpperCase()}{o.sites != null ? ` · ${o.sites} sites` : ""} · {o.bid_count} bids</span>
        <Link href={`/opportunities/supplier/${o.room_token}`} className="rounded-full bg-amber-500 px-3 py-1 text-xs font-medium text-zinc-950 no-underline hover:bg-amber-400 transition-colors">Open and bid</Link>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className={card}>
        <p className="eyebrow mb-1">Signed in as</p>
        <p className="text-lg font-semibold">{slug ? vendorTitle(slug) : "Netify (relay)"}</p>
        <p className="text-sm text-[var(--ink-600)]">{session.email}{session.admin ? " · admin" : ""}</p>
        {slug && <Link href={`/vendors/${slug}`} className="inline-block mt-3 text-sm underline">View your public profile</Link>}

        {/* Profile claim status */}
        {session.role === "netify" ? (
          <p className="mt-4 text-sm rounded-sm bg-[var(--ink-100,#f0f0f0)] px-3 py-2 text-[var(--ink-700)]">Netify staff: you can act on behalf of any vendor. No claim needed.</p>
        ) : slug && claim ? (
          claim.status === "approved" ? (
            <p className="mt-4 text-sm rounded-sm bg-emerald-50 px-3 py-2 text-emerald-800">✓ Profile claimed and verified. You can bid, quote and respond as {vendorTitle(slug)}.</p>
          ) : claim.status === "pending" ? (
            <p className="mt-4 text-sm rounded-sm bg-amber-50 px-3 py-2 text-amber-800">Claim submitted, awaiting Netify approval. You can browse opportunities, but you cannot bid or respond until your claim is approved.</p>
          ) : (
            <div className="mt-4 rounded-sm bg-[var(--ink-100,#f0f0f0)] px-3 py-3">
              <p className="text-sm text-[var(--ink-700)] mb-2">{claim.status === "rejected" ? "Your previous claim was declined. You can submit a new claim or contact Netify." : `This profile is not yet claimed. Claim ${vendorTitle(slug)} to bid, quote and respond as your company. Netify verifies and approves claims.`}</p>
              <button onClick={claimProfile} disabled={claiming} className="rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400 transition-colors disabled:opacity-50">{claiming ? "Submitting..." : `Claim this profile`}</button>
            </div>
          )
        ) : null}
      </div>

      {!slug ? (
        <p className="text-sm text-[var(--ink-600)]">You are signed in as Netify staff (relay). Open a specific opportunity via its room link to act on a vendor's behalf.</p>
      ) : !data ? (
        <p className="text-sm text-[var(--ink-600)]">Loading opportunities...</p>
      ) : (
        <>
          <section>
            <h2 className="text-xl font-semibold mb-1">Your invitations</h2>
            <p className="text-sm text-[var(--ink-600)] mb-4">Opportunities a buyer has invited you to.</p>
            {data.invited.length === 0 ? <p className="text-sm text-[var(--ink-500)]">No invitations yet.</p> : (
              <div className="grid gap-3 sm:grid-cols-2">{data.invited.map((o) => <OppCard key={o.id} o={o} invited />)}</div>
            )}
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-1">Open to bid</h2>
            <p className="text-sm text-[var(--ink-600)] mb-4">Open opportunities any matching verified vendor can bid on.</p>
            {data.open.length === 0 ? <p className="text-sm text-[var(--ink-500)]">Nothing open to all vendors right now. See the <Link href="/opportunities/board" className="underline">full board</Link>.</p> : (
              <div className="grid gap-3 sm:grid-cols-2">{data.open.map((o) => <OppCard key={o.id} o={o} invited={false} />)}</div>
            )}
          </section>
        </>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
