import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema, getSpeakableSchema } from "@/lib/structured-data";
import { featureList } from "@/lib/capabilities";
import HowItWorksDiagram from "@/components/HowItWorksDiagram";

export const metadata: Metadata = {
  title: "How the Netify SASE & SD-WAN marketplace works",
  description: "Four ways to buy SASE, SSE and SD-WAN: compare a shortlist, run a reverse auction, open a live quote room, or build a structured RFP. Vendor-neutral and open.",
  alternates: { canonical: `${SITE_URL}/how-it-works/` },
  openGraph: { title: "How the Netify marketplace works", description: "Research, reverse auction, live quote room or structured RFP. Vendor-neutral and open to browse.", url: `${SITE_URL}/how-it-works`, type: "website", locale: "en_GB" },
};

const PATHS = [
  {
    name: "Research a shortlist",
    when: "I want to understand the market first.",
    get: "A ranked, filtered shortlist of 30+ vendors graded across 40 features. No sign-in.",
    href: "/shortlist",
    cta: "Build a shortlist",
  },
  {
    name: "Run a reverse auction",
    when: "I know what I need and want competitive prices.",
    get: "Post once; verified vendors compete on price. Run it open-ended or to a deadline, open to all matching vendors or invite-only.",
    href: "/opportunities",
    cta: "Post an auction",
  },
  {
    name: "Open a live quote room",
    when: "I want a fast conversation and indicative quotes.",
    get: "Post a need and watch suppliers reply live with comments and indicative pricing.",
    href: "/opportunities",
    cta: "Open a quote room",
  },
  {
    name: "Run a structured RFP",
    when: "I am running a formal, multi-criteria procurement.",
    get: "An AI agent drafts methodology-backed questions, maps compliance, and manages responses and evaluation.",
    href: "/rfp-builder",
    cta: "Start an RFP",
  },
];

const BUYER_FLOW = [
  { step: "1", title: "Describe your need", body: "From underlay circuits to appliances, cloud security or a full managed SASE rollout. Plain language, or use the AI advisor." },
  { step: "2", title: "Choose how vendors respond", body: "A shortlist for research, a reverse auction for price, a live quote room for speed, or a structured RFP for rigour." },
  { step: "3", title: "Vendors bid and respond", body: "Verified vendors quote, comment and answer. Bid amounts stay private to you; the need itself is public." },
  { step: "4", title: "Compare and award", body: "Compare responses against Netify's independent grades and your criteria, then award." },
];

const SUPPLIER_FLOW = [
  { step: "1", title: "Browse the open board", body: "See open opportunities at /opportunities/board with scope, region and format. No sign-in to look." },
  { step: "2", title: "Sign in, domain-verified", body: "A magic link verifies your work email against your organisation. Business email only." },
  { step: "3", title: "Bid or quote", body: "Submit a competitive bid or an indicative quote, comment, request to engage, or decline." },
  { step: "4", title: "Win the work", body: "The buyer compares and awards. Your AI agent can also read the board and quote over MCP." },
];

const FEATURES = [
  ["AI advisor", "Describe a need in plain language; the agent shortlists vendors and drafts RFP questions."],
  ["Methodology v2026.1", "40 features across 6 categories, with sector and compliance maps, served openly at /methodology.json."],
  ["Compliance mapping", "DORA, NIS2, UK GDPR, PCI DSS, IEC 62443, ISO 27001 and the UK Cyber Resilience Bill mapped to questions."],
  ["Independent grades", "30+ vendors graded by Netify, used to cross-check supplier claims against the evidence."],
  ["Agent-ready (MCP)", "AI agents read the board, vendor grades and RFPs, and bid, over a public MCP endpoint."],
  ["Open and ungated", "Browsing, research, building and the machine twins need no login. Only submitting a bid needs a verified sign-in."],
];

const FAQS = [
  ["Why not just cold-call vendors?", "One posting reaches every matching verified vendor at once and brings comparable responses back to you, instead of repeating the same conversation many times."],
  ["Why not just prompt a generic AI to write an RFP?", "A generic prompt cannot see Netify's independent vendor grades, the 386-question analyst bank, the compliance maps, or run a live competitive process with real suppliers. This does."],
  ["Do I have to sign in?", "Not to explore. Researching, building an RFP, drafting and previewing a project notice, and reading the board are all open. Signing in is needed to publish a notice, download the final RFP, or respond as a supplier — your draft is carried through sign-in, nothing is lost."],
  ["Is pricing public?", "No. The need is public so vendors can find it, but bid and quote amounts are private to the buyer who posted."],
];

