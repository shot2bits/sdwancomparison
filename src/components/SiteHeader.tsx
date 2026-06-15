'use client';

// ════════════════════════════════════════════════════════════════════════════
//   APPLE-STYLE MEGA-MENU
// ────────────────────────────────────────────────────────────────────────────
//   Behaviour matched against apple.com:
//
//   • The drawer is `position: absolute` anchored to the bottom of the
//     sticky header. It OVERLAYS the page content, it never pushes
//     anything down. The header's own height is fixed.
//   • Hover any top item with a submenu → drawer slides down with
//     opacity + translateY transition (~250ms ease-out).
//   • Once open, hovering a different top item swaps content INSTANTLY
//     without closing the drawer.
//   • Hovering INTO the drawer keeps it open. Moving the cursor off
//     both the bar AND the drawer starts a ~200ms close timer.
//   • Soft scrim fades in behind the drawer so page content recedes.
//   • Click outside, Escape, or any link click closes it.
//
//   SEO note: every panel, every section title, every sub-link, is
//   rendered to HTML on every request. Inactive panels carry display:none
//   for the visible state but are still in the DOM, so AI crawlers and
//   search bots see the full link graph.
// ════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { NAV_LOCAL as NAV, NAV_CTA } from '@/lib/nav';
import { ArrowUpRight, Menu, X, Plus } from 'lucide-react';

const HOVER_OPEN_DELAY = 60;   // ms
const HOVER_CLOSE_DELAY = 220; // ms, generous so the cursor can cross the visual gap

const isExternal = (href: string) => href.startsWith('http');

