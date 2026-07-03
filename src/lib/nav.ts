/**
 * Navigation config — single source of truth for TopNav + SideNav.
 *
 * Unified with the main site (netify-bt-broadband-reseller lib/nav.ts) per
 * menu-redesign-plan.md, 2026-07-02. Netify's navigation is split into three
 * zones: SASE Marketplace / Buy BT / Resell BT. This entire app IS the SASE
 * zone, so:
 *
 *   • TopNav (TopNav.tsx)   = zone switching + global pages. "SASE
 *     Marketplace" is always the active zone here. No dropdowns — the top
 *     menu never repeats sidebar content.
 *   • SideNav (SideNav.tsx) = deep navigation within the SASE zone only.
 *     The old "NETIFY" master group (Resell/Calculators/Sectors/Learning)
 *     is gone: cross-zone links live in the top bar now.
 *
 * URL policy: in-app routes are relative (basePath /sase is applied by
 * next.config). Anything on the marketing site is absolute
 * https://netify.co.uk/… . All URLs verified against the live sitemap.
 */

export interface NavLink {
  label: string;
  href: string;
}

export interface NavSection {
  title: string;
  links: NavLink[];
}

export const isExternal = (href: string) => href.startsWith("http");

// ── Top bar: the three zones. This app is the SASE zone (active). ──────────
export const ZONE_LINKS: NavLink[] = [
  { label: "SASE Marketplace", href: "/" },
  { label: "Buy BT", href: "https://netify.co.uk/bt-fortinet-meraki/" },
  { label: "Resell BT", href: "https://netify.co.uk/resell/bt-business-services/" },
];

// ── Top bar: global pages (never in the sidebar). ──────────────────────────
// "Sign in" is the account entry point for buyers, suppliers and admins —
// previously none of those areas was reachable from the menu (Harry's
// retest, 03/07/2026). /account signs buyers in and signposts the rest.
export const GLOBAL_LINKS: NavLink[] = [
  { label: "Insights", href: "https://netify.co.uk/insights/" },
  { label: "About", href: "https://netify.co.uk/about-netify/" },
  { label: "Contact", href: "https://netify.co.uk/contact/" },
  { label: "Sign in", href: "/account" },
];

export const NAV_CTA: NavLink = { label: "Build RFP", href: "/rfp-builder" };

// ── Sidebar: deep nav within the SASE zone. ────────────────────────────────
// Mirrors the main site's SASE sidebar groups (Start / Compare / Build an
// RFP / By sector), then the app-native groups that only exist here.
export const SECTIONS: NavSection[] = [
  {
    title: "Start",
    links: [
      { label: "Start here", href: "/" },
      { label: "How it works", href: "/how-it-works" },
      { label: "Methodology", href: "https://netify.co.uk/methodology/" },
    ],
  },
  {
    title: "Compare",
    links: [
      { label: "All providers", href: "https://netify.co.uk/marketplace/" },
      { label: "Shortlist builder", href: "/shortlist" },
      { label: "All vendors", href: "/vendors" },
      { label: "Best by sector", href: "/best" },
      { label: "Vendor comparison hub", href: "https://netify.co.uk/vendor-comparison/" },
      { label: "SD-WAN research hub", href: "https://netify.co.uk/sd-wan/" },
    ],
  },
  {
    title: "Build an RFP",
    // The old-site SD-WAN RFI Builder link was removed here: it redirects to
    // this RFP Builder anyway, so listing both read as two competing tools
    // (Harry's evaluation, 03/07/2026).
    links: [
      { label: "RFP builder", href: "/rfp-builder" },
      { label: "Sample RFP", href: "/rfp-builder/sample-rfp" },
      { label: "Question bank", href: "/rfp-builder/questions" },
    ],
  },
  {
    title: "By sector",
    // Vendor-neutral, consistent routing (Harry's evaluation, 03/07/2026):
    // every sector starts the RFP Builder preloaded for that sector — the
    // agent opens with the sector's usual regulations. The old-site sector
    // articles stay live for search, just not in the app's nav.
    links: [
      { label: "Healthcare", href: "/rfp-builder?prefill=1&sector=healthcare" },
      { label: "Financial services", href: "/rfp-builder?prefill=1&sector=financial_services" },
      { label: "Retail", href: "/rfp-builder?prefill=1&sector=retail_ecommerce" },
      { label: "Manufacturing", href: "/rfp-builder?prefill=1&sector=manufacturing" },
    ],
  },
  {
    title: "Popular vendors",
    links: [
      { label: "Palo Alto Networks", href: "/vendors/palo-alto-networks" },
      { label: "Zscaler", href: "/vendors/zscaler" },
      { label: "Fortinet", href: "/vendors/fortinet" },
      { label: "Check Point", href: "/vendors/check-point" },
      { label: "BT Business", href: "/vendors/bt-business" },
      { label: "Versa Networks", href: "/vendors/versa-networks" },
    ],
  },
  {
    title: "Alternatives",
    links: [
      { label: "Colt alternatives", href: "/alternatives/colt-technology-services" },
      { label: "Versa alternatives", href: "/alternatives/versa-networks" },
      { label: "GTT alternatives", href: "/alternatives/gtt" },
      { label: "Juniper alternatives", href: "/alternatives/juniper-networks" },
    ],
  },
  {
    title: "Engage",
    links: [
      { label: "Opportunity board", href: "/opportunities/board" },
      { label: "Post a need", href: "/opportunities" },
    ],
  },
  {
    title: "Suppliers",
    links: [
      { label: "For vendors and providers", href: "/for-suppliers" },
      { label: "Supplier dashboard", href: "/supplier" },
    ],
  },
  {
    title: "Your account",
    // Discoverable entry points for every role (Harry's retest, 03/07/2026:
    // supplier/admin areas were unreachable without knowing the URL). Each
    // page gates itself; the admin console is harmless to expose.
    links: [
      { label: "Sign in / my account", href: "/account" },
      { label: "Netify admin", href: "/admin" },
    ],
  },
];
