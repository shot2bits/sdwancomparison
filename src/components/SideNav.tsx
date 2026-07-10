"use client";

/**
 * Contextual sidebar — "SASE Platform" (2026-07-10 dropdown-spec version).
 *
 * Groups come from src/lib/nav.ts (single source of truth, shared with the
 * drawer in TopNav). Visible header names the section per spec. The ↗ icon
 * is computed via isCrossApp() and lands on exactly the "Elsewhere on
 * Netify" links (the only cross-app hrefs here).
 *
 * /sase/admin is NOT in public navigation (2026-07-10 spec — it had been
 * exposed publicly since Harry's 03/07 retest round): the admin console link
 * renders only for an authenticated admin session. The session-aware footer
 * (sign out / supplier prompt) is unchanged. Desktop-only (lg+); below lg
 * the deep nav lives in TopNav's drawer.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SECTIONS, SIDEBAR_HEADER, NAV_CTA, CURRENT_APP,
  isCrossApp, appOf, toAppHref,
} from "@/lib/nav";

type Session = { authenticated: boolean; role?: string; email?: string; vendor_slug?: string | null; admin?: boolean };

export default function SideNav() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => { fetch("/sase/api/auth/session").then((r) => r.json()).then(setSession).catch(() => setSession({ authenticated: false })); }, []);

  async function logout() {
    await fetch("/sase/api/auth/logout", { method: "POST" }).catch(() => {});
    setSession({ authenticated: false });
  }

  // Single best active match (exact or true sub-path, longest wins), compared
  // against the in-app pathname (basePath already stripped by Next).
  const path = pathname.replace(/\/$/, "");
  const matches = (href: string) => {
    if (href.includes("?")) return false; // prefill links are actions, not pages
    if (appOf(href) !== "sase") return false;
    const base = toAppHref(href).replace(/\/$/, "");
    if (base === "") return path === "";
    return path === base || path.startsWith(`${base}/`);
  };
  const activeHref = [...SECTIONS.flatMap((s) => s.links.map((l) => l.href)), "/sase/admin/"]
    .filter(matches)
    .sort((a, b) => b.length - a.length)[0];

  const linkCls = (href: string) =>
    `block rounded-md px-3 py-1.5 text-sm no-underline transition-colors ${
      href === activeHref
        ? "bg-amber-500/15 text-[var(--ink-900)] font-medium"
        : "text-[var(--ink-700)] hover:bg-[var(--ink-100,#f3f3f3)] hover:text-[var(--ink-900)]"
    }`;

  const renderLink = (l: { label: string; href: string }, sectionTitle: string) => {
    const cross = isCrossApp(l.href, CURRENT_APP);
    const inner = (
      <>
        {l.label}
        {cross && <span aria-hidden="true" className="text-[var(--ink-400,#9ca3af)]"> ↗</span>}
      </>
    );
    return appOf(l.href) === "sase" ? (
      <Link key={`${sectionTitle}-${l.href}`} href={toAppHref(l.href)} className={linkCls(l.href)}>{inner}</Link>
    ) : (
      <a key={`${sectionTitle}-${l.href}`} href={l.href} className={linkCls(l.href)}>{inner}</a>
    );
  };

  return (
    <aside className="hidden lg:flex fixed left-0 top-12 bottom-0 w-60 flex-col border-r border-[var(--ink-200)] bg-[var(--paper-raised,#f4f4f5)]/60 px-3 py-5 z-20">
      {/* Visible section header (spec) */}
      <p className="px-3 mb-4 text-[13px] font-semibold tracking-tight text-[var(--ink-900)]">{SIDEBAR_HEADER}</p>
      <nav className="flex-1 space-y-5 overflow-y-auto" aria-label={SIDEBAR_HEADER}>
        {SECTIONS.map((s) => (
          <div key={s.title}>
            <p className="eyebrow px-3 mb-1.5">{s.title}</p>
            <div className="space-y-0.5">{s.links.map((l) => renderLink(l, s.title))}</div>
          </div>
        ))}
        {/* Admin console: session-gated, never public (spec) */}
        {session?.authenticated && session.admin && (
          <div>
            <p className="eyebrow px-3 mb-1.5">Admin</p>
            <div className="space-y-0.5">
              <Link href="/admin" className={linkCls("/sase/admin/")}>Admin console</Link>
            </div>
          </div>
        )}
      </nav>

      <div className="pt-4 mt-4 border-t border-[var(--ink-200,#e5e5e5)] space-y-2">
        <Link href={toAppHref(NAV_CTA.href)} className="block text-center rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400">
          {NAV_CTA.label}
        </Link>
        {session === null ? null : session.authenticated ? (
          <div className="px-3 text-xs text-[var(--ink-600)]">
            <p className="truncate">{session.email}{session.vendor_slug ? ` · ${session.vendor_slug}` : session.admin ? " · admin" : ""}</p>
            <button onClick={logout} className="mt-1 underline hover:text-[var(--ink-900)]">Sign out</button>
          </div>
        ) : (
          <Link href="/for-suppliers" className="block px-3 text-xs text-[var(--ink-600)] no-underline hover:text-[var(--ink-900)]">Supplier? Sign in to bid →</Link>
        )}
      </div>
    </aside>
  );
}
