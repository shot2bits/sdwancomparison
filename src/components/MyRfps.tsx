"use client";

/**
 * MyRfps: the signed-in buyer's saved RFPs (indexed at creation for buyer
 * sessions). Renders nothing when signed out or empty, so it can sit on the
 * account hub without noise.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

type Rfp = { id: string; title: string; status: string; updated: number };

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  review: "In review",
  published: "Published",
  qa: "Supplier Q&A",
  evaluation: "Evaluation",
};

/** Draft manage tokens the builder saved in this browser (netify_mtok_{id}). */
function localDrafts(): { id: string; manage_token: string }[] {
  const out: { id: string; manage_token: string }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i) ?? "";
      if (!k.startsWith("netify_mtok_")) continue;
      const id = k.slice("netify_mtok_".length);
      const manage_token = localStorage.getItem(k) ?? "";
      if (id && manage_token) out.push({ id, manage_token });
    }
  } catch { /* private mode */ }
  return out.slice(0, 25);
}

export default function MyRfps() {
  const [rfps, setRfps] = useState<Rfp[] | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/sase/api/rfp/mine")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d?.rfps) return;
          setRfps(d.rfps as Rfp[]);
          // Tell listeners (the sidebar Your projects badge) the list moved.
          try { window.dispatchEvent(new Event("netify:rfps-changed")); } catch { /* ignore */ }
        })
        .catch(() => {});
    // Claim any anonymous drafts this browser built before listing, so a
    // buyer who drafted first and signed in later still sees their work here.
    const drafts = localDrafts();
    if (drafts.length > 0) {
      fetch("/sase/api/rfp/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ drafts }) })
        .catch(() => {})
        .then(load);
    } else {
      load();
    }
  }, []);

  // Signed out (or still loading): render nothing, as before.
  if (!rfps) return null;

  // Signed in with an empty account: the launchpad, not an empty room.
  // r.wade@dadesigngroup.com (18 July 2026) signed in from the homepage,
  // landed here, saw a blank page and left. A fresh account must sell the
  // first action and what it pays out.
  if (rfps.length === 0) {
    return (
      <div className="mb-10 rounded-sm border border-amber-300 bg-amber-50 p-5">
        <h2 className="text-xl mb-1">Your account is ready. Here is what it does.</h2>
        <p className="text-sm text-[var(--ink-700)] mb-3 max-w-2xl">
          Describe your project once and Netify assembles a complete SASE or SD-WAN RFP from its question
          bank, in about two minutes. Publishing is free and pays out instantly: an indicative market price
          band for your estate, your document as Word and PDF, and structured responses from your matched
          suppliers, side by side, with pricing private to you. You stay anonymous until you reply, and a
          Netify analyst reviews every published RFP.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/rfp-builder/new" className="inline-flex items-center rounded-full bg-amber-500 px-5 py-2.5 text-sm font-medium text-zinc-950 no-underline hover:bg-amber-400 transition-colors">
            Start your first RFP
          </Link>
          <Link href="/shortlist" className="text-sm underline text-[var(--ink-700)]">
            Not ready? Compare the market first
          </Link>
        </div>
        <p className="mt-2 text-xs text-[var(--ink-600,#555)]">No obligation to award and no sales calls until you reply.</p>
      </div>
    );
  }

  return (
    <div className="mb-10">
      <h2 className="text-xl mb-1">Your RFPs</h2>
      <p className="text-sm text-[var(--ink-600)] mb-3">Saved to your account — open the builder, or preview and download the document.</p>
      <div className="space-y-2">
        {rfps.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-[var(--ink-200,#e5e5e5)] px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.title}</p>
              <p className="text-xs text-[var(--ink-500)]">{STATUS_LABELS[r.status] ?? r.status} · updated {new Date(r.updated).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link href={`/rfp-builder/${r.id}/preview`} className="rounded-full border border-[var(--ink-300,#ccc)] px-3 py-1 text-xs no-underline text-[var(--ink-800)] hover:border-[var(--ink-900)]">Preview</Link>
              <Link href={`/project/${r.id}`} className="rounded-full bg-amber-500 px-3 py-1 text-xs font-medium text-zinc-950 no-underline hover:bg-amber-400">Open project</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
