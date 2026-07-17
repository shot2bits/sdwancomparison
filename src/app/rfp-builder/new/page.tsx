import type { Metadata } from "next";
import Link from "next/link";
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
    "Compare SASE and SD-WAN across 30+ vendors and service providers. One two-minute brief and your five best-matched suppliers respond with structured answers and private pricing.",
  alternates: { canonical: `${SITE_URL}/rfp-builder/new/` },
  openGraph: {
    title: "Start a SASE or SD-WAN Project: Two-Minute Brief",
    description:
      "Compare SASE and SD-WAN across 30+ vendors and service providers. One two-minute brief and your five best-matched suppliers respond with structured answers and private pricing.",
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
      {/* Mockup B hero (Robert's pick, 17 July 2026): floating cream offer
          card over an illustrated amber scene, footnoted claim, promise
          sticker, jump-to strip. Sentence case throughout, site font
          untouched, all server-rendered so the offer is in the HTML for
          crawlers and agents. */}
      <div className="relative mb-6 overflow-hidden rounded-md border border-amber-200 bg-amber-50">
        <svg viewBox="0 0 640 190" preserveAspectRatio="xMaxYMax slice" aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-32 w-full sm:h-40">
          <path d="M0 152 L640 152 L640 190 L0 190 Z" fill="#e7e5e4" />
          <circle cx="376" cy="122" r="7" fill="#13294b" />
          <circle cx="470" cy="96" r="7" fill="#13294b" />
          <circle cx="562" cy="118" r="7" fill="#13294b" />
          <path d="M383 118 Q425 74 463 93" stroke="#f59e0b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M477 94 Q520 78 556 113" stroke="#f59e0b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <rect x="356" y="132" width="40" height="10" rx="5" fill="#fde68a" />
          <rect x="450" y="106" width="40" height="36" rx="8" fill="#ffffff" stroke="#e5e2da" />
          <rect x="457" y="114" width="26" height="5" rx="2.5" fill="#e7e5e4" />
          <rect x="457" y="124" width="18" height="5" rx="2.5" fill="#10b981" />
          <rect x="542" y="128" width="40" height="14" rx="7" fill="#fde68a" />
          <circle cx="330" cy="48" r="20" fill="#ffffff" /><circle cx="352" cy="42" r="15" fill="#ffffff" /><circle cx="312" cy="54" r="13" fill="#ffffff" />
        </svg>
        <div aria-hidden="true" className="absolute right-4 top-4 z-20 hidden max-w-[200px] rotate-6 rounded-xl border-[3px] border-zinc-900 bg-amber-400 px-4 py-2.5 text-center text-[13px] font-extrabold leading-snug sm:block">
          No sales calls until you reply
        </div>
        <div className="relative z-10 p-6 sm:p-10">
          <div className="max-w-md rounded-2xl border border-[#f3e8d8] bg-[#fffbf5] p-6 sm:p-7">
            <p className="eyebrow mb-2">Start your project</p>
            <h1 id="page-h1" className="mb-3 text-[26px] font-extrabold leading-[1.1] tracking-tight text-[#13294b] sm:text-[30px]">
              Compare SASE &amp; SD-WAN across 30+ vendors and service providers
            </h1>
            <p id="page-subhead" className="mb-5 text-[15px] text-[var(--ink-700)]">
              One two-minute brief and your five best-matched suppliers respond with structured
              answers and <strong>private pricing</strong>, side by side.<sup>1</sup>
            </p>
            <a href="#describe-wizard" className="inline-flex items-center rounded-lg bg-[#13294b] px-7 py-3 text-[15px] font-semibold text-white no-underline transition-colors hover:bg-[#1e3a5f]">
              Start my brief
            </a>
            <p className="mt-4 flex items-start gap-1.5 text-[12.5px] text-[var(--ink-700)]">
              <span aria-hidden="true" className="font-bold text-emerald-600">✓</span>
              <span><strong>Scored across 40 evidence-graded capabilities</strong> · Methodology v2026.1 · £0 for buyers</span>
            </p>
            <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] text-[var(--ink-700)] sm:hidden">
              <span aria-hidden="true" className="font-bold text-emerald-600">✓</span>
              <span>No sales calls until you reply</span>
            </p>
          </div>
          <p className="mt-4 max-w-2xl text-[11px] text-[var(--ink-600,#555)]">
            1. Up to five matched suppliers per submission, with more available after submitting.
            Free for buyers with no obligation to award. Netify marketplace dataset, July 2026.
            Vendors cannot pay to influence scores or matching.
          </p>
        </div>
      </div>

      <div className="mb-10 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-[var(--ink-200,#e5e5e5)] bg-white px-5 py-3 text-[13px]">
        <span className="font-bold text-[#13294b]">Jump to...</span>
        <a className="underline" href="https://netify.co.uk/insights/sase-cost-tco-global-enterprise/">How much does SASE and SD-WAN cost?</a>
        <Link className="underline" href="/how-it-works/">How do supplier responses work?</Link>
        <Link className="underline" href="/rfp-builder/sample-rfp/">What does the RFP include?</Link>
      </div>

      <div id="describe-wizard" className="scroll-mt-6">
        <DescribeWizard />
      </div>

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
