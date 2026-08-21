import { buildStamp } from "@/lib/build-info";

/**
 * The six-column commercial/trust footer, extracted (18 Aug 2026, 2030
 * living-procurement workspace separation) out of the old root layout.tsx
 * so it has exactly one home instead of being duplicated between
 * (marketing)/layout.tsx and (workspace)/layout.tsx. The (workspace) group
 * needs this same trust content reachable on /home and /workspace — see
 * that layout's own doc comment for why (Robert's 30 Jul 2026 EEAT ruling)
 * — without inheriting MegaNav or living inside the workspace surface
 * itself, so both layouts render <CommercialFooter/> directly rather than
 * one importing chrome from the other.
 *
 * Mirrors the netify.co.uk footer (components/site-footer.tsx + lib/home-
 * content.ts) so the SASE app carries the same trust/authority and
 * commercial links. ALL hrefs are ROOT-RELATIVE full public paths
 * (2026-07-10 nav spec): in-app links carry the /sase prefix explicitly
 * (plain anchors miss Next's basePath); marketing-site links are root-
 * relative and resolve on the public host. Keep labels in sync with the
 * main site's footer.
 */
/* The pillar footer (the final architecture, 23 Jul, "Please implement"),
 * re-cut on the AI evidence 25 Jul into SIX columns that declare the
 * architecture rather than repeat the menu. THE TWIN of the main repo's
 * lib/home-content.ts FOOTER_COLUMNS: keep the two in sync, column for
 * column. The redirecting provider-and-vendor-comparison URL is replaced by
 * its destination, the RFP door stops routing through a 301, the two cited
 * market guides gain seats, a neutral Pricing and cost tools column carries
 * the revenue routes (two of which were in no chrome at all), Partner
 * Programmes leads with programme TYPES with BT as one entry, and the
 * orphaned Acceptable Use Policy joins governance. UNION LINE held. The per-item
 * audit governs: nothing valuable removed, the one exact duplicate gone
 * (shortlist listed twice), the reseller portal linked for the first
 * time, sector preloads live in the nav's Solutions group rather than
 * duplicating here. /vendor-comparison/ and /about-netify-marketplace/
 * keep their links until their deferred merges actually happen: internal
 * linking before redirects, and no page orphaned by the chrome. */
const FOOTER_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Marketplace and procurement",
    links: [
      { label: "How It Works", href: "/sase/how-it-works/" },
      { label: "SASE & SD-WAN RFP Builder", href: "https://netify.co.uk/" },
      { label: "Publish a project notice", href: "/sase/opportunities/new/" },
      { label: "Opportunities board", href: "/sase/opportunities/board/" },
      { label: "Question bank", href: "/sase/rfp-builder/questions/" },
      { label: "Sample RFP", href: "/sase/rfp-builder/sample-rfp/" },
      { label: "SD-WAN RFI Builder App", href: "/sd-wan-rfi-builder-app/" },
      { label: "For vendors and providers", href: "/sase/for-suppliers/" },
    ],
  },
  {
    title: "Providers and comparisons",
    links: [
      { label: "Build your shortlist", href: "/sase/shortlist/" },
      { label: "Evaluated providers", href: "/sase/vendors/" },
      { label: "All listed vendors", href: "/marketplace/" },
      { label: "Provider comparisons", href: "/vendor-comparison/" },
      { label: "Best providers by sector", href: "/sase/best/" },
      { label: "What the market is buying", href: "/sase/demand/" },
      { label: "AI assistant connector", href: "/sase/connector/" },
    ],
  },
  {
    title: "Solutions and sectors",
    links: [
      { label: "Insights: the blog", href: "/insights/" },
      { label: "SD-WAN research hub", href: "/sd-wan/" },
      { label: "Managed SASE providers", href: "/insights/10-best-managed-sase-providers/" },
      { label: "SSE and cyber security vendors", href: "/insights/best-sse-security-service-edge-vendors/" },
      { label: "SD-WAN for healthcare", href: "/sd-wan-for-healthcare/" },
      { label: "SD-WAN & SASE for retail", href: "/sd-wan-sase-for-retail/" },
      { label: "SD-WAN & SASE for financial services", href: "/sd-wan-sase-for-financial-services/" },
      { label: "SD-WAN & SASE for manufacturing", href: "/sd-wan-sase-for-manufacturing/" },
      { label: "Netify Resources", href: "/resources/" },
      { label: "Healthcare Trust & Evidence", href: "/healthcare-trust-and-evidence/" },
    ],
  },
  {
    title: "Pricing and cost tools",
    links: [
      { label: "Cost & TCO estimator", href: "/sase/cost-estimator/" },
      { label: "BT Cloud Voice pricing", href: "/tools/bt-cloud-voice-pricing-calculator/" },
      { label: "BTnet leased line costs", href: "/bt-leased-line-cost-calculator-tool/" },
      { label: "BT One Phone replacement", href: "/tools/bt-one-phone-replacement/" },
      { label: "Buy BT Business through Netify", href: "/buy-bt/" },
    ],
  },
  {
    title: "Partner Programmes",
    links: [
      { label: "Compare reseller programmes", href: "/insights/broadband-reseller-companies/" },
      { label: "Broadband reseller opportunities", href: "/resell/bt-business-broadband/" },
      { label: "SD-WAN reseller opportunities", href: "/resell/sd-wan-reseller/" },
      { label: "VoIP reseller opportunities", href: "/resell/voip-reseller/" },
      { label: "BT Business Partner Programme", href: "/bt-reseller-programme/" },
      { label: "BT Business portfolio", href: "/resell/bt-business-services/" },
      { label: "Virgin Media Business", href: "/resell/virgin-media-business/" },
      { label: "Reseller order portal", href: "https://reseller.netify.co.uk/" },
    ],
  },
  {
    title: "Company & Governance",
    links: [
      { label: "About Us", href: "/about-netify/" },
      { label: "About the Netify Marketplace", href: "/about-netify-marketplace/" },
      { label: "How Netify makes money", href: "/how-netify-makes-money/" },
      { label: "Editorial Policy & Corrections", href: "/editorial-policy/" },
      { label: "Acceptable Use Policy", href: "/acceptable-use-policy/" },
      { label: "Research Methodology", href: "/methodology/" },
      { label: "Our Team", href: "/staff-list/" },
      { label: "Netify Authors", href: "/author-list/" },
      { label: "Contact Us", href: "/contact/" },
      { label: "Privacy Policy", href: "/privacy-policy/" },
      { label: "Cookie Policy", href: "/cookie-policy/" },
      { label: "Terms and Conditions", href: "/terms-conditions/" },
      { label: "Corrections and updates", href: "/methodology/#corrections-and-updates" },
    ],
  },
];

