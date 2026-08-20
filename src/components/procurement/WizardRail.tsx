"use client";

/**
 * The sourcing builder's five-step rail (Robert's "UI mockups request"
 * handoff bundle, structural pass 19 Aug 2026).
 *
 * WHY THIS EXISTS. The 19 Aug aesthetic-only pass repainted the existing
 * single-scroll workspace in the handoff bundle's palette and typography
 * and shipped something that shared its colours and almost nothing else.
 * Robert's rejection was exact: "Looks nothing like the ZIP file...
 * Mission Control is lame." The handoff's README does say "visual style
 * ONLY / do not restructure", but that README was written by a design
 * tool describing a repaint of ITS OWN mockup — it assumed the target
 * already had this layout. Ours did not, so the literal reading produced
 * the wrong artefact. Every one of the bundle's five screenshots shows
 * this rail; it is the spine of the design, not decoration.
 *
 * WHAT IT IS. Five stations — Describe, Decisions, Review, Publish,
 * Compare — each rendering in one of three real states:
 *   · completed  green disc, white tick
 *   · current    amber disc, dark ink numeral, bold label
 *   · pending    white disc, hairline border, muted numeral and label
 * Dashed connectors run between them, exactly as the reference draws it.
 *
 * WHAT IT IS NOT. It is not a stepper that gates or sequences the app.
 * Completion here is DERIVED from state the compiler already owns
 * (`started`, `materialDecisionsRemaining`, `published`) and never from
 * "the buyer clicked past this", so a station cannot claim to be done on
 * the strength of navigation alone — the same honesty rule every other
 * status surface in this codebase follows. Unreachable stations are real
 * `disabled` buttons, not links that silently no-op.
 */

import type { WizardStep } from "@/lib/workspace/wizard-steps";
import { WIZARD_STEPS } from "@/lib/workspace/wizard-steps";

export default function WizardRail({
  current,
  completed,
  reachable,
  badges,
  onSelect,
}: {
  current: WizardStep;
  /** Derived from real document state — never from navigation history. */
  completed: ReadonlySet<WizardStep>;
  /** Stations the buyer may open right now. */
  reachable: ReadonlySet<WizardStep>;
  /** Outstanding-item counts per station, e.g. how many MATERIAL decisions
   *  are still open. Added 19 Aug 2026 after Robert asked the obvious
   *  question of the first build — "how does the user know when Decisions
   *  is reached?" — to which the honest answer was: they didn't, unless
   *  they read the summary sentence or noticed the left-pane chips. The
   *  rail said only "2 Decisions" in inert grey whether six decisions were
   *  waiting or none were. Every value here is a real count the compiler
   *  already owns (see ProjectDesk's call site); a station with nothing
   *  outstanding renders no badge rather than a zero. */
  badges?: Partial<Record<WizardStep, number>>;
  onSelect: (step: WizardStep) => void;
}) {
  const currentStep = WIZARD_STEPS.find((s) => s.step === current) ?? WIZARD_STEPS[0];
  return (
    <nav
      aria-label="Sourcing builder progress"
      className="border-b"
      style={{ borderColor: "var(--nf-rule)", background: "var(--nf-ivory-raised)" }}
    >
      <ol className="mx-auto flex max-w-[1400px] list-none items-center gap-0 overflow-x-auto px-[26px] py-3 lg:px-[42px]">
        {WIZARD_STEPS.map((s, i) => {
          const isCurrent = s.step === current;
          const isDone = completed.has(s.step) && !isCurrent;
          const canOpen = reachable.has(s.step);
          const badge = badges?.[s.step];
          const showBadge = typeof badge === "number" && badge > 0 && !isDone;
          return (
            <li key={s.step} className="flex flex-none items-center">
              <button
                type="button"
                disabled={!canOpen}
                onClick={() => canOpen && onSelect(s.step)}
                aria-current={isCurrent ? "step" : undefined}
                /* The badge is a bare numeral, which a screen reader would
                   otherwise announce as "Decisions 6" — ambiguous between a
                   count and a step number. Name the whole control instead. */
                aria-label={showBadge ? `${s.label}, ${badge} outstanding` : undefined}
                className={`flex items-center gap-2.5 rounded-[3px] px-1.5 py-1 ${canOpen ? "cursor-pointer" : "cursor-default"}`}
                style={{ background: "transparent", border: 0 }}
              >
                <span
                  aria-hidden="true"
                  className="grid h-[22px] w-[22px] flex-none place-items-center rounded-full text-[11px]"
                  style={{
                    fontFamily: "var(--nf-font-mono)",
                    fontWeight: 600,
                    ...(isDone
                      ? { background: "var(--nf-emerald, #1e4e22)", color: "#fff", border: "1px solid var(--nf-emerald, #1e4e22)" }
                      : isCurrent
                        ? { background: "var(--nf-orange, #c66000)", color: "#fff", border: "1px solid var(--nf-orange, #c66000)" }
                        : { background: "#fff", color: "var(--nf-ink-400, #83807b)", border: "1px solid var(--nf-ink-200, #d3d0cd)" }),
                  }}
                >
                  {isDone ? "✓" : i + 1}
                </span>
                <span
                  className="whitespace-nowrap text-[13px]"
                  style={{
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent
                      ? "var(--nf-ink-950, #110f0d)"
                      : isDone
                        ? "var(--nf-ink-800, #302d2a)"
                        : "var(--nf-ink-400, #83807b)",
                  }}
                >
                  {s.label}
                </span>
                {showBadge && (
                  <span
                    aria-hidden="true"
                    className="grid h-[18px] min-w-[18px] flex-none place-items-center rounded-[3px] px-[5px] text-[10.5px]"
                    style={{
                      fontFamily: "var(--nf-font-mono)",
                      fontWeight: 700,
                      background: "var(--nf-orange-soft, #ffe3cc)",
                      color: "var(--nf-orange-strong, #832f00)",
                      border: "1px solid var(--nf-orange-soft-border, #db9f76)",
                    }}
                  >
                    {badge}
                  </span>
                )}
              </button>
              {i < WIZARD_STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="mx-2 hidden h-px w-[52px] flex-none sm:block"
                  style={{
                    borderTop: "1px dashed var(--nf-ink-200, #d3d0cd)",
                  }}
                />
              )}
            </li>
          );
        })}
      </ol>
      {/* The current station's purpose. Robert, 19 Aug 2026: "I'd have no
          idea what I was trying to accomplish here." The rail said
          "Publish" where the journey strip it replaced said "Publish
          anonymously -- your notice, your signature, your identity stays
          off it", and that sentence only ever renders before a project
          starts. Copy is unchanged and already-approved (see
          wizard-steps.ts); it is only being shown where it is needed. */}
      <div
        className="mx-auto max-w-[1400px] px-[26px] pb-2.5 text-[12.5px] leading-[1.45] lg:px-[42px]"
        style={{ color: "var(--nf-ink-600, #66635e)" }}
      >
        <span style={{ color: "var(--nf-ink-950, #110f0d)", fontWeight: 700 }}>{currentStep.label}</span>
        {` \u2014 ${currentStep.purpose}`}
      </div>
    </nav>
  );
}
