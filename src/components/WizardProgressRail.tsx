"use client";

/**
 * Compare-the-market style progress rail for the Describe wizard (Robert's
 * reference screenshot, 16 July 2026): a completion bar, then a vertical
 * stepper of sections with sub-steps, the active section expanded with a
 * pencil marker, completed sections ticked, upcoming ones numbered and
 * muted. Netify colours: emerald for progress and done, amber for active.
 */

const SECTIONS: { title: string; subs: { label: string; at: number }[] }[] = [
  {
    title: "Your project",
    subs: [
      { label: "What you're buying", at: 0 },
      { label: "Scope", at: 1 },
      { label: "Estate size", at: 2 },
    ],
  },
  {
    title: "Your context",
    subs: [
      { label: "Today's setup", at: 3 },
      { label: "Timing and delivery", at: 4 },
      { label: "Sector and compliance", at: 5 },
    ],
  },
  {
    title: "Generate and submit",
    subs: [{ label: "The agreement", at: 6 }],
  },
];

export function wizardPercent(step: number, count: number): number {
  return Math.min(100, Math.round((step / count) * 100));
}

export function WizardProgressBar({ step, count }: { step: number; count: number }) {
  const pct = wizardPercent(step, count);
  return (
    <div>
      <div className="h-2 rounded-full bg-emerald-100 overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
      <p className="mt-1.5 text-sm font-semibold">{pct}% complete</p>
    </div>
  );
}

export default function WizardProgressRail({ step, count }: { step: number; count: number }) {
  return (
    <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] bg-white p-4">
      <WizardProgressBar step={step} count={count} />
      <ol className="mt-4">
        {SECTIONS.map((section, si) => {
          const first = section.subs[0].at;
          const last = section.subs[section.subs.length - 1].at;
          const state = step > last ? "done" : step >= first ? "active" : "todo";
          const isLast = si === SECTIONS.length - 1;
          return (
            <li key={section.title} className="relative pl-10 pb-5 last:pb-0">
              {!isLast && <span aria-hidden="true" className={`absolute left-[13px] top-7 bottom-0 w-0.5 ${state === "done" ? "bg-emerald-400" : "bg-[var(--ink-200,#e5e5e5)]"}`} />}
              <span
                aria-hidden="true"
                className={`absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                  state === "done"
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : state === "active"
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-[var(--ink-300,#ccc)] bg-white text-[var(--ink-400)]"
                }`}
              >
                {state === "done" ? "✓" : state === "active" ? "✎" : si + 1}
              </span>
              <p className={`text-[15px] font-semibold leading-7 ${state === "active" ? "text-amber-800" : state === "done" ? "text-[var(--ink-800)]" : "text-[var(--ink-400)]"}`}>
                {section.title}
              </p>
              {state === "active" && (
                <ul className="mt-1.5 space-y-1.5">
                  {section.subs.map((sub) => (
                    <li
                      key={sub.at}
                      className={`text-sm ${
                        sub.at === step
                          ? "font-semibold text-[var(--ink-900,#18181b)]"
                          : sub.at < step
                            ? "text-emerald-700"
                            : "text-[var(--ink-500)]"
                      }`}
                    >
                      {sub.at < step ? "✓ " : ""}{sub.label}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