// A plain-English walk-through of what actually happens, told through one
// concrete buyer, so the page explains the experience rather than just listing
// what the tool can do.
const STORY_INTRO =
  "Here is the honest version. Buying SASE or SD-WAN usually means chasing five vendors, sitting through five pitches, and trying to line up five sets of answers that never quite match. Netify turns that around. You describe your network once, in plain English, and the providers who want your business come back to you with answers you can actually put side by side.";

const STORY_STEPS = [
  { step: "1", title: "Describe it once", body: "Say you run IT for a 40-site retailer, you are moving off MPLS, you need PCI DSS, and you would rather it was fully managed. Type that one sentence, or tick a few boxes. That is the whole brief, and you only give it once." },
  { step: "2", title: "Pick how you want to hear back", body: "Just researching? Get a graded shortlist in seconds. Want prices? Run a reverse auction. In a hurry? Open a live quote room and watch replies come in. Running a formal process? Let the AI agent build you a full RFP. Same brief, four different doors, and you can use more than one." },
  { step: "3", title: "The vendors come to you", body: "Verified providers see your need and respond, with a quote, an answer to your questions, or a request for a demo. You are not on the phone repeating yourself five times; everything lands in one place where you can keep track of it." },
  { step: "4", title: "Compare like for like, then award", body: "Every vendor is graded independently by Netify against the same 40-feature framework. So when a supplier claims something, you can see whether the public evidence backs it up. You compare on substance rather than sales decks, then award the work." },
];

const STORY_OUTRO =
  "Nothing is hidden behind a login. You can browse all 30+ vendors, build a shortlist, and even draft an RFP without an account. Vendors sign in only to bid, and only with a verified work email, so the responses you get come from real organisations. Your requirements are visible so the right vendors can find them; the prices they quote stay private to you.";

// Writer-authored explainers (Harry, June 2026 rewrite): how the research,
// vetting and agent layers actually work. Applied 16 July 2026.
const UNDER_THE_BONNET = [
  {
    title: "How the scoring works",
    body: "Here at Netify we score every vendor against the same feature matrix, grouped across six capability categories (service delivery and operating model, network architecture and transport, gateway and PoP design, security and SASE capability, operations and assurance, and automation), with each feature scored against publicly available sources. We do not allow vendors to pay to influence scores or where they land. The raw scores drive our shortlist rankings and they're the same data the Netify RFP agent uses. The grades are indicative rather than contractual (the likes of deployment ceiling, regional coverage and AI capability can all change between research cycles), so we'd always recommend confirming specifics via a structured RFP, something our platform can generate and issue on your behalf.",
  },
  {
    title: "How vendor verification works",
    body: "Vendors can browse the opportunity board without signing in, the same as buyers. To actually submit a bid or quote, suppliers sign in with a verified work email, and our experts manually process and vet each one against real-world experience before access is granted.",
  },
  {
    title: "How the AI advisor and RFP agent work",
    body: "The AI advisor on the shortlist page maps plain-language descriptions onto the same filter and scoring engine used by the manual controls, with access to the Netify vendor grades, our bank of 386 questions and compliance maps. So when it sets filters or drafts RFP questions, it's drawing on the same research that underpins the rankings.",
  },
  {
    title: "Agent-to-agent (MCP)",
    body: "The opportunity board publishes a machine-readable feed at /opportunities/board/data.json. Vendors' AI agents can read open opportunities using the list_opportunities tool and submit bids via opportunity_respond, all over the public MCP endpoint at /api/mcp. This isn't a bolt-on: it's the same interface the Netify advisor uses internally, so the board is genuinely open to both human and agent access without any separate integration work.",
  },
];

