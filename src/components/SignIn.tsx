"use client";

import { useEffect, useState } from "react";
import { firstTouch } from "@/components/NetifyEvents";

type Session = { authenticated: boolean; role?: string; email?: string; vendor_slug?: string | null };

/** Magic-link sign-in. role "supplier" verifies the email domain against a vendor. */
export default function SignIn({ role, prompt }: { role: "supplier" | "buyer"; prompt?: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetch("/sase/api/auth/session").then((r) => r.json()).then(setSession).catch(() => {}); }, []);

  async function request() {
    setError(null); setSent(null); setDevLink(null);
    try {
      // Where sign-in was requested from: carried through the magic link so
      // the verify page can send the person straight back here afterwards.
      const return_to = window.location.pathname + window.location.search;
      const res = await fetch("/sase/api/auth/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, role, return_to, attribution: firstTouch() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send a link.");
      setSent(data.message ?? "Check your inbox for a sign-in link.");
      if (data.dev_link) setDevLink(data.dev_link);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send a link."); }
  }

  async function logout() {
    await fetch("/sase/api/auth/logout", { method: "POST" });
    setSession({ authenticated: false });
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
      <p className="text-sm text-[var(--ink-600,#555)] mb-2">{prompt ?? (role === "supplier" ? "Sign in with your work email to respond. We verify your email domain against the listed supplier." : "Sign in with your business email to save and manage your RFPs.")}</p>
      <div className="flex gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@yourcompany.com" className="flex-1 border border-[var(--ink-300,#ccc)] rounded-sm p-2.5 text-sm" />
        <button onClick={request} disabled={!email.includes("@")} className="px-4 py-2 text-sm bg-amber-500 text-zinc-950 font-medium rounded-full hover:bg-amber-400 transition-colors disabled:opacity-50">Send link</button>
      </div>
      {sent && <p className="text-sm text-emerald-700 mt-2">{sent}</p>}
      {devLink && <p className="text-xs text-[var(--ink-500)] mt-1">Preview link (email not configured): <a className="underline" href={devLink}>sign in</a></p>}
      {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
      <p className="text-xs text-[var(--ink-500)] mt-2">We only email you about your RFPs, opportunities and RFP Builder and Marketplace features and benefits. No third-party marketing, and you can opt out at any time.</p>
      {role === "buyer" && (
        <p className="text-xs text-[var(--ink-500)] mt-1">
          Netify is the SASE and SD-WAN procurement marketplace for UK and North American businesses. Looking for Netlify website hosting (netlify.com) or Netify network intelligence (netify.ai)? Those are separate companies.
        </p>
      )}
    </div>
  );
}
