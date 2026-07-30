"use client";

import { useEffect, useState } from "react";

type DigestItem = { kind: string; severity: string; message: string; recommendation: string };
type Digest = { id: string; rfp_id: string; rfp_title: string; created: number; summary: string; items: DigestItem[]; proposal_ids: string[] };

export default function BuyerDigests() {
  const [digests, setDigests] = useState<Digest[] | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/sase/api/buyer/digests");
      if (res.status === 401) { setNeedsAuth(true); return; }
      const d = await res.json();
      setDigests(d.digests ?? []);
    })().catch(() => setDigests([]));
  }, []);

  if (needsAuth) return null; // memory panel already prompts sign-in
  if (digests === null) return <p className="text-sm text-[var(--ink-500)]">Loading digests…</p>;
  if (digests.length === 0) return (
    <div className="rounded-md border border-[var(--ink-200,#e5e5e5)] p-5">
      <p className="text-sm text-[var(--ink-600)]">No agent digests yet. When you have a live RFP with a goal, the agent reviews it on a schedule and posts a digest of risks and recommended next actions here. It never contacts a vendor without your approval.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {digests.map((d) => (
        <div key={d.id} className="rounded-md border border-[var(--ink-200,#e5e5e5)] p-4">
          <div className="flex items-center justify-between mb-1">
            <a href={`/sase/rfp-builder/${d.rfp_id}/review`} className="font-medium underline">{d.rfp_title || d.rfp_id}</a>
            <span className="text-xs text-[var(--ink-500)]">{new Date(d.created).toLocaleString("en-GB")}</span>
          </div>
          <p className="text-sm text-[var(--ink-700)] mb-2">{d.summary}</p>
          <ul className="space-y-1">
            {d.items.map((it, i) => (
              <li key={i} className={`text-sm border-l-2 pl-3 ${it.severity === "high" ? "border-red-500" : it.severity === "warn" ? "border-amber-500" : "border-[var(--ink-300,#ccc)]"}`}>{it.message}{it.recommendation ? ` — ${it.recommendation}` : ""}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
