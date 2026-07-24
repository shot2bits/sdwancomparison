"use client";

import { useEffect, useState } from "react";

/**
 * The welcome step after LinkedIn sign-in. Robert's ruling (24 July 2026,
 * evening, after the first organic LinkedIn signup arrived with no
 * company): the company name is MANDATORY on this lane. The two doors are
 * now symmetrical declarations: business email (the domain names the
 * company) or LinkedIn plus the company stated by the buyer themselves.
 * Netify never looks the company up: consented, stated facts only.
 *
 * What mandatory means here: no skip, and every LinkedIn sign-in without
 * a stored company lands back on this page (the callback routes on the
 * missing fact, not on first-signup). Someone who closes the tab keeps
 * their session but meets the question again at their next sign-in.
 *
 * What it still never does: lose the buyer to OUR failure. If storage is
 * down when they answer, the answer is attempted best-effort and they
 * continue; the requirement is that they state it, not that KV is up.
 * The answer stays internal to the Netify team; suppliers only ever see
 * the anonymous position.
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
    if (busy || !company.trim()) return;
    setBusy(true);
    try {
      await fetch("/sase/api/buyer/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ company: company.trim() }),
      });
    } catch { /* their statement was made; our storage being down must not trap them */ }
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
        You are signed in{name ? ` as ${name}` : ""}. One required detail and you are in:
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
      <div className="mt-3">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !company.trim()}
          className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Continue"}
        </button>
      </div>
      <p className="mt-4 text-xs text-[var(--ink-500)]">
        Netify is a marketplace for real businesses, so every buyer names the company they are buying for: by
        business email on the email lane, or here on the LinkedIn lane. It stays private to the Netify team.
        Suppliers never see your name or your company, only your anonymous position.
      </p>
    </div>
  );
}
