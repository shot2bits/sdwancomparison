"use client";

/**
 * Shared 6-digit code entry for magic-link sign-in, extracted for the
 * requirement publish rail (21 July 2026). Same behaviour as the builder's
 * inline version: posts the emailed code to /sase/api/auth/verify and calls
 * onVerified on success. defaultEmail optional; when absent the person
 * types the address the code was sent to.
 */

import { useState } from "react";

export default function CodeEntry({ defaultEmail = "", onVerified }: { defaultEmail?: string; onVerified: () => void }) {
  const [addr, setAddr] = useState(defaultEmail);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit() {
    const c = code.trim();
    const e = addr.trim();
    if (busy || c.length !== 6 || !e.includes("@")) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/sase/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: c, email: e }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? "That code did not work.");
      onVerified();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "That code did not work.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 border-t border-[var(--ink-200,#e5e5e5)] pt-3">
      <p className="text-sm mb-1.5"><strong>Or type the 6-digit code from the email.</strong> Quicker than finding the link, and it works even if your company scans links:</p>
      <div className="flex flex-wrap items-center gap-2">
        {!defaultEmail && (
          <input
            value={addr}
            onChange={(ev) => setAddr(ev.target.value)}
            type="email"
            placeholder="you@yourcompany.com"
            className="border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm"
            aria-label="Work email the code was sent to"
          />
        )}
        <input
          value={code}
          onChange={(ev) => setCode(ev.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          className="w-28 border border-[var(--ink-300,#ccc)] rounded-sm p-2 text-sm tracking-[0.3em] text-center"
          aria-label="6-digit code from the email"
          onKeyDown={(ev) => { if (ev.key === "Enter") submit(); }}
        />
        <button onClick={submit} disabled={busy || code.trim().length !== 6 || !addr.trim().includes("@")} className="px-4 py-2 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">
          {busy ? "Checking..." : "Confirm with code"}
        </button>
      </div>
      {err && <p className="mt-1.5 text-sm text-red-700">{err}</p>}
    </div>
  );
}
