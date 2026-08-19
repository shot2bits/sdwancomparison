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
  onSelect,
}: {
  current: WizardStep;
  /** Derived from real document state — never from navigation history. */
  completed: ReadonlySet<WizardStep>;
  /** Stations the buyer may open right now. */
  reachable: ReadonlySet<WizardStep>;
  onSelect: (step: WizardStep) => void;
}) {
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
          return (
            <li key={s.step} className="flex flex-none items-center">
              <button
                type="button"
                disabled={!canOpen}
                onClick={() => canOpen && onSelect(s.step)}
                aria-current={isCurrent ? "step" : undefined}
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
    </nav>
  );
}
