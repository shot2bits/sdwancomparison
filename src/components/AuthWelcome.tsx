"use client";

import { useEffect, useState } from "react";

/**
 * The one-question welcome after a first LinkedIn sign-up. Rules it lives
 * by (24 July 2026): never a wall (skip is always there, storage failures
 * still let the person through), never nosy (one field, plain reason,
 * private-to-Netify stated), and never seen twice (a company already on
 * file, or no session at all, passes straight through to the return
 * path). The return path is same-app only, guarded here as well as where
 * it was minted.
 */

function safeReturn(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw.length <= 400 ? raw : "/";
}

export default function AuthWelcome() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ret, setRet] = useState("/");

  useEffect(() => {
    const r = safeReturn(new URLSearchParams(window.location.search).get("return"));
    setRet(r);
    fetch("/sase/api/buyer/profile")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("no session"))))
      .then((p: { name?: string; company?: string }) => {
        // Already answered, or nothing to ask: pass straight through.
        if (p.company) { window.location.replace(r); return; }
        setName(p.name ?? "");
        setReady(true);
      })
      .catch(() => { window.location.replace(r); });
  }, []);

  async function submit() {
    if (busy) return;
    setBusy(true);
    // Best effort by design: the answer is valuable, the person more so.
    // Whatever storage does, they continue to where they were going.
    try {
      if (company.trim()) {
        await fetch("/sase/api/buyer/profile", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ company: company.trim() }),
        });
      }
    } catch { /* never a wall */ }
    window.location.replace(ret);
  }

  if (!ready) {
    return <p className="text-sm text-[var(--ink-500)] text-center">One moment…</p>;
  }

  return (
    <div>
      <p className="eyebrow mb-2">Welcome to Netify</p>
      <h1 className="text-2xl mb-2">{name ? `Good to have you, ${name.split(" ")[0]}.` : "Good to have you."}</h1>
      <p className="text-sm text-[var(--ink-600,#555)] mb-5">
        You are signed in{name ? ` as ${name}` : ""}. One question and you are on your way:
      </p>
      <label className="block text-sm font-medium mb-1.5" htmlFor="welcome-company">Which company are you buying for?</label>
      <input
        id="welcome-company"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        placeholder="Company name"
        className="w-full border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm"
        onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
        autoFocus
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !company.trim()}
          className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Continue"}
        </button>
        <button type="button" onClick={() => window.location.replace(ret)} className="text-sm text-[var(--ink-500)] underline hover:text-[var(--ink-900)]">
          Skip for now
        </button>
      </div>
      <p className="mt-4 text-xs text-[var(--ink-500)]">
        Private to the Netify team, so we know who we are working with. Suppliers only ever see your anonymous position, never your name or company.
      </p>
    </div>
  );
}
