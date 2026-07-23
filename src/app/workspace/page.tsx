import type { Metadata } from "next";
import ProjectDesk from "@/components/ProjectDesk";
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

/** The canonical paragraph, Robert's words verbatim (23 Jul 2026). */
const CANON_H1 = "Netify is a living SASE & SD-WAN procurement marketplace.";
const CANON_REST =
  "Build your Statement of Requirements (SoR), RFI or full RFP, then publish anonymously to a curated marketplace of 30+ leading vendors and managed service providers. Receive competing proposals, compare solutions, build your shortlist and manage your procurement from a single description of your project.";
const CANON = `${CANON_H1} ${CANON_REST}`;

export const metadata: Metadata = {
  title: "The living SASE & SD-WAN procurement marketplace",
  description: CANON,
  alternates: { canonical: "https://netify.co.uk/" },
  openGraph: {
    title: "Netify | The living SASE & SD-WAN procurement marketplace",
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
        <h1
          id="page-h1"
          className="m-0 max-w-3xl tracking-tight"
          style={{ fontSize: "16.5px", lineHeight: 1.45, fontWeight: 600, color: "#27272a" }}
        >
          {CANON_H1}
        </h1>
        <p id="page-subhead" className="mb-0 mt-1 max-w-3xl text-[12.5px] leading-relaxed text-zinc-500">
          {CANON_REST}
        </p>
        <p className="m-0 mt-2.5 max-w-3xl border-l-2 border-amber-400 pl-2.5 text-[11.5px] leading-relaxed text-zinc-600">
          <span className="font-semibold text-zinc-800">Netify</span> is a UK research and procurement platform for SASE, SD-WAN and network security: evaluated
          supplier intelligence with dates on every grade, and an anonymous route to market that only you can sign.
          Reviewed by Robert Sturt.
        </p>

        <ProjectDesk />

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
