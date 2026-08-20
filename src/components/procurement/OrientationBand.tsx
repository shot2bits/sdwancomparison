"use client";

/**
 * "What am I making · what's stopping me · what do I get" — the three
 * facts a first-time buyer needs on screen at all times.
 *
 * WHY THIS EXISTS. Robert, 19 Aug 2026, reviewing a real session PDF:
 * "I think the platform remains confusing to use. If I was a new user,
 * I'd have no idea what I was trying to accomplish here. Just suggestion
 * prompts but to what end?"
 *
 * The diagnosis, from that PDF: the workspace was fluent in its own
 * machinery — SEC-8b7a1c72, SCORED · WEIGHT 3, PASS/FAIL GATES, netify
 * derived, a readiness ring reading 57 — and silent on purpose. It never
 * said what was being made, when it would be finished, or what happened
 * next. Worse, the one sentence that DID answer "when am I finished"
 * ("N material decisions remain before suppliers can price consistently")
 * was small grey caption text while the uninterpretable 57 got the ring.
 *
 * Two of those gaps were self-inflicted the same day: the five-station
 * rail replaced JourneyStrip's 01-05 explainer but kept only its labels,
 * and CollapsibleHero's H1/promise went sr-only on start. So a new user
 * typed one sentence and lost, simultaneously, every statement of what
 * the product was for.
 *
 * NO NEW FACTS. Every value here is already computed elsewhere on the
 * page and is simply being said in the buyer's terms rather than the
 * compiler's:
 *   · the subject line is `document.summary`
 *   · the gate count is `materialDecisionsRemaining`, the SAME figure the
 *     rail badge, the Decisions heading and the publish panel all read
 *   · the named blocker is the top-ranked open decision
 *   · the consequence line and the payoff copy are lifted verbatim from
 *     the publish CTA and JourneyStrip stations 04/05
 *
 * POST-PUBLISH HONESTY. Once a real publication exists, "before it's
 * ready" and "then" would both be lies — publication has happened. Both
 * cells re-state to what is actually true, the same rule every other
 * status surface in this codebase follows.
 */

import { useState } from "react";
import type { PublishChecklist } from "@/lib/workspace/publish-checklist";

const mono: React.CSSProperties = { fontFamily: "var(--nf-font-mono)" };

function Cell({
  label,
  value,
  detail,
  cta,
  last = false,
  detailOnMobile = false,
}: {
  label: string;
  value: string;
  detail: string;
  cta?: { text: string; onClick: () => void };
  last?: boolean;
  /** Whether this cell's explanatory paragraph survives below `lg`.
   *
   *  Measured, not guessed: with all three paragraphs shown the band ran
   *  to 400px on a 390x844 viewport and pushed the architecture twin to
   *  764px -- the buyer's own document below the fold behind a panel
   *  explaining it. That is precisely the mistake the dark Mission
   *  Control rail made, and it is not worth repeating for a better
   *  reason. The short VALUES carry the orientation on their own ("A
   *  requirement suppliers can price", "You publish anonymously"); the
   *  paragraphs are elaboration, and only the cell the buyer can act on
   *  keeps its on a phone. */
  detailOnMobile?: boolean;
}) {
  return (
    <div
      className={`min-w-0 flex-1 px-4 py-3.5 ${last ? "" : "border-b lg:border-b-0 lg:border-r"}`}
      style={{ borderColor: "var(--nf-ink-100, #e3e1de)" }}
    >
      <div className="text-[9px] uppercase" style={{ ...mono, letterSpacing: "0.1em", color: "var(--nf-ink-400, #83807b)" }}>
        {label}
      </div>
      <div className="mt-1.5 text-[13.5px] font-semibold leading-[1.4]" style={{ color: "var(--nf-ink-950, #110f0d)" }}>
        {value}
      </div>
      <p
        className={`m-0 mt-1 text-[12px] leading-[1.45] ${detailOnMobile ? "" : "hidden lg:block"}`}
        style={{ color: "var(--nf-ink-600, #66635e)" }}
      >
        {detail}
      </p>
      {cta && (
        <button
          type="button"
          onClick={cta.onClick}
          className="mt-1.5 cursor-pointer border-0 bg-transparent p-0 text-[12px] font-bold"
          style={{ color: "var(--nf-orange-strong, #832f00)" }}
        >
          {cta.text}
        </button>
      )}
    </div>
  );
}

