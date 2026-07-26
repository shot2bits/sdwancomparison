import type { Metadata } from "next";
import ProjectDesk from "@/components/ProjectDesk";
import HeroBlocks from "@/components/HeroBlocks";
import MegaNav from "@/components/MegaNav";
import { SITE_URL, getBreadcrumbSchema, getOrganizationSchema, getSpeakableSchema } from "@/lib/structured-data";

/**
 * /workspace/ (public path /sase/workspace/): the Living Statement of
 * Requirements, P3.1 (spec v1.5 section 13, Robert's sign-off 22 July).
 *
 * The inversion, decided: the document is the hero. The complete framework
 * stands on screen from second zero in the example state; Robert's
 * headline and sub paragraph stay verbatim but recede (13.4); the market,
 * estate figure and crew respond in the rail. The takeover holds from P2:
 * a fixed, opaque, paper-light surface above the site chrome, system font.
 *
 * Below the desk, almost nothing: the document IS the explanation. The
 * two rules and the RFP Builder escape hatch survive in a quiet footer
 * with the bridge line; yesterday's below-fold sections retired here by
 * the same decision that made the document the hero.
 */

/** The canonical top text, Robert's words verbatim (revised by Robert
 *  25 Jul 2026 evening, the real-time living Buying Assistant ruling,
 *  mockup v4 sign-off: heading size unchanged, no chip, no ticks;
 *  "vendors and managed service providers" stays in the text by his
 *  instruction; demos and local contacts ride the messaging sentence
 *  until the live supply-side slice makes them first-class). Respoken
 *  identically in src/app/home/page.tsx. */
const CANON_H1 = "Netify is a real-time living SASE Security & SD-WAN Buying Assistant.";
/** The mechanism (Robert, 25 Jul night, v5): the subhead and the page's
 *  spoken description. His words; "high-level" hyphenated, house comma. */
const CANON_REST =
  "Start with a single prompt. The Netify SASE Security & SD-WAN buying assistant translates your high-level needs into technical requirements. Build your Statement of Requirements, RFI or RFP. Publish it to our global opportunity board.";
const CANON_CAPS =
  "Start receiving responses from vendors and managed service providers, all without a single call. Message vendors and providers to request demos and reach their local teams. Get bids and pricing. Shortlist the solutions that match.";
const CANON_PROOF =
  "Connected in real time to 30+ SASE & SD-WAN vendors and managed service providers, from Gartner leaders to niche players. Used by UK & North American national and multinational businesses.";
const CANON = `${CANON_H1} ${CANON_REST} ${CANON_CAPS} ${CANON_PROOF}`;

export const metadata: Metadata = {
  title: "The real-time living SASE Security & SD-WAN Buying Assistant",
  description: CANON,
  alternates: { canonical: "https://netify.co.uk/" },
  openGraph: {
    title: "Netify | The real-time living SASE Security & SD-WAN Buying Assistant",
    description: CANON,
    url: `${SITE_URL}/workspace/`,
    type: "website",
    locale: "en_GB",
  },
};

function getWorkspaceWebApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": "https://netify.co.uk/#webapplication",
    name: "Netify SASE & SD-WAN Procurement Marketplace",
    url: "https://netify.co.uk/",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: `${CANON} Provenance on every claim, a network diagram drawn from the stated estate, rulebook-assessed scope and evidence-graded supplier fit. One signature publishes an anonymous notice to the open board and the full brief to matched signed-in suppliers.`,
    offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
    provider: { "@id": `${SITE_URL}/#organization` },
  };
}

export default function Page() {
  const schemas = [
    getWorkspaceWebApplicationSchema(),
    getOrganizationSchema(),
    getBreadcrumbSchema("Start a project", "/workspace/"),
    getSpeakableSchema("/workspace/"),
  ];
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-[#fbfaf8]">
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}
      <MegaNav takeover />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">

        {/* Robert's words, verbatim, rendered secondary (13.4): the document
            commands the viewport; the words recede but do not leave. */}
        {/* Inline sizes: the site's un-layered heading rules would otherwise
            out-cascade the utilities and render the promise huge again. */}
        {/* The v6 Perplexity ruling (Robert, 26 Jul): the headline is the
            one line above the prompt; every paragraph lives in the hero
            blocks the desk renders beneath its prompt card. */}
        <h1
          id="page-h1"
          className="mx-auto m-0 max-w-3xl text-center tracking-tight"
          style={{ fontSize: "16.5px", lineHeight: 1.45, fontWeight: 600, color: "#27272a" }}
        >
          {CANON_H1}
        </h1>

        <ProjectDesk afterPrompt={<HeroBlocks />} />

        {/* The quiet footer: the rules, the bridge, the escape hatch. */}
        <section className="mx-auto mt-16 max-w-3xl border-t border-zinc-200 pt-5 text-[11.5px] leading-relaxed text-zinc-500">
          <p className="m-0">
            Most technology buyers ask AI dozens of questions before they speak to a supplier. Netify begins where those
            conversations end: every section above exists because buyers ask for it, and the two rules this surface is
            built on never bend. Nothing here simulates liveness: supplier entries show real capability grades with
            their evaluation dates, and a quiet market shows quietly. And every claim carries provenance: your words, a
            named inference, dated evidence, or grey example content that never publishes. Recommendations that route
            away from what Netify earns from are recorded and shown.
          </p>
          <p className="m-0 mt-2.5">
            Prefer to study the formal shape first? The <a href="/sase/rfp-builder/sample-rfp/" className="underline">sample RFP</a>{" "}
            and the <a href="/sase/rfp-builder/questions/" className="underline">question bank</a> stay open, and
            everything you publish from here opens in the same procurement: responses side by side, pricing private to
            you.
          </p>
        </section>
      </main>
    </div>
  );
}
