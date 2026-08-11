"use client";

import { useEffect, useState } from "react";
import { firstTouch } from "@/components/NetifyEvents";
import CodeEntry from "@/components/CodeEntry";

type Session = { authenticated: boolean; role?: string; email?: string; vendor_slug?: string | null };

/**
 * Sign-in, one lane (Robert's ruling, 29 Jul 2026, with the mockup
 * review: business email only, so the LinkedIn door built 23-24 July is
 * removed). The work-email magic link is the whole story for buyers and
 * suppliers alike: the mailbox is the verification, and a personal
 * address is refused with the reason and the reassurance that nothing
 * built is lost while the person switches address.
 *
 * The 6-digit code entry lives INSIDE the sent state on every
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
  const [codeOpen, setCodeOpen] = useState(false);

  useEffect(() => { fetch("/sase/api/auth/session").then((r) => r.json()).then(setSession).catch(() => {}); }, []);

  async function request() {
    if (busy) return;
    setBusy(true);
    setError(null); setSent(null); setDevLink(null);
    try {
      // Where sign-in was requested from: carried through the magic link so
      // the verify page can send the person straight back here afterwards.
      const return_to = window.location.pathname + window.location.search;
      const res = await fetch("/sase/api/auth/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, role, return_to, attribution: firstTouch() }) });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Could not send a link.");
      }
      // Fix, 11 Aug 2026: emailed can now come back false on a 200 response
      // (the request was accepted, but the actual send failed) — this used
      // to be ignored entirely, so a rejected send still showed the same
      // green "Sent" message as a real delivery, with no signal anything
      // was wrong. dev_link (preview only, no Resend configured) still
      // takes the ordinary sent path below, unaffected by this.
      if (data.emailed === false && !data.dev_link) {
        setError("We could not confirm delivery to that address. Double-check it, try a different work email, or email support@netify.com and we will get you in.");
      } else {
        setSent(data.message ?? `Sent. Click the link in the email, or type the 6-digit code from it below. Not there within a minute? Check spam.`);
        if (data.dev_link) setDevLink(data.dev_link);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send a link."); }
    finally { setBusy(false); }
  }

  async function logout() {
    await fetch("/sase/api/auth/logout", { method: "POST" });
    setSession({ authenticated: false });
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
      <p className="eyebrow mb-1">{role === "supplier" ? "Vendor sign-in" : "Sign in"}</p>
      <p className="text-sm text-[var(--ink-600,#555)] mb-2">{prompt ?? (role === "supplier" ? "Sign in with your work email to respond. We verify your email domain against the listed vendor." : "Verify yourself once and everything you build stays yours.")}</p>

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
      {/* The Netlify and netify.ai disambiguation used to stand here (R9,
          Robert's ruling 30 Jul 2026: it is gone from sign-in). Somebody
          reaching a sign-in box has already decided who we are; the
          sentence only planted a doubt at the worst moment. The guard now
          lives at the desk, where it fires quietly and only for a person
          whose own words say they came for the other company. */}
    </div>
  );
}
