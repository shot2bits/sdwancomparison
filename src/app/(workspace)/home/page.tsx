import type { Metadata } from "next";
import ProcurementEntry, {
  ENGINE_PROMISE,
  ENGINE_DESCRIPTION,
} from "@/components/procurement/ProcurementEntry";
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
 * ONE HIERARCHY (Robert, 29 Jul, exact-copy prompt): one H1, one
 * supporting paragraph, one trust paragraph, then the input. No second
 * heading, no card, no panel, no divider between the H1 and the input;
 * the value card and its title are retired; the geography line stays
 * retired. Copy below is his exact 29 Jul wording; sizes are fluid
 * clamps inside his ruled desktop/tablet/mobile ranges. The input
 * caption, placeholder and button keep their earlier rulings unchanged.
 *
 * UPDATE (2030 canonical product entry extraction, 18 Aug 2026): the
 * ENGINE_* copy constants and the hero+desk composition itself now live
 * in src/components/procurement/ProcurementEntry.tsx — this route is
 * authoritative for that shared component (per Robert's "the homepage is
 * authoritative" instruction) but no longer holds its own copy of the
 * constants or JSX, so this page and (workspace)/workspace/page.tsx
 * literally cannot drift apart on the product surface itself. Only the
 * route-specific SEO layer (metadata, canonical URL, structured-data
 * schemas) stays local to each page.
 */

const APEX = "https://netify.co.uk";

export const metadata: Metadata = {
  title: "SASE & SD-WAN RFP/RFI Builder and Vendor Shortlist",
  description: ENGINE_DESCRIPTION,
  alternates: { canonical: `${APEX}/` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Netify | SASE & SD-WAN RFP/RFI Builder",
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

     UPDATE (2030 living-procurement workspace separation, 18 Aug 2026):
     this route now lives in the (workspace) route group, whose own
     layout — src/app/(workspace)/layout.tsx — renders MegaNav
     above and CommercialFooter below every workspace page, so the trust
     footer described above stays reachable without this page rendering
     any chrome itself. Chrome parity restored 19 Aug 2026 (Robert: "Add back the main
     menu as well") — this group now carries the SAME MegaNav and
     commercial footer as (marketing), superseding the 18 Aug split:
     the approved 2030 closure package's rule 14 keeps marketing chrome
     out of the workspace, so this route no longer inherits MegaNav at
     all (that moved to (marketing)/layout.tsx for every non-workspace
     route). This page still renders no navigation of its own — only the
     owning layout changed. */
  return (
    <>
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}
      <ProcurementEntry />
    </>
  );
}
