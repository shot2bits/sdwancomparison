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
      { label: "Create Healthcare RFP", href: "https://netify.co.uk/sase-sd-wan-rfp-builder/?q=We%20are%20a%20healthcare%20provider%20replacing%20legacy%20connectivity%20with%20managed%20SD-WAN%20and%20SASE." },
      { label: "Create Retail RFP", href: "https://netify.co.uk/sase-sd-wan-rfp-builder/?q=We%20are%20a%20retailer%20needing%20a%20PCI%20DSS%20compliant%20network." },
      { label: "Create Manufacturing RFP", href: "https://netify.co.uk/sase-sd-wan-rfp-builder/?q=We%20are%20a%20manufacturer%20securing%20IT%20and%20OT%20with%20managed%20SASE." },
      { label: "Create Financial Services RFP", href: "https://netify.co.uk/sase-sd-wan-rfp-builder/?q=We%20are%20a%20financial%20services%20firm%20consolidating%20network%20and%20security%20into%20SASE." },
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
    label: "For vendors and providers",
    items: [
      { label: "Open opportunities", href: "/sase/opportunities/board/" },
      { label: "Vendor sign-in", href: "/sase/supplier/" },
    ],
  },
];

/** Retained for compatibility; all groups now live in NAV_GROUPS. */
export const APP_GROUPS: NavGroup[] = [];

/* NO ACCOUNT WITHOUT A PUBLISH (Robert's ruling, 30 Jul 2026, emphatic:
 * "No more free signups with no publish"). A buyer arrived from Google,
 * landed on the front page, clicked Sign in, verified an email address and
 * created an account without ever describing a project. Nothing was
 * broken; this link simply led to a standalone sign-in box, so the nav was
 * a second door into an empty room. An account is what publishing
 * PRODUCES, and the work email is the signature inside that act, never the
 * price of getting in (R1a). So the signed-out label now anchors to the
 * prompt on the front page, where a project starts.
 *
 * ACCOUNT is the signed-in destination and is unchanged: anyone who has
 * published still reaches their record, and the magic links in their
 * confirmation emails still land there. */
export const SIGN_IN: NavLink = { label: "Sign in", href: "/sase/account/" };
export const ACCOUNT: NavLink = { label: "My account", href: "/sase/account/" };
// One universal CTA everywhere (navigation architecture, 14 July 2026):
// the top bar, drawer and sidebar all say Start a project. Since 21 July
// 2026 (W0 slice 3) it opens the Live Sourcing Workspace, the one door
// for security, SASE and SD-WAN; the Describe wizard remains reachable
// from the Get quotes group and the workspace's builder link.
export const NAV_CTA: NavLink = { label: "Start a project", href: "/sase-sd-wan-rfp-builder/" };

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
    label: "By Sector",
    columns: 2,
    items: [
      { label: "BT for healthcare", href: "/sd-wan-for-healthcare/", desc: "BT SD-WAN and SASE for NHS and healthcare organisations." },
      { label: "Manufacturing", href: "/sd-wan-sase-for-manufacturing/", desc: "OT segmentation, plant uptime, failover and brownfield estates." },
      { label: "Retail", href: "/sd-wan-sase-for-retail/", desc: "Store rollout, POS, PCI, guest Wi-Fi and resilient connectivity." },
      { label: "Financial services", href: "/sd-wan-sase-for-financial-services/", desc: "DORA, auditability, resilience and supplier due diligence." },
    ],
  },
  {
    label: "Tools",
    columns: 2,
    items: [
      { label: "Build an SD-WAN or SASE RFP", href: "/sase-sd-wan-rfp-builder/", desc: "SD-WAN and SASE RFP builder: governed supplier questions, validation, anonymous publication and vendor evaluation." },
      { label: "Provider shortlist", href: "/sase/shortlist/", desc: "Score evaluated suppliers against capability and sector requirements." },
      { label: "Cost and TCO estimator", href: "/sase/cost-estimator/", desc: "Model budget and total cost of ownership for SASE and SD-WAN." },
      { label: "SD-WAN vendor filter", href: "/sd-wan/vendor-filter/", desc: "Narrow the market by service model, capability and requirement." },
      { label: "Question bank", href: "/sase/rfp-builder/questions/", desc: "Reusable questions for SASE and SD-WAN procurement." },
      { label: "BT Cloud Voice pricing", href: "/tools/bt-cloud-voice-pricing-calculator/", desc: "Model users, licences and calling requirements before a formal quote." },
      { label: "BTnet leased line costs", href: "/bt-leased-line-cost-calculator-tool/", desc: "What a leased line actually costs, by bandwidth, term and install." },
      { label: "BT One Phone replacement", href: "/tools/bt-one-phone-replacement/", desc: "One Phone is switched off: map your usage to the right replacement and price it." },
      { label: "Opportunities board", href: "/sase/opportunities/board/", desc: "Review current network and security opportunities." },
    ],
  },
  {
    label: "By Provider",
    columns: 2,
    items: [
      { label: "BT Fortinet and Cisco Meraki", href: "/bt-fortinet-meraki/", desc: "Buy BT Managed SD-WAN and SASE through Netify." },
      { label: "Buy BT Business", href: "/buy-bt/", desc: "Source connectivity, voice, security and managed networks through Netify." },
      { label: "BT reseller programme", href: "/resell/bt-business-services/", desc: "The active BT portfolio for UK channel partners." },
      { label: "Resell BT Business Broadband", href: "/resell/bt-business-broadband/", desc: "BT products, eligibility, commission and the application route." },
      { label: "BT Business Internet", href: "/resell/bt-business-internet/", desc: "BTnet leased lines and associated managed services." },
      { label: "BT Cloud Voice", href: "/resell/bt-hosted-voip/", desc: "Hosted voice for organisations and the BT reseller route." },
      { label: "BT SD-WAN and SASE databank", href: "/bt-sase-sd-wan/", desc: "Query sourced BT evidence and turn requirements into a buying brief." },
      { label: "Virgin Media Business profile", href: "/marketplace/virgin-media/", desc: "Connectivity, SD-WAN capabilities and buying fit." },
      { label: "Virgin reseller route", href: "/resell/virgin-media-business/", desc: "Current status and reseller interest registration." },
    ],
    footerLink: { label: "Reseller order portal", href: "https://reseller.netify.co.uk/" },
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