export default function CommercialFooter() {
  return (
    <footer className="mt-12 border-t border-[var(--ink-200)]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Link columns - mirrors the netify.co.uk footer */}
        <div className="grid gap-x-6 gap-y-6 text-[12px] leading-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="eyebrow mb-2 text-[10px] leading-4">{col.title}</p>
              <ul className="space-y-1.5">
                {col.links.map((l) => {
                  const external = l.href.startsWith("http");
                  return (
                    <li key={`${col.title}-${l.href}-${l.label}`}>
                      <a
                        href={l.href}
                        className="text-[var(--ink-500)] hover:text-[var(--ink-900)] transition-colors"
                        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      >
                        {l.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Company details + research note */}
        <div className="mt-8 grid gap-5 border-t border-[var(--ink-200)] pt-6 text-[11px] leading-4 text-[var(--ink-500)] md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold text-[var(--ink-900)]">Netify Group Limited</p>
            <p>Moor Hall Barn</p>
            <p>Workhouse Lane</p>
            <p>Melton Constable, Norfolk</p>
            <p>NR24 2BE, England</p>
            <p className="mt-2">Company No: 07087612</p>
          </div>
          <div className="md:text-right">
            <p>
              Email:{" "}
              <a href="mailto:support@netify.com" className="hover:text-[var(--ink-900)]">
                support@netify.com
              </a>
            </p>
            <p>Tel: +44 (0)333 202 1011</p>
            <p className="mt-2">Netify® is a registered trademark (UK00003413742)</p>
            <p className="mt-2">
              Vendor-neutral SD-WAN, SASE and managed network research. Capability grades are
              based on public source evidence; always confirm via RFP.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2 border-t border-[var(--ink-200)] pt-4">
          <p className="text-[10px] leading-4 text-[var(--ink-500)]">
            © {new Date().getUTCFullYear()} Netify Group Limited. All rights reserved.
          </p>
          {/* The build stamp, on every page in both route groups. Baked in
              at build time, so a cached page disagrees with a freshly
              served one -- see build-info.ts for why it must not be
              computed per request. */}
          <p className="m-0 font-mono text-[10px] leading-4 text-[var(--ink-500)]" title="The build this page was served from">
            {buildStamp()}
          </p>
        </div>
      </div>
    </footer>
  );
}
