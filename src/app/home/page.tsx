import type { Metadata } from "next";
import ProjectDesk from "@/components/ProjectDesk";
import JourneyStrip from "@/components/JourneyStrip";
import CapabilityBlock from "@/components/CapabilityBlock";
import { getOrganizationSchema } from "@/lib/structured-data";
import { getAllVendors } from "@/lib/vendors";

/**
 * /home/ (public path /sase/home/, served at netify.co.uk/ by the apex
 * rewrite): the door of the sourcing engine.
 *
 * THE RECUT (Robert's build ruling, 28 Jul 2026, the sourcing engine
 * challenge): the engine is the category, the assistant is how a person
 * experiences it, the project is the durable object, the SoR, RFI and
 * RFP are outputs, publication is the commercial destination. The door
 * carries the category line, the promise, the input, the journey strip,
 * the live proof and the control lines, and nothing else: the spine,
 * the example desk and every grey section left the first paint. First
 * real input opens the working desk.
 *
 * ONE HIERARCHY (Robert, 29 Jul, exact-copy prompt): one H1, one
 * supporting paragraph, one trust paragraph, then the input. No second
 * heading, no card, no panel, no divider between the H1 and the input;
 * the value card and its title are retired; the geography line stays
 * retired. Copy below is his exact 29 Jul wording; sizes are fluid
 * clamps inside his ruled desktop/tablet/mobile ranges. The input
 * caption, placeholder and button keep their earlier rulings unchanged.
 */

const APEX = "https://netify.co.uk";

/** The category line (Robert's ruling, 28 Jul 2026: "Approve the
 *  category direction"; no full stop on the title, re-affirmed in his
 *  29 Jul one-hierarchy prompt). Twin of src/app/workspace/page.tsx. */
const ENGINE_H1 = "The global SASE and SD-WAN sourcing engine";
/** The supporting paragraph (his exact copy, 29 Jul). */
const ENGINE_PROMISE =
  "Describe your requirement in your own words. Netify structures it, identifies what’s missing, evaluates suitable vendors and service providers and prepares an anonymous opportunity for the market.";
/** The trust paragraph (his exact copy, 29 Jul): plain centred text,
 *  never a card or border, never uppercase, no heading of its own. */
const ENGINE_VALUE =
  `Connected to ${getAllVendors().length} leading vendors and managed service providers, Netify combines specialist AI with continuously updated market intelligence and years of networking and procurement expertise across healthcare, manufacturing, retail, financial services and other sectors.`;
/** The two-buyer line and the control line (ruled v2 door). Geography
 *  retired as a separate line (Robert, 29 Jul: one message); it lives in
 *  the value card's title. */
const ENGINE_AGENT =
  "Use Netify directly, or connect your organisation's approved AI agent through MCP. Agents research, draft, compare and monitor. Your team publishes, selects and awards.";
/** Last sentence changed 29 Jul 2026 (Robert's ruling with the mockup
 *  review): the analyst-review claim retired with the approval queue; the
 *  sentence that replaces it is ruled promise wording. Twin of workspace. */
const ENGINE_CONTROL =
  "Free for buyers. Anonymous until you choose. Pricing private to you. Nothing publishes without your signature. Only vetted vendors and service providers can respond.";
const ENGINE_DESCRIPTION = `${ENGINE_H1}. ${ENGINE_PROMISE} ${ENGINE_VALUE} ${ENGINE_AGENT} ${ENGINE_CONTROL}`;

