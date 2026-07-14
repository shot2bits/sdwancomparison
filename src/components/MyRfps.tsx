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
        .then((d) => { if (d?.rfps) setRfps(d.rfps as Rfp[]); })
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

  if (!rfps || rfps.length === 0) return null;

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
              <Link href={`/rfp-builder/${r.id}`} className="rounded-full bg-amber-500 px-3 py-1 text-xs font-medium text-zinc-950 no-underline hover:bg-amber-400">Open builder</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
