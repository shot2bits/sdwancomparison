/**
 * Navigation config — app-style accordion sidebar + minimal top bar (v3).
 *
 * 2026-07-10, Robert's direction: the SIDEBAR is the navigation — each menu
 * item expands in place (multi-expand; the current page's section opens
 * automatically). Top bar = logo + Sign in + Build an RFP only.
 *
 * NAV_GROUPS mirrors the marketing site's lib/nav.ts exactly; APP_GROUPS are
 * this app's own sections, appended below a divider. Rules carried over:
 * root-relative full-public-path hrefs (renderers strip /sase via toAppHref
 * for next/link), trailing slashes, canonical /sase/rfp-builder/, computed ↗,
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

// ── Shared groups (identical to the marketing site) ─────────────────────────
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Compare & Shortlist",
    items: [
      { label: "Marketplace", href: "/sase/" },
      { label: "How it works", href: "/sase/how-it-works/" },
      { label: "Shortlist builder", href: "/sase/shortlist/" },
      { label: "All vendors", href: "/sase/vendors/" },
      { label: "Best by sector", href: "/sase/best/" },
      { label: "Vendor comparison hub", href: "/vendor-comparison/" },
    ],
  },
  {
    label: "RFP Builder",
    items: [
      { label: "Build an RFP", href: "/sase/rfp-builder/" },
      { label: "Sample RFP", href: "/sase/rfp-builder/sample-rfp/" },
      { label: "Question bank", href: "/sase/rfp-builder/questions/" },
      { label: "RFP for Healthcare", href: "/sase/rfp-builder/?prefill=1&sector=healthcare" },
      { label: "RFP for Financial services", href: "/sase/rfp-builder/?prefill=1&sector=financial_services" },
      { label: "RFP for Retail", href: "/sase/rfp-builder/?prefill=1&sector=retail_ecommerce" },
      { label: "RFP for Manufacturing", href: "/sase/rfp-builder/?prefill=1&sector=manufacturing" },
    ],
  },
  {
    label: "BT Solutions",
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
  { label: "Insights", href: "/insights/" },
  {
    label: "About",
    items: [
      { label: "About Netify", href: "/about-netify/" },
      { label: "Contact", href: "/contact/" },
    ],
  },
];

// ── This app's own sections (appended under a divider) ──────────────────────
export const APP_GROUPS: NavGroup[] = [
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
    label: "Engage",
    items: [
      { label: "Opportunity board", href: "/sase/opportunities/board/" },
      { label: "Post a need", href: "/sase/opportunities/" },
    ],
  },
  {
    label: "Suppliers",
    items: [
      { label: "For vendors and providers", href: "/sase/for-suppliers/" },
      { label: "Supplier dashboard", href: "/sase/supplier/" },
    ],
  },
  {
    label: "Elsewhere on Netify",
    items: [
      { label: "All providers", href: "/marketplace/" },
      { label: "SD-WAN research hub", href: "/sd-wan/" },
      { label: "Methodology", href: "/methodology/" },
    ],
  },
];

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
