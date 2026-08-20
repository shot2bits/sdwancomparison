/**
 * The five stations of the sourcing builder (Robert's "UI mockups
 * request" handoff bundle, structural pass 19 Aug 2026) — the shared
 * vocabulary for WizardRail.tsx and ProjectDesk.tsx's own step routing,
 * so the rail's labels and the pane that renders for each step can never
 * drift apart.
 *
 * PURE: no React, no I/O, like every other projection in this codebase
 * (Article 17). Order is the reference's order and is load-bearing — the
 * rail renders `WIZARD_STEPS` in array order and derives its numerals
 * from position, so reordering this array reorders the product.
 */

export type WizardStep = "describe" | "decisions" | "review" | "publish" | "compare";

/**
 * `purpose` added 19 Aug 2026. Robert, on a live session PDF: "If I was a
 * new user, I'd have no idea what I was trying to accomplish here. Just
 * suggestion prompts but to what end?"
 *
 * He was right, and part of it was self-inflicted: the five-station rail
 * built earlier the same day replaced JourneyStrip's 01-05 explainer, but
 * carried only its LABELS. The sentences that told a buyer what a station
 * was FOR ("Publish anonymously -- your notice, your signature, your
 * identity stays off it") were left behind on the pre-start door, where a
 * started project never sees them.
 *
 * EVERY LINE BELOW ALREADY EXISTED AND WAS ALREADY APPROVED -- none of it
 * is newly-written product copy:
 *   describe   JourneyStrip station 01's own detail
 *   decisions  DecisionsStep's own subhead
 *   review     the Review station's own subhead
 *   publish    JourneyStrip station 04's own detail
 *   compare    JourneyStrip station 05's own detail
 * The rail's five stations do not map 1:1 onto the old 01-05 (there is no
 * "identify suitable vendors" station, and Review/Decisions are finer
 * grained), which is why two lines come from the stations themselves
 * rather than from JourneyStrip.
 */
export const WIZARD_STEPS: ReadonlyArray<{ step: WizardStep; label: string; purpose: string }> = [
  { step: "describe", label: "Describe", purpose: "Your words start it. One sentence is enough." },
  { step: "decisions", label: "Decisions", purpose: "The choices that change price, risk, compliance or delivery." },
  { step: "review", label: "Review", purpose: "Everything suppliers will see. Nothing about price or preferred vendors is shared." },
  { step: "publish", label: "Publish", purpose: "Your notice, your signature. Your identity stays off it." },
  { step: "compare", label: "Compare", purpose: "Structured responses side by side. Pricing private to you." },
];

/**
 * Which stations are open right now, derived ONLY from real document
 * state — never from where the buyer has already clicked.
 *
 * `describe` is always open (it is the door). The middle three open once
 * a single real fact exists, since there is genuinely nothing to decide,
 * review or publish about an empty document. `compare` opens only after
 * a real publication, because supplier responses cannot exist before one
 * — showing it earlier would promise a surface that must render empty.
 */
export function reachableSteps({ started, published }: { started: boolean; published: boolean }): Set<WizardStep> {
  const out = new Set<WizardStep>(["describe"]);
  if (started) {
    out.add("decisions");
    out.add("review");
    out.add("publish");
  }
  if (published) out.add("compare");
  return out;
}

/**
 * Which stations are genuinely finished. Every entry below is a fact the
 * compiler or the publish saga already owns:
 *
 *  · describe   at least one real fact or noted item exists
 *  · decisions  zero MATERIAL decisions remain (the same
 *               `materialDecisionCount()` figure Mission Control used to
 *               show and the publish panel's own stat still reads, so the
 *               tick and the count can never contradict each other)
 *  · review     only once published — reviewing is not an action with its
 *               own completion record, and ticking it on visit alone
 *               would be exactly the "a card was clicked, therefore it is
 *               resolved" fiction this codebase refuses everywhere else
 *  · publish    a real publication exists
 *  · compare    terminal; never self-reports done
 */
export function completedSteps({
  started,
  materialDecisionsRemaining,
  published,
}: {
  started: boolean;
  materialDecisionsRemaining: number;
  published: boolean;
}): Set<WizardStep> {
  const out = new Set<WizardStep>();
  if (started) out.add("describe");
  if (started && materialDecisionsRemaining === 0) out.add("decisions");
  if (published) {
    out.add("review");
    out.add("publish");
  }
  return out;
}
