"use client";

/**
 * The Continuation: the Derived Experience Framework's first component
 * (Robert's go, 23 Jul 2026; mockups docs/netify-continuation-mockups).
 *
 * This component NEVER derives. It renders a Continuation or, given
 * null, renders nothing at all: no UI, no assistant lane, no JSON-LD.
 * Humans and agents observe identical truth.
 *
 * Visually kin to the homepage prompt on purpose: the same white card,
 * the same underlined editable sentence, the same single soft shadow,
 * amber only on the primary action. A buyer who has seen the front door
 * recognises the instrument wherever they meet it again.
 */

import { useState } from "react";
import { fireNetifyEvent } from "@/components/NetifyEvents";
import { continuationJsonLd, continuationUrl, type Continuation as ContinuationData } from "@/lib/continuation/types";

export default function Continuation({ c, pageUrl }: { c: ContinuationData | null; pageUrl?: string }) {
  const [sentence, setSentence] = useState(c?.sentence ?? "");
  if (!c) return null;

  const go = () => {
    const words = sentence.trim().length >= 3 ? sentence.trim() : c.sentence;
    fireNetifyEvent("continuation_taken", { family: c.family, source: c.source });
    window.location.assign(continuationUrl(words, c.pins));
  };

  return (
    <section
      aria-label={c.stamp}
      data-continuation-version={c.version}
      data-continuation-family={c.family}
      className="max-w-2xl rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-[0_1px_0_rgba(24,24,27,.05),0_18px_44px_-20px_rgba(24,24,27,.22),0_2px_12px_-4px_rgba(180,83,9,.07)]"
    >
      {pageUrl && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(continuationJsonLd(c, pageUrl)) }} />
      )}
      <p className="m-0 text-[10px] font-semibold uppercase tracking-[.12em] text-zinc-400">{c.stamp}</p>
      <div className="relative mt-2 border-b-2 border-zinc-300 focus-within:border-amber-500">
        <input
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(); } }}
          aria-label="Your first sentence, editable"
          className="w-full bg-transparent py-2 pl-0.5 pr-7 text-[15px] text-zinc-800 outline-none"
        />
        <span aria-hidden="true" className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-zinc-400">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5 L10.5 3.5 L4 10 L1.5 10.5 L2 8 Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" /></svg>
        </span>
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={go}
          className="rounded-full bg-amber-500 px-4 py-2 text-[13px] font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
        >
          {c.label} <span aria-hidden="true">&rarr;</span>
        </button>
        <p className="m-0 min-w-[200px] flex-1 text-[11px] leading-relaxed text-zinc-500">
          {c.reassurance}
          {c.deepClaim ? ` ${c.deepClaim}` : ""}
        </p>
      </div>
      <p className="m-0 mt-2.5 text-[10.5px] text-zinc-400">Opens your procurement on Netify</p>
      <p className="m-0 mt-2.5 border-t border-zinc-100 pt-2 text-[10.5px] leading-relaxed text-zinc-400">
        Working with an assistant? Connect{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[10px]">netify.co.uk/sase/api/mcp/</code> and use{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[10px]">workspace_ingest</code> with this page as context.
      </p>
    </section>
  );
}
