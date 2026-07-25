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
 * the same single soft shadow, amber only on the primary action. A buyer
 * who has seen the front door recognises the instrument wherever they
 * meet it again.
 *
 * THE AI WINDOW (25 Jul 2026, Robert's mockup sign-off, twin-synced with
 * the main repo's component the same day): the single-line underlined
 * input read as a printed statement, so nobody knew they could write.
 * Presentation only: heading, helper and a real textarea seeded with the
 * derived sentence. Derivation, consent wording, events and the
 * assistant footer untouched. Enter submits, Shift+Enter makes a line.
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
      <p className="m-0 text-[10px] font-semibold uppercase tracking-[.12em] text-zinc-400">AI advisor &middot; {c.stamp}</p>
      <h3 className="m-0 mt-1.5 text-[19px] font-semibold tracking-[-.01em] text-zinc-900">Describe what you need</h3>
      <p className="m-0 mt-1 text-[13px] leading-relaxed text-zinc-500">
        Your first sentence is drafted from {c.family === "insight" ? "this article" : "this page"}. Edit it, or replace it with your own words: sites, regions, what must not go down.
      </p>
      <textarea
        value={sentence}
        onChange={(e) => setSentence(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); } }}
        aria-label="Your first sentence, editable"
        rows={3}
        className="mt-3 min-h-[76px] w-full resize-y rounded-[10px] border-[1.5px] border-zinc-300 bg-white px-3.5 py-3 text-[15px] leading-relaxed text-zinc-800 outline-none transition-colors focus:border-amber-500"
      />
      <p className="m-0 mt-1.5 text-[11px] text-zinc-400">
        Drafted from {c.family === "insight" ? "this article" : "this page"}. Everything you type stays yours to edit before anything is published.
      </p>
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
