"use client";

/**
 * Request approval before publishing (D5): name, role, business email,
 * one consented email. Optional, never mandatory. The consent wording
 * shown here is exactly what the ledger records (Article 13): it comes
 * from the same pure helper the server uses.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestApprovalConsentText } from "@/lib/project-approvals";

export default function ApprovalRequest({ projectId, manage }: { projectId: string; manage?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const ready = name.trim() && role.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function request() {
    if (!ready || !consent || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/sase/api/rfp/${projectId}/signoff`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ manage_token: manage ?? "", name: name.trim(), role: role.trim(), email: email.trim(), consent: true }),
      });
      const data = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) setError(data.error ?? `Could not request approval (${res.status}).`);
      else {
        setDone(role.trim());
        setOpen(false);
        router.refresh();
      }
    } catch {
      setError("Could not reach the server; try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <p className="m-0 mt-2 text-xs text-emerald-700">Approval requested from your {done}; their decision will appear here.</p>;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 text-sm underline text-[var(--ink-700)] hover:text-[var(--ink-900,#111)]">
        Request approval before publishing
      </button>
    );
  }

  const inputCls = "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-amber-500 focus:outline-none";
  return (
    <div className="mt-3 rounded-sm border border-[var(--ink-200,#e5e5e5)] p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs font-medium text-zinc-600">Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam Patel" className={inputCls} />
        </label>
        <label className="text-xs font-medium text-zinc-600">Role
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. CISO, Legal" className={inputCls} />
        </label>
        <label className="text-xs font-medium text-zinc-600">Business email
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className={inputCls} />
        </label>
      </div>
      {ready && (
        <label className="mt-2 flex items-start gap-2 text-xs text-zinc-700">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
          <span>{requestApprovalConsentText(role.trim(), email.trim())}</span>
        </label>
      )}
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      <div className="mt-2 flex gap-3">
        <button onClick={request} disabled={!ready || !consent || busy} className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-medium text-zinc-950 hover:bg-amber-400 transition-colors disabled:opacity-50">
          {busy ? "Sending…" : "Send the request"}
        </button>
        <button onClick={() => setOpen(false)} className="text-xs underline text-[var(--ink-600)]">Cancel</button>
      </div>
    </div>
  );
}
