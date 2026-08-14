import type { Metadata } from "next";
import ProjectDesk from "@/components/ProjectDesk";
import JourneyStrip from "@/components/JourneyStrip";
import CapabilityBlock from "@/components/CapabilityBlock";
import CollapsibleHero from "@/components/CollapsibleHero";
import { SITE_URL, getBreadcrumbSchema, getOrganizationSchema, getSpeakableSchema } from "@/lib/structured-data";
import { getAllVendors } from "@/lib/vendors";

/**
 * /workspace/ (public path /sase/workspace/): the door of the sourcing
 * engine, twin of src/app/home/page.tsx (the apex serves that file; this
 * route 308s to the apex publicly and exists for internal continuity).
 *
 * THE RECUT (Robert's build ruling, 28 Jul 2026): category line,
 * promise, input, journey strip, live proof, control lines, nothing
 * else on first paint. ONE HIERARCHY (Robert, 29 Jul, exact-copy
 * prompt): one H1, one supporting paragraph, one trust paragraph, then
 * the input: no card, no second heading, geography stays retired.
 * Copy is his exact wording; the constants are kept verbatim-identical
 * with the home twin.
 */

/** The category line (Robert's ruling, 28 Jul 2026; his correction the
 *  same evening: no full stop on the title). Twin of
 *  src/app/home/page.tsx, kept verbatim-identical. */
const ENGINE_H1 = "The global SASE and SD-WAN sourcing engine";
const ENGINE_PROMISE =
  "Describe your requirement in your own words. Netify structures it, identifies what’s missing, evaluates suitable vendors and service providers and prepares an anonymous opportunity for the market.";
/** The trust paragraph (his exact copy, 29 Jul, extended 10 Aug 2026 with
 *  his sell-the-concept language, then tightened same day): plain centred
 *  text, never a card or border, never uppercase, no heading of its own.
 *  Kept verbatim-identical with the home twin; see that file's comment for
 *  the full 10 Aug context (graphic explored and set aside, language-only
 *  addition keeps ONE HIERARCHY intact). */
const ENGINE_VALUE =
  `Connected to ${getAllVendors().length} leading vendors and managed service providers, Netify combines specialist AI with continuously updated market intelligence and years of networking and procurement expertise across healthcare, manufacturing, retail, financial services and other sectors. Get bids. Get pricing. Get vetted responses. Send messages. Request demos. No salesperson involved.`;
/** Geography retired as a separate line (Robert, 29 Jul: one message);
 *  it lives in the value card's title. Twin of home. */
const ENGINE_AGENT =
  "Use Netify directly, or connect your organisation's approved AI agent through MCP. Agents research, draft, compare and monitor. Your team publishes, selects and awards.";
/** Last sentence changed 29 Jul 2026 (Robert's ruling with the mockup
 *  review): the analyst-review claim retired with the approval queue; the
 *  sentence that replaces it is ruled promise wording. Twin of home. */
const ENGINE_CONTROL =
  "Free for buyers. Anonymous until you choose. Pricing private to you. Nothing publishes without your signature. Only vetted vendors and service providers can respond.";
const ENGINE_DESCRIPTION = `${ENGINE_H1}. ${ENGINE_PROMISE} ${ENGINE_VALUE} ${ENGINE_AGENT} ${ENGINE_CONTROL}`;

export const metadata: Metadata = {
  title: "The global SASE and SD-WAN sourcing engine",
  description: ENGINE_DESCRIPTION,
  alternates: { canonical: "https://netify.co.uk/" },
  openGraph: {
    title: "Netify | The global SASE and SD-WAN sourcing engine",
    description: ENGINE_DESCRIPTION,
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
    name: "Netify SASE & SD-WAN Sourcing Engine",
    url: "https://netify.co.uk/",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: `${ENGINE_DESCRIPTION} Provenance on every claim, rulebook-assessed scope and evidence-graded vendor fit. One signature publishes an anonymous notice to the open board and the full brief to matched signed-in vendors and service providers.`,
    offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
    provider: { "@id": `${SITE_URL}/#organization` },
  };
}

/** The journey, machine-readable: the five ruled stations. Twin of the
 *  HowTo in src/app/home/page.tsx, kept verbatim-identical. */
function getWorkspaceHowToSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "@id": "https://netify.co.uk/#howto",
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
  };
}

export default function Page() {
  const schemas = [
    getWorkspaceWebApplicationSchema(),
    getWorkspaceHowToSchema(),
    getOrganizationSchema(),
    getBreadcrumbSchema("Start a project", "/workspace/"),
    getSpeakableSchema("/workspace/"),
  ];
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
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-6 sm:px-6">

        {/* One visual hierarchy (Robert, 29 Jul, exact-copy prompt): H1,
            supporting paragraph, trust paragraph, input: nothing else.
            Twin of home, same fluid clamps; gap before the input is
            trust mb 12px + ProjectDesk's mt-10 = 52px. */}
        <CollapsibleHero h1={ENGINE_H1} promise={ENGINE_PROMISE} value={ENGINE_VALUE} />

        <ProjectDesk afterPrompt={<><JourneyStrip /><CapabilityBlock /></>} />
      </main>
    </div>
  );
}
