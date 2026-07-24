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
 * States (Harry's testing, 14 July 2026):
 *  - Visiting with no token while signed in: a signed-in screen with account
 *    and builder buttons, never a misleading "expired" error.
 *  - Visiting with no token signed out, or with a dead token: the error
 *    offers a Return to sign in route instead of dead-ending.
 *  - After Confirm sign-in: buyer sessions claim this browser's draft RFPs
 *    (manage tokens prove creation, POST /api/rfp/claim), a note is handed
 *    to the destination via sessionStorage (same tab), and the person is
 *    redirected: the ?return= path the sign-in came from, else the claimed
 *    draft, else the account hub, or the board for suppliers.
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

const BTN = "inline-flex items-center px-5 py-2.5 bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors no-underline";
const BTN_GHOST = "inline-flex items-center px-5 py-2.5 border border-[var(--ink-900)] rounded-full text-[var(--ink-900)] no-underline hover:bg-[var(--ink-900)] hover:text-white transition-colors";

export default function VerifyClient() {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "working" | "done" | "signed_in" | "already" | "error">("loading");
  const [info, setInfo] = useState<{ role?: string; vendor_slug?: string | null; email?: string }>({});
  const [claimedCount, setClaimedCount] = useState(0);
  const [dest, setDest] = useState<string>("/sase/account/");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    if (t) {
      setToken(t);
      // A valid token AND an existing session (Harry, 24 July 2026: signed
      // in with the 6-digit code, then clicked the same email's link and
      // was asked to confirm sign-in a third time). Recognise the session
      // FIRST: the person is already in, so say so and offer the way on.
      // The unconsumed token stays available behind "someone else" for the
      // cross-account edge, and scanners still never consume anything.
      fetch("/sase/api/auth/session")
        .then((r) => r.json())
        .then((d: { authenticated?: boolean; role?: string; email?: string; vendor_slug?: string | null }) => {
          if (d?.authenticated) { setInfo(d); setState("already"); } else { setState("ready"); }
        })
        .catch(() => setState("ready"));
      return;
    }
    // No token: someone navigated here directly. Recognise an existing
    // session rather than showing a misleading "expired" error.
    fetch("/sase/api/auth/session")
      .then((r) => r.json())
      .then((d: { authenticated?: boolean; role?: string; email?: string; vendor_slug?: string | null }) => {
        if (d?.authenticated) { setInfo(d); setState("signed_in"); } else { setState("error"); }
      })
      .catch(() => setState("error"));
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

      // Hand a persistent note to the destination (same tab, sessionStorage),
      // so the confirmation survives the redirect (Harry: the flash message
      // alone was easy to miss).
      try { sessionStorage.setItem("netify_signin_note", JSON.stringify({ claimed: claimed.length })); } catch { /* ignore */ }

      setClaimedCount(claimed.length);
      setDest(to);
      setInfo(d);
      setState("done");
      window.setTimeout(() => { window.location.assign(to); }, 2500);
    } catch { setState("error"); }
  }

  if (state === "loading") return <p className="text-[var(--ink-500)]">Loading...</p>;

  if (state === "signed_in") {
    return (
      <div>
        <h1 className="text-xl mb-2">You are signed in{info.email ? ` as ${info.email}` : ""}.</h1>
        <p className="text-[var(--ink-700)] mb-5">
          {info.role === "supplier"
            ? `Supplier access${info.vendor_slug ? ` for ${info.vendor_slug}` : ""}. Browse open projects and respond from the board.`
            : "Your RFPs and projects are saved to your account."}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {info.role === "supplier" ? (
            <a href="/sase/opportunities/board/" className={BTN}>Browse open projects</a>
          ) : (
            <>
              <a href="/sase/account/" className={BTN}>Go to my account</a>
              <a href="https://netify.co.uk/" className={BTN_GHOST}>Start a project</a>
            </>
          )}
        </div>
      </div>
    );
  }

  if (state === "already") {
    const ret = safeReturnPath() ?? "/sase/account/";
    return (
      <div>
        <h1 className="text-xl mb-2">You are already signed in{info.email ? ` as ${info.email}` : ""}.</h1>
        <p className="text-[var(--ink-700)] mb-5">No need to confirm anything again; carry straight on.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <a href={ret} className={BTN}>Continue</a>
        </div>
        <p className="mt-4 text-xs text-[var(--ink-500)]">
          Signing in as someone else?{" "}
          <button type="button" onClick={() => setState("ready")} className="underline hover:text-[var(--ink-900)]">Use this link&rsquo;s sign-in instead</button>
        </p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div>
        <p className="text-red-700 mb-5">This sign-in link is invalid or has expired. Request a new one.</p>
        <a href="/sase/account/" className={BTN}>Return to sign in</a>
      </div>
    );
  }

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
        <a href={dest} className={BTN}>Continue</a>
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
