"use client";

/**
 * Contextual sidebar — deep navigation within the SASE zone only.
 *
 * Restructured 2026-07-02 (menu-redesign-plan.md): cross-zone links (the old
 * "NETIFY" master group: Resell / Calculators / Sectors / Learning) moved to
 * the top bar (TopNav.tsx), which is now the only place a visitor switches
 * between Netify's three zones. This sidebar carries the SASE zone's groups,
 * defined once in src/lib/nav.ts and shared with the mobile drawer.
 *
 * Desktop only (hidden lg:flex) — mobile navigation is TopNav's hamburger
 * drawer. Session-aware footer unchanged: supplier/admin areas surface only
 * once signed in.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTIONS, NAV_CTA, isExternal } from "@/lib/nav";

type Session = { authenticated: boolean; role?: string; email?: string; vendor_slug?: string | null; admin?: boolean };

export default function SideNav() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => { fetch("/sase/api/auth/session").then((r) => r.json()).then(setSession).catch(() => setSession({ authenticated: false })); }, []);

  async function logout() {
    await fetch("/sase/api/auth/logout", { method: "POST" }).catch(() => {});
    setSession({ authenticated: false });
  }

  const linkCls = (href: string) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return `block rounded-md px-3 py-1.5 text-sm no-underline transition-colors ${active ? "bg-amber-500/15 text-[var(--ink-900)] font-medium" : "text-[var(--ink-700)] hover:bg-[var(--ink-100,#f3f3f3)] hover:text-[var(--ink-900)]"}`;
  };
  const extCls =
    "block rounded-md px-3 py-1.5 text-sm no-underline text-[var(--ink-700)] transition-colors hover:bg-[var(--ink-100,#f3f3f3)] hover:text-[var(--ink-900)]";

  return (
    // Desktop only — mobile nav lives in TopNav's drawer. top-12 clears the
    // sticky 48px top bar.
    <aside className="hidden lg:flex fixed left-0 top-12 bottom-0 w-60 flex-col border-r border-[var(--ink-200)] bg-[var(--paper-raised,#f4f4f5)]/60 px-3 py-5 z-20">
      <p className="px-3 mb-4 text-[13px] font-semibold tracking-tight text-[var(--ink-900)]">SASE Marketplace</p>
      <nav className="flex-1 space-y-5 overflow-y-auto" aria-label="Section">
        {SECTIONS.map((s) => (
          <div key={s.title}>
            <p className="eyebrow px-3 mb-1.5">{s.title}</p>
            <div className="space-y-0.5">
              {s.links.map((l) =>
                isExternal(l.href) ? (
                  <a key={l.href} href={l.href} className={extCls}>
                    {l.label}<span className="text-[var(--ink-400,#9ca3af)]"> ↗</span>
                  </a>
                ) : (
                  <Link key={l.href} href={l.href} className={linkCls(l.href)}>{l.label}</Link>
                ),
              )}
            </div>
          </div>
        ))}
        {session?.authenticated && (session.role === "supplier" || session.role === "netify") && (
          <div>
            <p className="eyebrow px-3 mb-1.5">My account</p>
            <div className="space-y-0.5"><Link href="/supplier" className={linkCls("/supplier")}>Supplier dashboard</Link></div>
          </div>
        )}
        {session?.authenticated && session.admin && (
          <div>
            <p className="eyebrow px-3 mb-1.5">Admin</p>
            <div className="space-y-0.5"><Link href="/admin" className={linkCls("/admin")}>Admin console</Link></div>
          </div>
        )}
      </nav>

      <div className="pt-4 mt-4 border-t border-[var(--ink-200,#e5e5e5)] space-y-2">
        <Link href={NAV_CTA.href} className="block text-center rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400">Build an RFP</Link>
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
