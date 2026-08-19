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

export const WIZARD_STEPS: ReadonlyArray<{ step: WizardStep; label: string }> = [
  { step: "describe", label: "Describe" },
  { step: "decisions", label: "Decisions" },
  { step: "review", label: "Review" },
  { step: "publish", label: "Publish" },
  { step: "compare", label: "Compare" },
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
