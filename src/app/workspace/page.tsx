import type { Metadata } from "next";
import LiveWorkspace from "@/components/LiveWorkspace";
import { SITE_URL } from "@/lib/structured-data";
import { RULEBOOK_VERSION } from "@/lib/security/rulebook";

/**
 * /workspace/ (public path /sase/workspace/): the Live Sourcing Workspace,
 * the one door for security, SASE and SD-WAN buying (W0, spec v1.3
 * section 3). Server-rendered intro so the page is indexable and citable;
 * the workspace itself is a client island over the extraction, rulebook,
 * diagram and fit organs.
 *
 * Constitutional traceability: serves the Marketplace (publish is the
 * payout), the Matrix (evidence-graded fit), the Notary (consent at
 * signature), the Record (the project object), the Observatory (cycle
 * events) and the Mandate (the same loop is the MCP contract).
 */

export const metadata: Metadata = {
  title: "Start a Project: Describe Your SD-WAN, SASE or Security Requirement in One Sentence",
  description:
    "Describe your requirement in a sentence and watch the statement of requirements write itself, with every claim marked as your words or Netify's inference. Correct it by tapping, then sign once to publish to matched, evaluated suppliers.",
  alternates: { canonical: `${SITE_URL}/workspace/` },
  openGraph: {
    title: "Start a Project: the Netify Live Sourcing Workspace",
    description:
      "One sentence in, a publishable statement of requirements out: provenance on every claim, a network diagram drawn from your estate, evaluated supplier fit and one signature to publish.",
    url: `${SITE_URL}/workspace/`,
    type: "website",
    locale: "en_GB",
  },
};

export default function Page() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="eyebrow mb-2">Netify marketplace · rulebook {RULEBOOK_VERSION}</p>
      <h1 className="mb-3 text-3xl leading-tight sm:text-4xl">
        Where you go when you need to buy SD-WAN, SASE or managed security
      </h1>
      {/* Extractable answer block: what this page does, in under 80 words. */}
      <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--ink-700,#3f3f46)]">
        Describe your requirement in one sentence. The workspace drafts your statement of requirements as you type,
        marks every claim as your words or Netify&rsquo;s named inference, draws your network, and lists evaluated
        suppliers with real evaluation dates. One signature publishes it: an anonymous notice on the open board, the
        full brief to matched signed-in suppliers. Free to draft, no sign-in until you publish.
      </p>

      <LiveWorkspace />

      {/* Below the workspace: the honest boundary and the delegation case. */}
      <section className="mt-16 max-w-2xl border-t border-[var(--ink-200,#e5e5e5)] pt-6">
        <h2 className="mb-2 text-lg font-semibold">Why publish here rather than paste an AI draft into email</h2>
        <p className="mb-3 text-sm leading-relaxed text-[var(--ink-700,#3f3f46)]">
          An AI assistant can draft a requirement document. It cannot publish an anonymous notice to Netify&rsquo;s
          opportunity board, invite suppliers graded against a 40-feature evaluation, gather structured responses with
          private pricing, or hold your identity back until you choose to reply. This page does both halves: the
          drafting and the market.
        </p>
        <h2 className="mb-2 mt-6 text-lg font-semibold">The two rules the draft is built on</h2>
        <p className="mb-3 text-sm leading-relaxed text-[var(--ink-700,#3f3f46)]">
          Nothing on this page simulates liveness: supplier entries show real capability grades with their evaluation
          dates, and nothing pretends to be live activity. And every claim carries provenance: a solid underline is
          your words, a dotted underline is a named Netify inference, and anything assumed publishes labelled as an
          assumption. Recommendations that route away from what Netify earns from are recorded and shown, because the
          verdict is worth more than the transaction.
        </p>
        <h2 className="mb-2 mt-6 text-lg font-semibold">Prefer the structured builder</h2>
        <p className="text-sm leading-relaxed text-[var(--ink-700,#3f3f46)]">
          The <a href="/sase/rfp-builder/" className="underline">RFP Builder</a> remains available for a
          question-by-question build, and everything you publish from here opens in the same project workspace:
          responses side by side, pricing private to you.
        </p>
      </section>
    </main>
  );
}
