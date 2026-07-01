"use client";

import { useEffect, useState } from "react";

/**
 * Sign-in confirmation. The magic-link token is single-use, so we must NOT
 * consume it automatically on page load: corporate mail scanners (Microsoft
 * Defender Safe Links, link previews, etc.) pre-fetch links in emails, and an
 * auto-submit would let the scanner burn the one-time token before the real
 * person clicks, producing a spurious "invalid or expired" error. Instead we
 * show a button and only exchange the token on a real user click, which
 * scanners do not perform.
 */
export default function VerifyClient() {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "working" | "done" | "error">("loading");
  const [info, setInfo] = useState<{ role?: string; vendor_slug?: string | null }>({});

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    if (!t) { setState("error"); return; }
    setToken(t);
    setState("ready");
  }, []);

  async function confirm() {
    if (!token) return;
    setState("working");
    try {
      const r = await fetch("/sase/api/auth/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      const d = await r.json();
      if (r.ok) { setState("done"); setInfo(d); } else setState("error");
    } catch { setState("error"); }
  }

  if (state === "loading") return <p className="text-[var(--ink-500)]">Loading...</p>;

  if (state === "error") return <p className="text-red-700">This sign-in link is invalid or has expired. Request a new one.</p>;

  if (state === "done") {
    return (
      <div>
        <h1 className="text-xl mb-2">You are signed in.</h1>
        <p className="text-[var(--ink-700)]">{info.role === "supplier" || info.role === "netify" ? `As a supplier${info.vendor_slug ? ` (${info.vendor_slug})` : ""}. Return to the opportunity or RFP tab to respond.` : "As a buyer. You can save and manage your RFPs."}</p>
      </div>
    );
  }

  // ready or working: wait for a real click before consuming the one-time token.
  return (
    <div>
      <h1 className="text-xl mb-2">Confirm sign-in</h1>
      <p className="text-[var(--ink-700)] mb-4">Click below to finish signing in to the Netify marketplace.</p>
      <button
        onClick={confirm}
        disabled={state === "working" || !token}
        className="px-5 py-2.5 bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50"
      >
        {state === "working" ? "Signing you in..." : "Confirm sign-in"}
      </button>
    </div>
  );
}