export const metadata: Metadata = {
  title: "The global SASE and SD-WAN sourcing engine",
  description: ENGINE_DESCRIPTION,
  alternates: { canonical: `${APEX}/` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Netify | The global SASE and SD-WAN sourcing engine",
    description: ENGINE_DESCRIPTION,
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
      description: ENGINE_DESCRIPTION,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "@id": `${APEX}/#webapplication`,
      name: "Netify SASE & SD-WAN Sourcing Engine",
      url: `${APEX}/`,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: `${ENGINE_DESCRIPTION} Provenance on every claim, evidence-graded vendor fit, and one human signature publishes the anonymous notice. Fully agent-accessible via MCP and llms.txt.`,
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
    // The journey, machine-readable: the five ruled stations, so answer
    // engines answer "how do I publish a requirement" with the true
    // journey in the same words the page uses.
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      "@id": `${APEX}/#howto`,
      name: "Publish a SASE, security or SD-WAN requirement on Netify",
      description: ENGINE_PROMISE,
      step: [
        {
          "@type": "HowToStep",
          position: 1,
          name: "Describe your project",
          text: "Describe your requirement in your own words. One sentence is enough to start, and drafting needs no account.",
        },
        {
          "@type": "HowToStep",
          position: 2,
          name: "Develop the requirement",
          text: "The assistant structures your words into facts, named inferences and open questions, asked one at a time, with provenance on every claim.",
        },
        {
          "@type": "HowToStep",
          position: 3,
          name: "Identify suitable vendors and service providers",
          text: "Evaluated fit across 30 SASE and SD-WAN vendors and service providers reorders around your stated requirement, with the reasons stated and every grade dated.",
        },
        {
          "@type": "HowToStep",
          position: 4,
          name: "Publish anonymously",
          text: "Sign in to publish. Your notice lists anonymously on the opportunity board, your identity stays hidden until you choose to disclose it, and only your signature sends it.",
        },
        {
          "@type": "HowToStep",
          position: 5,
          name: "Compare responses",
          text: "Structured responses from vendors and managed service providers land side by side, with pricing private to you.",
        },
      ],
    },
  ];
}

export default function Page() {
  const schemas = getHomeSchemas();
  /* THE DOOR SITS IN NORMAL FLOW (Robert's ruling, 30 Jul 2026: "the
     footer is missing from the main front page, this will impact EEAT").
     It used to be `fixed inset-0 overflow-y-auto`, a full-viewport overlay
     with its own internal scroll. Nothing looked wrong, but a fixed
     element is out of flow, so the layout's <main> collapsed to zero
     height and the site footer rendered UNDERNEATH the overlay where no
     amount of scrolling could reach it. Measured live before the change:
     main 0px tall, footer starting at 149px with the hero and the FAQ
     drawn over it.

     That footer carries the whole experience, expertise, authoritativeness
     and trust surface: About, Our Team, Editorial Policy, Research
     Methodology, Corrections, How Netify makes money, the company number,
     the registered address and the trademark. On the one page most likely
     to be cited by an AI, none of it was reachable.

     This page renders no navigation of its own. The root layout's MegaNav
     serves every route, which is what keeps it to exactly one. Removing
     the overlay exposed a second sticky header here that the overlay had
     been covering. */
  return (
    <div className="relative bg-[#fbfaf8]">
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-6 sm:pt-12">

        {/* One visual hierarchy (Robert, 29 Jul, exact-copy prompt): H1,
            supporting paragraph, trust paragraph, input: nothing else.
            All three blocks inline-styled so global styles can never win;
            sizes are fluid clamps inside his ruled ranges (H1 38-58px,
            supporting 20-26px, trust 16.5-20px); no uppercase, no letter
            spacing on paragraphs, no card, no second heading. The gap
            before the input is trust mb 12px + ProjectDesk's own mt-10
            (40px) = 52px, inside his ruled 44-56px. */}
        <h1
          id="page-h1"
          className="mx-auto max-w-[1150px] text-center"
          style={{ fontSize: "clamp(38px, 2.5vw + 24px, 58px)", lineHeight: 1.1, fontWeight: 650, letterSpacing: "-0.015em", color: "#18181b", margin: "0 auto 32px" }}
        >
          {ENGINE_H1}
        </h1>
        <p
          id="page-subhead"
          className="mx-auto text-center"
          style={{ fontSize: "clamp(20px, 1vw + 16px, 26px)", lineHeight: 1.55, color: "#52525b", margin: "0 auto 22px" }}
        >
          {ENGINE_PROMISE}
        </p>
        <p
          className="mx-auto text-center"
          style={{ fontSize: "clamp(16.5px, 0.5vw + 14px, 20px)", lineHeight: 1.6, color: "#71717a", margin: "0 auto 12px" }}
        >
          {ENGINE_VALUE}
        </p>

        <ProjectDesk afterPrompt={<><JourneyStrip /><CapabilityBlock /></>} />
      </main>
    </div>
  );
}
