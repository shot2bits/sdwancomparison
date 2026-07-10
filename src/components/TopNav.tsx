"use client";

/**
 * SHARED TOP BAR — grouped dropdown menus (2026-07-10 spec).
 *
 * Mirror of the marketing site's site-header.tsx with this app's design
 * tokens; src/lib/nav.ts is the single source of truth. In-app links use
 * next/link with the /sase basePath stripped (Link re-applies it);
 * marketing-site links are root-relative plain <a>. The ↗ icon is computed
 * via isCrossApp() — it appears if and only if a link leaves this app.
 *
 * Accessibility: triggers carry aria-expanded/aria-haspopup, open on
 * Enter/Space (button semantics) or hover (pointer); ArrowUp/Down/Home/End
 * move focus in the open menu; Esc closes and refocuses the trigger; click
 * outside closes.
 *
 * Responsive: the dropdown bar shows from lg. Below lg the hamburger is the
 * only navigation (the desktop sidebar also starts at lg — tablet gap,
 * Harry's testing 03/07/2026). The drawer is PORTALED to <body> with an
 * explicit opaque background: inside the sticky header its background failed
 * to cover the page (Harry's retest, 08/07/2026).
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  TOP_MENU, SECTIONS, SIDEBAR_HEADER, SIGN_IN, NAV_CTA, CURRENT_APP,
  isCrossApp, appOf, toAppHref, type NavLink,
} from "@/lib/nav";

const HOVER_CLOSE_DELAY = 200; // ms

function Cross({ href }: { href: string }) {
  if (!isCrossApp(href, CURRENT_APP)) return null;
  return <span aria-hidden="true" className="text-[var(--ink-400,#9ca3af)]"> ↗</span>;
}

function NavAnchor({ link, className, onNavigate }: { link: NavLink; className: string; onNavigate?: () => void }) {
  if (appOf(link.href) === "sase") {
    return (
      <Link href={toAppHref(link.href)} className={className} onClick={onNavigate}>
        {link.label}
        <Cross href={link.href} />
      </Link>
    );
  }
  return (
    <a href={link.href} className={className} onClick={onNavigate}>
      {link.label}
      <Cross href={link.href} />
    </a>
  );
}

export default function TopNav() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Portal target only exists client-side; render the drawer after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const pathname = usePathname();
  const rootRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpenIndex(null), HOVER_CLOSE_DELAY);
  }, [cancelClose]);
  const closeAndRefocus = useCallback((i: number) => {
    setOpenIndex(null);
    triggerRefs.current[i]?.focus();
  }, []);

  useEffect(() => { setOpenIndex(null); setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);
  useEffect(() => {
    if (openIndex === null) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenIndex(null);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [openIndex]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (openIndex !== null) closeAndRefocus(openIndex);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, closeAndRefocus]);

  const menuLinks = (i: number): HTMLAnchorElement[] =>
    Array.from(panelRefs.current[i]?.querySelectorAll("a") ?? []);

  // ArrowDown on a closed trigger: the panel is still display:none when the
  // same-tick focus() runs (focus on a hidden element is silently ignored),
  // so defer the focus to an effect that runs AFTER React commits the open
  // state. If the menu is already open, focus the first link directly.
  const pendingFocus = useRef<number | null>(null);
  useEffect(() => {
    if (openIndex !== null && pendingFocus.current === openIndex) {
      pendingFocus.current = null;
      menuLinks(openIndex)[0]?.focus();
    }
  }, [openIndex]);

  const onTriggerKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (openIndex === i) {
        menuLinks(i)[0]?.focus();
      } else {
        pendingFocus.current = i;
        setOpenIndex(i);
      }
    }
  };
  const onPanelKeyDown = (e: React.KeyboardEvent, i: number) => {
    const links = menuLinks(i);
    const idx = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === "ArrowDown") { e.preventDefault(); links[Math.min(idx + 1, links.length - 1)]?.focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); links[Math.max(idx - 1, 0)]?.focus(); }
    else if (e.key === "Home") { e.preventDefault(); links[0]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); links[links.length - 1]?.focus(); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeAndRefocus(i); }
    else if (e.key === "Tab") { setOpenIndex(null); }
  };

  return (
    <header
      ref={rootRef}
      className="sticky top-0 z-40 h-12 border-b border-[var(--ink-200)]/60 bg-[var(--paper-base)]/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-base font-semibold tracking-tight text-[var(--ink-900)] no-underline">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-zinc-950 text-white text-sm font-bold">N</span>
          <span>Netify</span>
        </Link>

        {/* Desktop (lg+): grouped dropdowns */}
        <nav aria-label="Primary" className="hidden flex-1 lg:block">
          <ul className="flex items-center justify-center gap-0.5 list-none m-0 p-0">
            {TOP_MENU.map((group, i) =>
              group.items?.length ? (
                <li
                  key={group.label}
                  className="relative"
                  onMouseEnter={() => { cancelClose(); setOpenIndex(i); }}
                  onMouseLeave={scheduleClose}
                >
                  <button
                    type="button"
                    ref={(el) => { triggerRefs.current[i] = el; }}
                    aria-expanded={openIndex === i}
                    aria-haspopup="true"
                    aria-controls={`nav-menu-${i}`}
                    onClick={() => setOpenIndex(openIndex === i ? null : i)}
                    onKeyDown={(e) => onTriggerKeyDown(e, i)}
                    className={`inline-flex items-center gap-1 whitespace-nowrap px-3 py-1.5 text-[13px] tracking-tight transition-colors bg-transparent border-0 cursor-pointer ${
                      openIndex === i ? "text-[var(--ink-900)]" : "text-[var(--ink-700)] hover:text-[var(--ink-900)]"
                    }`}
                  >
                    {group.label}
                    <span aria-hidden="true" className={`text-[10px] opacity-60 transition-transform ${openIndex === i ? "rotate-180" : ""}`}>▾</span>
                  </button>
                  <div
                    id={`nav-menu-${i}`}
                    ref={(el) => { panelRefs.current[i] = el; }}
                    onKeyDown={(e) => onPanelKeyDown(e, i)}
                    className={`absolute left-1/2 top-full z-40 min-w-56 -translate-x-1/2 pt-2 ${openIndex === i ? "block" : "hidden"}`}
                  >
                    <ul className="rounded-xl border border-[var(--ink-200)] bg-[var(--paper-base,#fff)] p-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.15)] list-none m-0">
                      {group.items.map((l) => (
                        <li key={l.href}>
                          <NavAnchor
                            link={l}
                            onNavigate={() => setOpenIndex(null)}
                            className="block whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] text-[var(--ink-700)] no-underline transition-colors hover:bg-[var(--ink-100,#f3f3f3)] hover:text-[var(--ink-900)]"
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ) : (
                <li key={group.label}>
                  <NavAnchor
                    link={{ label: group.label, href: group.href! }}
                    className="inline-flex items-center gap-1 whitespace-nowrap px-3 py-1.5 text-[13px] tracking-tight text-[var(--ink-700)] no-underline transition-colors hover:text-[var(--ink-900)]"
                  />
                </li>
              ),
            )}
          </ul>
        </nav>

        {/* Right: Sign in + CTA (lg+) */}
        <div className="hidden shrink-0 items-center gap-4 lg:flex">
          <NavAnchor
            link={SIGN_IN}
            className="inline-flex items-center whitespace-nowrap text-[13px] tracking-tight text-[var(--ink-700)] no-underline transition-colors hover:text-[var(--ink-900)]"
          />
          <Link
            href={toAppHref(NAV_CTA.href)}
            className="inline-flex items-center whitespace-nowrap rounded-full bg-amber-500 px-5 py-1.5 text-[13px] font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400"
          >
            {NAV_CTA.label}
          </Link>
        </div>

        {/* Hamburger below lg: only nav there (sidebar starts at lg). */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="lg:hidden shrink-0 rounded-md border border-[var(--ink-300,#d4d4d8)] px-3 py-1.5 text-sm"
          aria-label="Open menu"
        >
          Menu
        </button>
      </div>

      {/* Drawer: portaled to <body> with an explicit opaque background
          (Harry's retest, 08/07/2026). */}
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
          <nav aria-label="Primary (mobile)" className="h-[calc(100dvh-3rem)] overflow-y-auto px-6 py-4">
            <ul className="divide-y divide-[var(--ink-200)] list-none m-0 p-0">
              {TOP_MENU.map((group) => (
                <li key={group.label} className="py-2">
                  {group.items?.length ? (
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-base font-medium text-[var(--ink-900)]">
                        <span>{group.label}</span>
                        <span aria-hidden="true" className="text-[var(--ink-500)] transition-transform group-open:rotate-45">+</span>
                      </summary>
                      <ul className="space-y-2 pb-4 pl-2 list-none m-0 p-0">
                        {group.items.map((l) => (
                          <li key={l.href}>
                            <NavAnchor
                              link={l}
                              onNavigate={() => setMobileOpen(false)}
                              className="block text-sm text-[var(--ink-700)] no-underline"
                            />
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <NavAnchor
                      link={{ label: group.label, href: group.href! }}
                      onNavigate={() => setMobileOpen(false)}
                      className="block py-3 text-base font-medium text-[var(--ink-900)] no-underline"
                    />
                  )}
                </li>
              ))}
              <li className="py-2">
                <NavAnchor
                  link={SIGN_IN}
                  onNavigate={() => setMobileOpen(false)}
                  className="block py-3 text-base font-medium text-[var(--ink-900)] no-underline"
                />
              </li>
            </ul>

            {/* This app's deep nav (desktop sidebar hidden below lg) */}
            <div className="mt-4 space-y-6 border-t border-[var(--ink-200)] pt-6">
              <p className="eyebrow">{SIDEBAR_HEADER}</p>
              {SECTIONS.map((s) => (
                <div key={s.title}>
                  <p className="eyebrow mb-2">{s.title}</p>
                  <ul className="space-y-1.5 list-none m-0 p-0">
                    {s.links.map((l) => (
                      <li key={`${s.title}-${l.href}`}>
                        <NavAnchor
                          link={l}
                          onNavigate={() => setMobileOpen(false)}
                          className="block text-sm text-[var(--ink-700)] no-underline"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-6 pb-8">
              <Link
                href={toAppHref(NAV_CTA.href)}
                onClick={() => setMobileOpen(false)}
                className="inline-flex w-full items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-medium text-zinc-950 no-underline"
              >
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
