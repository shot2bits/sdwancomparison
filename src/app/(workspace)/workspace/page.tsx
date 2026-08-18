import type { Metadata } from "next";
import ProcurementEntry, {
  ENGINE_PROMISE,
  ENGINE_DESCRIPTION,
} from "@/components/procurement/ProcurementEntry";
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
 * the input: no card, no second heading, geography stays retired.
 *
 * UPDATE (2030 canonical product entry extraction, 18 Aug 2026): the
 * ENGINE_* copy constants and the hero+desk composition itself moved to
 * src/components/procurement/ProcurementEntry.tsx, with (workspace)/home/
 * page.tsx as the authoritative caller (Robert: "the homepage is
 * authoritative"). This route imports and renders the exact same
 * component rather than keeping its own "verbatim-identical" copy, so
 * the two routes cannot silently drift apart on the product surface.
 * Only the SEO layer below (metadata, canonical URL, structured-data
 * schemas — including the breadcrumb this route legitimately carries as
 * a named, navigable path rather than the apex) stays route-specific.
 */

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

     UPDATE (2030 living-procurement workspace separation, 18 Aug 2026):
     this route now lives in the (workspace) route group, whose own
     layout — src/app/(workspace)/layout.tsx — renders WorkspaceHeader
     above and CommercialFooter below every workspace page, so the trust
     footer described above stays reachable without this page rendering
     any chrome itself. It is deliberately WorkspaceHeader, not MegaNav:
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
