"use client";

/**
 * Persistent navigation shell. One consistent sidebar on every page so the
 * marketplace feels coherent rather than a set of scattered pages. Ungated:
 * everything here is browseable without an account. The footer is session
 * aware, surfacing the supplier and admin areas only once signed in.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Session = { authenticated: boolean; role?: string; email?: string; vendor_slug?: string | null; admin?: boolean };

// Global brand nav, identical to the netify.co.uk master menu and the Insights
// blog, so the primary navigation is the same on every Netify property. These
// point at the marketing site (and the blog for Learning); the product's own
// sections follow below.
const MASTER: { label: string; href: string }[] = [
  { label: "Resell", href: "https://netify.co.uk/resell/bt-business-services/" },
  { label: "Marketplace", href: "https://netify.co.uk/marketplace/" },
  { label: "Calculators", href: "https://netify.co.uk/tools/" },
  { label: "Sectors", href: "https://netify.co.uk/sd-wan-for-healthcare/" },
  { label: "Learning", href: "https://insights.netify.co.uk/" },
];

const SECTIONS: { title: string; links: { label: string; href: string }[] }[] = [
  { title: "Start", links: [{ label: "Start here", href: "/" }, { label: "How it works", href: "/how-it-works" }] },
  { title: "Compare", links: [{ label: "Shortlist builder", href: "/shortlist" }, { label: "All vendors", href: "/vendors" }] },
  { title: "Engage", links: [{ label: "Opportunity board", href: "/opportunities/board" }, { label: "Post a need", href: "/opportunities" }, { label: "RFP builder", href: "/rfp-builder" }] },
  { title: "Suppliers", links: [{ label: "For vendors and providers", href: "/for-suppliers" }] },
];

export default function SideNav() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { fetch("/api/auth/session").then((r) => r.json()).then(setSession).catch(() => setSession({ authenticated: false })); }, []);
  useEffect(() => { setOpen(false); }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setSession({ authenticated: false });
  }

  const linkCls = (href: string) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return `block rounded-md px-3 py-1.5 text-sm no-underline transition-colors ${active ? "bg-amber-500/15 text-[var(--ink-900)] font-medium" : "text-[var(--ink-700)] hover:bg-[var(--ink-100,#f3f3f3)] hover:text-[var(--ink-900)]"}`;
  };

  const nav = (
    <div className="flex flex-col h-full">
      <Link href="/" className="display text-xl font-semibold tracking-tight no-underline text-[var(--ink-900)] px-3 mb-6 mt-1">Netify</Link>
      <nav className="flex-1 space-y-5 overflow-y-auto">
        <div>
          <p className="eyebrow px-3 mb-1.5">Netify</p>
          <div className="space-y-0.5">
            {MASTER.map((l) => (
              <a key={l.href} href={l.href} className="block rounded-md px-3 py-1.5 text-sm no-underline text-[var(--ink-700)] transition-colors hover:bg-[var(--ink-100,#f3f3f3)] hover:text-[var(--ink-900)]">
                {l.label}<span className="text-[var(--ink-400,#9ca3af)]"> ↗</span>
              </a>
            ))}
          </div>
        </div>
        <div className="space-y-5 border-t border-[var(--ink-200,#e5e5e5)] pt-5">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <p className="eyebrow px-3 mb-1.5">{s.title}</p>
              <div className="space-y-0.5">
                {s.links.map((l) => <Link key={l.href} href={l.href} className={linkCls(l.href)}>{l.label}</Link>)}
              </div>
            </div>
          ))}
        </div>
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
        <Link href="/rfp-builder" className="block text-center rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400">Build an RFP</Link>
        {session === null ? null : session.authenticated ? (
          <div className="px-3 text-xs text-[var(--ink-600)]">
            <p className="truncate">{session.email}{session.vendor_slug ? ` · ${session.vendor_slug}` : session.admin ? " · admin" : ""}</p>
            <button onClick={logout} className="mt-1 underline hover:text-[var(--ink-900)]">Sign out</button>
          </div>
        ) : (
          <Link href="/for-suppliers" className="block px-3 text-xs text-[var(--ink-600)] no-underline hover:text-[var(--ink-900)]">Supplier? Sign in to bid →</Link>
        )}
        <a href="https://netify.co.uk" className="block px-3 text-xs text-[var(--ink-500)] no-underline hover:text-[var(--accent)]">netify.co.uk ↗</a>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-[var(--ink-200)] bg-[var(--paper-base)]/90 backdrop-blur-sm px-4 py-3">
        <Link href="/" className="display text-lg font-semibold no-underline text-[var(--ink-900)]">Netify</Link>
        <button onClick={() => setOpen((v) => !v)} aria-label="Menu" className="rounded-md border border-[var(--ink-300,#ccc)] px-3 py-1.5 text-sm">Menu</button>
      </header>
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setOpen(false)}>
          <div className="absolute left-0 top-0 h-full w-72 bg-[var(--paper-base,#fff)] p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>{nav}</div>
        </div>
      )}

      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-[var(--ink-200)] bg-[var(--paper-base)]/95 px-3 py-5 z-30">{nav}</aside>
    </>
  );
}
