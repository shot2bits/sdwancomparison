import ProjectDesk from "@/components/ProjectDesk";
import JourneyStrip from "@/components/JourneyStrip";
import CapabilityBlock from "@/components/CapabilityBlock";
import CollapsibleHero from "@/components/CollapsibleHero";
import EmptyDocumentFrame from "@/components/procurement/EmptyDocumentFrame";
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

export const ENGINE_H1 = "Build a SASE or SD-WAN RFP, RFI and vendor shortlist";
export const ENGINE_PROMISE =
  "Describe your sector and requirements in your own words. Netify builds the RFP or RFI, identifies suitable vendors and service providers, and prepares an anonymous Opportunity Board listing so you can receive bids.";
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
        <CollapsibleHero h1={ENGINE_H1} promise={ENGINE_PROMISE} value={ENGINE_VALUE} eyebrow={ENGINE_EYEBROW} />

        {/* State 0 correction (18 Aug 2026): "a blank project must still
            show a compelling empty living document -- not a huge
            marketing landing page." The ghosted document frame renders
            FIRST, immediately below the prompt, so it is the dominant
            thing a buyer sees before typing; the journey strip and the
            collapsed capability FAQ (real, deliberate SEO content --
            native <details>, collapsed by default, not a rendered wall
            of text) follow beneath it rather than being the first thing
            in view. */}
        <ProjectDesk afterPrompt={<><EmptyDocumentFrame /><JourneyStrip /><CapabilityBlock /></>} />
      </div>
    </div>
  );
}
