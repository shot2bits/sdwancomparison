"use client";

/**
 * The journey rail (P1 of the CTM pivot, Robert's rulings 30 Jul 2026;
 * reference: netify-ctm-p1-reference).
 *
 * Robert brought Compare the Market's car journey sidebar and pointed at
 * their registration-plate lookup: one thing typed, several answers
 * filled. Our one-sentence prompt does the same job better, and this rail
 * is what makes it visible. Three ruled steps (R5: Requirement, Who fits,
 * Generate and publish), the active one expanded, its sub-steps ticking
 * themselves as extraction places facts. One sentence can tick several at
 * once, and when it does they tick where the buyer can watch it happen.
 *
 * THE PERCENTAGE IS HONEST BY CONSTRUCTION. It is not a formula and it is
 * not a readiness score (the mockup's readiness maths are banned). It is
 * the ticks on this rail divided by the ticks this rail has, and the rail
 * says so in words beside it. Every tick is a real fact standing in the
 * ledger, a real matched vendor set, or a real publish. Nothing here
 * can move without something true moving first.
 *
 * The register is CTM's and the instrument-grade law's: numbered circles,
 * thin connectors, flat panel, hairlines. No glow, no padlocks, no
 * blurs, no teasers, no countdowns (R1b: no 2005 landing-page
 * behaviour). A completed step carries a pencil so the buyer can walk
 * back into it, exactly as CTM's step one does.
 */

import { useEffect, useRef, useState } from "react";

export type RailStepId = 1 | 2 | 3;

/**
 * One sub-step. `done` is always read from real state by the caller.
 * `goesTo` is the id of the element on the page that holds this detail, so
 * an unfilled sub-step is a way in rather than a scolding: CTM's sub-steps
 * are navigation and ours are too.
 */
export type RailCheck = { id: string; label: string; done: boolean; goesTo?: string };

export type RailStep = {
  id: RailStepId;
  title: string;
  /** What this step is for, in one short line. */
  detail: string;
  checks: RailCheck[];
};

