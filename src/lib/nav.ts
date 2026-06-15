// ═══════════════════════════════════════════════════════════════════════════
//   ✏️  GLOBAL NAVIGATION, mirrors the live netify.co.uk menu structure
// ───────────────────────────────────────────────────────────────────────────
//   This file's structure was reconciled against the live netify.co.uk
//   header menu on 2026-05-31, five top items: Resell, Marketplace,
//   Calculators, Sectors, Learning. Build RFP is the right-aligned CTA.
//
//   URL POLICY (per memory: feedback-never-guess-links):
//     • Every URL in this file is verified against the live Yoast page
//       sitemap at https://www.netify.co.uk/page-sitemap.xml.
//     • Vercel-hosted pages use relative paths with trailing slashes.
//     • WordPress-hosted pages (the ones we haven't migrated to Vercel:
//       application form, company pages, legal pages) use the full
//       https://www.netify.co.uk/<path>/ URL.
//     • External destinations (Ghost blog) stay at their subdomain.
//     • One link from the live WP menu was OMITTED per Robert (2026-05-31):
//       the "BT Cloud Security Cost/Pricing Calculator" item linked to
//       /bt-business/complete-cloud-secure/ which is a trashed page on
//       WordPress and not in the sitemap. There is no real calculator
//       at that URL.
//
//   Components that consume this:
//     • components/site-header.tsx (Apple-style mega-menu, wraps each
//       top item's links inside a single section).
// ═══════════════════════════════════════════════════════════════════════════

export interface NavLink {
  label: string;
  href: string;
  description?: string;     // optional one-line subtitle shown under the label
}

export interface NavSection {
  title: string;
  links: NavLink[];
  /**
   * Visual size of the links in this section. Apple's mega-menu uses a
   * two-tier hierarchy per drawer:
   *
   *   'large'  → 28px medium tracking-tight, generous row spacing. Use
   *              for the lead/feature column (e.g. sector overviews,
   *              flagship resell products, primary marketplace tools).
   *
   *   'small'  → 13px regular, tighter spacing. Use for secondary
   *              "Quick Links" / "Specialist" / sub-page columns.
   *
   * Default is 'small' so existing nav data still renders sensibly.
   */
  size?: 'large' | 'small';
}

export interface NavTopItem {
  label: string;
  href: string;             // landing URL when the top label is clicked directly
  sections?: NavSection[];  // if present → mega-menu dropdown; if omitted → simple link
}

/**
 * Top navigation, mirrors the live netify.co.uk menu (verified 2026-05-31).
 * Pages already on Vercel use relative paths. Pages still on WordPress use
 * www.netify.co.uk absolute URLs. Ghost editorial blog stays at its subdomain.
 */
