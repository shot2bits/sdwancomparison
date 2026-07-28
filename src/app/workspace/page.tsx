import type { Metadata } from "next";
import ProjectDesk from "@/components/ProjectDesk";
import JourneyStrip from "@/components/JourneyStrip";
import MegaNav from "@/components/MegaNav";
import { SITE_URL, getBreadcrumbSchema, getOrganizationSchema, getSpeakableSchema } from "@/lib/structured-data";

/**
 * /workspace/ (public path /sase/workspace/): the door of the sourcing
 * engine, twin of src/app/home/page.tsx (the apex serves that file; this
 * route 308s to the apex publicly and exists for internal continuity).
 *
 * THE RECUT (Robert's build ruling, 28 Jul 2026): category line,
 * promise, input, journey strip, live proof, control lines, nothing
 * else on first paint. ONE HIERARCHY (Robert, 29 Jul, exact-copy
 * prompt): one H1, one supporting paragraph, one trust paragraph, then
 * the input — no card, no second heading, geography stays retired.
 * Copy is his exact wording; the constants are kept verbatim-identical
 * with the home twin.
 */

/** The category line (Robert's ruling, 28 Jul 2026; his correction the
 *  same evening: no full stop on the title). Twin of
 *  src/app/home/page.tsx, kept verbatim-identical. */
const ENGINE_H1 = "The global SASE and SD-WAN sourcing engine";
const ENGINE_PROMISE =
  "Describe your requirement in your own words. Netify structures it, identifies what’s missing, evaluates suitable suppliers and prepares an anonymous opportunity for the market.";
/** The trust paragraph (his exact copy, 29 Jul): plain centred text,
 *  never a card or border, never uppercase, no heading of its own. */
const ENGINE_VALUE =
  "Connected to 30+ leading vendors and managed service providers, Netify combines specialist AI with continuously updated supplier intelligence and years of networking and procurement expertise across healthcare, manufacturing, retail, financial services and other sectors.";
/** Geography retired as a separate line (Robert, 29 Jul: one message);
 *  it lives in the value card's title. Twin of home. */
const ENGINE_AGENT =
  "Use Netify directly, or connect your organisation's approved AI agent through MCP. Agents research, draft, compare and monitor. Your team publishes, selects and awards.";
const ENGINE_CONTROL =
  "Free for buyers. Anonymous until you choose. Pricing private to you. Nothing publishes without your signature. A Netify analyst reviews every published RFP.";
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
    description: `${ENGINE_DESCRIPTION} Provenance on every claim, rulebook-assessed scope and evidence-graded supplier fit. One signature publishes an anonymous notice to the open board and the full brief to matched signed-in suppliers.`,
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
        name: "Identify suitable suppliers",
        text: "Evaluated fit across 30 SASE and SD-WAN suppliers reorders around your stated requirement, with the reasons stated and every grade dated.",
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
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-[#fbfaf8]">
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}
      <MegaNav takeover />
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-6 sm:px-6">

        {/* One visual hierarchy (Robert, 29 Jul, exact-copy prompt): H1,
            supporting paragraph, trust paragraph, input — nothing else.
            Twin of home, same fluid clamps; gap before the input is
            trust mb 12px + ProjectDesk's mt-10 = 52px. */}
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

        <ProjectDesk afterPrompt={<JourneyStrip />} />
      </main>
    </div>
  );
}
