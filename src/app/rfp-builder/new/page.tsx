import type { Metadata } from "next";
import DescribeWizard from "@/components/DescribeWizard";
import WizardSupportingContent from "@/components/WizardSupportingContent";
import {
  SITE_URL,
  getBreadcrumbSchema,
  getOrganizationSchema,
  getSpeakableSchema,
} from "@/lib/structured-data";

// /rfp-builder/new/ - the Describe step of the Describe, Generate, Publish
// flow (docs/netify-rfp-flow-spec-2026-07-14.md). Server-rendered intro so
// the page is indexable and citable; the wizard itself is a client island.

export const metadata: Metadata = {
  title: "Start a SASE or SD-WAN Project: Two-Minute Brief",
  description:
    "One two-minute brief and five verified SASE or SD-WAN suppliers respond with structured answers and private pricing. Free for buyers, no sales calls until you reply.",
  alternates: { canonical: `${SITE_URL}/rfp-builder/new/` },
  openGraph: {
    title: "Start a SASE or SD-WAN Project: Two-Minute Brief",
    description:
      "One two-minute brief and five verified SASE or SD-WAN suppliers respond with structured answers and private pricing. Free for buyers, no sales calls until you reply.",
    url: `${SITE_URL}/rfp-builder/new/`,
    type: "website",
    locale: "en_GB",
  },
};

export default function NewProjectPage() {
  const schemas = [
    getOrganizationSchema(),
    getBreadcrumbSchema("Start your project", "/rfp-builder/new"),
    getSpeakableSchema("/rfp-builder/new"),
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "How to get competing SASE and SD-WAN supplier bids on Netify",
      totalTime: "PT2M",
      step: [
        { "@type": "HowToStep", position: 1, name: "Describe your project", text: "Give the project a title, then answer five quick questions on scope, estate size, regions, current setup and timescale. No account is needed." },
        { "@type": "HowToStep", position: 2, name: "Review the generated RFP", text: "Netify assembles a complete RFP from its question bank (Methodology v2026.1). You review, trim and tailor the document." },
        { "@type": "HowToStep", position: 3, name: "Publish to matched suppliers", text: "Publishing emails each matched vendor and managed service provider a private response link. One sign-in with a business email is required at this point." },
        { "@type": "HowToStep", position: 4, name: "Compare the bids", text: "Structured responses come back scored against your questions. Pricing stays private to the buyer." },
      ],
    },
  ];
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}
      <div className="mb-10 max-w-3xl">
        <p className="eyebrow mb-3">Start your project</p>
        <h1 id="page-h1" className="mb-4">One two-minute brief. Five verified SASE and SD-WAN suppliers respond.</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">
          Answer five quick questions and Netify assembles a complete RFP from its question bank,
          matches you to verified vendors and managed service providers, and submits it when you
          agree the final step. Suppliers respond in the app with structured answers and pricing
          that stays private to you. One submission replaces five sales calls.
        </p>
        {/* CTM-style offer ticks (Robert, 17 July 2026): the deal in one
            glance before any question is asked. Server-rendered so agents and
            crawlers read the offer, not just the form. */}
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="text-emerald-600 font-bold">✓</span> Free for buyers</li>
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="text-emerald-600 font-bold">✓</span> No sales calls until you reply</li>
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="text-emerald-600 font-bold">✓</span> Pricing private to you</li>
          <li className="flex items-center gap-1.5"><span aria-hidden="true" className="text-emerald-600 font-bold">✓</span> No obligation to award</li>
        </ul>
      </div>
      <DescribeWizard />

      {/* Server-rendered context below the wizard, so this page carries the
          same substance for crawlers and AI engines that the interaction
          carries for people. Hidden client-side once the wizard starts, so
          the flow never reads as repeating itself (Harry, 15 July 2026). */}
      <WizardSupportingContent>
      <section className="mt-16 max-w-3xl">
        <h2 className="text-xl font-semibold mb-2">What happens after you describe the project</h2>
        <p className="text-sm text-[var(--ink-700)] mb-3">
          Netify assembles a complete RFP from its question bank (Methodology v2026.1), tailored to
          your scope, estate, regions and compliance answers. The final step is the agreement: your
          RFP is generated and submitted to your matched vendors and managed service providers, each
          of whom receives a private response link; suppliers do not need an account to reply.
          Responses come back structured against your questions and are scored side by side. Bid
          amounts stay private to you.
        </p>
        <p className="text-sm text-[var(--ink-700)]">
          Nothing is shared with any supplier until you agree the submission at the final step, and
          no account is needed to build. One business-email sign-in confirms the submission, which
          also saves the RFP to your account. Prefer to review first? A generate-only option sits
          under the submit button.
        </p>
      </section>

      <section className="mt-10 max-w-3xl">
        <h2 className="text-xl font-semibold mb-2">For AI agents</h2>
        <p className="text-sm text-[var(--ink-700)]">
          Agents can run this flow programmatically: <code className="text-[13px]">GET /sase/api/rfp/match</code> returns
          the live supplier match for a scope, region set and delivery model; <code className="text-[13px]">POST /sase/api/rfp</code> creates
          a draft RFP from a title and buyer context and returns the manage token; the Netify MCP
          server at <code className="text-[13px]">/sase/api/mcp</code> exposes the full toolset for drafting, validating and
          publishing on a buyer&apos;s behalf. The methodology behind the generated questions is served
          at <a href="https://netify.co.uk/methodology/" className="underline">netify.co.uk/methodology</a>.
        </p>
      </section>
      </WizardSupportingContent>
    </div>
  );
}