export function SiteHeader() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLElement>(null);

  const clearTimers = useCallback(() => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);

  const openMenu = useCallback((i: number) => {
    clearTimers();
    setActiveIndex((prev) => {
      if (prev !== null) return i; // already open → swap content instantly
      openTimer.current = setTimeout(() => setActiveIndex(i), HOVER_OPEN_DELAY);
      return prev;
    });
  }, [clearTimers]);

  const scheduleClose = useCallback(() => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setActiveIndex(null), HOVER_CLOSE_DELAY);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);

  const closeNow = useCallback(() => {
    clearTimers();
    setActiveIndex(null);
  }, [clearTimers]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setActiveIndex(null); setMobileOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (activeIndex === null) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setActiveIndex(null);
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [activeIndex]);

  const ctaExternal = isExternal(NAV_CTA.href);
  const menuOpen = activeIndex !== null;

  return (
    <>
      {/* Scrim behind drawer, soft, light, Apple-style (not a heavy dim) */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-30 bg-zinc-950 transition-opacity duration-[400ms] [transition-timing-function:cubic-bezier(0.28,0.11,0.32,1)] ${
          menuOpen ? 'opacity-[0.08]' : 'opacity-0'
        }`}
      />

      <header
        ref={rootRef}
        className="sticky top-0 z-40 border-b border-zinc-200/60 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70"
      >
        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div
          className="relative mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3.5"
          onMouseLeave={scheduleClose}
        >
          {/* Logo */}
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 text-base font-semibold tracking-tight text-zinc-900"
            onMouseEnter={scheduleClose}
            onClick={closeNow}
          >
            <span className="grid h-7 w-7 place-items-center rounded-md bg-zinc-950 text-white text-sm font-bold">N</span>
            <span>Netify</span>
          </Link>

          {/* Desktop nav */}
          <nav aria-label="Primary" className="hidden flex-1 md:block">
            <ul className="flex items-center justify-center gap-1">
              {NAV.map((item, i) => {
                const hasMenu = !!item.sections?.length;
                const external = isExternal(item.href);
                const isOpen = activeIndex === i;
                const sharedClass = `inline-flex items-center px-4 py-1.5 text-[13px] tracking-tight transition-colors ${
                  isOpen ? 'text-zinc-950' : 'text-zinc-700 hover:text-zinc-950'
                }`;
                return (
                  <li
                    key={item.label}
                    onMouseEnter={() => (hasMenu ? openMenu(i) : scheduleClose())}
                    onFocus={() => hasMenu && openMenu(i)}
                  >
                    {external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={sharedClass}
                        onClick={closeNow}
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        className={sharedClass}
                        aria-expanded={hasMenu ? isOpen : undefined}
                        aria-haspopup={hasMenu ? 'true' : undefined}
                        onClick={closeNow}
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* CTA */}
          <div className="hidden shrink-0 md:block" onMouseEnter={scheduleClose}>
            {ctaExternal ? (
              <a
                href={NAV_CTA.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-5 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-amber-400"
                onClick={closeNow}
              >
                {NAV_CTA.label}
              </a>
            ) : (
              <Link
                href={NAV_CTA.href}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-5 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-amber-400"
                onClick={closeNow}
              >
                {NAV_CTA.label}
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6 text-zinc-900" />
          </button>
        </div>

        {/* ── Mega drawer ─────────────────────────────────────────────────────
            position: absolute so it OVERLAYS the page below without pushing
            content down. Anchored to top: 100% of the header (i.e. just below
            the top bar). All panels live in the DOM for SEO; inactive ones
            use display: none. */}
        <div
          className={`absolute inset-x-0 top-full z-40 hidden overflow-hidden bg-[#fbfbfd] shadow-[0_24px_48px_-16px_rgba(0,0,0,0.10)] transition-[max-height,opacity,transform] duration-[400ms] [transition-timing-function:cubic-bezier(0.28,0.11,0.32,1)] md:block ${
            menuOpen
              ? 'max-h-[760px] opacity-100 translate-y-0 pointer-events-auto'
              : 'max-h-0 opacity-0 -translate-y-1 pointer-events-none'
          }`}
          aria-hidden={!menuOpen}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          {NAV.map((item, i) => {
            if (!item.sections?.length) return null;
            const visible = activeIndex === i;

            // Apple-style grid: the LARGE section spans col-span-2 on the
            // left; the SMALL sections stack into the remaining column on
            // the right. If a drawer only has small sections, fall back to
            // an even three-column grid.
            const hasLarge = item.sections.some((s) => s.size === 'large');

            return (
              <div
                key={item.label}
                className={visible ? 'block' : 'hidden'}
                aria-hidden={!visible}
              >
                <div className="mx-auto max-w-6xl px-6 py-10">
                  <div
                    className={
                      hasLarge
                        ? 'grid gap-x-12 gap-y-8 md:grid-cols-3'
                        : 'grid gap-x-12 gap-y-8 md:grid-cols-3'
                    }
                  >
                    {item.sections.map((section) => {
                      const isLarge = section.size === 'large';
                      return (
                        <div
                          key={section.title}
                          className={isLarge && hasLarge ? 'md:col-span-2' : ''}
                        >
                          <h3 className="text-[12px] font-normal tracking-tight text-[#86868b]">
                            {section.title}
                          </h3>
                          <ul className={isLarge ? 'mt-4 space-y-3' : 'mt-3.5 space-y-2.5'}>
                            {section.links.map((l) => {
                              const external = isExternal(l.href);
                              // Large: 20px medium, tight leading. Smaller
                              // than apple.com's literal pixel size but reads
                              // proportionally to the rest of the site.
                              // Small: 13px regular for the secondary column.
                              const linkLabelClass = isLarge
                                ? 'flex items-center gap-2 text-[20px] font-medium leading-tight tracking-tight text-zinc-900 transition-colors group-hover:text-amber-700'
                                : 'flex items-center gap-1.5 text-[13px] font-normal leading-snug text-zinc-700 transition-colors group-hover:text-zinc-950';
                              const iconSize = isLarge ? 'h-4 w-4' : 'h-3 w-3';
                              const title = (
                                <span className={linkLabelClass}>
                                  {l.label}
                                  {external && <ArrowUpRight className={`${iconSize} opacity-50`} />}
                                </span>
                              );
                              const desc = l.description ? (
                                <span
                                  className={
                                    isLarge
                                      ? 'mt-1.5 block text-[13px] leading-snug text-[#86868b]'
                                      : 'mt-0.5 block text-[12px] leading-snug text-[#86868b]'
                                  }
                                >
                                  {l.description}
                                </span>
                              ) : null;
                              return (
                                <li key={l.href}>
                                  {external ? (
                                    <a
                                      href={l.href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="group block"
                                      onClick={closeNow}
                                    >
                                      {title}
                                      {desc}
                                    </a>
                                  ) : (
                                    <Link
                                      href={l.href}
                                      className="group block"
                                      onClick={closeNow}
                                    >
                                      {title}
                                      {desc}
                                    </Link>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 bg-white md:hidden">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 text-base font-semibold tracking-tight text-zinc-900"
              >
                <span className="grid h-7 w-7 place-items-center rounded-md bg-zinc-950 text-white text-sm font-bold">N</span>
                <span>Netify</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-6 w-6 text-zinc-900" />
              </button>
            </div>
            <nav aria-label="Primary (mobile)" className="overflow-y-auto px-6 py-4">
              <ul className="divide-y divide-zinc-200">
                {NAV.map((item) => (
                  <li key={item.label} className="py-2">
                    {item.sections?.length ? (
                      <details className="group">
                        <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-base font-medium text-zinc-900">
                          <span>{item.label}</span>
                          <Plus className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-45" />
                        </summary>
                        <div className="space-y-5 pb-4 pl-2">
                          {item.sections.map((section) => (
                            <div key={section.title}>
                              <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">{section.title}</h3>
                              <ul className="mt-3 space-y-2">
                                {section.links.map((l) => (
                                  <li key={l.href}>
                                    {isExternal(l.href) ? (
                                      <a
                                        href={l.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={() => setMobileOpen(false)}
                                        className="block text-sm text-zinc-700 hover:text-amber-700"
                                      >
                                        {l.label}
                                      </a>
                                    ) : (
                                      <Link
                                        href={l.href}
                                        onClick={() => setMobileOpen(false)}
                                        className="block text-sm text-zinc-700 hover:text-amber-700"
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
                      </details>
                    ) : isExternal(item.href) ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setMobileOpen(false)}
                        className="block py-3 text-base font-medium text-zinc-900"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className="block py-3 text-base font-medium text-zinc-900"
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <a
                  href={NAV_CTA.href}
                  target={ctaExternal ? '_blank' : undefined}
                  rel={ctaExternal ? 'noopener noreferrer' : undefined}
                  className="inline-flex w-full items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-medium text-zinc-950"
                  onClick={() => setMobileOpen(false)}
                >
                  {NAV_CTA.label}
                </a>
              </div>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
