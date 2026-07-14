"use client";

/**
 * Homepage hero form: the Shiply pattern (Robert, 14 July 2026). The single
 * action a new visitor needs is right in the hero: type what you are buying,
 * press the button, land in the Describe wizard with the title already
 * answered. No reading required to understand the product; the form is the
 * explanation.
 */

import { useState } from "react";
import { fireNetifyEvent } from "@/components/NetifyEvents";

export default function HomeHeroForm() {
  const [title, setTitle] = useState("");

  function go() {
    fireNetifyEvent("home_hero_start", { has_title: title.trim().length >= 8 ? "yes" : "no" });
    const t = title.trim().slice(0, 120);
    const q = t.length >= 8 ? `?title=${encodeURIComponent(t)}` : "";
    window.location.assign(`/sase/rfp-builder/new/${q}`);
  }

  return (
    <div className="max-w-2xl">
      <label htmlFor="hero-title" className="mb-2 block text-sm font-medium text-[var(--ink-800,#27272a)]">
        What are you buying?
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="hero-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") go(); }}
          placeholder="e.g. Managed SD-WAN for 40 UK retail sites"
          className="flex-1 rounded-sm border border-[var(--ink-300,#ccc)] bg-white p-3 text-base"
        />
        <button
          onClick={go}
          className="shrink-0 rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
        >
          Get supplier bids
        </button>
      </div>
      <p className="mt-2 text-xs text-[var(--ink-500)]">
        Free for buyers. No account needed to build. Nothing is shared until you publish.
      </p>
    </div>
  );
}
