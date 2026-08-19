"use client";

/**
 * Step 2, "Decisions before this can be published" (Robert's "UI mockups
 * request" handoff bundle, screenshot 02-decisions.png; structural pass
 * 19 Aug 2026).
 *
 * WHAT THIS REPLACES, AND WHY. Until this pass these same decisions were
 * rendered by `NextQuestions ... bare dark` inside a 340px dark sticky
 * rail captioned "Mission Control" — three cards deep, two of them hidden
 * below `lg`, each one a ~14px question in a cramped charcoal box.
 * Robert's verdict on it was one word: "lame". He is right, and the
 * reference is unambiguous about the alternative: decisions are not
 * sidebar chrome, they are a STEP. They get the full right pane, a
 * heading that states the stakes, and cards big enough to actually read.
 *
 * WHAT CHANGES: presentation only. Same `NextQuestionCard[]` the rail was
 * given, same `nq.id` identity, same `buttons[].onClick` handlers wired
 * by ProjectDesk (`landOption` / `dismissQuestion` / the governed
 * accept-suggestion path), same `MATERIAL_IMPACTS` classification behind
 * the material/optional split. Nothing about how a decision is recorded,
 * ranked or resolved moves here.
 *
 * TWO THINGS THE RAIL COULD NOT SHOW, now restored from data that already
 * existed and was simply thrown away by the cramped layout:
 *  · the full ranked list, not `slice(0, 3)` — the cap existed because
 *    three dark cards already overran a 390px viewport, which is not a
 *    constraint a full pane has;
 *  · `nq.target` resolved through SECTION_TITLES into the reference's own
 *    "Resolves X in the outline once answered" footnote, so a buyer can
 *    see what answering actually moves.
 */

import type { NextQuestionCard } from "@/components/procurement/LivingProcurementCanvas";
import { MATERIAL_IMPACTS } from "@/lib/workspace/procurement-next-questions";
import { outlineRowForDecision } from "@/lib/workspace/procurement-outline";

const mono: React.CSSProperties = { fontFamily: "var(--nf-font-mono)" };

const IMPACT_LABEL: Record<string, string> = {
  eligibility: "Affects who can bid",
  price: "Affects pricing",
  architecture: "Affects architecture",
  compliance: "Affects compliance",
  delivery: "Affects delivery",
  evaluation: "Affects evaluation",
  risk: "Affects resilience/risk",
};

