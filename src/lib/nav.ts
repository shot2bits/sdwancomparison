/**
 * Navigation config — app-style accordion sidebar + minimal top bar (v3).
 *
 * 2026-07-10, Robert's direction: the SIDEBAR is the navigation — each menu
 * item expands in place (multi-expand; the current page's section opens
 * automatically). Top bar = logo + Sign in + Build an RFP only.
 *
 * NAV_GROUPS is ordered by buyer intent (funnel first), no longer a mirror of
 * the marketing site's nav. Rules carried over: root-relative full-public-path
 * hrefs (renderers strip /sase via toAppHref for next/link), trailing slashes,
 * canonical /sase/rfp-builder/, computed ↗ for cross-app links,
 * /sase/admin never in public nav (session-gated in SideNav).
 */

export interface NavLink {
  label: string;
  href: string;
}

export interface NavGroup {
  label: string;
  href?: string;
  items?: NavLink[];
  extraPrefixes?: string[];
}

export type AppNamespace = "sase" | "marketing";

export function appOf(href: string): AppNamespace {
  const path = href.split(/[?#]/)[0];
  return path === "/sase" || path === "/sase/" || path.startsWith("/sase/") ? "sase" : "marketing";
}

export function isCrossApp(href: string, currentApp: AppNamespace): boolean {
  return appOf(href) !== currentApp;
}

export const CURRENT_APP: AppNamespace = "sase";

/** Strip the /sase basePath for next/link (which re-applies it). */
export function toAppHref(href: string): string {
  if (href === "/sase" || href === "/sase/") return "/";
  return href.startsWith("/sase/") ? href.slice("/sase".length) : href;
}

// ── Task-first groups (2026-07-14, Robert's direction) ──────────────────────
// The sidebar leads with the buyer funnel (start, resume, browse), then the
// research surface, then suppliers; content sections follow. This deliberately
// stops mirroring the marketing site's nav: the app is a workflow, not a
// directory. Every previous link is preserved for internal linking, except
// the four ?prefill sector entries (query-string CTAs, not pages — they live
// on the sector and best-for pages instead).
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Get quotes",
    items: [
      { label: "Start a project", href: "/sase/rfp-builder/new/" },
      { label: "Your projects", href: "/sase/account/" },
      { label: "Publish an RFI", href: "/sase/opportunities/" },
      { label: "Open projects board", href: "/sase/opportunities/board/" },
      { label: "How it works", href: "/sase/how-it-works/" },
    ],
  },
  {
    label: "Research the market",
    items: [
      { label: "RFP Builder overview", href: "/sase/rfp-builder/" },
      { label: "Shortlist builder", href: "/sase/shortlist/" },
      { label: "All vendors", href: "/sase/vendors/" },
      { label: "Best by sector", href: "/sase/best/" },
      { label: "Vendor comparison hub", href: "/vendor-comparison/" },
      { label: "Question bank", href: "/sase/rfp-builder/questions/" },
      { label: "Sample RFP", href: "/sase/rfp-builder/sample-rfp/" },
      { label: "Cost & TCO estimator", href: "/sase/cost-estimator/" },
    ],
  },
  {
    label: "For suppliers",
    items: [
      { label: "Respond to projects", href: "/sase/for-suppliers/" },
      { label: "Supplier dashboard", href: "/sase/supplier/" },
    ],
  },
  {
    label: "Popular vendors",
    items: [
      { label: "Palo Alto Networks", href: "/sase/vendors/palo-alto-networks/" },
      { label: "Zscaler", href: "/sase/vendors/zscaler/" },
      { label: "Fortinet", href: "/sase/vendors/fortinet/" },
      { label: "Check Point", href: "/sase/vendors/check-point/" },
      { label: "BT Business", href: "/sase/vendors/bt-business/" },
      { label: "Versa Networks", href: "/sase/vendors/versa-networks/" },
    ],
  },
  {
    label: "Alternatives",
    items: [
      { label: "Colt alternatives", href: "/sase/alternatives/colt-technology-services/" },
      { label: "Versa alternatives", href: "/sase/alternatives/versa-networks/" },
      { label: "GTT alternatives", href: "/sase/alternatives/gtt/" },
      { label: "Juniper alternatives", href: "/sase/alternatives/juniper-networks/" },
    ],
  },
  {
    label: "BT solutions",
    items: [
      { label: "Buy BT", href: "/bt-fortinet-meraki/" },
      { label: "Resell BT", href: "/resell/bt-business-services/" },
      { label: "Become a BT reseller", href: "/go/bt-reseller-application/" },
      { label: "Cloud Voice pricing calculator", href: "/tools/bt-cloud-voice-pricing-calculator/" },
      { label: "BT One Phone replacement", href: "/tools/bt-one-phone-replacement/" },
      { label: "Leased line cost calculator", href: "/bt-leased-line-cost-calculator-tool/" },
      { label: "How to buy BT Cloud Voice", href: "/insights/how-to-buy-bt-cloud-voice/" },
    ],
  },
  {
    label: "More from Netify",
    items: [
      { label: "Insights", href: "/insights/" },
      { label: "All providers", href: "/marketplace/" },
      { label: "SD-WAN research hub", href: "/sd-wan/" },
      { label: "Methodology", href: "/methodology/" },
      { label: "About Netify", href: "/about-netify/" },
      { label: "Contact", href: "/contact/" },
    ],
  },
];

/** Retained for compatibility; all groups now live in NAV_GROUPS. */
export const APP_GROUPS: NavGroup[] = [];

export const SIGN_IN: NavLink = { label: "Sign in", href: "/sase/account/" };
export const NAV_CTA: NavLink = { label: "Build an RFP", href: "/sase/rfp-builder/" };

// ── Active-link + auto-open helpers (pathname is basePath-stripped here) ────
const norm = (p: string) => p.replace(/\/$/, "");

export function linkMatches(pathname: string, href: string): boolean {
  if (href.includes("?")) return false;
  if (appOf(href) !== "sase") return false;
  const base = norm(toAppHref(href).split("#")[0]);
  const path = norm(pathname);
  if (base === "") return path === "";
  return path === base || path.startsWith(`${base}/`);
}

export function activeHref(pathname: string, groups: NavGroup[]): string | undefined {
  return groups
    .flatMap((g) => g.items ?? [])
    .filter((l) => linkMatches(pathname, l.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function groupIsCurrent(pathname: string, group: NavGroup): boolean {
  return !!group.items?.some((l) => linkMatches(pathname, l.href));
}
