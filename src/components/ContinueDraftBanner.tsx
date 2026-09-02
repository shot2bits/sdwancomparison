"use client";

/**
 * Continue-your-draft banner (20 July 2026, the draft-pool fix): the return
 * path for anonymous drafts. RfpBuilder records a pointer to the last opened
 * draft in localStorage (id and title only; the manage token stays in its own
 * per-draft key, which the builder restores itself). When someone lands back
 * on the start page with a draft behind them, the fastest route to a
 * published RFP is the one they already started.
 */

import { useEffect, useState } from "react";

interface LastDraft {
  id: string;
  title: string;
  at: number;
}

function ageLabel(at: number): string {
  const days = Math.floor((Date.now() - at) / 86400000);
  if (days <= 0) return "earlier today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "last week" : `${weeks} weeks ago`;
}

export default function ContinueDraftBanner() {
  const [draft, setDraft] = useState<LastDraft | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("netify_last_draft");
      if (!raw) return;
      const d = JSON.parse(raw) as LastDraft;
      // Only surface drafts the builder can actually reopen (its token key).
      if (d?.id && localStorage.getItem(`netify_mtok_${d.id}`)) queueMicrotask(() => setDraft(d));
    } catch {
      /* private mode or malformed pointer: no banner */
    }
  }, []);

  if (!draft) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-sm border border-amber-300 bg-amber-50 p-3 text-sm">
      <span className="text-[var(--ink-800)]">
        You have a draft in progress from {ageLabel(draft.at)}: <strong>{draft.title}</strong>
      </span>
      <a
        href={`/sase/rfp-builder/${draft.id}/`}
        className="inline-flex items-center rounded-full bg-amber-500 px-4 py-1.5 font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400"
      >
        Continue your draft
      </a>
    </div>
  );
}