export default function DecisionsStep({
  cards,
  materialDecisionsRemaining,
  published,
  sectorSectionTitle,
}: {
  cards: NextQuestionCard[];
  materialDecisionsRemaining: number;
  published: boolean;
  /** The active sector pack's outline row title, when one is active —
   *  needed to resolve a governed suggestion's own "Resolves ..."
   *  footnote (see outlineRowForDecision). */
  sectorSectionTitle: string | null;
}) {
  return (
    <div>
      <h2
        className="m-0 text-[27px] font-semibold leading-[1.2]"
        style={{ fontFamily: "var(--nf-font-serif)", letterSpacing: "-0.02em", color: "var(--nf-ink-950, #110f0d)" }}
      >
        {/* The reference's heading is the static "Decisions before this can
            be published". The live count is kept in front of it: it is real,
            it is the SAME `materialDecisionsRemaining` the publish panel's
            own stat and the rail's completion tick read, and dropping it to
            match a mockup screenshot would have quietly removed the one
            number that tells a buyer how far off publishing they are.
            Post-publish the wording changes entirely -- publication has
            happened, so nothing remaining can be "before" it. */}
        {published
          ? materialDecisionsRemaining
            ? `Project published · ${materialDecisionsRemaining} optional refinement${materialDecisionsRemaining === 1 ? "" : "s"} for the next revision`
            : "Project published"
          : materialDecisionsRemaining
            ? `${materialDecisionsRemaining} decision${materialDecisionsRemaining === 1 ? "" : "s"} before this can be published`
            : "No blocking decisions"}
      </h2>
      {/* Same honesty split every other status surface uses (see
          wizard-steps.ts's own completedSteps comment): post-publish,
          nothing remaining is a blocker of anything, whatever its
          pre-publish material/optional classification was. */}
      <p className="m-0 mt-2 max-w-[62ch] text-[13.5px] leading-[1.55]" style={{ color: "var(--nf-ink-600, #66635e)" }}>
        {published
          ? "Publication is already complete — nothing below reopens it. These only shape your next revision."
          : materialDecisionsRemaining
            ? "These are the choices that change price, risk, compliance or delivery — ranked, not everything that's merely unfilled."
            : "Nothing below blocks publishing — every card here is optional."}
      </p>

      {cards.length === 0 ? (
        <div
          className="mt-6 rounded-[4px] border p-6"
          style={{ borderColor: "var(--nf-rule, #d6d4d0)", background: "var(--nf-ivory-raised, #fefdfc)" }}
        >
          <p className="m-0 text-[13.5px] leading-[1.55]" style={{ color: "var(--nf-ink-600, #66635e)" }}>
            No material decision is open right now — the document reflects everything stated so far.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {cards.map(({ nq, buttons, hint }) => {
            const isMaterial =
              !nq.governedSuggestion && nq.impact.some((i) => (MATERIAL_IMPACTS as readonly string[]).includes(i));
            const section = outlineRowForDecision({
              id: nq.id,
              target: nq.target,
              governedSuggestion: nq.governedSuggestion,
              sectorSectionTitle,
            });
            return (
              <div
                key={nq.id}
                className="rounded-[4px] border p-5"
                style={{
                  borderColor: nq.governedSuggestion ? "var(--nf-lilac-soft-border, #b6a2dc)" : "var(--nf-rule, #d6d4d0)",
                  background: nq.governedSuggestion ? "var(--nf-lilac-soft, #eee6ff)" : "var(--nf-ivory-raised, #fefdfc)",
                }}
              >
                {/* Impact tags lead the card, as the reference draws them —
                    a buyer reads WHAT THIS CHANGES before reading the
                    question itself. Same `nq.impact` values, same labels. */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {nq.impact.map((i) => (
                    <span
                      key={i}
                      className="rounded-[3px] px-[7px] py-[3px] text-[10px] font-semibold uppercase"
                      style={{
                        ...mono,
                        letterSpacing: "0.06em",
                        background: "var(--nf-neutral-tag-soft, #e7e4e0)",
                        color: "var(--nf-neutral-tag, #47413a)",
                      }}
                    >
                      {IMPACT_LABEL[i] ?? i}
                    </span>
                  ))}
                  {nq.governedSuggestion && (
                    <span
                      className="rounded-[3px] px-[7px] py-[3px] text-[10px] font-semibold uppercase"
                      style={{
                        ...mono,
                        letterSpacing: "0.06em",
                        background: "var(--nf-lilac-soft, #eee6ff)",
                        color: "var(--nf-lilac, #573c7f)",
                      }}
                    >
                      Netify suggests · optional
                    </span>
                  )}
                  {!nq.governedSuggestion && !isMaterial && (
                    <span
                      className="rounded-[3px] px-[7px] py-[3px] text-[10px] font-semibold uppercase"
                      style={{
                        ...mono,
                        letterSpacing: "0.06em",
                        background: "var(--nf-neutral-tag-soft, #e7e4e0)",
                        color: "var(--nf-neutral-tag, #47413a)",
                      }}
                    >
                      Not required to publish
                    </span>
                  )}
                  <span className="flex-1" />
                  <span className="text-[10px]" style={{ ...mono, color: "var(--nf-ink-400, #83807b)" }} title="Stable question id">
                    {nq.id}
                  </span>
                </div>

                <h3
                  className="m-0 mt-3 max-w-[54ch] text-[19px] font-semibold leading-[1.35]"
                  style={{ fontFamily: "var(--nf-font-serif)", letterSpacing: "-0.01em", color: "var(--nf-ink-950, #110f0d)" }}
                >
                  {nq.question}
                </h3>

                {nq.reason && (
                  <p className="m-0 mt-2 max-w-[62ch] text-[13px] leading-[1.5]" style={{ color: "var(--nf-ink-600, #66635e)" }}>
                    {nq.reason}
                  </p>
                )}
                {nq.conflictReason && (
                  <p className="m-0 mt-2 max-w-[62ch] text-[13px] leading-[1.5]" style={{ color: "var(--nf-red, #8d1a1e)" }}>
                    {nq.conflictReason}
                  </p>
                )}

                {buttons.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {buttons.map((b) => (
                      <button
                        key={b.label}
                        type="button"
                        onClick={b.onClick}
                        className="cursor-pointer rounded-[3px] border px-3.5 py-2 text-[13px] font-semibold transition-colors hover:border-[var(--nf-ink-400,#83807b)]"
                        style={{
                          borderColor: "var(--nf-ink-200, #d3d0cd)",
                          background: "#fff",
                          color: "var(--nf-ink-950, #110f0d)",
                        }}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                ) : hint ? (
                  <p className="m-0 mt-3 text-[12.5px]" style={{ color: "var(--nf-ink-600, #66635e)" }}>{hint}</p>
                ) : null}

                {section && (
                  <p className="m-0 mt-3.5 text-[12px] leading-[1.5]" style={{ color: "var(--nf-ink-400, #83807b)" }}>
                    Resolves &ldquo;{section}&rdquo; in the outline once answered.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
