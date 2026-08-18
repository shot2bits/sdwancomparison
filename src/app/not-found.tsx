import Link from "next/link";
import MegaNav from "@/components/MegaNav";

/**
 * Custom 404 (18 July 2026). The default framework 404 was a blank dead end;
 * the objective is published RFPs, so even a broken link presents the next
 * step. Server-rendered, no client code.
 *
 * 2030 workspace-separation note (18 Aug 2026): the global not-found.tsx is
 * rendered directly by the true root (src/app/layout.tsx) whenever no route
 * segment matches at all, so it sits OUTSIDE both the (marketing) and
 * (workspace) route groups and can't inherit either one's layout chrome.
 * Root layout no longer renders MegaNav itself (that moved into
 * (marketing)/layout.tsx so the workspace could opt out of it), so this page
 * renders MegaNav directly to stay navigable. It intentionally does not
 * duplicate the six-column SiteFooter — a broken-link page carries much
 * lower SEO/EEAT weight than the pages that prompted keeping the footer
 * reachable (see (workspace)/layout.tsx's own note), and duplicating that
 * column data a third time was judged not worth the maintenance cost.
 */
export default function NotFound() {
  return (
    <>
      <MegaNav />
      <div className="mx-auto max-w-3xl px-6 py-20">
        <p className="eyebrow mb-2">Page not found</p>
        <h1 className="mb-3 text-2xl">That page does not exist, but your project can.</h1>
        <p className="mb-6 max-w-xl text-sm text-[var(--ink-700)]">
          The link you followed is broken or the page has moved. The fastest way forward: describe your project
          once and Netify assembles a complete SASE or SD-WAN RFP in about two minutes, free, with structured
          vendor responses and pricing kept private to you.
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
    </>
  );
}
