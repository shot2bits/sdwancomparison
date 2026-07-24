"use client";

import { useEffect, useRef, useState } from "react";
import { firstTouch } from "@/components/NetifyEvents";
import CodeEntry from "@/components/CodeEntry";

type Session = { authenticated: boolean; role?: string; email?: string; vendor_slug?: string | null; linkedin?: boolean };

/* What a LinkedIn bounce-back means, in the buyer's language. The email
   lane beside the message is always the fallback. */
const LI_ERRORS: Record<string, string> = {
  denied: "LinkedIn sign-in was cancelled. Try again, or use your work email instead.",
  state: "That LinkedIn sign-in attempt expired. Try again.",
  exchange: "LinkedIn did not complete the sign-in. Try again, or use your work email instead.",
  email: "LinkedIn did not share a verified email address, so we could not sign you in. Use your work email instead.",
  config: "LinkedIn sign-in is not available right now. Use your work email instead.",
  storage: "LinkedIn sign-in is not available right now. Use your work email instead.",
};

/**
 * Sign-in, both lanes (redesigned 24 July 2026 after the overnight funnel
 * read: six of seven sign-in attempts were personal addresses the email
 * lane rightly refuses, so the lane built for those buyers now leads).
 *
 * Buyers: LinkedIn first when the server says the lane is configured (the
 * LinkedIn account is the verification, so any email works there), then
 * the work-email magic link. A personal-address rejection becomes a
 * rescue: the message says the LinkedIn door is the road in, and the
 * button draws the eye once. Suppliers: work email only, domain-verified
 * against the vendor list, exactly as before.
 *
 * The 6-digit code entry now lives INSIDE the sent state on every
 * surface (it used to be bolted on by some callers and missing from
 * others, including the account page, where last night's one delivered
 * link died unverified). After a code verifies: onAuthed() when the
 * caller passed one (the publish gates auto-continue), otherwise a full
 * reload so server-rendered surfaces pick up the session.
 */
