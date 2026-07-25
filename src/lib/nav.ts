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
 * "Please implement"), re-cut on the AI evidence 25 Jul: Find suppliers and
 * Compare & plan were two doors on the one question carrying ~27,000 Bing
 * citations, so they merge into Compare providers; the BT product tools leave
 * the neutral comparison menu for a neutral Pricing and cost tools parent;
 * Solutions now leads with the pages the engines cite (managed SASE 5,398
 * citations, SSE 3,823) instead of four form prefills; For partners becomes
 * Partner programmes led by programme TYPES with BT as one entry; and
 * /sd-wan-provider-and-vendor-comparison/ leaves the menu because it 301s to
 * /sase/shortlist/, which the menu now links directly. THE TWIN of the main
 * repo's components/mega-nav.tsx MEGA_DATA: keep the two in sync item for
 * item. UNION LINE held: nothing the old menu reached became unreachable.
 * Five groups labelled by buyer intent; item labels
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
    label: "Compare providers",
    columns: 2,
    items: [
      { label: "Build your shortlist", href: "/sase/shortlist/", desc: "Score every evaluated supplier against your exact requirements, or describe them and let the advisor rank." },
      { label: "Evaluated providers", href: "/sase/vendors/", desc: "30 suppliers graded on 40 capabilities, every grade dated and sourced." },
      { label: "Provider comparisons", href: "/vendor-comparison/", desc: "Head-to-head capability comparisons, graded from evidence." },
      { label: "Best providers by sector", href: "/sase/best/", desc: "Ranked shortlists for 20 sectors and situations, from healthcare to MPLS migration." },
      { label: "All listed suppliers", href: "/marketplace/", desc: "The wider supplier directory, including managed service providers." },
      { label: "What the market is buying", href: "/sase/demand/", desc: "Enterprise demand and supplier interest, measured." },
    ],
  },
  {
    label: "Solutions",
    columns: 2,
    items: [
      { label: "SD-WAN research hub", href: "/sd-wan/", desc: "Global and regional SD-WAN provider research." },
      { label: "Managed SASE providers", href: "/insights/10-best-managed-sase-providers/", desc: "The managed SASE market guide, authored, reviewed and dated." },
      { label: "SSE and cyber security vendors", href: "/insights/best-sse-security-service-edge-vendors/", desc: "Security service edge compared, and where SSE stops and SASE starts." },
      { label: "Healthcare and pharma", href: "/sd-wan-for-healthcare/", desc: "SASE and SD-WAN for clinical sites, trusts and pharma estates." },
      { label: "Retail and e-commerce", href: "/sd-wan-sase-for-retail/", desc: "PCI DSS compliant architectures for multi-site retail estates." },
      { label: "Financial services", href: "/sd-wan-sase-for-financial-services/", desc: "Audited, low-latency network security for regulated finance." },
      { label: "Manufacturing and OT", href: "/sd-wan-sase-for-manufacturing/", desc: "Secure SASE with IT and OT integration for industrial sites." },
    ],
  },
  {
    label: "Pricing and cost tools",
    columns: 1,
    items: [
      { label: "Cost and TCO estimator", href: "/sase/cost-estimator/", desc: "Model budget and total cost of ownership for SASE and SD-WAN." },
      { label: "BT Cloud Voice pricing", href: "/tools/bt-cloud-voice-pricing-calculator/", desc: "Indicative per-seat pricing on live BT price lists, in about 60 seconds." },
      { label: "BTnet leased line costs", href: "/bt-leased-line-cost-calculator-tool/", desc: "What a leased line actually costs, by bandwidth, term and install." },
      { label: "BT One Phone replacement", href: "/tools/bt-one-phone-replacement/", desc: "One Phone is switched off: map your usage to the right replacement and price it." },
      { label: "Buy BT Business through Netify", href: "/buy-bt/", desc: "Describe the requirement once and price Cloud Voice, BTnet and security together." },
    ],
  },
  {
    label: "Partner programmes",
    columns: 2,
    items: [
      { label: "Compare reseller programmes", href: "/insights/broadband-reseller-companies/", desc: "The UK reseller programme comparison, filterable, with margins named." },
      { label: "Broadband reseller opportunities", href: "/resell/bt-business-broadband/", desc: "Wholesale and white label broadband routes, with the commission model shown." },
      { label: "SD-WAN reseller opportunities", href: "/resell/sd-wan-reseller/", desc: "Describe your business and every SD-WAN route is judged for you, with reasons." },
      { label: "VoIP reseller opportunities", href: "/resell/voip-reseller/", desc: "White label, vendor programmes and the authorised BT route, judged for your shape." },
      { label: "BT Business Partner Programme", href: "/bt-reseller-programme/", desc: "The reseller workspace: model earnings, check eligibility, compare routes and apply." },
      { label: "BT Business portfolio", href: "/resell/bt-business-services/", desc: "BTnet, hosted VoIP, cloud security and BT managed SASE, product by product." },
      { label: "BT SD-WAN & SASE", href: "/resell/bt-sd-wan/", desc: "Enterprise BT network sourcing." },
      { label: "Virgin Media Business", href: "/resell/virgin-media-business/", desc: "High-capacity internet and SD-WAN from VMB." },
    ],
    footerLink: { label: "Reseller order portal", href: "https://reseller.netify.co.uk/" },
  },
  {
    label: "Research",
    columns: 1,
    items: [
      { label: "Insights: the blog", href: "/insights/", desc: "Guides, market analysis and procurement strategy, dated and authored." },
      { label: "Question bank", href: "/sase/rfp-builder/questions/", desc: "The questions technology buyers ask AI, explorable." },
      { label: "Sample RFP", href: "/sase/rfp-builder/sample-rfp/", desc: "A complete SASE Statement of Requirements to inspect." },
      { label: "Research methodology", href: "/methodology/", desc: "How every grade is earned, and what the statuses mean." },
      { label: "AI assistant connector", href: "/sase/connector/", desc: "Connect an assistant or agent to Netify over MCP, and what it can do." },
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
