/**
 * FlowStageStrip: the persistent "you are here" spine of the buyer journey
 * (Robert, 14 July 2026: users should always see what is happening, what
 * they are doing and what happens next). Four fixed stages — Describe,
 * Review your RFP, Publish, Supplier responses — with the current one
 * highlighted, completed ones ticked, and a one-line Now/Next explanation
 * underneath that the mounting page sets from its real state.
 *
 * Pure presentational component (no hooks), safe in server and client trees.
 */

const STAGES = [
  { key: "describe", label: "Describe" },
  { key: "review", label: "Review your RFP" },
  { key: "publish", label: "Publish" },
  { key: "responses", label: "Supplier responses" },
] as const;

export type FlowStage = (typeof STAGES)[number]["key"];

export default function FlowStageStrip({ stage, now, next }: { stage: FlowStage; now: string; next?: string }) {
  const idx = STAGES.findIndex((s) => s.key === stage);
  return (
    <div className="mb-6 rounded-sm border border-[var(--ink-200,#e5e5e5)] bg-[var(--paper-base,#faf9f7)] p-3">
      <ol className="m-0 mb-2 flex list-none flex-wrap items-center gap-x-1.5 gap-y-1 p-0" aria-label="Where you are in the process">
        {STAGES.map((s, i) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span
              className={
                i === idx
                  ? "rounded-full bg-amber-500 px-2.5 py-0.5 text-[11.5px] font-semibold text-zinc-950"
                  : i < idx
                    ? "rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11.5px] font-medium text-emerald-900"
                    : "rounded-full border border-[var(--ink-200,#e5e5e5)] px-2.5 py-0.5 text-[11.5px] text-[var(--ink-500,#71717a)]"
              }
              aria-current={i === idx ? "step" : undefined}
            >
              {i < idx ? "✓ " : ""}{s.label}
            </span>
            {i < STAGES.length - 1 && <span aria-hidden="true" className="text-[var(--ink-300,#d4d4d8)]">→</span>}
          </li>
        ))}
      </ol>
      <p className="m-0 text-xs leading-relaxed text-[var(--ink-600,#555)]">
        <strong className="text-[var(--ink-800,#27272a)]">Now:</strong> {now}
        {next && (
          <>
            {" "}<strong className="text-[var(--ink-800,#27272a)]">Next:</strong> {next}
          </>
        )}
      </p>
    </div>
  );
}