export default function SignIn({ role, prompt, onAuthed }: { role: "supplier" | "buyer"; prompt?: string; onAuthed?: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rescue, setRescue] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const liButton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => { fetch("/sase/api/auth/session").then((r) => r.json()).then(setSession).catch(() => {}); }, []);
  useEffect(() => {
    // A LinkedIn round trip that failed lands back with ?li_error=; say why.
    try {
      const reason = new URLSearchParams(window.location.search).get("li_error");
      if (reason) setError(LI_ERRORS[reason] ?? LI_ERRORS.exchange);
    } catch { /* display only */ }
  }, []);

  const linkedinAvailable = role === "buyer" && Boolean(session?.linkedin);

  function linkedinStart() {
    const ret = window.location.pathname + window.location.search;
    window.location.href = `/sase/api/auth/linkedin/start?return=${encodeURIComponent(ret)}`;
  }

  async function request() {
    if (busy) return;
    setBusy(true);
    setError(null); setSent(null); setDevLink(null); setRescue(false);
    try {
      // Where sign-in was requested from: carried through the magic link so
      // the verify page can send the person straight back here afterwards.
      const return_to = window.location.pathname + window.location.search;
      const res = await fetch("/sase/api/auth/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, role, return_to, attribution: firstTouch() }) });
      const data = await res.json();
      if (!res.ok) {
        // The rescue moment (24 Jul): a personal address cannot receive the
        // link, but the LinkedIn lane exists precisely for that buyer. Say
        // so and let the button draw the eye once.
        if (data.reason === "personal_email" && linkedinAvailable) {
          setRescue(true);
          setTimeout(() => setRescue(false), 6000);
          try { liButton.current?.focus({ preventScroll: false }); } catch { /* focus only */ }
        }
        throw new Error(data.error ?? "Could not send a link.");
      }
      setSent(data.message ?? `Sent. Click the link in the email, or type the 6-digit code from it below. Not there within a minute? Check spam.`);
      if (data.dev_link) setDevLink(data.dev_link);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send a link."); }
    finally { setBusy(false); }
  }

  async function logout() {
    await fetch("/sase/api/auth/logout", { method: "POST" });
    setSession({ authenticated: false, linkedin: session?.linkedin });
  }

  function verified() {
    // The code confirmed a session on this very screen. Publish gates pass
    // onAuthed and continue their interrupted action; standalone surfaces
    // reload so the whole page renders signed in.
    fetch("/sase/api/auth/session").then((r) => r.json()).then(setSession).catch(() => {});
    if (onAuthed) onAuthed();
    else window.location.reload();
  }

  if (session?.authenticated) {
    return (
      <div className="text-sm text-[var(--ink-600,#555)] flex items-center gap-3">
        <span>Signed in as {session.email}{session.vendor_slug ? ` (${session.vendor_slug})` : ""}.</span>
        <button onClick={logout} className="underline hover:text-[var(--ink-900)]">Sign out</button>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-[var(--ink-300,#ccc)] p-4 max-w-md">
      <p className="eyebrow mb-1">{role === "supplier" ? "Supplier sign-in" : "Sign in"}</p>
      <p className="text-sm text-[var(--ink-600,#555)] mb-2">{prompt ?? (role === "supplier" ? "Sign in with your work email to respond. We verify your email domain against the listed supplier." : "Verify yourself once and everything you build stays yours.")}</p>

      {linkedinAvailable && (
        <>
          <button
            ref={liButton}
            type="button"
            onClick={linkedinStart}
            className={`flex w-full items-center justify-center gap-2 rounded-full border border-[#0A66C2] bg-white px-4 py-2.5 text-sm font-semibold text-[#0A66C2] transition-colors hover:bg-[#eef6fc] ${rescue ? "ring-2 ring-[#0A66C2] ring-offset-2 animate-pulse" : ""}`}
          >
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] bg-[#0A66C2] text-[10px] font-bold leading-none text-white" aria-hidden="true">in</span>
            Continue with LinkedIn
          </button>
          <p className="text-xs text-[var(--ink-500)] mt-1.5">One click if you are signed in to LinkedIn. Works with any email address, because your LinkedIn profile is the verification. We never post or touch your connections.</p>
          <div className="my-3 flex items-center gap-2" aria-hidden="true">
            <span className="h-px flex-1 bg-[var(--ink-300,#ccc)]" />
            <span className="text-[11px] text-[var(--ink-500)]">or use your work email</span>
            <span className="h-px flex-1 bg-[var(--ink-300,#ccc)]" />
          </div>
        </>
      )}

      <div className="flex gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@yourcompany.com" className="flex-1 border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" onKeyDown={(e) => { if (e.key === "Enter") void request(); }} />
        <button onClick={request} disabled={busy || !email.includes("@")} className="px-4 py-2 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">{busy ? "Sending…" : "Send link"}</button>
      </div>
      {sent && (
        <>
          <p className="text-sm text-emerald-700 mt-2">{sent}</p>
          <CodeEntry defaultEmail={email} onVerified={verified} />
        </>
      )}
      {devLink && <p className="text-xs text-[var(--ink-500)] mt-1">Preview link (email not configured): <a className="underline" href={devLink}>sign in</a></p>}
      {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
      {!sent && (
        <p className="text-xs text-[var(--ink-500)] mt-2">
          <button type="button" onClick={() => setCodeOpen((v) => !v)} className="underline hover:text-[var(--ink-900)]">Already have a 6-digit code from us?</button>
        </p>
      )}
      {!sent && codeOpen && <CodeEntry defaultEmail={email.includes("@") ? email : ""} onVerified={verified} />}
      <p className="text-xs text-[var(--ink-500)] mt-2">We only email you about your RFPs, opportunities and RFP Builder and Marketplace features and benefits. No third-party marketing, and you can opt out at any time.</p>
      {role === "buyer" && (
        <p className="text-xs text-[var(--ink-500)] mt-1">
          Netify is the SASE and SD-WAN procurement marketplace for UK and North American businesses. Looking for Netlify website hosting (netlify.com) or Netify network intelligence (netify.ai)? Those are separate companies.
        </p>
      )}
    </div>
  );
}
