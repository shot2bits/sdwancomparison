import type { Metadata } from "next";
import ProjectDesk from "@/components/ProjectDesk";
import { getOrganizationSchema } from "@/lib/structured-data";

/**
 * /home/ (public path /sase/home/, served at netify.co.uk/ by the apex
 * rewrite): the homepage variant of the workspace, Robert's decision,
 * 23 July: "the future is not marketing copy... this page is really
 * Netify". Identical desk, identical H1 verbatim; three differences only:
 * the canonical is the apex itself, the chrome carries one quiet line of
 * paths into the rest of the estate (the takeover must not hide the
 * company when it IS the front door), and the schema declares the
 * application at the apex. Everything else is the workspace, unchanged.
 */

const APEX = "https://netify.co.uk";

const TITLE =
  "Imagine describing your SASE and SD-WAN requirements once, then watching the world's leading suppliers compete for your business";

export const metadata: Metadata = {
  title: `Netify | ${TITLE}`,
  description:
    "Imagine describing your requirements in a single sentence. Behind the scenes, Netify has already mapped the thousands of follow-up questions technology buyers ask AI, helping you build a richer, more complete Statement of Requirements automatically.",
  alternates: { canonical: `${APEX}/` },
  robots: { index: true, follow: true },
  openGraph: {
    title: `Netify | ${TITLE}`,
    description:
      "Describe your requirements in a single sentence; Netify has already mapped the thousands of follow-up questions technology buyers ask AI, and builds your Statement of Requirements automatically.",
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
      description:
        "Netify is a living procurement position for SASE and SD-WAN: describe your requirements once and the world's leading suppliers compete for your business.",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "@id": `${APEX}/#webapplication`,
      name: "Netify Live Sourcing Workspace",
      url: `${APEX}/`,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "A living Statement of Requirements for SD-WAN, SASE and managed security: the complete framework stands on screen from the first second and becomes yours as you describe your project in plain sentences. Provenance on every claim, evidence-graded supplier fit, and one human signature publishes an anonymous notice to the signed-in curated marketplace. Fully agent-accessible via MCP and llms.txt.",
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
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-5 sm:px-6">
        {/* The front door's chrome: the wordmark, the two working exits, and
            one quiet line into the rest of the estate. The homepage must
            never hide the company. */}
        <header className="mb-2 flex items-baseline justify-between">
          <span className="text-[15px] font-semibold tracking-tight text-zinc-900">
            <span className="mr-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 align-[-4px] text-[13px] font-bold text-white">N</span>
            Netify
          </span>
          <span className="flex gap-5 text-[12.5px] text-zinc-500">
            <a href="/sase/opportunities/board/" className="no-underline hover:text-zinc-900">The board</a>
            <a href="/sase/account/" className="no-underline hover:text-zinc-900">My account</a>
          </span>
        </header>
        <p className="m-0 mb-6 text-[10.5px] text-zinc-400">
          <a href="/sase/" className="no-underline hover:text-zinc-700">Comparisons and research</a>
          <span className="mx-2">·</span>
          <a href="/insights/" className="no-underline hover:text-zinc-700">Insights</a>
          <span className="mx-2">·</span>
          <a href="/resell/reseller-programmes/" className="no-underline hover:text-zinc-700">Reseller programmes</a>
          <span className="mx-2">·</span>
          <a href="/sase/rfp-builder/" className="no-underline hover:text-zinc-700">RFP Builder</a>
        </p>

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
            AI agents are first-class visitors here: <a href="/llms.txt" className="underline">llms.txt</a> describes
            this application and Netify&rsquo;s MCP connection lets an agent build and iterate the same Statement of
            Requirements a person builds, to the same publish gate, where a human always signs. Prefer a
            question-by-question build? The <a href="/sase/rfp-builder/" className="underline">RFP Builder</a> remains
            available, and everything you publish from here opens in the same project workspace: responses side by
            side, pricing private to you.
          </p>
        </section>
      </main>
    </div>
  );
}
