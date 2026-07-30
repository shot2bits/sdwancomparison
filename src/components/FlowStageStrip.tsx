/**
 * FlowStageStrip: the persistent "you are here" spine of the buyer journey
 * (Robert, 14 July 2026: users should always see what is happening, what
 * they are doing and what happens next; 15 July: number every step and say
 * "Next step" literally so buyers know the journey runs to the end).
 *
 * Four fixed numbered stages — 1 Describe, 2 Review your RFP, 3 Publish,
 * 4 Supplier responses — completed ones ticked green, the current one as
 * the amber pill, the upcoming one tagged NEXT STEP. The Now line comes
 * from the mounting page's real state; the Next line is numbered
 * ("Next step, 3 of 4:") when the page passes numberNext (the builder,
 * where next means the next stage; the wizard's next is its own micro-step
 * so it keeps a plain Next).
 *
 * Pure presentational component (no hooks), safe in server and client trees.
 */

const STAGES = [
  { key: "describe", label: "Describe" },
  { key: "review", label: "Review your RFP" },
  { key: "publish", label: "Submit" },
  { key: "responses", label: "Vendor responses" },
] as const;

export type FlowStage = (typeof STAGES)[number]["key"];

export default function FlowStageStrip({ stage, now, next, numberNext = false }: { stage: FlowStage; now: string; next?: string; numberNext?: boolean }) {
  const idx = STAGES.findIndex((s) => s.key === stage);
  const nextIdx = idx + 1 < STAGES.length ? idx + 1 : null;
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
              {i < idx ? "✓ " : ""}{i + 1}. {s.label}
            </span>
            {nextIdx === i && (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-amber-800">
                Next step
              </span>
            )}
            {i < STAGES.length - 1 && <span aria-hidden="true" className="text-[var(--ink-300,#d4d4d8)]">→</span>}
          </li>
        ))}
      </ol>
      <p className="m-0 text-xs leading-relaxed text-[var(--ink-600,#555)]">
        <strong className="text-[var(--ink-800,#27272a)]">Now:</strong> {now}
        {next && (
          <>
            {" "}
            <strong className="text-[var(--ink-800,#27272a)]">
              {numberNext && nextIdx !== null ? `Next step, ${nextIdx + 1} of ${STAGES.length}:` : "Next:"}
            </strong>{" "}
            {next}
          </>
        )}
      </p>
    </div>
  );
}