export default function JourneyRail({
  steps,
  current,
  onGoTo,
  published = false,
  maxStep = 3,
}: {
  steps: RailStep[];
  current: RailStepId;
  onGoTo: (id: RailStepId) => void;
  published?: boolean;
  /** The furthest step reached. Steps beyond it are shown but not
   *  clickable: going back is free, going forward happens through the
   *  step's own control, so the step that proves the value cannot be
   *  skipped (Harry's read, 30 Jul 2026). */
  maxStep?: RailStepId;
}) {
  const all = steps.flatMap((s) => s.checks);
  const total = all.length;
  const done = all.filter((c) => c.done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  /* The magic moment, made visible: a sub-step that has just ticked holds
   * a brief mark so a buyer who typed one sentence can see the several
   * answers it filled. Presentation only; the tick itself is state. */
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const prevDone = useRef<Set<string> | null>(null);
  useEffect(() => {
    const nowDone = new Set(all.filter((c) => c.done).map((c) => c.id));
    const before = prevDone.current;
    prevDone.current = nowDone;
    if (!before) return;
    const added = [...nowDone].filter((id) => !before.has(id));
    if (!added.length) return;
    setFresh(new Set(added));
    const t = setTimeout(() => setFresh(new Set()), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all.map((c) => `${c.id}:${c.done ? 1 : 0}`).join("|")]);

  return (
    <nav aria-label="Your progress" className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
      <style>{`
        @keyframes jrtick{0%{transform:translateX(-3px);opacity:.4}100%{transform:none;opacity:1}}
        .jr-tick{animation:jrtick .5s ease forwards}
        @media(prefers-reduced-motion:reduce){.jr-tick{animation:none}}
      `}</style>

      {/* The bar and the count, with what the count counts stated beside it. */}
      <div className="h-[6px] overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="m-0 text-[13px] font-semibold text-zinc-900">{pct}% complete</p>
        <p className="m-0 text-[11px] text-zinc-500" title="Every tick on this rail is a fact standing in your requirement, a real matched vendor set, or a real publish. Nothing else counts towards it.">
          {done} of {total} things this rail asks for
        </p>
      </div>

      <ol className="m-0 mt-4 list-none p-0">
        {steps.map((step, i) => {
          const stepDone = step.checks.every((c) => c.done);
          const isCurrent = step.id === current;
          const isLast = i === steps.length - 1;
          const state = isCurrent ? "active" : stepDone ? "done" : step.id < current ? "visited" : "todo";
          return (
            <li key={step.id} className="relative pl-9 pb-4 last:pb-0">
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={`absolute left-[12px] top-7 bottom-0 w-px ${state === "done" ? "bg-emerald-300" : "bg-zinc-200"}`}
                />
              )}
              <span
                aria-hidden="true"
                className={`absolute left-0 top-0 flex h-[25px] w-[25px] items-center justify-center rounded-full border text-[11px] font-semibold ${
                  state === "done"
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : state === "active"
                      ? "border-amber-500 bg-white text-amber-700"
                      : state === "visited"
                        ? "border-zinc-400 bg-white text-zinc-600"
                        : "border-zinc-200 bg-white text-zinc-400"
                }`}
              >
                {state === "done" ? "✓" : step.id}
              </span>

              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                {isCurrent || step.id > maxStep ? (
                  <p
                    aria-current={isCurrent ? "step" : undefined}
                    className={`m-0 text-[14px] font-semibold leading-6 ${isCurrent ? "text-zinc-900" : "text-zinc-400"}`}
                  >
                    {step.title}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => onGoTo(step.id)}
                    className={`m-0 rounded-sm text-left text-[14px] font-semibold leading-6 underline decoration-transparent underline-offset-2 transition-colors hover:decoration-zinc-400 ${
                      state === "todo" ? "text-zinc-500 hover:text-zinc-800" : "text-zinc-800 hover:text-zinc-950"
                    }`}
                  >
                    {step.title}
                  </button>
                )}
                {/* CTM's pencil: a step you have been through is a step you
                    can walk back into. Never shown on the step you are on. */}
                {!isCurrent && step.id <= maxStep && (state === "done" || state === "visited") && !published && (
                  <button
                    type="button"
                    onClick={() => onGoTo(step.id)}
                    className="text-[11px] text-zinc-500 underline hover:text-zinc-900"
                    aria-label={`Go back to ${step.title}`}
                  >
                    ✎ edit
                  </button>
                )}
              </div>

              {isCurrent && (
                <>
                  <p className="m-0 mt-0.5 text-[11px] leading-snug text-zinc-500">{step.detail}</p>
                  {step.checks.length > 0 && (
                    <ul className="m-0 mt-2 list-none space-y-[5px] p-0">
                      {step.checks.map((c) => (
                        <li
                          key={c.id}
                          className={`flex items-baseline gap-2 text-[12.5px] leading-snug ${
                            c.done ? "text-zinc-800" : "text-zinc-500"
                          } ${fresh.has(c.id) ? "jr-tick" : ""}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`mt-[3px] inline-block h-[13px] w-[13px] shrink-0 rounded-full border text-center text-[9px] leading-[11px] ${
                              c.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-zinc-300 bg-white"
                            }`}
                          >
                            {c.done ? "✓" : ""}
                          </span>
                          {c.goesTo && !c.done ? (
                            <button
                              type="button"
                              onClick={() => {
                                document.getElementById(c.goesTo as string)?.scrollIntoView({ behavior: "smooth", block: "center" });
                              }}
                              className="text-left underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 hover:decoration-zinc-900"
                            >
                              {c.label}
                            </button>
                          ) : (
                            c.label
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {/* A step you are not on still says how much of it stands, so
                  walking back is an informed decision rather than a hunt. */}
              {!isCurrent && step.id <= maxStep && step.checks.length > 1 && (
                <p className="m-0 mt-0.5 text-[11px] leading-snug text-zinc-400">
                  {step.checks.filter((c) => c.done).length} of {step.checks.length} filled
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
