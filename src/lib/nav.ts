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
// the top bar, drawer and sidebar all say Start a project. Since 21 July
// 2026 (W0 slice 3) it opens the Live Sourcing Workspace, the one door
// for security, SASE and SD-WAN; the Describe wizard remains reachable
// from the Get quotes group and the workspace's builder link.
export const NAV_CTA: NavLink = { label: "Start a project", href: "/" };

/* ── The 2026 top navigation (Robert's spec, 24 Jul; his verdicts: one
 * header everywhere, both repos, main as always). Five groups; every href
 * verified against a real route in one of the two repos before it was
 * allowed in; descriptions quiet and factual under the evidence law. ── */
export type MegaItem = { label: string; href: string; desc: string };
export type MegaGroup = {
  label: string;
  columns: 1 | 2;
  items: MegaItem[];
  footerLink?: { label: string; href: string };
};

export const MEGA_GROUPS: MegaGroup[] = [
  {
    label: "Solutions",
    columns: 2,
    items: [
      { label: "Healthcare & pharma", href: "/sase/rfp-builder/new/?sector=healthcare", desc: "SASE and SD-WAN requirements mapped for healthcare trusts and pharma." },
      { label: "Retail & e-commerce", href: "/sase/rfp-builder/new/?sector=retail_ecommerce", desc: "PCI DSS compliant architectures for multi-site retail estates." },
      { label: "Manufacturing & OT", href: "/sase/rfp-builder/new/?sector=manufacturing", desc: "Secure SASE with IT and OT integration for industrial sites." },
      { label: "Financial services", href: "/sase/rfp-builder/new/?sector=financial_services", desc: "Audited, low-latency network security frameworks for regulated finance." },
    ],
    footerLink: { label: "Browse all sector guides", href: "/sase/best/" },
  },
  {
    label: "Compare & research",
    columns: 2,
    items: [
      { label: "SASE providers directory", href: "/sase/vendors/", desc: "Evaluated vendor capability matrices, graded with dates." },
      { label: "SD-WAN vendors", href: "/sd-wan/", desc: "Global and regional SD-WAN vendor profiles." },
      { label: "Managed service providers", href: "/marketplace/", desc: "The curated MSP partner directory." },
      { label: "Shortlist builder", href: "/sase/shortlist/", desc: "Build an interactive vendor shortlist." },
      { label: "Vendor comparisons", href: "/vendor-comparison/", desc: "Head-to-head capability comparisons." },
    ],
  },
  {
    label: "Tools & intelligence",
    columns: 1,
    items: [
      { label: "Cost & TCO estimator", href: "/sase/cost-estimator/", desc: "Model budget and total cost of ownership." },
      { label: "Demand index", href: "/sase/demand/", desc: "Enterprise demand and vendor interest, measured." },
      { label: "Question bank", href: "/sase/rfp-builder/questions/", desc: "The questions technology buyers ask AI, explorable." },
      { label: "Sample RFP", href: "/sase/rfp-builder/sample-rfp/", desc: "A complete SASE Statement of Requirements to inspect." },
      { label: "RFP Builder", href: "/sase/rfp-builder/", desc: "The question-by-question builder for SASE, SD-WAN and SSE." },
      { label: "AI assistant connector", href: "/sase/connector/", desc: "Connect agents through llms.txt and MCP." },
    ],
  },
  {
    label: "Providers & ecosystem",
    columns: 2,
    items: [
      { label: "Evaluated vendor directory", href: "/sase/vendors/", desc: "Direct vendor capability evaluations." },
      { label: "BT Business portfolio", href: "/resell/bt-business-services/", desc: "BTnet, hosted VoIP and BT managed SASE." },
      { label: "BT SD-WAN & SASE", href: "/resell/bt-sd-wan/", desc: "Enterprise BT network sourcing." },
      { label: "Virgin Media Business", href: "/resell/virgin-media-business/", desc: "High-capacity internet and SD-WAN from VMB." },
      { label: "For suppliers: the board", href: "/sase/opportunities/board/", desc: "Anonymous buyer notices, visible to the signed-in supplier community." },
    ],
  },
];

/** The board stands alone in the bar: one tap, no dropdown. */
export const BOARD_LINK: NavLink = { label: "Opportunities board", href: "/sase/opportunities/board/" };

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
