import type { Metadata } from "next";
import ProjectDesk from "@/components/ProjectDesk";
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

const TITLE =
  "Imagine describing your SASE and SD-WAN requirements once, then watching the world's leading suppliers compete for your business";

export const metadata: Metadata = {
  title: TITLE,
  description:
    "Imagine describing your requirements in a single sentence. Behind the scenes, Netify has already mapped the thousands of follow-up questions technology buyers ask AI, helping you build a richer, more complete Statement of Requirements automatically.",
  alternates: { canonical: "https://netify.co.uk/" },
  openGraph: {
    title: TITLE,
    description:
      "Describe your requirements in a single sentence; Netify has already mapped the thousands of follow-up questions technology buyers ask AI, and builds your Statement of Requirements automatically.",
    url: `${SITE_URL}/workspace/`,
    type: "website",
    locale: "en_GB",
  },
};

function getWorkspaceWebApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${SITE_URL}/workspace/#webapplication`,
    name: "Netify Live Sourcing Workspace",
    url: `${SITE_URL}/workspace/`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "A living Statement of Requirements for SD-WAN, SASE and managed security: the complete framework stands on screen from the first second and becomes yours as you describe your project in plain sentences or touch the requirements you recognise. Provenance on every claim, a network diagram drawn from the stated estate, rulebook-assessed scope and evidence-graded supplier fit. One signature publishes an anonymous notice to the open board and the full brief to matched signed-in suppliers.",
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
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6">
        {/* The only chrome: a wordmark and two quiet exits. */}
        <header className="mb-7 flex items-baseline justify-between">
          <a href="/" className="text-[15px] font-semibold tracking-tight text-zinc-900 no-underline">
            <span className="mr-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 align-[-4px] text-[13px] font-bold text-white">N</span>
            Netify
          </a>
          <span className="flex gap-5 text-[12.5px] text-zinc-500">
            <a href="/sase/opportunities/board/" className="no-underline hover:text-zinc-900">The board</a>
            <a href="/sase/account/" className="no-underline hover:text-zinc-900">My account</a>
          </span>
        </header>

        {/* Robert's words, verbatim, rendered secondary (13.4): the document
            commands the viewport; the words recede but do not leave. */}
        {/* Inline sizes: the site's un-layered heading rules would otherwise
            out-cascade the utilities and render the promise huge again. */}
        <h1
          id="page-h1"
          className="m-0 max-w-3xl tracking-tight"
          style={{ fontSize: "16.5px", lineHeight: 1.45, fontWeight: 600, color: "#27272a" }}
        >
          Imagine describing your SASE and SD-WAN requirements once, then watching the world&rsquo;s leading suppliers
          compete for your business.
        </h1>
        <p id="page-subhead" className="mb-0 mt-1 max-w-2xl text-[12.5px] leading-relaxed text-zinc-500">
          Imagine describing your requirements in a single sentence. Behind the scenes, Netify has already mapped the
          thousands of follow-up questions technology buyers ask AI, helping you build a richer, more complete Statement
          of Requirements automatically.
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
            Prefer a question-by-question build? The <a href="/sase/rfp-builder/" className="underline">RFP Builder</a>{" "}
            remains available, and everything you publish from here opens in the same project workspace: responses side
            by side, pricing private to you.
          </p>
        </section>
      </main>
    </div>
  );
}
