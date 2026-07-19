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

// ── Capability-named groups (2026-07-14, Robert's mockup sign-off) ─────────
// Search arrivals land on SASE RFP, SD-WAN providers, sector pages and the
// like, so menu items carry the arrival vocabulary as specific creation
// actions ("Create your SASE RFP"), grouped by outcome. Creation clusters
// first (GET QUOTES, BY SECTOR), research after, suppliers last. Sector
// actions open the Describe wizard with the sector pre-answered. Links that
// left the sidebar (vendor profiles, alternatives, BT tools, corporate) live
// in the footer and research pages, keeping their internal-link equity.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Get quotes",
    items: [
      { label: "Create your SASE RFP", href: "/sase/rfp-builder/sase/" },
      { label: "Create your SD-WAN RFP", href: "/sase/rfp-builder/sd-wan/" },
      { label: "Create your SSE RFP", href: "/sase/rfp-builder/sse/" },
      { label: "Create your SASE & SD-WAN RFI", href: "/sase/opportunities/new/" },
      { label: "Your projects", href: "/sase/account/" },
    ],
  },
  {
    label: "By sector",
    items: [
      { label: "Create Healthcare RFP", href: "/sase/rfp-builder/new/?sector=healthcare" },
      { label: "Create Retail RFP", href: "/sase/rfp-builder/new/?sector=retail_ecommerce" },
      { label: "Create Manufacturing RFP", href: "/sase/rfp-builder/new/?sector=manufacturing" },
      { label: "Create Financial Services RFP", href: "/sase/rfp-builder/new/?sector=financial_services" },
      { label: "All sector guides", href: "/sase/best/" },
    ],
  },
  {
    label: "Compare providers",
    items: [
      { label: "SASE providers", href: "/sase/vendors/" },
      { label: "SD-WAN providers", href: "/sd-wan/" },
      { label: "Managed service providers", href: "/marketplace/" },
      { label: "Shortlist builder", href: "/sase/shortlist/" },
      { label: "Demand Index", href: "/sase/demand/" },
      { label: "Vendor comparisons", href: "/vendor-comparison/" },
    ],
  },
  {
    label: "Tools",
    items: [
      { label: "Cost & TCO estimator", href: "/sase/cost-estimator/" },
      { label: "Question bank", href: "/sase/rfp-builder/questions/" },
      { label: "Sample RFP", href: "/sase/rfp-builder/sample-rfp/" },
      { label: "AI assistant connector", href: "/sase/connector/" },
    ],
  },
  {
    label: "Netify Research",
    items: [
      { label: "SASE cost and TCO guide", href: "/insights/sase-cost-tco-global-enterprise/" },
    ],
  },
  {
    label: "For suppliers",
    items: [
      { label: "Open opportunities", href: "/sase/opportunities/board/" },
      { label: "Supplier sign-in", href: "/sase/supplier/" },
    ],
  },
];

/** Retained for compatibility; all groups now live in NAV_GROUPS. */
export const APP_GROUPS: NavGroup[] = [];

export const SIGN_IN: NavLink = { label: "Sign in", href: "/sase/account/" };
// One universal CTA everywhere (navigation architecture, 14 July 2026):
// the top bar, drawer and sidebar all say Start a project and open the
// Describe wizard. "Build an RFP" as a competing entry CTA is retired.
export const NAV_CTA: NavLink = { label: "Start a project", href: "/sase/rfp-builder/new/" };

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
