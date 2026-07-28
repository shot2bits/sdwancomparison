import type { Metadata } from "next";
import ProjectDesk from "@/components/ProjectDesk";
import JourneyStrip from "@/components/JourneyStrip";
import MegaNav from "@/components/MegaNav";
import { getOrganizationSchema } from "@/lib/structured-data";

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
 * Copy below is Robert's ruled wording (his ruling message, 28 Jul:
 * category H1 approved; promise merged from his two versions with the
 * assistant named; geography line his exact words). The input caption,
 * placeholder and button keep their earlier rulings unchanged.
 */

const APEX = "https://netify.co.uk";

/** The category line (Robert's ruling, 28 Jul 2026: "Approve the
 *  category direction"; his correction the same evening: no full stop
 *  on the title). Twin of src/app/workspace/page.tsx. */
const ENGINE_H1 = "The global SASE and SD-WAN sourcing engine";
/** The promise (his two ruled versions merged, the assistant named). */
const ENGINE_PROMISE =
  "Describe your requirement in your own words. Netify's specialist sourcing assistant structures it, identifies what's missing, evaluates fit across the SASE and SD-WAN market, and prepares an anonymous opportunity for suitable suppliers to respond to.";
/** The value section (his ruled paragraph from the re-issued challenge,
 *  placed by his correction: after the promise, before the input). */
const ENGINE_VALUE_H2 = "Purpose-built for UK and North American enterprise and mid-market global SASE & SD-WAN sourcing";
const ENGINE_VALUE =
  "Netify combines specialist AI with continuously updated supplier intelligence, years of networking and procurement expertise, and real sourcing data from healthcare, manufacturing, retail, financial services and other sectors. Connected to more than 30 global vendors and managed service providers, every sourcing project benefits from knowledge that evolves with the market.";
/** The two-buyer line and the control line (ruled v2 door). Geography
 *  retired as a separate line (Robert, 29 Jul: one message); it lives in
 *  the value card's title. */
const ENGINE_AGENT =
  "Use Netify directly, or connect your organisation's approved AI agent through MCP. Agents research, draft, compare and monitor. Your team publishes, selects and awards.";
const ENGINE_CONTROL =
  "Free for buyers. Anonymous until you choose. Pricing private to you. Nothing publishes without your signature. A Netify analyst reviews every published RFP.";
const ENGINE_DESCRIPTION = `${ENGINE_H1}. ${ENGINE_PROMISE} ${ENGINE_VALUE_H2}. ${ENGINE_VALUE} ${ENGINE_AGENT} ${ENGINE_CONTROL}`;

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
      description: `${ENGINE_DESCRIPTION} Provenance on every claim, evidence-graded supplier fit, and one human signature publishes the anonymous notice. Fully agent-accessible via MCP and llms.txt.`,
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
      {/* One header everywhere (Robert, 24 Jul): the mega navigation IS
          "the homepage must never hide the company", done properly. */}
      <MegaNav takeover />
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-12">

        <h1
          id="page-h1"
          className="mx-auto m-0 max-w-3xl text-center tracking-tight"
          style={{ fontSize: "27px", lineHeight: 1.25, fontWeight: 650, letterSpacing: "-0.015em", color: "#18181b" }}
        >
          {ENGINE_H1}
        </h1>
        <p id="page-subhead" className="mx-auto m-0 mt-3 max-w-3xl text-center text-[14.5px] leading-relaxed text-zinc-600">
          {ENGINE_PROMISE}
        </p>
        {/* The value section (Robert's correction, 28 Jul eve; styled as a
            trust statement on his late-night ruling, relayed 28 Jul: a
            bordered statement card, not another paragraph): part of the
            title and trust proposition, after the promise, before the
            input, never below the journey strip. His words. */}
        <section aria-labelledby="enterprise-sourcing-value" className="mx-auto mt-5 max-w-3xl">
          {/* One header section on this page (Robert, 29 Jul): the card's
              heading is a quiet uppercase eyebrow, inline-styled like the
              H1 above so global heading styles can never inflate it; the
              h2 element stays for the machine layer. */}
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-4 text-center">
            <h2
              id="enterprise-sourcing-value"
              className="m-0 uppercase"
              style={{ fontSize: "11.5px", fontWeight: 600, letterSpacing: "0.08em", color: "#71717a" }}
            >
              {ENGINE_VALUE_H2}
            </h2>
            <p className="m-0 mt-2" style={{ fontSize: "13.5px", lineHeight: 1.6, color: "#52525b" }}>
              {ENGINE_VALUE}
            </p>
          </div>
        </section>

        <ProjectDesk afterPrompt={<JourneyStrip />} />
      </main>
    </div>
  );
}
