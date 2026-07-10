"use client";

/**
 * MINIMAL TOP BAR (2026-07-10 v3) — logo + Sign in + Build an RFP only.
 *
 * Navigation lives in the accordion sidebar (SideNav.tsx). Below lg the
 * hamburger opens a drawer with the SAME AccordionNav, portaled to <body>
 * with an explicit opaque background (July fix: inside the sticky header the
 * drawer's background failed to cover the page). Esc closes; body scroll
 * locks while open.
 */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SIGN_IN, NAV_CTA, toAppHref } from "@/lib/nav";
import { AccordionNav } from "@/components/SideNav";

export default function TopNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const pathname = usePathname();

  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-40 h-12 border-b border-[var(--ink-200)]/60 bg-[var(--paper-base)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-base font-semibold tracking-tight text-[var(--ink-900)] no-underline">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-zinc-950 text-white text-sm font-bold">N</span>
          <span>Netify</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link href={toAppHref(SIGN_IN.href)} className="inline-flex items-center whitespace-nowrap text-[13px] tracking-tight text-[var(--ink-700)] no-underline transition-colors hover:text-[var(--ink-900)]">
            {SIGN_IN.label}
          </Link>
          <Link href={toAppHref(NAV_CTA.href)} className="hidden sm:inline-flex items-center whitespace-nowrap rounded-full bg-amber-500 px-5 py-1.5 text-[13px] font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400">
            {NAV_CTA.label}
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden shrink-0 rounded-md border border-[var(--ink-300,#d4d4d8)] px-3 py-1.5 text-sm bg-transparent"
            aria-label="Open menu"
          >
            Menu
          </button>
        </div>
      </div>

      {mobileOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[100] overflow-hidden bg-white lg:hidden" style={{ backgroundColor: "#ffffff" }}>
          <div className="flex h-12 items-center justify-between border-b border-[var(--ink-200)] px-6">
            <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 text-base font-semibold tracking-tight text-[var(--ink-900)] no-underline">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-zinc-950 text-white text-sm font-bold">N</span>
              <span>Netify</span>
            </Link>
            <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" className="text-sm bg-transparent border-0">
              Close
            </button>
          </div>
          <nav aria-label="Primary (mobile)" className="h-[calc(100dvh-3rem)] overflow-y-auto px-4 py-4">
            <AccordionNav idPrefix="drawer" onNavigate={() => setMobileOpen(false)} />
            <div className="mt-6 border-t border-[var(--ink-200)] pt-5 pb-8 space-y-3">
              <Link href={toAppHref(SIGN_IN.href)} onClick={() => setMobileOpen(false)} className="block px-3 text-sm font-medium text-[var(--ink-900)] no-underline">
                {SIGN_IN.label}
              </Link>
              <Link href={toAppHref(NAV_CTA.href)} onClick={() => setMobileOpen(false)} className="inline-flex w-full items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-medium text-zinc-950 no-underline">
                {NAV_CTA.label}
              </Link>
            </div>
          </nav>
        </div>,
        document.body,
      )}
    </header>
  );
}
