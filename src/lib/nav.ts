/**
 * Navigation config — single source of truth for TopNav + SideNav (this app).
 *
 * 2026-07-10 dropdown spec, rebased onto the 8 July main (Harry's testing
 * rounds). Mirrors the marketing site's lib/nav.ts so both deployments render
 * an identical top bar. Rules:
 *
 * • Every internal link is ROOT-RELATIVE. Cross-app (marketing) links are
 *   root-relative plain <a> — correct on the public host netify.co.uk (the
 *   subdomains 301 there; the raw .vercel.app host is proxy-origin only).
 * • Hrefs are stored as FULL PUBLIC PATHS (/sase/... for in-app routes);
 *   renderers strip the /sase basePath via toAppHref() before next/link.
 * • One canonical RFP Builder URL: /sase/rfp-builder/ (trailing slash —
 *   matches canonicals + sitemap; skipTrailingSlashRedirect → no redirects).
 * • ↗ appears if and only if a link crosses between this app and the
 *   marketing site — computed via isCrossApp(), never hard-coded.
 * • /sase/admin is NOT in public navigation (spec). The admin console link
 *   renders only for an authenticated admin session (SideNav).
 */

export interface NavLink {
  label: string;
  href: string;
}

export interface NavGroup {
  label: string;
  href?: string;
  items?: NavLink[];
}

export interface NavSection {
  title: string;
  links: NavLink[];
}

export type AppNamespace = "sase" | "marketing";

export function appOf(href: string): AppNamespace {
  const path = href.split(/[?#]/)[0];
  return path === "/sase" || path === "/sase/" || path.startsWith("/sase/") ? "sase" : "marketing";
}

export function isCrossApp(href: string, currentApp: AppNamespace): boolean {
  return appOf(href) !== currentApp;
}

/** This entire deployment is the /sase app. */
export const CURRENT_APP: AppNamespace = "sase";

/** Strip the /sase basePath for next/link (which re-applies it). Keeps query
 *  strings and trailing slashes intact. */
export function toAppHref(href: string): string {
  if (href === "/sase" || href === "/sase/") return "/";
  return href.startsWith("/sase/") ? href.slice("/sase".length) : href;
}

// ── TOP MENU (identical to the marketing site's) ────────────────────────────
export const TOP_MENU: NavGroup[] = [
  {
    label: "Compare & Shortlist",
    href: "/sase/",
    items: [
      { label: "Marketplace", href: "/sase/" },
      { label: "Shortlist builder", href: "/sase/shortlist/" },
      { label: "All vendors", href: "/sase/vendors/" },
      { label: "Best by sector", href: "/sase/best/" },
      { label: "Vendor comparison hub", href: "/vendor-comparison/" },
    ],
  },
  {
    label: "RFP Builder",
    href: "/sase/rfp-builder/",
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
    href: "/resell/bt-business-services/",
    items: [
      { label: "Buy BT", href: "/bt-fortinet-meraki/" },
      { label: "Resell BT", href: "/resell/bt-business-services/" },
      { label: "Become a BT reseller", href: "/go/bt-reseller-application/" },
      { label: "Cloud Voice pricing calculator", href: "/tools/bt-cloud-voice-pricing-calculator/" },
      { label: "BT One Phone replacement", href: "/tools/bt-one-phone-replacement/" },
      { label: "Leased line cost calculator", href: "/bt-leased-line-cost-calculator-tool/" },
    ],
  },
  { label: "Insights", href: "/insights/" },
  {
    label: "About",
    href: "/about-netify/",
    items: [
      { label: "About Netify", href: "/about-netify/" },
      { label: "Contact", href: "/contact/" },
    ],
  },
];

export const SIGN_IN: NavLink = { label: "Sign in", href: "/sase/account/" };
export const NAV_CTA: NavLink = { label: "Build an RFP", href: "/sase/rfp-builder/" };

// ── SIDEBAR — "SASE Platform" (this app's contextual deep nav) ──────────────
export const SIDEBAR_HEADER = "SASE Platform";

export const SECTIONS: NavSection[] = [
  {
    title: "Start",
    links: [
      { label: "Start here", href: "/sase/" },
      { label: "How it works", href: "/sase/how-it-works/" },
    ],
  },
  {
    title: "Compare",
    links: [
      { label: "Shortlist builder", href: "/sase/shortlist/" },
      { label: "All vendors", href: "/sase/vendors/" },
      { label: "Best by sector", href: "/sase/best/" },
    ],
  },
  {
    title: "Build an RFP",
    links: [
      { label: "RFP builder", href: "/sase/rfp-builder/" },
      { label: "Sample RFP", href: "/sase/rfp-builder/sample-rfp/" },
      { label: "Question bank", href: "/sase/rfp-builder/questions/" },
    ],
  },
  {
    title: "By sector",
    // Every sector starts the RFP Builder preloaded for that sector — the
    // agent opens with the sector's usual regulations (Harry's evaluation,
    // 03/07/2026). The marketing sector articles stay live for search.
    links: [
      { label: "Healthcare", href: "/sase/rfp-builder/?prefill=1&sector=healthcare" },
      { label: "Financial services", href: "/sase/rfp-builder/?prefill=1&sector=financial_services" },
      { label: "Retail", href: "/sase/rfp-builder/?prefill=1&sector=retail_ecommerce" },
      { label: "Manufacturing", href: "/sase/rfp-builder/?prefill=1&sector=manufacturing" },
    ],
  },
  {
    title: "Popular vendors",
    links: [
      { label: "Palo Alto Networks", href: "/sase/vendors/palo-alto-networks/" },
      { label: "Zscaler", href: "/sase/vendors/zscaler/" },
      { label: "Fortinet", href: "/sase/vendors/fortinet/" },
      { label: "Check Point", href: "/sase/vendors/check-point/" },
      { label: "BT Business", href: "/sase/vendors/bt-business/" },
      { label: "Versa Networks", href: "/sase/vendors/versa-networks/" },
    ],
  },
  {
    title: "Alternatives",
    links: [
      { label: "Colt alternatives", href: "/sase/alternatives/colt-technology-services/" },
      { label: "Versa alternatives", href: "/sase/alternatives/versa-networks/" },
      { label: "GTT alternatives", href: "/sase/alternatives/gtt/" },
      { label: "Juniper alternatives", href: "/sase/alternatives/juniper-networks/" },
    ],
  },
  {
    title: "Engage",
    links: [
      { label: "Opportunity board", href: "/sase/opportunities/board/" },
      { label: "Post a need", href: "/sase/opportunities/" },
    ],
  },
  {
    title: "Suppliers",
    links: [
      { label: "For vendors and providers", href: "/sase/for-suppliers/" },
      { label: "Supplier dashboard", href: "/sase/supplier/" },
    ],
  },
  {
    title: "Your account",
    // Sign-in entry point for buyers and suppliers (Harry's retest,
    // 03/07/2026). The admin console is deliberately NOT here — it must not
    // appear in public navigation (2026-07-10 spec); SideNav renders it only
    // for an authenticated admin session.
    links: [{ label: "Sign in / my account", href: "/sase/account/" }],
  },
  {
    title: "Elsewhere on Netify",
    links: [
      { label: "All providers", href: "/marketplace/" },
      { label: "Vendor comparison hub", href: "/vendor-comparison/" },
      { label: "SD-WAN research hub", href: "/sd-wan/" },
      { label: "Methodology", href: "/methodology/" },
    ],
  },
];
