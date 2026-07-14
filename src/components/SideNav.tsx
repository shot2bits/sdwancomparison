"use client";

/**
 * Flat task-first sidebar (2026-07-14, Robert's direction, replacing the v3
 * accordion he disliked): every link is always visible under a small
 * uppercase group label, no expand/collapse. Groups are ordered by buyer
 * intent in lib/nav.ts (Get quotes, Research the market, For suppliers,
 * then content). Tighter type scale: 11px labels, 12.5px links.
 *
 * "Your projects" carries a session-aware badge (drafts not yet published,
 * or live count) so a buyer's unfinished work follows them on every page —
 * the UI's answer to "they sign up and exit".
 *
 * NavList is shared with TopNav's mobile drawer. /sase/admin stays out of
 * public nav — the admin console link renders only for an authenticated
 * admin session. Session footer (sign out / supplier prompt) unchanged.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  NAV_GROUPS, NAV_CTA, CURRENT_APP,
  isCrossApp, appOf, toAppHref, activeHref, type NavLink,
} from "@/lib/nav";

type Session = { authenticated: boolean; role?: string; email?: string; vendor_slug?: string | null; admin?: boolean };

function NavAnchor({ link, className, onNavigate, badge }: { link: NavLink; className: string; onNavigate?: () => void; badge?: React.ReactNode }) {
  const cross = isCrossApp(link.href, CURRENT_APP);
  const inner = (
    <>
      <span className="truncate">{link.label}</span>
      {badge}
      {cross && <span aria-hidden="true" className="ml-1 text-[var(--ink-400,#9ca3af)]">↗</span>}
    </>
  );
  return appOf(link.href) === "sase" ? (
    <Link href={toAppHref(link.href)} className={className} onClick={onNavigate}>{inner}</Link>
  ) : (
    <a href={link.href} className={className} onClick={onNavigate}>{inner}</a>
  );
}

/**
 * Session-aware status for the "Your projects" link: unpublished drafts in
 * amber (the state we want resolved), otherwise the live count in green.
 * Renders nothing signed out or with no RFPs, so the public nav is clean.
 */
function ProjectsBadge() {
  const [counts, setCounts] = useState<{ drafts: number; live: number } | null>(null);
  useEffect(() => {
    const load = () =>
      fetch("/sase/api/rfp/mine")
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { rfps?: { status: string }[] } | null) => {
          if (!d?.rfps) return;
          const live = d.rfps.filter((r) => r.status === "published").length;
          setCounts({ drafts: d.rfps.length - live, live });
        })
        .catch(() => {});
    load();
    // The account page claims this browser's drafts after the badge's first
    // fetch, so it broadcasts when the list changes and the badge reloads
    // (Robert's screenshot, 14 July: badge said 1 draft beside a list of 6).
    window.addEventListener("netify:rfps-changed", load);
    return () => window.removeEventListener("netify:rfps-changed", load);
  }, []);
  if (!counts || (counts.drafts === 0 && counts.live === 0)) return null;
  return counts.drafts > 0 ? (
    <span className="ml-2 shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
      {counts.drafts} draft{counts.drafts === 1 ? "" : "s"}
    </span>
  ) : (
    <span className="ml-2 shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-900">
      {counts.live} live
    </span>
  );
}

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const current = activeHref(pathname, NAV_GROUPS);

  const itemCls = (href: string) =>
    `flex items-center rounded-md px-3 py-[3px] text-[12.5px] leading-5 no-underline transition-colors ${
      href === current
        ? "bg-amber-500/15 text-[var(--ink-900)] font-medium"
        : "text-[var(--ink-600,#71717a)] hover:bg-[var(--ink-100,#f3f3f3)] hover:text-[var(--ink-900)]"
    }`;

  return (
    <div>
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="mb-4">
          <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-400,#9ca3af)]">
            {group.label}
          </p>
          <div className="space-y-px">
            {(group.items ?? []).map((l) => (
              <NavAnchor
                key={l.href}
                link={l}
                onNavigate={onNavigate}
                className={itemCls(l.href)}
                badge={l.href === "/sase/account/" ? <ProjectsBadge /> : undefined}
              />
            ))}
          </div>
        </div>
      ))}
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
        <NavList />
        {/* Session-gated: never public */}
        {session?.authenticated && session.admin && (
          <div className="mt-3 border-t border-[var(--ink-200,#e5e5e5)] pt-3">
            <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-400,#9ca3af)]">Admin</p>
            <Link href="/admin" className="block rounded-md px-3 py-[3px] text-[12.5px] leading-5 no-underline text-[var(--ink-600,#71717a)] hover:bg-[var(--ink-100,#f3f3f3)] hover:text-[var(--ink-900)]">
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