export default function OrientationBand({
  summary,
  checklist,
  materialDecisionsRemaining,
  published,
  responseCount,
  invitedCount,
  onReviewDecisions,
  onCompare,
  startCollapsed,
}: {
  /** `document.summary` — the compiler's own one-line description of what
   *  has been stated so far. Never invented here. */
  summary: string;
  /** The REAL publish gate \u2014 finite, monotonic, and the SAME object
   *  `signLocked` is built from, so what a buyer is told they need and
   *  what actually stops them cannot differ. */
  checklist: PublishChecklist;
  /** Open decisions. Advisory: they sharpen what suppliers quote and gate
   *  NOTHING, which is why they are never called blocking here. */
  materialDecisionsRemaining: number;
  published: boolean;
  responseCount: number | null;
  invitedCount: number;
  onReviewDecisions: () => void;
  onCompare: () => void;
  /** Collapse to one line by default. Passed `true` once a project has
   *  started (20 Aug 2026).
   *
   *  This band is ORIENTATION — the three facts a first-time buyer needs
   *  before they have any of their own on screen. Once they do, it is
   *  competing for the same space as the things that replaced its job:
   *  the rail's "N of M sections ready", the captured list, and the end
   *  state in the chat column. Measured on a live 1440x1000 screenshot,
   *  expanded it cost ~250px at the top of a viewport-bounded persistent
   *  pane and pushed "Your RFP can be published" under the composer.
   *  Collapsed, not deleted: a new user still gets it in full, and one
   *  click brings it back at any time. */
  startCollapsed?: boolean;
}) {
  const [open, setOpen] = useState(!startCollapsed);
  if (!open) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-[26px] lg:px-[42px]">
        <div
          className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-[4px] border px-3.5 py-2 text-[12px] leading-[1.45]"
          style={{ borderColor: "var(--nf-rule, #d6d4d0)", background: "var(--nf-ivory-raised, #fefdfc)", color: "var(--nf-ink-600, #66635e)" }}
        >
          <span className="text-[10px] uppercase" style={{ ...mono, letterSpacing: "0.08em" }}>
            You&rsquo;re building
          </span>
          <span style={{ color: "var(--nf-ink-950, #110f0d)", fontWeight: 600 }}>
            A requirement suppliers can price
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="cursor-pointer border-0 bg-transparent p-0 text-[11.5px] font-semibold"
            style={{ color: "var(--nf-orange-strong, #832f00)" }}
          >
            What happens next?
          </button>
        </div>
      </div>
    );
  }
  return (
    <div
      className="mx-auto w-full max-w-[1400px] px-[26px] lg:px-[42px]"
      aria-label="What you are building"
    >
      <div
        className="flex flex-col rounded-[4px] border lg:flex-row"
        style={{ borderColor: "var(--nf-rule, #d6d4d0)", background: "var(--nf-ivory-raised, #fefdfc)" }}
      >
        <Cell
          label="You're building"
          value="A requirement suppliers can price"
          detail={summary}
        />

        {published ? (
          <Cell
            label="Status"
            detailOnMobile
            value="Published"
            detail={
              responseCount
                ? `${responseCount} of ${invitedCount} invited supplier${invitedCount === 1 ? "" : "s"} ${responseCount === 1 ? "has" : "have"} responded.`
                : "Awaiting supplier responses. Nothing further is needed from you."
            }
          />
        ) : (
          <Cell
            label="To publish, you need"
            value={checklist.ready ? "Ready to publish" : `${checklist.doneCount} of ${checklist.total} done`}
            detail={
              checklist.ready
                ? materialDecisionsRemaining
                  ? `Everything required is stated. ${materialDecisionsRemaining} open decision${materialDecisionsRemaining === 1 ? "" : "s"} would tighten what suppliers quote \u2014 optional, and ${materialDecisionsRemaining === 1 ? "it doesn't" : "they don't"} hold publishing up.`
                  : "Everything required is stated."
                : `Still needed: ${checklist.remaining.join(", ").toLowerCase()}.`
            }
            detailOnMobile
            cta={
              checklist.ready && materialDecisionsRemaining
                ? { text: "Sharpen it first \u2192", onClick: onReviewDecisions }
                : undefined
            }
          />
        )}

        <Cell
          last
          label="Then"
          value={published ? "Compare the responses" : "You publish anonymously"}
          detail={
            published
              ? "Structured responses side by side. Pricing private to you."
              : "Your notice, your signature. Your identity stays off it. Matched suppliers respond, and their answers come back here to compare."
          }
          cta={published ? { text: "Compare →", onClick: onCompare } : undefined}
        />
      </div>
    </div>
  );
}
