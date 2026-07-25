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
      // Internal linking before redirects (R1, 24 Jul): these doors point
      // straight at the desk now the wizard paths 301 there.
      { label: "Create your SASE RFP", href: "https://netify.co.uk/" },
      { label: "Create your SD-WAN RFP", href: "https://netify.co.uk/" },
      { label: "Create your SSE RFP", href: "https://netify.co.uk/" },
      { label: "Create your SASE & SD-WAN RFI", href: "/sase/opportunities/new/" },
      { label: "Your projects", href: "/sase/account/" },
    ],
  },
  {
    label: "By sector",
    items: [
      // The sector doors carry their prefill sentence straight to the desk
      // (the same destinations the 301s serve, without the hop).
      { label: "Create Healthcare RFP", href: "https://netify.co.uk/?q=We%20are%20a%20healthcare%20provider%20replacing%20legacy%20connectivity%20with%20managed%20SD-WAN%20and%20SASE." },
      { label: "Create Retail RFP", href: "https://netify.co.uk/?q=We%20are%20a%20retailer%20needing%20a%20PCI%20DSS%20compliant%20network." },
      { label: "Create Manufacturing RFP", href: "https://netify.co.uk/?q=We%20are%20a%20manufacturer%20securing%20IT%20and%20OT%20with%20managed%20SASE." },
      { label: "Create Financial Services RFP", href: "https://netify.co.uk/?q=We%20are%20a%20financial%20services%20firm%20consolidating%20network%20and%20security%20into%20SASE." },
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

/* ── The intent navigation (the final architecture, 23 Jul, Robert's
 * "Please implement"). Five groups labelled by buyer intent; item labels
 * use the market's nouns; ONE label per URL across the whole menu (the
 * previous nav listed /sase/vendors/ twice under two names). Research is
 * a primary destination for the first time, and partner surfaces never
 * share a group with evaluation surfaces (Principle 5 made visible).
 * Every href verified against a live route or the declared reseller
 * subdomain before it was allowed in. ── */
export type MegaItem = { label: string; href: string; desc: string };
export type MegaGroup = {
  label: string;
  columns: 1 | 2;
  items: MegaItem[];
  footerLink?: { label: string; href: string };
};

export const MEGA_GROUPS: MegaGroup[] = [
  {
    label: "Find suppliers",
    columns: 1,
    items: [
      { label: "Evaluated directory", href: "/sase/vendors/", desc: "30 suppliers graded on 40 capabilities, every grade dated and sourced." },
      { label: "All listed suppliers", href: "/marketplace/", desc: "The wider supplier directory, including managed service providers." },
      { label: "Demand index", href: "/sase/demand/", desc: "Enterprise demand and supplier interest, measured." },
    ],
  },
  {
    label: "Compare & plan",
    columns: 2,
    items: [
      { label: "Vendor comparisons", href: "/vendor-comparison/", desc: "Head-to-head capability comparisons, graded from evidence." },
      { label: "Shortlist builder", href: "/sase/shortlist/", desc: "Score every evaluated supplier against your exact requirements." },
      // One Door repair (25 Jul, bug sweep): the old href 301-bounced to the
      // apex; the label is Robert's law, the destination is now honest.
      { label: "RFP Builder", href: "https://netify.co.uk/", desc: "The question-by-question builder for SASE, SD-WAN and SSE." },
      { label: "Cost & TCO estimator", href: "/sase/cost-estimator/", desc: "Model budget and total cost of ownership." },
      { label: "Question bank", href: "/sase/rfp-builder/questions/", desc: "The questions technology buyers ask AI, explorable." },
      { label: "Sample RFP", href: "/sase/rfp-builder/sample-rfp/", desc: "A complete SASE Statement of Requirements to inspect." },
    ],
  },
  {
    label: "Research",
    columns: 1,
    items: [
      { label: "Insights: the blog", href: "/insights/", desc: "Guides, market analysis and procurement strategy, dated and authored." },
      { label: "SD-WAN research hub", href: "/sd-wan/", desc: "Global and regional SD-WAN provider research." },
      { label: "Provider & vendor market guide", href: "/sd-wan-provider-and-vendor-comparison/", desc: "The full market comparison guide, updated for 2026." },
      { label: "Research methodology", href: "/methodology/", desc: "How every grade is earned, and what the statuses mean." },
    ],
  },
  {
    label: "Solutions",
    columns: 2,
    items: [
      // Internal linking before redirects (24 Jul, the shortlist walk found
      // these four still hopping through the wizard 301s): the sector doors
      // carry their prefill sentences straight to the desk, matching the
      // sidebar's Get quotes doors.
      { label: "Healthcare & pharma", href: "https://netify.co.uk/?q=We%20are%20a%20healthcare%20provider%20replacing%20legacy%20connectivity%20with%20managed%20SD-WAN%20and%20SASE.", desc: "SASE and SD-WAN requirements mapped for healthcare trusts and pharma." },
      { label: "Retail & e-commerce", href: "https://netify.co.uk/?q=We%20are%20a%20retailer%20needing%20a%20PCI%20DSS%20compliant%20network.", desc: "PCI DSS compliant architectures for multi-site retail estates." },
      { label: "Manufacturing & OT", href: "https://netify.co.uk/?q=We%20are%20a%20manufacturer%20securing%20IT%20and%20OT%20with%20managed%20SASE.", desc: "Secure SASE with IT and OT integration for industrial sites." },
      { label: "Financial services", href: "https://netify.co.uk/?q=We%20are%20a%20financial%20services%20firm%20consolidating%20network%20and%20security%20into%20SASE.", desc: "Audited, low-latency network security frameworks for regulated finance." },
    ],
    footerLink: { label: "Best by sector: all sector guides", href: "/sase/best/" },
  },
  {
    label: "For partners",
    columns: 1,
    items: [
      { label: "BT Business portfolio", href: "/resell/bt-business-services/", desc: "BTnet, hosted VoIP and BT managed SASE." },
      { label: "BT SD-WAN & SASE", href: "/resell/bt-sd-wan/", desc: "Enterprise BT network sourcing." },
      { label: "Virgin Media Business", href: "/resell/virgin-media-business/", desc: "High-capacity internet and SD-WAN from VMB." },
      { label: "Reseller order portal", href: "https://reseller.netify.co.uk/", desc: "Quote, order and track BT reseller business in the partner application." },
      { label: "Broadband reseller dataset", href: "/insights/broadband-reseller-companies/", desc: "The UK broadband reseller comparison, filterable." },
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
