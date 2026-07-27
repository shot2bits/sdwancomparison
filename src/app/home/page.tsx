import type { Metadata } from "next";
import ProjectDesk from "@/components/ProjectDesk";
import HeroBlocks from "@/components/HeroBlocks";
import MegaNav from "@/components/MegaNav";
import { getOrganizationSchema } from "@/lib/structured-data";

/**
 * /home/ (public path /sase/home/, served at netify.co.uk/ by the apex
 * rewrite): the homepage variant of the workspace, Robert's decision,
 * 23 July: "the future is not marketing copy... this page is really
 * Netify". Three differences only: the canonical is the apex itself, the
 * chrome carries one quiet line of paths into the rest of the estate
 * (the takeover must not hide the company when it IS the front door),
 * and the schema declares the application at the apex.
 *
 * THE CANON (Robert, verbatim, 23 Jul evening, the consolidation): the
 * top text IS the canonical paragraph. Sentence one is the H1; the rest
 * is the sub. Word for word his; never paraphrase it here.
 *
 * Concept A visual pass (Robert's word, 23 Jul 2026): treatment only.
 * Type, space, depth and colour discipline hold.
 */

const APEX = "https://netify.co.uk";

/** The canonical top text, Robert's words verbatim (revised by Robert
 *  25 Jul 2026 evening, the real-time living Buying Assistant ruling,
 *  mockup v4 sign-off). Twin of the definition in
 *  src/app/workspace/page.tsx, kept verbatim-identical. */
const CANON_H1 = "Netify is a real-time living SASE Security & SD-WAN Buying Assistant.";
/** The mechanism (Robert, 25 Jul night, v5): the subhead and the page's
 *  spoken description. Twin of src/app/workspace/page.tsx, verbatim. */
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
  alternates: { canonical: `${APEX}/` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Netify | The real-time living SASE Security & SD-WAN Buying Assistant",
    description: CANON,
    url: `${APEX}/`,
    type: "website",
    locale: "en_GB",
  },
};

function getHomeSchemas() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${APEX}/#website`,
      name: "Netify",
      url: `${APEX}/`,
      description: CANON,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "@id": `${APEX}/#webapplication`,
      name: "Netify SASE & SD-WAN Procurement Marketplace",
      url: `${APEX}/`,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: `${CANON} Provenance on every claim, evidence-graded supplier fit, and one human signature publishes the anonymous notice. Fully agent-accessible via MCP and llms.txt.`,
      offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
      provider: { "@id": `${APEX}/#organization` },
    },
    {
      ...getOrganizationSchema(),
      "@id": `${APEX}/#organization`,
      url: `${APEX}/`,
    },
    {
      "@context": "https://schema.org",
      "@type": "SpeakableSpecification",
      "@id": `${APEX}/#speakable`,
      cssSelector: ["#page-h1", "#page-subhead"],
    },
    // The journey, machine-readable (v7): answer engines answer "how do I
    // publish a requirement" with the true four steps. Every claim below
    // traces to the canonical paragraph or the anonymity rule.
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      "@id": `${APEX}/#howto`,
      name: "Publish a SASE, security or SD-WAN requirement on Netify",
      description: CANON_REST,
      step: [
        {
          "@type": "HowToStep",
          position: 1,
          name: "Describe",
          text: "Start with a single prompt: describe your project in a sentence. The assistant translates your high-level needs into technical requirements.",
        },
        {
          "@type": "HowToStep",
          position: 2,
          name: "Preview",
          text: "Watch your Statement of Requirements, RFI or RFP build in the open, every claim carrying provenance, with no account needed to draft and preview.",
        },
        {
          "@type": "HowToStep",
          position: 3,
          name: "Publish",
          text: "Sign in to publish. Your notice lists anonymously on the global opportunity board and pricing stays private to you.",
        },
        {
          "@type": "HowToStep",
          position: 4,
          name: "Compare",
          text: "Receive responses from vendors and managed service providers, get bids and pricing, and shortlist the solutions that match.",
        },
      ],
    },
  ];
}

export default function Page() {
  const schemas = getHomeSchemas();
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-[#fbfaf8]">
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}
      {/* One header everywhere (Robert, 24 Jul): the mega navigation IS
          "the homepage must never hide the company", done properly. */}
      <MegaNav takeover />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-12">

        {/* The v6 Perplexity ruling (Robert, 26 Jul): the headline is the
            one line above the prompt; every paragraph lives in the hero
            blocks the desk renders beneath its prompt card. */}
        <h1
          id="page-h1"
          className="mx-auto m-0 max-w-3xl text-center tracking-tight"
          style={{ fontSize: "22px", lineHeight: 1.35, fontWeight: 600, letterSpacing: "-0.015em", color: "#18181b" }}
        >
          {CANON_H1}
        </h1>

        <ProjectDesk afterPrompt={<HeroBlocks />} />

        <section className="mx-auto mt-24 max-w-3xl border-t border-zinc-200 pt-6 text-[11px] leading-relaxed text-zinc-500">
          <p className="m-0">
            Most technology buyers ask AI dozens of questions before they speak to a supplier. Netify begins where those
            conversations end: every section above exists because buyers ask for it, and the two rules this surface is
            built on never bend. Nothing here simulates liveness: supplier entries show real capability grades with
            their evaluation dates, and a quiet market shows quietly. And every claim carries provenance: your words, a
            named inference, dated evidence, or grey example content that never publishes. Recommendations that route
            away from what Netify earns from are recorded and shown.
          </p>
          <p className="m-0 mt-2.5">
            AI agents are first-class visitors here: <a href="/llms.txt" className="underline">llms.txt</a> describes
            this application and Netify&rsquo;s MCP connection lets an agent build and iterate the same Statement of
            Requirements a person builds, to the same publish gate, where a human always signs. Prefer to
            study the formal shape first? The <a href="/sase/rfp-builder/sample-rfp/" className="underline">sample RFP</a>{" "}
            and the <a href="/sase/rfp-builder/questions/" className="underline">question bank</a> stay open, and
            everything you publish from here opens in the same procurement: responses side by side, pricing private to
            you.
          </p>
        </section>
      </main>
    </div>
  );
}
