import type { Metadata } from "next";
import ProjectDesk from "@/components/ProjectDesk";
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

/** The canonical paragraph, Robert's words verbatim (23 Jul 2026). */
const CANON_H1 = "Netify is a living SASE & SD-WAN procurement marketplace.";
const CANON_REST =
  "Build your Statement of Requirements (SoR), RFI or full RFP, then publish anonymously to a curated marketplace of 30+ leading vendors and managed service providers. Receive competing proposals, compare solutions, build your shortlist and manage your procurement from a single description of your project.";
const CANON = `${CANON_H1} ${CANON_REST}`;

export const metadata: Metadata = {
  title: "The living SASE & SD-WAN procurement marketplace",
  description: CANON,
  alternates: { canonical: `${APEX}/` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Netify | The living SASE & SD-WAN procurement marketplace",
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

        <h1
          id="page-h1"
          className="m-0 max-w-3xl tracking-tight"
          style={{ fontSize: "22px", lineHeight: 1.35, fontWeight: 600, letterSpacing: "-0.015em", color: "#18181b" }}
        >
          {CANON_H1}
        </h1>
        <p id="page-subhead" className="mb-0 mt-3 max-w-3xl text-[14px] leading-relaxed text-zinc-500">
          {CANON_REST}
        </p>
        <p className="m-0 mt-4 flex max-w-3xl items-start gap-2 text-[13px] leading-relaxed text-zinc-500">
          <svg width="13" height="15" viewBox="0 0 14 16" className="mt-[3px] shrink-0" aria-hidden="true">
            <path d="M7 1 L13 3.2 V8 C13 11.8 10.4 14.2 7 15 C3.6 14.2 1 11.8 1 8 V3.2 Z" fill="none" stroke="#71717a" strokeWidth="1.3" />
            <path d="M4.6 8 L6.4 9.8 L9.6 6.2" fill="none" stroke="#71717a" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <span>
            <span className="font-semibold text-zinc-800">Netify</span> is a UK research and procurement platform for SASE, SD-WAN and network security: evaluated
            supplier intelligence with dates on every grade, and an anonymous route to market that only you can sign.
          </span>
        </p>

        <ProjectDesk />

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
