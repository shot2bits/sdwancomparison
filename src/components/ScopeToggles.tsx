"use client";

/**
 * Keep-or-exclude chips for conditional capabilities on the requirement
 * page (Robert's approved mockup, 21 July 2026). One click per decision;
 * the change is an ordinary recorded document edit and the page refreshes
 * to show the new question counts. No RFP Builder required.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ScopeItem = { category: string; label: string; included: boolean; reason: string };

export default function ScopeToggles({ projectId, manage, items }: { projectId: string; manage?: string; items: ScopeItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function setIncluded(category: string, included: boolean) {
    if (busy) return;
    setBusy(category);
    setError("");
    try {
      const res = await fetch(`/sase/api/security-sourcing/project/${projectId}/scope`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category, included, ...(manage ? { manage_token: manage } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || "Could not save the change.");
      else router.refresh();
    } catch {
      setError("Network error; try again.");
    } finally {
      setBusy("");
    }
  }

  if (items.length === 0) return null;

  return (
    <section className="mb-6 rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4 print:hidden">
      <p className="eyebrow mb-1">Conditional capabilities, your call</p>
      <p className="m-0 mb-3 text-sm text-[var(--ink-600,#555)]">
        The assessment recommends these but does not require them. Keep or exclude each one here; the requirement updates immediately and the decision is recorded.
      </p>
      <ul className="m-0 list-none space-y-2 p-0">
        {items.map((it) => (
          <li key={it.category} className="rounded-lg border border-[var(--ink-200,#e5e5e5)] p-3">
            <p className="m-0 text-sm font-medium text-[var(--ink-900,#111)]">{it.label}</p>
            <p className="m-0 mt-0.5 text-xs text-[var(--ink-600,#555)]">{it.reason}</p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIncluded(it.category, true)}
                disabled={busy !== "" || it.included}
                className={`rounded-full px-3 py-1 text-xs font-medium ${it.included ? "bg-emerald-100 text-emerald-900" : "border border-[var(--ink-300,#ccc)] text-[var(--ink-700)] hover:bg-[var(--ink-100,#f5f5f5)]"}`}
              >
                {it.included ? "In scope ✓" : "Keep in scope"}
              </button>
              <button
                type="button"
                onClick={() => setIncluded(it.category, false)}
                disabled={busy !== "" || !it.included}
                className={`rounded-full px-3 py-1 text-xs font-medium ${!it.included ? "bg-zinc-200 text-zinc-800" : "border border-[var(--ink-300,#ccc)] text-[var(--ink-700)] hover:bg-[var(--ink-100,#f5f5f5)]"}`}
              >
                {!it.included ? "Excluded" : "Exclude"}
              </button>
              {busy === it.category && <span className="text-xs text-[var(--ink-500)]">Saving…</span>}
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="m-0 mt-2 text-sm text-rose-600">{error}</p>}
    </section>
  );
}
