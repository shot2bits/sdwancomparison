import type { Metadata } from "next";
import { Inter } from "next/font/google";
import SideNav from "@/components/SideNav";
import TopNav from "@/components/TopNav";
import "./globals.css";

// Inter matches the main netify.co.uk site (SF Pro approximation),
// self-hosted via next/font so no layout shift and no runtime request.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Netify SD-WAN and SASE Vendor Comparison",
    template: "%s | Netify",
  },
  description:
    "Vendor-neutral SD-WAN and SASE comparison covering 30 platforms and managed providers against a 40-feature evaluation framework. Published by Netify.",
  metadataBase: new URL("https://netify.co.uk/sase"),
  openGraph: {
    type: "website",
    siteName: "Netify Vendor Comparison",
  },
  robots: { index: true, follow: true },
};

// Footer mega-nav. Mirrors the netify.co.uk footer (components/site-footer.tsx
// + lib/home-content.ts) so the SASE app carries the same trust/authority and
// commercial links. SASE-app-native routes use relative paths; everything that
// lives on the marketing site uses absolute https://netify.co.uk URLs; the
// editorial blog uses its Ghost subdomain. Keep labels in sync with the main
// site's footer.
const FOOTER_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Platform",
    links: [
      { label: "How It Works", href: "/how-it-works" },
      { label: "SASE & SD-WAN RFP Builder", href: "/rfp-builder" },
      { label: "SD-WAN Shortlist Builder", href: "/shortlist" },
      { label: "All vendors", href: "/vendors" },
    ],
  },
  {
    title: "Resell",
    links: [
      { label: "BT Business portfolio", href: "https://netify.co.uk/resell/bt-business-services/" },
      { label: "BT Business Broadband", href: "https://netify.co.uk/resell/bt-business-broadband/" },
      { label: "BT Business Internet (BTnet)", href: "https://netify.co.uk/resell/bt-business-internet/" },
      { label: "BT Cloud Voice", href: "https://netify.co.uk/resell/bt-hosted-voip/" },
      { label: "BT Cloud Security", href: "https://netify.co.uk/resell/bt-cloud-security/" },
      { label: "BT SD-WAN", href: "https://netify.co.uk/resell/bt-sd-wan/" },
      { label: "BT SASE", href: "https://netify.co.uk/resell/bt-sase/" },
      { label: "Virgin Media Business", href: "https://netify.co.uk/resell/virgin-media-business/" },
    ],
  },
  {
    title: "RFP Building by Sector",
    links: [
      { label: "Healthcare & Pharma", href: "https://netify.co.uk/sd-wan-for-healthcare/" },
      { label: "Retail & E-commerce", href: "https://netify.co.uk/sd-wan-sase-for-retail/" },
      { label: "Financial Services", href: "https://netify.co.uk/sd-wan-sase-for-financial-services/" },
      { label: "Manufacturing", href: "https://netify.co.uk/sd-wan-sase-for-manufacturing/" },
    ],
  },
  {
    title: "Insights & Guidance",
    links: [
      { label: "Blog & Articles", href: "https://netify.co.uk/insights/" },
      { label: "SD-WAN Shortlist Builder", href: "/shortlist" },
      { label: "Netify Resources", href: "https://netify.co.uk/resources/" },
      { label: "Healthcare Trust & Evidence", href: "https://netify.co.uk/healthcare-trust-and-evidence/" },
      { label: "Vendor Comparison Index", href: "https://netify.co.uk/vendor-comparison/" },
      { label: "Research Methodology", href: "https://netify.co.uk/methodology/" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", href: "https://netify.co.uk/about-netify/" },
      { label: "How Netify Works", href: "https://netify.co.uk/about-netify-marketplace/" },
      { label: "How Netify makes money", href: "https://netify.co.uk/how-netify-makes-money/" },
      { label: "Editorial Policy & Corrections", href: "https://netify.co.uk/editorial-policy/" },
      { label: "Our Team", href: "https://netify.co.uk/staff-list/" },
      { label: "Netify Authors", href: "https://netify.co.uk/author-list/" },
      { label: "Contact Us", href: "https://netify.co.uk/contact/" },
      { label: "Privacy Policy", href: "https://netify.co.uk/privacy-policy/" },
      { label: "Cookie Policy", href: "https://netify.co.uk/cookie-policy/" },
      { label: "Terms and Conditions", href: "https://netify.co.uk/terms-conditions/" },
    ],
  },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB" className={inter.variable}>
      <body className="paper-texture min-h-screen">
        {/* TopNav = global zone switcher (SASE Marketplace / Buy BT /
            Resell BT + global pages). SideNav = SASE-zone deep nav,
            desktop only; mobile deep nav is TopNav's drawer. */}
        <TopNav />
        <SideNav />
        <div className="lg:pl-60 min-h-screen flex flex-col">
          <main className="flex-1">{children}</main>

          <footer className="border-t border-[var(--ink-200)] mt-24">
            <div className="max-w-6xl mx-auto px-6 py-16">
              {/* Link columns - mirrors the netify.co.uk footer */}
              <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5 text-sm">
                {FOOTER_COLUMNS.map((col) => (
                  <div key={col.title}>
                    <p className="eyebrow mb-4">{col.title}</p>
                    <ul className="space-y-3">
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
              <div className="mt-16 grid gap-8 border-t border-[var(--ink-200)] pt-10 md:grid-cols-2 text-sm text-[var(--ink-500)]">
                <div>
                  <p className="display text-lg text-[var(--ink-900)] mb-2">Netify Group Limited</p>
                  <p>Moor Hall Barn</p>
                  <p>Workhouse Lane</p>
                  <p>Melton Constable, Norfolk</p>
                  <p>NR24 2BE, England</p>
                  <p className="mt-3">Company No: 07087612</p>
                </div>
                <div className="md:text-right">
                  <p>
                    Email:{" "}
                    <a href="mailto:support@netify.com" className="hover:text-[var(--ink-900)]">
                      support@netify.com
                    </a>
                  </p>
                  <p>Tel: +44 (0)333 202 1011</p>
                  <p className="mt-3">Netify® is a registered trademark (UK00003413742)</p>
                  <p className="mt-3">
                    Vendor-neutral SD-WAN, SASE and managed network research. Capability grades are
                    based on public source evidence; always confirm via RFP.
                  </p>
                </div>
              </div>

              <div className="mt-10 border-t border-[var(--ink-200)] pt-6">
                <p className="text-xs text-[var(--ink-500)]">
                  © {new Date().getUTCFullYear()} Netify Group Limited. All rights reserved.
                </p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
