import type { Metadata } from "next";
import PositionWorkspace from "@/components/PositionWorkspace";
import { getAllVendors } from "@/lib/vendors";
import { SITE_URL, getBreadcrumbSchema, getOrganizationSchema, getSpeakableSchema } from "@/lib/structured-data";

/**
 * /workspace/ (public path /sase/workspace/): the Position surface, P2.
 * Robert's correction (21 July, on seeing P1 live): the workspace must not
 * be a panel embedded in a webpage with menus and standard text, and it is
 * not dark mode. So this page TAKES OVER the viewport: a fixed, opaque,
 * paper-light surface above the site chrome, owning its own scroll. The
 * order of comprehension is his: the promise (his headline, verbatim), the
 * machine behind it (his paragraph, verbatim), the one obvious input, then
 * the living market below. Server-rendered so the H1, answer block and
 * JSON-LD stay fully indexable; the workspace itself is the client island.
 */

const TITLE =
  "Imagine describing your SASE and SD-WAN requirements once, then watching the world's leading suppliers compete for your business";

export const metadata: Metadata = {
  title: TITLE,
  description:
    "Imagine describing your requirements in a single sentence. Behind the scenes, Netify has already mapped the thousands of follow-up questions technology buyers ask AI, helping you build a richer, more complete Statement of Requirements automatically.",
  alternates: { canonical: `${SITE_URL}/workspace/` },
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
      "Describe an SD-WAN, SASE or managed security requirement in one sentence and the statement of requirements assembles itself, with provenance on every claim, a network diagram drawn from the stated estate, rulebook-assessed scope and evidence-graded supplier fit. One signature publishes an anonymous notice to the open board and the full brief to matched signed-in suppliers.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
    provider: { "@id": `${SITE_URL}/#organization` },
  };
}

export default function Page() {
  // The moat is stated in specifics, and the specific is read from the
  // dataset at render time so the prose can never drift from the truth.
  const vendorCount = getAllVendors().length;
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
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-5 sm:px-6">
        {/* The only chrome: a wordmark and two quiet exits. */}
        <header className="mb-10 flex items-baseline justify-between">
          <a href="/" className="text-[15px] font-semibold tracking-tight text-zinc-900 no-underline">
            <span className="mr-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 align-[-4px] text-[13px] font-bold text-white">N</span>
            Netify
          </a>
          <span className="flex gap-5 text-[12.5px] text-zinc-500">
            <a href="/sase/opportunities/board/" className="no-underline hover:text-zinc-900">The board</a>
            <a href="/sase/account/" className="no-underline hover:text-zinc-900">My account</a>
          </span>
        </header>

        {/* The promise, verbatim, then the machine behind it, verbatim. */}
        <h1
          id="page-h1"
          className="mx-auto mb-4 max-w-3xl text-center text-[28px] font-semibold leading-[1.15] tracking-tight text-zinc-950 sm:text-[36px]"
        >
          Imagine describing your SASE and SD-WAN requirements once, then watching the world&rsquo;s leading suppliers
          compete for your business.
        </h1>
        <p id="page-subhead" className="mx-auto mb-2 max-w-2xl text-center text-[15px] leading-relaxed text-zinc-600">
          Imagine describing your requirements in a single sentence. Behind the scenes, Netify has already mapped the
          thousands of follow-up questions technology buyers ask AI, helping you build a richer, more complete Statement
          of Requirements automatically.
        </p>
        {/* The bridge (22 July positioning review): Netify is the step after
            the AI conversation, not a competitor to it. One quiet line. */}
        <p id="page-bridge" className="mx-auto mb-2 max-w-2xl text-center text-[13.5px] leading-relaxed text-zinc-500">
          Most technology buyers ask AI dozens of questions before they speak to a supplier. Netify begins where those
          conversations end.
        </p>

        <PositionWorkspace />

        {/* Below the market: the separation from a writing tool, the moat in
            specifics (the count is rendered from the dataset, never typed),
            the rules, and the escape hatch. */}
        <section className="mx-auto mt-20 max-w-2xl border-t border-zinc-200 pt-6">
          <h2 className="mb-2 text-lg font-semibold text-zinc-900">An AI assistant can write an RFP. It cannot run a market.</h2>
          <p className="mb-3 text-sm leading-relaxed text-zinc-600">
            ChatGPT can draft a requirement document. What it cannot do is grade suppliers against Netify&rsquo;s
            40-feature evaluation framework, publish an anonymous notice to a live opportunity board, gather structured
            supplier responses with pricing kept private to you, or hold your identity back until you choose to reply.
            The writing is the start. The market is the product.
          </p>
          <h2 className="mb-2 mt-6 text-lg font-semibold text-zinc-900">What Netify holds that a general AI does not</h2>
          <p className="mb-3 text-sm leading-relaxed text-zinc-600">
            Evaluations of {vendorCount} suppliers against one 40-feature framework, each carrying the date it was last
            verified. A versioned security rulebook applied identically in your browser and on the server. A live board
            where breath marks only a genuinely open notice. And the mapped follow-up questions this engine was built
            from. None of it is generated on the fly, which is exactly why suppliers can compete for your business
            through it.
          </p>
          <h2 className="mb-2 mt-6 text-lg font-semibold text-zinc-900">The two rules this surface is built on</h2>
          <p className="mb-3 text-sm leading-relaxed text-zinc-600">
            Nothing here simulates liveness: supplier entries show real capability grades with their evaluation dates,
            breath marks only a genuinely open notice, and a quiet market shows quietly. And every claim carries
            provenance: your words, a named inference, dated evidence, or a labelled assumption. Recommendations that
            route away from what Netify earns from are recorded and shown, because the verdict is worth more than the
            transaction.
          </p>
          <h2 className="mb-2 mt-6 text-lg font-semibold text-zinc-900">Prefer the structured builder</h2>
          <p className="text-sm leading-relaxed text-zinc-600">
            The <a href="/sase/rfp-builder/" className="underline">RFP Builder</a> remains available for a
            question-by-question build, and everything you publish from here opens in the same project workspace:
            responses side by side, pricing private to you.
          </p>
        </section>
      </main>
    </div>
  );
}