export const NAV: ReadonlyArray<NavTopItem> = [
  // ── RESELL ────────────────────────────────────────────────────────────
  // Big column: the BT products you can resell. Small column: actions
  // (apply, see commission, programme overview).
  {
    label: 'Resell',
    href: '/resell/bt-business-broadband/',
    sections: [
      {
        title: 'Resell BT services',
        size: 'large',
        links: [
          { label: 'BT Business Broadband', href: '/resell/bt-business-broadband/' },
          { label: 'BT Business Internet (BTnet)', href: '/resell/bt-business-internet/' },
          { label: 'BT Cloud Voice', href: '/resell/bt-hosted-voip/' },
          { label: 'BT Cloud Security', href: '/resell/bt-cloud-security/' },
          { label: 'BT SD-WAN', href: '/resell/bt-sd-wan/' },
          { label: 'BT SASE', href: '/resell/bt-sase/' },
        ],
      },
      {
        title: 'Quick links',
        size: 'small',
        links: [
          { label: 'Apply to resell BT', href: '/go/bt-reseller-application/' },
          { label: 'Commission simulator', href: '/resell/bt-business-broadband/#revenue-simulator' },
          { label: 'Programme overview', href: '/resell/bt-business-services/' },
          { label: 'BT Fortinet & Meraki', href: '/bt-fortinet-meraki/' },
          // Asset B (listicle). Lateral exploration: how does BT compare to
          // the other 14 UK broadband reseller programmes? Sits last so it
          // does not interrupt the apply funnel above.
          { label: 'Compare broadband programmes', href: '/insights/broadband-reseller-companies/' },
        ],
      },
    ],
  },

  // ── MARKETPLACE ───────────────────────────────────────────────────────
  // Big column: comparison hubs. Small column: the supporting frameworks.
  {
    label: 'Marketplace',
    href: '/marketplace/',
    sections: [
      {
        title: 'Compare',
        size: 'large',
        links: [
          { label: 'All providers', href: '/marketplace/' },
          { label: 'SASE shortlist builder', href: 'https://sase.netify.co.uk/shortlist' },
          { label: 'Vendor rankings', href: 'https://sase.netify.co.uk/best/sd-wan-providers' },
          { label: 'Managed services', href: '/managed-service-providers-comparison-2026/' },
        ],
      },
      {
        title: 'Frameworks',
        size: 'small',
        links: [
          { label: 'How Netify works', href: '/about-netify-marketplace/' },
          { label: 'Methodology', href: '/methodology/' },
          { label: 'Vendor comparison hub', href: '/vendor-comparison/' },
        ],
      },
    ],
  },

  // ── CALCULATORS ───────────────────────────────────────────────────────
  // Single item, keep large for visual weight.
  {
    label: 'Calculators',
    href: '/tools/bt-cloud-voice-pricing-calculator/',
    sections: [
      {
        title: 'BT pricing calculators',
        size: 'large',
        links: [
          { label: 'BT Cloud Voice Pricing Calculator', href: '/tools/bt-cloud-voice-pricing-calculator/' },
          // NOTE: "BT Cloud Security Cost/Pricing Calculator" was on the
          // live WP menu but its target URL is a trashed WP page. Omitted
          // per Robert (2026-05-31). Add back when a real URL exists.
        ],
      },
      {
        title: 'Related',
        size: 'small',
        links: [
          { label: 'All tools', href: '/tools/' },
          { label: 'Commission simulator (Broadband)', href: '/resell/bt-business-broadband/#revenue-simulator' },
          { label: 'Commission simulator (BTnet)', href: '/resell/bt-business-internet/#revenue-simulator' },
        ],
      },
    ],
  },

  // ── SECTORS ───────────────────────────────────────────────────────────
  // Apple-style: big column lists the four sector overviews, small column
  // breaks Healthcare into its three specialist sub-pages (per Robert's
  // example: Healthcare benefits from the two-tier treatment).
  {
    label: 'Sectors',
    href: '/sd-wan-for-healthcare/',
    sections: [
      {
        title: 'Explore sectors',
        size: 'large',
        links: [
          { label: 'Healthcare', href: '/sd-wan-for-healthcare/' },
          { label: 'Manufacturing', href: '/sd-wan-sase-for-manufacturing/' },
          { label: 'Financial services', href: '/sd-wan-sase-for-financial-services/' },
          { label: 'Retail', href: '/sd-wan-sase-for-retail/' },
          { label: 'Food retail', href: '/sd-wan-for-food-retailers-guide/' },
        ],
      },
      {
        title: 'Healthcare',
        size: 'small',
        links: [
          { label: 'Healthcare SD-WAN & SASE', href: '/sd-wan-for-healthcare/' },
          { label: 'Healthcare MDR', href: '/managed-detection-and-response-for-healthcare/' },
          { label: 'Healthcare trust & evidence', href: '/healthcare-trust-and-evidence/' },
        ],
      },
    ],
  },

  // ── LEARNING ──────────────────────────────────────────────────────────
  // Single link, no dropdown, destination is the Ghost editorial blog.
  {
    label: 'Learning',
    href: 'https://insights.netify.co.uk/',
  },
] as const;

// Right-aligned CTA next to the nav, "Build RFP" on the live WP menu.
// The RFP Builder lives on the Netify app subdomain at
// app.netify.co.uk/try-rfp-builder. The /rfp-builder/ marketing page on
// netify.co.uk stays live for SEO but the CTA launches the actual product.
export const NAV_CTA = {
  label: 'Build RFP',
  href: 'https://sase.netify.co.uk/rfp-builder',
} as const;


/* ────────────────────────────────────────────────────────────────────────
   This file is ported from the netify.co.uk repo so both sites share one
   menu. Keep the NAV data identical to the main site; the transform below
   rewrites hrefs for this subdomain: main-site paths become absolute
   netify.co.uk URLs, and sase.netify.co.uk URLs become local paths.
   ──────────────────────────────────────────────────────────────────────── */

const MAIN = "https://netify.co.uk";
const SASE = "https://sase.netify.co.uk";

function rewriteHref(href: string): string {
  if (href.startsWith(SASE)) return href.slice(SASE.length) || "/";
  if (href.startsWith("/")) return `${MAIN}${href}`;
  return href;
}

function rewriteLinks<T extends { href: string }>(links: ReadonlyArray<T>): T[] {
  return links.map((l) => ({ ...l, href: rewriteHref(l.href) }));
}

export const NAV_LOCAL: ReadonlyArray<NavTopItem> = NAV.map((item) => ({
  ...item,
  href: rewriteHref(item.href),
  sections: item.sections?.map((sec) => ({
    ...sec,
    links: rewriteLinks(sec.links),
  })),
}));
