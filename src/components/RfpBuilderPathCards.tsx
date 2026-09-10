"use client";

/**
 * Wraps the four buyer-path cards on the RFP Builder landing page. Once an RFP
 * is actually underway (RfpBuilder dispatches "netify:rfp-active"), the big
 * cards collapse to one slim line so they stop competing with the builder —
 * Harry's testing feedback (03/07/2026): after clicking Start, the large
 * Post-a-project / Browse / Not-sure cards detract from the actual builder.
 *
 * The cards themselves are server-rendered children, so the landing page keeps
 * its crawlable, indexable markup; this wrapper only handles the collapse.
 */

import { useEffect, useState } from "react";

export default function RfpBuilderPathCards({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const onActive = () => setCollapsed(true);
    window.addEventListener("netify:rfp-active", onActive);
    // Covers the reload case: the builder rewrites the URL to /rfp-builder/{rfp id}.
    if (/\/rfp-builder\/rfp_/.test(window.location.pathname)) queueMicrotask(() => setCollapsed(true));
    return () => window.removeEventListener("netify:rfp-active", onActive);
  }, []);

  if (!collapsed) return <>{children}</>;

  return (
    <div className="mb-10 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-sm border border-[var(--ink-200,#e5e5e5)] px-4 py-2.5 text-sm text-[var(--ink-600)]">
      <span className="font-medium text-[var(--ink-800)]">You&apos;re building an RFP.</span>
      <span>Other routes:</span>
      <a href="/sase/opportunities/new/" className="underline">Publish an RFI</a>
      <a href="/sase/opportunities/board/" className="underline">Browse opportunities</a>
      <a href="/sase/rfp-builder/start/" className="underline">Not sure?</a>
    </div>
  );
}
