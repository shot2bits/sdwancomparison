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
 *
 * After sign-in this page is NOT a dead end (Robert's 13 July screenshot):
 * buyer sessions claim any draft RFPs held in this browser's localStorage
 * (manage tokens prove creation, POST /api/rfp/claim), then everyone is sent
 * somewhere useful — the ?return= path the sign-in was requested from, the
 * claimed draft, the account hub, or the opportunity board for suppliers.
 * The builder's pending-publish flag then auto-resumes a publish that was
 * interrupted by the sign-in requirement.
 */

/** Same-app absolute paths only (basePath /sase), so the redirect can never leave the app. */
function safeReturnPath(): string | null {
  const r = new URLSearchParams(window.location.search).get("return");
  return r && r.length <= 400 && /^\/sase\/[\w\-/.~%?=&]*$/.test(r) ? r : null;
}

/** Draft manage tokens saved by the builder in this browser (netify_mtok_{id}). */
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
  } catch { /* private mode: nothing to claim */ }
  return out.slice(0, 25);
}

export default function VerifyClient() {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "working" | "done" | "error">("loading");
  const [info, setInfo] = useState<{ role?: string; vendor_slug?: string | null }>({});
  const [claimedCount, setClaimedCount] = useState(0);
  const [dest, setDest] = useState<string>("/sase/account/");

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
      if (!r.ok) { setState("error"); return; }

      // Buyer (or Netify) sessions: attach this browser's anonymous drafts to
      // the account, so the sign-up and the drafting are finally the same person.
      let claimed: { id: string }[] = [];
      const supplier = d.role === "supplier";
      if (!supplier) {
        const drafts = localDrafts();
        if (drafts.length > 0) {
          try {
            const cr = await fetch("/sase/api/rfp/claim", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ drafts }) });
            const cd = await cr.json();
            if (cr.ok && Array.isArray(cd.claimed)) claimed = cd.claimed;
          } catch { /* claiming is best effort */ }
        }
      }

      // Where next: the page that asked for sign-in, else the single claimed
      // draft, else the account hub (buyers) or the board (suppliers).
      const ret = safeReturnPath();
      const to = ret
        ?? (supplier
          ? "/sase/opportunities/board/"
          : claimed.length === 1
            ? `/sase/rfp-builder/${claimed[0].id}/`
            : "/sase/account/");

      setClaimedCount(claimed.length);
      setDest(to);
      setInfo(d);
      setState("done");
      window.setTimeout(() => { window.location.assign(to); }, 1600);
    } catch { setState("error"); }
  }

  if (state === "loading") return <p className="text-[var(--ink-500)]">Loading...</p>;

  if (state === "error") return <p className="text-red-700">This sign-in link is invalid or has expired. Request a new one.</p>;

  if (state === "done") {
    const supplier = info.role === "supplier";
    return (
      <div>
        <h1 className="text-xl mb-2">You are signed in.</h1>
        {claimedCount > 0 && (
          <p className="text-emerald-700 mb-1">{claimedCount === 1 ? "Your draft RFP is now saved to your account." : `${claimedCount} draft RFPs are now saved to your account.`}</p>
        )}
        <p className="text-[var(--ink-700)] mb-4">
          {supplier
            ? `Signed in as a supplier${info.vendor_slug ? ` (${info.vendor_slug})` : ""}. Taking you to the opportunity board...`
            : claimedCount > 0
              ? "Taking you back to your RFP..."
              : "Taking you to your account..."}
        </p>
        <a href={dest} className="inline-block px-5 py-2.5 bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors no-underline">Continue</a>
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
