"use client";

import { useEffect, useState } from "react";

export default function VerifyClient() {
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [info, setInfo] = useState<{ role?: string; vendor_slug?: string | null }>({});

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) { setState("error"); return; }
    fetch("/api/auth/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => { if (ok) { setState("done"); setInfo(d); } else setState("error"); })
      .catch(() => setState("error"));
  }, []);

  if (state === "working") return <p className="text-[var(--ink-500)]">Signing you in...</p>;
  if (state === "error") return <p className="text-red-700">This sign-in link is invalid or has expired. Request a new one.</p>;
  return (
    <div>
      <h1 className="text-xl mb-2">You are signed in.</h1>
      <p className="text-[var(--ink-700)]">{info.role === "supplier" || info.role === "netify" ? `As a supplier${info.vendor_slug ? ` (${info.vendor_slug})` : ""}. Return to the opportunity or RFP tab to respond.` : "As a buyer. You can save and manage your RFPs."}</p>
    </div>
  );
}
