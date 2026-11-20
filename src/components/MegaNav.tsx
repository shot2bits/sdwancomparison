"use client";
import ReleaseVersion from "@/components/ReleaseVersion";

/**
 * The 2026 top navigation (Robert's spec, 24 Jul; his verdicts: one header
 * everywhere including the apex takeover, both repos, main as always). It
 * replaces the sidebar and the zone-switcher bar in one system:
 *
 * - Five groups from MEGA_GROUPS (lib/nav.ts), each href verified against
 *   a real route before it entered the data. The board stands alone.
 * - Desktop: click or tap opens a stable panel; state-driven (not
 *   CSS-only hover) so keyboard users get the same menu: Enter opens,
 *   Escape closes, aria-expanded and aria-haspopup carried.
 * - Mobile: a right slide-over drawer with accordion sections and generous
 *   touch targets, portaled to body (the July drawer-background fix).
 * - Session-aware: Sign in becomes My account, the drafts badge follows
 *   the buyer (the answer to "they sign up and exit"), admins keep their
 *   console link. Amber stays the one action colour.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { lockMenuScroll } from "@/lib/menu-scroll-lock";
import { usePathname } from "next/navigation";
import { MEGA_GROUPS, NAV_CTA, SIGN_IN, ACCOUNT, type MegaGroup } from "@/lib/nav";

type Session = { authenticated: boolean; role?: string; email?: string; vendor_slug?: string | null; admin?: boolean };

/** Unpublished drafts in amber, otherwise the live count: real state only. */
function ProjectsBadge({ enabled }: { enabled: boolean }) {
  const [counts, setCounts] = useState<{ drafts: number; live: number } | null>(null);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const load = () =>
      fetch("/sase/api/rfp/mine")
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { rfps?: { status: string; published?:boolean }[] } | null) => {
          if (!d?.rfps) return;
          const live = d.rfps.filter((r) => r.published ?? ["published","qa","evaluation","awarded","transacting","complete"].includes(r.status)).length;
          setCounts({ drafts: d.rfps.length - live, live });
        })
        .catch(() => {});
    load();
    window.addEventListener("netify:rfps-changed", load);
    return () => window.removeEventListener("netify:rfps-changed", load);
  }, [enabled]);
  if (!enabled || !counts || (counts.drafts === 0 && counts.live === 0)) return null;
  return counts.drafts > 0 ? (
    <span className="ml-1.5 shrink-0 rounded-full bg-amber-100 px-1.5 py-[1px] text-[10px] font-medium text-amber-900">
      {counts.drafts} draft{counts.drafts === 1 ? "" : "s"}
    </span>
  ) : (
    <span className="ml-1.5 shrink-0 rounded-full bg-emerald-100 px-1.5 py-[1px] text-[10px] font-medium text-emerald-900">
      {counts.live} live
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"
      className={`text-zinc-400 transition-transform duration-200 group-hover:text-zinc-700 ${open ? "rotate-180" : ""}`}>
      <path d="M2.5 4.5 L6 8 L9.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PanelItems({ group, onNavigate }: { group: MegaGroup; onNavigate?: () => void }) {
  return (
    <>
      {group.primaryLabel && <h2 className="px-2.5 pb-2 text-xs font-semibold text-zinc-600">{group.primaryLabel}</h2>}
      <div className={group.columns === 2 ? "grid grid-cols-1 gap-1 sm:grid-cols-2" : "grid grid-cols-1 gap-1"}>
        {group.items.map((item) => (
          <a
            key={`${item.href}:${item.label}`}
            href={item.href}
            onClick={onNavigate}
            className="block rounded-xl p-2.5 no-underline transition-all duration-150 hover:bg-zinc-50/80"
          >
            <span className="block text-[12.5px] font-semibold leading-snug text-zinc-900">{item.label}</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">{item.desc}</span>
          </a>
        ))}
      </div>
      {group.comparisonGroup && (
        <section aria-label={group.comparisonGroup.label} className="mt-3 border-t border-zinc-200/80 pt-3">
          <h2 className="px-2.5 pb-2 text-[12px] font-semibold tracking-wide text-zinc-600">{group.comparisonGroup.label}</h2>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {group.comparisonGroup.items.map(item => (
              <a key={item.href} href={item.href} onClick={onNavigate} className="block rounded-xl p-2.5 no-underline transition-colors hover:bg-zinc-50/80">
                <span className="block text-[12.5px] font-semibold leading-snug text-zinc-900">{item.label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500">{item.desc}</span>
              </a>
            ))}
          </div>
        </section>
      )}
      {group.footerLink && (
        <a
          href={group.footerLink.href}
          onClick={onNavigate}
          className="mt-2 block border-t border-zinc-100 px-2.5 pt-2.5 text-[11.5px] font-medium text-zinc-600 no-underline hover:text-zinc-950"
        >
          {group.footerLink.label} <span aria-hidden="true">→</span>
        </a>
      )}
    </>
  );
}

export default function MegaNav() {
  const pathname = usePathname();
  /* ONE NAVIGATION, ALWAYS, RENDERED BY THE ROOT LAYOUT (30 Jul 2026).
   * This used to take a `takeover` prop and return null on /home and
   * /workspace, because those routes rendered their own copy inside a
   * fixed z-70 overlay. The overlay is gone (it was burying the site
   * footer), and the moment it went, the apex root showed TWO sticky
   * headers: the layout's and the door's. The pathname test could not fix
   * it, because netify.co.uk/ and /sase/ are BOTH "/" once the basePath is
   * stripped, and /sase/ has no nav of its own. So the doors no longer
   * render a nav at all and this instance serves every route. */
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);

  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/sase/api/auth/session")
      .then((r) => r.json())
      .then((d: Session) => { if (live) setSession(d); })
      .catch(() => { if (live) setSession({ authenticated: false }); });
    return () => { live = false; };
  }, [pathname]);
  const accountLabel = session?.authenticated ? ACCOUNT.label : SIGN_IN.label;
  /* Signed in goes to the record. Signed out goes to the prompt, not to a
     sign-in box: an account is produced by publishing (30 Jul 2026). */
  const accountHref = session?.authenticated ? ACCOUNT.href : SIGN_IN.href;

  useLayoutEffect(() => {
    if (!mobileOpen) return;
    return lockMenuScroll();
  }, [mobileOpen]);
  useEffect(() => {
    if (!openGroup) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) setOpenGroup(null);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [openGroup]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const close = () => { setMobileOpen(false); setOpenSection(null); setOpenGroup(null); };
    media.addEventListener("change", close);
    return () => media.removeEventListener("change", close);
  }, []);
  useEffect(() => {
    queueMicrotask(() => { setMobileOpen(false); setOpenSection(null); setOpenGroup(null); });
  }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMobileOpen(false); setOpenGroup(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);


  return (
    <header ref={headerRef} onBlur={event => { if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpenGroup(null); }} className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.04)]">
      <div className="mx-auto flex h-13 max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
        <a href="https://netify.co.uk/" className="flex shrink-0 items-center gap-2 text-[15px] font-semibold tracking-tight text-zinc-900 no-underline">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-zinc-950 text-sm font-bold text-white">N</span>
          <span>Netify</span>
        </a>

        <ReleaseVersion />
        {/* Desktop groups */}
        <nav aria-label="Primary" className="hidden min-w-0 items-center gap-1 xl:flex">
          {MEGA_GROUPS.map((group, gi) => {
            const open = openGroup === group.label;
            return (
              <div
                key={group.label}
                className="group relative"
              >
                <button
                  type="button"
                  aria-expanded={open}
                  aria-haspopup="true"
                  onClick={() => setOpenGroup(current => current === group.label ? null : group.label)}
                  className="flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-2 text-[13px] font-medium text-zinc-600 transition-colors hover:text-zinc-950"
                >
                  {group.label}
                  <Chevron open={open} />
                </button>
                <div
                  aria-hidden={!open}
                  inert={!open}
                  style={{ backgroundColor: "#ffffff" }}
                  className={`absolute top-full max-h-[calc(100dvh-80px)] overflow-y-auto rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.12)] ${
                    gi >= 2 ? "right-0" : "left-0"
                  } ${group.columns === 2 ? "w-[540px]" : "w-[360px]"} ${
                    open ? "block" : "hidden"
                  }`}
                >
                  <PanelItems group={group} onNavigate={() => setOpenGroup(null)} />
                </div>
              </div>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex shrink-0 items-center gap-3">
          {session?.authenticated && session.admin && (
            <a href="/sase/admin/" className="hidden text-[12px] font-medium text-zinc-500 no-underline transition-colors hover:text-zinc-950 md:inline-flex">
              Admin
            </a>
          )}
          <a href={accountHref} className="hidden items-center text-[12.5px] font-medium text-zinc-600 no-underline transition-colors hover:text-zinc-950 sm:inline-flex">
            {accountLabel}
            <ProjectsBadge enabled={Boolean(session?.authenticated)} />
          </a>
          <a
            href={NAV_CTA.href}
            className="hidden items-center whitespace-nowrap rounded-full bg-amber-500 px-4 py-2 text-[12.5px] font-bold text-zinc-950 no-underline shadow-sm transition-all duration-150 hover:bg-amber-400 hover:shadow active:scale-95 sm:inline-flex"
          >
            {NAV_CTA.label}
          </a>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 text-sm xl:hidden"
          >
            Menu
          </button>
        </div>
      </div>

      {/* Mobile: the right slide-over drawer */}
      {mobileOpen && createPortal(
        <div className="fixed inset-0 z-[100] xl:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="absolute inset-0 border-0 bg-zinc-950/20" />
          <div className="absolute inset-y-0 right-0 w-full max-w-sm overflow-y-auto border-l border-zinc-200 bg-white p-6 shadow-2xl" style={{ backgroundColor: "#ffffff" }}>
            <div className="mb-4 flex items-center justify-between">
              <a href="https://netify.co.uk/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-zinc-900 no-underline">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-zinc-950 text-sm font-bold text-white">N</span>
                <span>Netify</span>
              </a>
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu" className="border-0 bg-transparent text-sm text-zinc-600">
                Close
              </button>
            </div>
            <nav aria-label="Primary (mobile)">
              {MEGA_GROUPS.map((group) => {
                const open = openSection === group.label;
                return (
                  <div key={group.label} className="border-b border-zinc-100">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenSection(open ? null : group.label)}
                      className="flex w-full items-center justify-between border-0 bg-transparent py-3 text-left text-[14px] font-semibold text-zinc-900"
                    >
                      {group.label}
                      <Chevron open={open} />
                    </button>
                    {open && (
                      <div className="pb-3">
                        <PanelItems group={group} onNavigate={() => setMobileOpen(false)} />
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
            <div className="mt-5 space-y-3">
              <a href={accountHref} onClick={() => setMobileOpen(false)} className="flex items-center py-1 text-sm font-medium text-zinc-900 no-underline">
                {accountLabel}
                <ProjectsBadge enabled={Boolean(session?.authenticated)} />
              </a>
              {session?.authenticated && session.admin && (
                <a href="/sase/admin/" onClick={() => setMobileOpen(false)} className="block py-1 text-sm text-zinc-600 no-underline">Admin console</a>
              )}
              <a href={NAV_CTA.href} onClick={() => setMobileOpen(false)} className="flex w-full items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-bold text-zinc-950 no-underline transition-all active:scale-95">
                {NAV_CTA.label}
              </a>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </header>
  );
}
