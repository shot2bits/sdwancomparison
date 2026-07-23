/**
 * The Derived Experience Framework (DEF), wave one: the Continuation.
 *
 * Ratified 23 Jul 2026 (docs/netify-2030-entry-challenge-2026-07-23.html,
 * both verdicts): pages never decide, data derives, components render.
 * The contract is binary: a deriver returns a complete Continuation or
 * null, and null silences every lane at once (UI, assistant line,
 * CreateAction JSON-LD, machine twin). No booleans, no flags, no
 * exclusion lists. The return value is the law.
 */

/** Bumped only when derivation rules change; rides in the component
 *  metadata, the JSON-LD and the machine twins so any rendered entry can
 *  name the rules that produced it. */
export const CONTINUATIONS_VERSION = "continuations v2026.1";

/** The one door. Every Continuation opens the Netify Workspace. */
export const WORKSPACE_ORIGIN = "https://netify.co.uk";

export type ContinuationFamily =
  | "vendor"
  | "comparison"
  | "sector"
  | "insight" // derived in the main repo beside the Ghost template; listed here so the contract is whole
  | "tool_shortlist"
  | "tool_cost"
  | "question"
  | "sample_rfp";

/** The label law (Robert, 23 Jul): the primary verb speaks the buyer's
 *  problem, never the product. The product name appears only in the
 *  constant undertext rendered by the component. */
export const FAMILY_LABELS: Record<ContinuationFamily, string> = {
  vendor: "Continue your evaluation",
  comparison: "Continue your evaluation",
  sector: "Turn this into a live project",
  insight: "Turn this into a live project",
  tool_shortlist: "Take your shortlist to market",
  tool_cost: "Take this estimate to market",
  question: "Turn this into a live project",
  sample_rfp: "Turn this into a live project",
};

export interface Continuation {
  version: typeof CONTINUATIONS_VERSION;
  family: ContinuationFamily;
  /** Machine id of the deriving source, e.g. "vendor:cato-networks". */
  source: string;
  /** The context stamp: the page naming itself and its freshest fact. */
  stamp: string;
  /** The buyer's first sentence, written by the page, editable by the buyer. */
  sentence: string;
  /** The primary verb, from FAMILY_LABELS. Never names the product. */
  label: string;
  /** Supplier slugs that arrive pinned (the ?vendors= contract), max five. */
  pins: string[];
  /** Family-specific truth about what happens on arrival. Never boilerplate. */
  reassurance: string;
  /** Renders only where the underlying dataset genuinely holds the claim
   *  (e.g. the healthcare pack). Appended to the reassurance. */
  deepClaim?: string;
}

/** The workspace handoff URL for a Continuation. `sentence` is passed
 *  separately so the component can honour the buyer's edits; the derived
 *  sentence is used for the machine lanes, which are static truth. */
export function continuationUrl(sentence: string, pins: string[], opts?: { medium?: "twin" }): string {
  const params = new URLSearchParams();
  params.set("q", sentence);
  if (pins.length) params.set("vendors", pins.slice(0, 5).join(","));
  if (opts?.medium) {
    // Attribution law (19 Jul 2026): machine-served ACTION links carry
    // utm_source=ai_assistant; page-served human links never do.
    params.set("utm_source", "ai_assistant");
    params.set("utm_medium", opts.medium);
  }
  return `${WORKSPACE_ORIGIN}/?${params.toString()}`;
}

/** The machine-twin serialisation of a Continuation. Twins omit the key
 *  entirely when the deriver returns null: no phantom contracts. */
export function continuationForTwin(c: Continuation) {
  return {
    version: c.version,
    family: c.family,
    source: c.source,
    sentence: c.sentence,
    action: { label: c.label, url: continuationUrl(c.sentence, c.pins, { medium: "twin" }) },
    opens: "Netify Workspace",
    pins: c.pins,
    mcp_tools: ["workspace_ingest", "score_vendor_fit", "build_sase_shortlist"],
  };
}

/** The CreateAction JSON-LD for a rendered Continuation. Served only when
 *  a Continuation derived: null upstream means no machine contract. */
export function continuationJsonLd(c: Continuation, pageUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "CreateAction",
    "@id": `${pageUrl}#continuation`,
    name: c.label,
    identifier: c.version,
    description:
      `Carry this page's context into the Netify Workspace as the buyer's own editable words. Derived from ${c.source} under ${c.version}; nothing publishes without a human signature.`,
    target: {
      "@type": "EntryPoint",
      urlTemplate: continuationUrl(c.sentence, c.pins),
      actionPlatform: ["https://schema.org/DesktopWebPlatform", "https://schema.org/MobileWebPlatform"],
    },
  };
}
