import PublicComparison from "@/components/procurement/PublicComparison";
import { Suspense } from "react";
import ProjectDesk from "@/components/ProjectDesk";
import JourneyStrip from "@/components/JourneyStrip";
import CapabilityBlock from "@/components/CapabilityBlock";
import CollapsibleHero from "@/components/CollapsibleHero";
import EmptyDocumentFrame from "@/components/procurement/EmptyDocumentFrame";
import JourneyModeSelector from "@/components/procurement/JourneyModeSelector";
import { getAllVendors } from "@/lib/vendors";

/**
 * The canonical product entry (2030 living-procurement workspace
 * separation, 18 Aug 2026): the ONE composition of the door — hero copy,
 * the living-document desk, the journey strip and capability block below
 * the prompt — shared by every route that serves the sourcing engine's
 * front door. Extracted per Robert's explicit instruction: "The homepage
 * is the product... /workspace is a supporting/resume route, not a
 * second independently designed product... Do not maintain two separate
 * implementations... extract or reuse one canonical product entry
 * component. The homepage is authoritative."
 *
 * Before this extraction, src/app/home/page.tsx and src/app/workspace/
 * page.tsx each carried their own copy of these constants and this JSX,
 * kept in sync only by doc-comment discipline ("Twin of home, kept
 * verbatim-identical") — a real duplication risk, not just a style
 * preference. This file is now the single source; (workspace)/home/
 * page.tsx and (workspace)/workspace/page.tsx both render it unmodified
 * and differ only in what's legitimately route-specific: metadata,
 * canonical URLs and structured-data schemas (home carries the WebSite +
 * Speakable schema as the canonical apex; workspace additionally carries
 * a breadcrumb, since it is a named, navigable route rather than the
 * root). None of that SEO-layer variation touches the rendered product
 * surface itself, which is exactly what must not diverge.
 *
 * Copy below is Robert's exact ruled wording (26 Jul category line, 29
 * Jul one-hierarchy prompt, 10 Aug trust-paragraph extension/tightening).
 * See git history on the pre-extraction home/page.tsx and workspace/
 * page.tsx for the full per-line ruling provenance.
 */

/* H1 (Robert, 3 Sep 2026, "sd-wan rfp" / "sase rfp" citation work): the
 * two head terms and the outcome, in the order buyers search. Replaces
 * "Build or validate a procurement-ready SASE or SD-WAN RFP", whose exact
 * phrase "SASE RFP" never appeared in the served HTML. */
export const ENGINE_H1 = "Find SASE and SD-WAN providers for your project";
/* The two definitions shown above the application (Robert, 3 Sep 2026).
 * They exist so an answer engine can read what an SD-WAN RFP and a SASE
 * RFP are from THIS page rather than from a redirected legacy URL: the
 * AI Overview sentence Google was quoting lived only in the old
 * /sase-rfp-builder-app/ copy. Keep them short, factual and separable. */
export const RFP_DEFINITIONS: { term: string; article: string; text: string }[] = [
  {
    term: "SD-WAN RFP",
    article: "an",
    text: "An SD-WAN RFP is a request for proposal that sets out an organisation's sites, underlay circuits, application performance targets, failover, security integration and managed service needs so that SD-WAN vendors and service providers can respond with comparable, priced bids.",
  },
  {
    term: "SASE RFP",
    article: "a",
    text: "A SASE RFP is a request for proposal for converged networking and security delivered from the cloud: SD-WAN plus ZTNA, SWG, CASB, FWaaS and DLP, with identity, data residency, logging and operating model requirements stated so that SASE vendors can be evaluated on the same criteria.",
  },
];
/* One sentence on what Netify does with either document, for the intro. */
export const ENGINE_ROLE =
  "Netify builds the document from your answers, validates the requirements against a governed question bank, and compares supplier responses side by side after you publish anonymously.";
/* The meta description (Robert, 3 Sep 2026): one concise summary under
 * 160 characters carrying SD-WAN RFP, SASE RFP, supplier questions,
 * evaluation and anonymous publication. The former description was the
 * whole ENGINE_DESCRIPTION paragraph stack (984 characters). */
export const RFP_META_DESCRIPTION =
  "Build an SD-WAN RFP or SASE RFP with governed supplier questions, validate it, publish anonymously and run a like-for-like vendor evaluation. Free for buyers.";
export const ENGINE_PROMISE =
  "Compare providers, describe your requirements and publish a free, anonymous project. Unlock your personalised shortlist and invite supplier responses. A full RFP is optional.";
