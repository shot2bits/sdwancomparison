"use client";

import { useEffect, useState } from "react";

/**
 * The way into the record editor from a supplier profile, and invisible to
 * everyone else.
 *
 * These thirty profiles are the estate's most valuable citation surface and
 * they are statically generated, so nothing here may change a single byte of
 * what a crawler or an anonymous reader receives. This renders null on the
 * server and stays null until a session comes back belonging to a netify.com
 * address. The session endpoint is already fetched on every page by MegaNav,
 * so the only cost is one duplicate request for people who are signed in.
 *
 * The address check is a display hint and nothing more. Every write is
 * allowed or refused server side in /api/vendor-edit, so a link shown to the
 * wrong person would buy them a refusal, not an edit.
 */
export default function RecordEditLink({ slug }: { slug: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/sase/api/auth/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((s: { authenticated?: boolean; email?: string }) => {
        if (live && s?.authenticated && /@netify\.com$/i.test(s.email ?? "")) setShow(true);
      })
      .catch(() => {
        /* Signed out, offline, or the endpoint is unhappy. Show nothing. */
      });
    return () => {
      live = false;
    };
  }, []);

  if (!show) return null;
  return (
    <p className="text-sm mb-6 rounded-lg border border-[var(--ink-200,#e8ebef)] bg-[var(--ink-50,#f6f8fa)] px-4 py-2.5 inline-block">
      <a href={`/sase/vendors/${slug}/edit/`} className="underline font-medium">
        Edit this record
      </a>
      <span className="text-[var(--ink-600,#5b636e)]">
        {" "}
        · Netify only. Facts and the Netify View, saved as you go.{" "}
      </span>
      <a href="/sase/admin/records/" className="underline">
        All 30 records
      </a>
    </p>
  );
}
