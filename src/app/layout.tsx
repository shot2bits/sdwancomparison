import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://sase.netify.co.uk"),
  openGraph: {
    type: "website",
    siteName: "Netify Vendor Comparison",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB" className={inter.variable}>
      <body className="paper-texture min-h-screen flex flex-col">
        <SiteHeader />

        <main className="flex-1">{children}</main>

        <footer className="border-t border-[var(--ink-200)] mt-24 py-10">
          <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-8 text-sm text-[var(--ink-500)]">
            <div>
              <p className="display text-lg text-[var(--ink-900)] mb-2">Netify</p>
              <p>
                Vendor-neutral SD-WAN, SASE and managed network research. Published by Netify
                Group Limited.
              </p>
            </div>
            <div>
              <p className="eyebrow mb-3">Research methodology</p>
              <p>
                Capability grades are based on public source evidence. Status grades:
                yes, partial, partner-integrated, managed-service dependent, not primary,
                unknown. Always confirm via RFP.
              </p>
            </div>
            <div>
              <p className="eyebrow mb-3">About</p>
              <p>
                Netify Group Limited operates a marketplace and research platform for
                enterprise networking. This comparison covers 30 SD-WAN and SASE platforms
                and managed providers.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