export const ENGINE_VALUE =
  `Connected to ${getAllVendors().length} leading vendors and managed service providers, Netify combines specialist AI with continuously updated market intelligence and years of networking and procurement expertise across healthcare, manufacturing, retail, financial services and other sectors. Get bids. Get pricing. Get vetted responses. Send messages. Request demos. No salesperson involved.`;
export const ENGINE_AGENT =
  "Use Netify directly, or connect your organisation's approved AI agent through MCP. Agents research, draft, compare and monitor. Your team publishes, selects and awards.";
export const ENGINE_CONTROL =
  "Free for buyers. Anonymous until you choose. Pricing private to you. Nothing publishes without your signature. Only vetted vendors and service providers can respond.";
export const ENGINE_DESCRIPTION = `${ENGINE_H1}. ${ENGINE_PROMISE} ${ENGINE_VALUE} ${ENGINE_AGENT} ${ENGINE_CONTROL}`;

// State-0 height correction (18 Aug 2026 Constitution): a short, real
// eyebrow line above the H1, in the mockup's own register ("FROM ONE
// SENTENCE TO A MARKET-READY PROCUREMENT ASSET") -- describes what the
// product actually does (one input -> a structured, evaluated, market-
// ready procurement asset), not invented marketing filler.
export const ENGINE_EYEBROW = "SASE and SD-WAN procurement, from requirement to bids";

export default function ProcurementEntry() {
  return (
    // .procurement-2030 activates the scoped 2030 design tokens (see
    // globals.css) for everything inside this component and nothing
    // else on the site — CollapsibleHero and ProjectDesk are both
    // children, so both pick up the palette/typography-role variables.
    // 19 Aug 2026 aesthetic-only restyle (Robert's handoff bundle):
    // replaces the earlier dramatic warm-gradient canvas background
    // with the handoff doc's own flat treatment -- a solid warm
    // off-white plus a very subtle dot grid ("1. Colors" / "Background
    // texture"), via the .nf-canvas-texture class in globals.css. The
    // gradient "glow" this replaces was never part of that spec.
    <div className="procurement-2030 nf-canvas-texture relative">
      {/* Accessibility correction (18 Aug 2026, real bug found via an
          axe-core scan): this was a second `<main>` -- both routes that
          render this component ((workspace)/home/page.tsx and
          (workspace)/workspace/page.tsx) are already wrapped by
          (workspace)/layout.tsx's own `<main id="main-content">`, so this
          produced a real nested/duplicate main-landmark violation
          (landmark-no-duplicate-main, landmark-main-is-top-level). A
          plain `<div>` keeps every class/layout unchanged; the page's one
          true main landmark stays exactly where it already was. */}
      <div className="mx-auto max-w-none px-0 pb-0 pt-0">
        {/* One visual hierarchy (Robert, 29 Jul, exact-copy prompt): H1,
            supporting paragraph, trust paragraph, input: nothing else.
            All three blocks inline-styled inside CollapsibleHero so global
            styles can never win; sizes are fluid clamps inside his ruled
            ranges (H1 38-58px, supporting 20-26px, trust 16.5-20px); no
            uppercase, no letter spacing on paragraphs, no card, no second
            heading. The gap before the input is trust mb 12px +
            ProjectDesk's own mt-10 (40px) = 52px, inside his ruled
            44-56px range. */}
        <CollapsibleHero h1={ENGINE_H1} promise={ENGINE_PROMISE} value={ENGINE_VALUE} eyebrow={ENGINE_EYEBROW} definitions={RFP_DEFINITIONS} role={ENGINE_ROLE} />

        <Suspense fallback={<a href="/sase/shortlist/">Compare SD-WAN and SASE providers</a>}><PublicComparison /></Suspense>
        <JourneyModeSelector>

        {/* State 0 correction (18 Aug 2026): "a blank project must still
            show a compelling empty living document -- not a huge
            marketing landing page." The ghosted document frame renders
            FIRST, immediately below the prompt, so it is the dominant
            thing a buyer sees before typing; the journey strip and the
            collapsed capability FAQ (real, deliberate SEO content --
            native <details>, collapsed by default, not a rendered wall
            of text) follow beneath it rather than being the first thing
            in view. */}
        {/* NOTE (3 Sep 2026): ProjectDesk accepts `afterPrompt` for
            compatibility and does not render it, so nothing passed here
            reaches the page. The citable public content for the canonical
            builder page (RfpPublicContent, RfpCitationEvidence) is rendered
            by (workspace)/home/page.tsx directly, after this component. */}
        <ProjectDesk afterPrompt={<><EmptyDocumentFrame /><JourneyStrip /><CapabilityBlock /></>} />
        </JourneyModeSelector>
      </div>
    </div>
  );
}
