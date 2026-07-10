"use client";

/**
 * App-style accordion sidebar — the navigation (2026-07-10 v3).
 *
 * Each menu item expands in place (WAI-ARIA disclosure: button +
 * aria-expanded + aria-controls; Enter/Space toggle natively). Multi-expand;
 * the current page's section opens automatically without closing sections
 * the visitor opened. Shared NAV_GROUPS mirror the marketing site; this
 * app's own sections (APP_GROUPS) follow under a divider.
 *
 * AccordionNav is shared with TopNav's mobile drawer. /sase/admin stays out
 * of public nav — the admin console link renders only for an authenticated
 * admin session. Session footer (sign out / supplier prompt) unchanged.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  NAV_GROUPS, APP_GROUPS, NAV_CTA, CURRENT_APP,
  isCrossApp, appOf, toAppHref, activeHref, groupIsCurrent, type NavGroup, type NavLink,
} from "@/lib/nav";

type Session = { authenticated: boolean; role?: string; email?: string; vendor_slug?: string | null; admin?: boolean };

const ALL_GROUPS = [...NAV_GROUPS, ...APP_GROUPS];

function NavAnchor({ link, className, onNavigate }: { link: NavLink; className: string; onNavigate?: () => void }) {
  const cross = isCrossApp(link.href, CURRENT_APP);
  const inner = (
    <>
      {link.label}
      {cross && <span aria-hidden="true" className="text-[var(--ink-400,#9ca3af)]"> ↗</span>}
    </>
  );
  return appOf(link.href) === "sase" ? (
    <Link href={toAppHref(link.href)} className={className} onClick={onNavigate}>{inner}</Link>
  ) : (
    <a href={link.href} className={className} onClick={onNavigate}>{inner}</a>
  );
}

export function AccordionNav({ onNavigate, idPrefix = "nav" }: { onNavigate?: () => void; idPrefix?: string }) {
  const pathname = usePathname();
  const current = activeHref(pathname, ALL_GROUPS);

  const [open, setOpen] = useState<Set<string>>(
    () => new Set(ALL_GROUPS.filter((g) => groupIsCurrent(pathname, g)).map((g) => g.label)),
  );
  useEffect(() => {
    setOpen((prev) => {
      const next = new Set(prev);
      ALL_GROUPS.forEach((g) => { if (groupIsCurrent(pathname, g)) next.add(g.label); });
      return next;
    });
  }, [pathname]);

  const toggle = (label: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  const itemCls = (href: string) =>
    `block rounded-md px-3 py-1.5 text-[13px] no-underline transition-colors ${
      href === current
        ? "bg-amber-500/15 text-[var(--ink-900)] font-medium"
        : "text-[var(--ink-600,#71717a)] hover:bg-[var(--ink-100,#f3f3f3)] hover:text-[var(--ink-900)]"
    }`;

  const renderGroup = (group: NavGroup, gi: number, prefix: string) => {
    if (!group.items?.length) {
      return (
        <NavAnchor
          key={group.label}
          link={{ label: group.label, href: group.href! }}
          onNavigate={onNavigate}
          className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-[var(--ink-900)] no-underline transition-colors hover:bg-[var(--ink-100,#f3f3f3)]"
        />
      );
    }
    const isOpen = open.has(group.label);
    const panelId = `${idPrefix}-${prefix}-${gi}`;
    return (
      <div key={group.label}>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => toggle(group.label)}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-[var(--ink-900)] bg-transparent border-0 cursor-pointer transition-colors hover:bg-[var(--ink-100,#f3f3f3)]"
        >
          <span className="flex-1">{group.label}</span>
          <span
            aria-hidden="true"
            className={`text-[11px] text-[var(--ink-400,#9ca3af)] transition-transform duration-200 inline-block ${isOpen ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </button>
        <div id={panelId} hidden={!isOpen}>
          <div className="ml-3 border-l border-[var(--ink-200,#e5e5e5)] pl-2 py-1 space-y-0.5">
            {group.items.map((l) => (
              <NavAnchor key={l.href} link={l} onNavigate={onNavigate} className={itemCls(l.href)} />
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-0.5">
      {NAV_GROUPS.map((g, i) => renderGroup(g, i, "core"))}
      <div aria-hidden="true" className="my-3 border-t border-[var(--ink-200,#e5e5e5)]" />
      {APP_GROUPS.map((g, i) => renderGroup(g, i, "app"))}
    </div>
  );
}

export default function SideNav() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => { fetch("/sase/api/auth/session").then((r) => r.json()).then(setSession).catch(() => setSession({ authenticated: false })); }, []);

  async function logout() {
    await fetch("/sase/api/auth/logout", { method: "POST" }).catch(() => {});
    setSession({ authenticated: false });
  }

  const accountActive = pathname.replace(/\/$/, "") === "/account";

  return (
    <aside className="hidden lg:flex fixed left-0 top-12 bottom-0 w-60 flex-col border-r border-[var(--ink-200)] bg-[var(--paper-raised,#f4f4f5)]/60 px-3 py-4 z-20">
      <nav className="flex-1 overflow-y-auto" aria-label="Primary">
        <AccordionNav idPrefix="side" />
        {/* Session-gated: never public */}
        {session?.authenticated && session.admin && (
          <div className="mt-3 border-t border-[var(--ink-200,#e5e5e5)] pt-3">
            <p className="eyebrow px-3 mb-1.5">Admin</p>
            <Link href="/admin" className="block rounded-md px-3 py-1.5 text-[13px] no-underline text-[var(--ink-600,#71717a)] hover:bg-[var(--ink-100,#f3f3f3)] hover:text-[var(--ink-900)]">
              Admin console
            </Link>
          </div>
        )}
      </nav>

      <div className="pt-4 mt-2 border-t border-[var(--ink-200,#e5e5e5)] space-y-2">
        <Link href={toAppHref(NAV_CTA.href)} className="block text-center rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400">
          {NAV_CTA.label}
        </Link>
        {session === null ? null : session.authenticated ? (
          <div className="px-3 text-xs text-[var(--ink-600)]">
            <p className="truncate">{session.email}{session.vendor_slug ? ` · ${session.vendor_slug}` : session.admin ? " · admin" : ""}</p>
            <div className="mt-1 flex gap-3">
              <Link href="/account" className={`no-underline ${accountActive ? "text-[var(--ink-900)] font-medium" : "underline hover:text-[var(--ink-900)]"}`}>My account</Link>
              <button onClick={logout} className="underline hover:text-[var(--ink-900)] bg-transparent border-0 cursor-pointer p-0 text-xs text-[var(--ink-600)]">Sign out</button>
            </div>
          </div>
        ) : (
          <Link href="/for-suppliers" className="block px-3 text-xs text-[var(--ink-600)] no-underline hover:text-[var(--ink-900)]">Supplier? Sign in to bid →</Link>
        )}
      </div>
    </aside>
  );
}
