import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  weight: ["400", "500", "600"],
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plex",
  weight: ["400", "500", "600"],
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
    <html lang="en-GB" className={`${fraunces.variable} ${plex.variable}`}>
      <body className="paper-texture min-h-screen flex flex-col">
        <header className="border-b border-[var(--ink-200)] bg-[var(--paper-base)]/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-baseline justify-between gap-8">
            <Link
              href="/"
              className="display text-xl font-semibold tracking-tight no-underline text-[var(--ink-900)] hover:text-[var(--accent)]"
            >
              Netify
            </Link>
            <nav className="flex items-center gap-8 text-sm">
              <Link href="/shortlist" className="no-underline text-[var(--ink-700)] hover:text-[var(--accent)]">
                Shortlist builder
              </Link>
              <Link href="/vendors" className="no-underline text-[var(--ink-700)] hover:text-[var(--accent)]">
                Vendor comparison
              </Link>
              <a
                href="https://netify.co.uk"
                className="no-underline text-[var(--ink-700)] hover:text-[var(--accent)]"
              >
                netify.co.uk
              </a>
            </nav>
          </div>
        </header>

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
