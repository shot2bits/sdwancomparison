"use client";

/**
 * Apple-style top bar — zone switching + global pages ONLY.
 *
 * Visually and structurally identical to the main site's site-header.tsx
 * (48px sticky, frosted glass, 13px tracking-tight labels, amber reserved
 * for the CTA) so netify.co.uk and /sase/* feel like one product. This app
 * is the SASE zone, so "SASE Marketplace" carries the active underline.
 *
 * No dropdowns: deep SASE navigation belongs to the sidebar (SideNav.tsx).
 * Mobile: hamburger → full-screen drawer carrying the zones, this zone's
 * sidebar groups (the desktop sidebar is hidden on small screens), the
 * global links and the CTA.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ZONE_LINKS, GLOBAL_LINKS, NAV_CTA, SECTIONS, isExternal } from "@/lib/nav";

export default function TopNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const zoneCls = (active: boolean) =>
    `relative inline-flex items-center px-4 py-1.5 text-[13px] tracking-tight no-underline transition-colors ${
      active
        ? "text-[var(--ink-900)] font-medium after:absolute after:left-4 after:right-4 after:-bottom-[9px] after:h-[2px] after:rounded-full after:bg-[var(--ink-900)]"
        : "text-[var(--ink-700)] hover:text-[var(--ink-900)]"
    }`;

  return (
    <header className="sticky top-0 z-40 h-12 border-b border-[var(--ink-200)]/60 bg-[var(--paper-base)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-6 px-6">
        {/* Logo */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-base font-semibold tracking-tight text-[var(--ink-900)] no-underline"
        >
          <span className="grid h-7 w-7 place-items-center rounded-md bg-zinc-950 text-white text-sm font-bold">N</span>
          <span>Netify</span>
        </Link>

        {/* Desktop: three zones, hairline divider, global pages */}
        <nav aria-label="Primary" className="hidden flex-1 md:block">
          <ul className="flex items-center justify-center gap-1 list-none m-0 p-0">
            {ZONE_LINKS.map((zone) => {
              const active = !isExternal(zone.href); // this app IS the SASE zone
              return (
                <li key={zone.label}>
                  {isExternal(zone.href) ? (
                    <a href={zone.href} className={zoneCls(false)}>
                      {zone.label}
                    </a>
                  ) : (
                    <Link href={zone.href} aria-current={active ? "true" : undefined} className={zoneCls(active)}>
                      {zone.label}
                    </Link>
                  )}
                </li>
              );
            })}
            <li aria-hidden="true" className="mx-2 h-4 w-px bg-[var(--ink-300,#d4d4d8)]" />
            {GLOBAL_LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="inline-flex items-center px-3 py-1.5 text-[13px] tracking-tight text-[var(--ink-500)] no-underline transition-colors hover:text-[var(--ink-900)]"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* CTA */}
        <div className="hidden shrink-0 md:block">
          <Link
            href={NAV_CTA.href}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-5 py-1.5 text-[13px] font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400"
          >
            {NAV_CTA.label}
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="md:hidden rounded-md border border-[var(--ink-300,#d4d4d8)] px-3 py-1.5 text-sm"
          aria-label="Open menu"
        >
          Menu
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-[var(--paper-base,#fff)] md:hidden">
          <div className="flex h-12 items-center justify-between border-b border-[var(--ink-200)] px-6">
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 text-base font-semibold tracking-tight text-[var(--ink-900)] no-underline"
            >
              <span className="grid h-7 w-7 place-items-center rounded-md bg-zinc-950 text-white text-sm font-bold">N</span>
              <span>Netify</span>
            </Link>
            <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" className="text-sm">
              Close
            </button>
          </div>
          <nav aria-label="Primary (mobile)" className="h-[calc(100dvh-3rem)] overflow-y-auto px-6 py-4">
            {/* Zones */}
            <div className="mb-6">
              <p className="eyebrow mb-3">Netify</p>
              <ul className="space-y-2 list-none m-0 p-0">
                {ZONE_LINKS.map((zone) => (
                  <li key={zone.label}>
                    {isExternal(zone.href) ? (
                      <a href={zone.href} className="block py-1 text-base font-medium text-[var(--ink-900)] no-underline">
                        {zone.label} <span className="text-[var(--ink-400,#9ca3af)]">↗</span>
                      </a>
                    ) : (
                      <Link
                        href={zone.href}
                        onClick={() => setMobileOpen(false)}
                        className="block py-1 text-base font-medium text-[var(--ink-900)] no-underline"
                      >
                        {zone.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* This zone's deep nav (desktop sidebar is hidden on mobile) */}
            <div className="space-y-6 border-t border-[var(--ink-200)] pt-6">
              {SECTIONS.map((s) => (
                <div key={s.title}>
                  <p className="eyebrow mb-2">{s.title}</p>
                  <ul className="space-y-1.5 list-none m-0 p-0">
                    {s.links.map((l) => (
                      <li key={l.href}>
                        {isExternal(l.href) ? (
                          <a href={l.href} className="block text-sm text-[var(--ink-700)] no-underline">
                            {l.label} <span className="text-[var(--ink-400,#9ca3af)]">↗</span>
                          </a>
                        ) : (
                          <Link
                            href={l.href}
                            onClick={() => setMobileOpen(false)}
                            className="block text-sm text-[var(--ink-700)] no-underline"
                          >
                            {l.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Global pages */}
            <div className="mt-6 border-t border-[var(--ink-200)] pt-6">
              <ul className="space-y-2 list-none m-0 p-0">
                {GLOBAL_LINKS.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="block py-1 text-base font-medium text-[var(--ink-900)] no-underline">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 pb-8">
              <Link
                href={NAV_CTA.href}
                onClick={() => setMobileOpen(false)}
                className="inline-flex w-full items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-medium text-zinc-950 no-underline"
              >
                {NAV_CTA.label}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
