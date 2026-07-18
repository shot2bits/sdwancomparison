import Link from "next/link";

/**
 * Custom 404 (18 July 2026). The default framework 404 was a blank dead end;
 * the objective is published RFPs, so even a broken link presents the next
 * step. Server-rendered, no client code.
 */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <p className="eyebrow mb-2">Page not found</p>
      <h1 className="mb-3 text-2xl">That page does not exist, but your project can.</h1>
      <p className="mb-6 max-w-xl text-sm text-[var(--ink-700)]">
        The link you followed is broken or the page has moved. The fastest way forward: describe your project
        once and Netify assembles a complete SASE or SD-WAN RFP in about two minutes, free, with structured
        supplier responses and pricing kept private to you.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/rfp-builder/new"
          className="inline-flex items-center rounded-full bg-amber-500 px-5 py-2.5 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400"
        >
          Start an RFP
        </Link>
        <Link href="/shortlist" className="text-sm underline text-[var(--ink-700)]">
          Compare the market
        </Link>
        <Link href="/opportunities/board" className="text-sm underline text-[var(--ink-700)]">
          Open opportunities
        </Link>
        <Link href="/" className="text-sm underline text-[var(--ink-700)]">
          Home
        </Link>
      </div>
    </div>
  );
}