export default function HowItWorksPage() {
  const schemas = [
    getOrganizationSchema(),
    getBreadcrumbSchema("How it works", "/how-it-works"),
    getSpeakableSchema("/how-it-works"),
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "How to buy SASE, SSE or SD-WAN on the Netify marketplace",
      step: BUYER_FLOW.map((s) => ({ "@type": "HowToStep", position: Number(s.step), name: s.title, text: s.body })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#marketplace-app`,
      name: "Netify SASE and SD-WAN marketplace",
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
      featureList: featureList(),
      potentialAction: { "@type": "SearchAction", target: `${SITE_URL}/capabilities.json`, description: "Machine-readable capability catalogue for agents." },
    },
  ];

  const card = "rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5";

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {schemas.map((s, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />)}

      <div className="mb-12 max-w-3xl">
        <p className="eyebrow mb-3">How it works</p>
        <h1 id="page-h1" className="mb-4">From a network need to competing offers, without the cold-calling.</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">Netify is a vendor-neutral marketplace for SASE, SSE and SD-WAN. Describe what you need and get comparable, competing responses from more than 30 verified providers, graded independently against 40 of the most important capabilities. Browse and build without an account; sign in only to bid.</p>
      </div>

      <HowItWorksDiagram />

      <section className="mb-14 max-w-3xl">
        <h2 className="text-2xl font-semibold mb-4">What actually happens</h2>
        <p className="text-[var(--ink-700)] mb-6">{STORY_INTRO}</p>
        <ol className="space-y-4 mb-6">
          {STORY_STEPS.map((s) => (
            <li key={s.step} className="flex gap-4">
              <span className="flex-none w-8 h-8 rounded-full bg-amber-500 text-zinc-950 font-semibold flex items-center justify-center">{s.step}</span>
              <div><p className="font-medium">{s.title}</p><p className="text-sm text-[var(--ink-700)]">{s.body}</p></div>
            </li>
          ))}
        </ol>
        <p className="text-[var(--ink-700)]">{STORY_OUTRO}</p>
      </section>

      <section className="mb-14">
        <h2 className="text-2xl font-semibold mb-1">Four ways to use it</h2>
        <p className="text-[var(--ink-600)] mb-5">Pick the path that matches where you are. You can combine them: research first, then run an auction or an RFP.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {PATHS.map((p) => (
            <div key={p.name} className={card}>
              <h3 className="text-lg font-semibold mb-1">{p.name}</h3>
              <p className="text-sm text-[var(--ink-500)] mb-2 italic">{p.when}</p>
              <p className="text-sm text-[var(--ink-700)] mb-4">{p.get}</p>
              <Link href={p.href} className="inline-flex items-center rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400">{p.cta}</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-14 grid lg:grid-cols-2 gap-10">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Buyer flow</h2>
          <ol className="space-y-4">
            {BUYER_FLOW.map((s) => (
              <li key={s.step} className="flex gap-4">
                <span className="flex-none w-8 h-8 rounded-full bg-amber-500 text-zinc-950 font-semibold flex items-center justify-center">{s.step}</span>
                <div><p className="font-medium">{s.title}</p><p className="text-sm text-[var(--ink-700)]">{s.body}</p></div>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h2 className="text-2xl font-semibold mb-4">Supplier flow</h2>
          <ol className="space-y-4">
            {SUPPLIER_FLOW.map((s) => (
              <li key={s.step} className="flex gap-4">
                <span className="flex-none w-8 h-8 rounded-full border border-[var(--ink-900)] font-semibold flex items-center justify-center">{s.step}</span>
                <div><p className="font-medium">{s.title}</p><p className="text-sm text-[var(--ink-700)]">{s.body}</p></div>
              </li>
            ))}
          </ol>
          <Link href="/for-suppliers" className="mt-5 inline-flex items-center rounded-full border border-[var(--ink-300,#ccc)] px-4 py-1.5 text-sm no-underline text-[var(--ink-800)] hover:bg-[var(--ink-100,#f5f5f5)]">For vendors and providers</Link>
        </div>
      </section>

      <section className="mb-14 max-w-3xl">
        <h2 className="text-2xl font-semibold mb-5">How the research behind it works</h2>
        <div className="space-y-6">
          {UNDER_THE_BONNET.map((s) => (
            <div key={s.title}>
              <h3 className="text-lg font-semibold mb-1">{s.title}</h3>
              <p className="text-sm text-[var(--ink-700)]">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-14">
        <h2 className="text-2xl font-semibold mb-5">What the marketplace provides</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([t, b]) => (
            <div key={t} className={card}><h3 className="font-semibold mb-1">{t}</h3><p className="text-sm text-[var(--ink-700)]">{b}</p></div>
          ))}
        </div>
      </section>

      <section className="mb-14 max-w-3xl">
        <h2 className="text-2xl font-semibold mb-5">Questions</h2>
        <div className="space-y-5">
          {FAQS.map(([q, a]) => (
            <div key={q}><p className="font-medium mb-1">{q}</p><p className="text-sm text-[var(--ink-700)]">{a}</p></div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/shortlist" className="inline-flex items-center rounded-full bg-amber-500 px-5 py-2 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400">Build a shortlist</Link>
        <Link href="/opportunities" className="inline-flex items-center rounded-full border border-[var(--ink-300,#ccc)] px-5 py-2 text-sm no-underline text-[var(--ink-800)] hover:bg-[var(--ink-100,#f5f5f5)]">Post an opportunity</Link>
        <Link href="/rfp-builder" className="inline-flex items-center rounded-full border border-[var(--ink-300,#ccc)] px-5 py-2 text-sm no-underline text-[var(--ink-800)] hover:bg-[var(--ink-100,#f5f5f5)]">Start an RFP</Link>
      </div>
    </div>
  );
}
