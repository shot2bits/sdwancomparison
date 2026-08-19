import type { Metadata } from "next";
import NetifyEvents from "@/components/NetifyEvents";
import "./globals.css";

// 19 Aug 2026: Robert asked to drop the self-hosted Inter webfont entirely
// and render in the platform's own default system UI font throughout (see
// the --nf-font-* / --font-* tokens in globals.css, which no longer
// reference --font-inter). No custom font file is fetched or loaded now;
// every OS renders its own native UI typeface, exactly as an unstyled page
// would.

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /**
   * True root (2030 living-procurement workspace separation, 18 Aug
   * 2026): this used to render MegaNav + the six-column SiteFooter
   * directly, which meant EVERY route in the app — including the living-
   * document workspace — inherited marketing chrome with no way to opt
   * out (Next's App Router nesting is strictly additive: a child layout
   * can only add to what an ancestor already rendered, never remove it).
   * That chrome now lives one level down, in (marketing)/layout.tsx,
   * applied to every existing route via `git mv` (route groups are
   * stripped from the URL, so every public path is unchanged). The
   * living-document experience sits in the sibling (workspace)/layout.tsx
   * with its own minimal product header instead. This root is now just
   * the html/body shell, the accessibility skip link, and sitewide
   * analytics — both of which still apply to literally every route,
   * workspace included.
   */
  return (
    <html lang="en-GB">
      <body className="paper-texture min-h-screen">
        {/* Accessibility skip link: invisible until keyboard-focused, then a
            fixed amber pill just below the top bar. Styled by .skip-link in
            globals.css (owning every property) after Tailwind's not-sr-only
            reset put the focused link underneath the nav bar — the overlap
            in Harry's retest screenshot, 03/07/2026. Every route-group
            layout below renders its own <main id="main-content">, so this
            target id always resolves. */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {/* Commercial event tracking: Vercel Web Analytics + GA4 — sitewide,
            workspace included, so it stays at the true root. */}
        <NetifyEvents />
        {children}
      </body>
    </html>
  );
}
