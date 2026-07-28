import type { ReactNode } from "react";

/**
 * The journey strip (the sourcing engine recut, Robert's build ruling,
 * 28 Jul 2026; made state-aware the same evening on his R1 ruling from
 * Harry's Section 1 test: two numbered strips on one page read as a
 * repeat, and a hardcoded station one still read as current after
 * publish). One strip now serves the whole journey: the ruled five
 * labels never change; `current` moves with the project's real state;
 * `notes` carry the earned live sublines (claims held, suppliers
 * evaluated, suppliers invited, the record link) under their stations.
 * Flat panels, hairlines, no glow: the instrument-grade law. No hooks,
 * so it renders server-side on the door and inside the client desk
 * alike.
 *
 * Every line traces to ruled words or estate truth: anonymous
 * publication, signature-only sending, pricing privacy, evidenced fit
 * with reasons stated, structured responses side by side.
 */

const STATIONS: { n: string; title: string; detail: string }[] = [
  { n: "01", title: "Describe your project", detail: "Your words start it. One sentence is enough." },
  { n: "02", title: "Develop the requirement", detail: "Facts, named inferences and open questions, one at a time." },
  { n: "03", title: "Identify suitable suppliers", detail: "Evaluated fit across the market, with the reasons stated." },
  { n: "04", title: "Publish anonymously", detail: "Your notice, your signature. Your identity stays off it." },
  { n: "05", title: "Compare responses", detail: "Structured responses side by side. Pricing private to you." },
];

export type JourneyStation = 1 | 2 | 3 | 4 | 5;

export default function JourneyStrip({
  current = 1,
  notes,
}: {
  current?: JourneyStation;
  notes?: Partial<Record<JourneyStation, ReactNode>>;
}) {
  return (
    <ol
      aria-label="The sourcing journey"
      className="mx-auto mt-5 grid w-[min(860px,100%)] list-none grid-cols-1 overflow-hidden rounded-md border border-zinc-200 bg-white p-0 sm:grid-cols-5"
    >
      {STATIONS.map((s, i) => {
        const idx = (i + 1) as JourneyStation;
        const note = notes?.[idx];
        return (
          <li
            key={s.n}
            aria-current={idx === current ? "step" : undefined}
            className={`border-b border-zinc-200 p-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${
              idx === current ? "bg-amber-50/50 shadow-[inset_0_2px_0_#f59e0b]" : ""
            }`}
          >
            <span className="block font-mono text-[9.5px] text-zinc-400">{s.n}</span>
            <span className="mt-0.5 block text-[12px] font-semibold leading-tight text-zinc-900">{s.title}</span>
            <span className="mt-0.5 block text-[10.5px] leading-snug text-zinc-500">{s.detail}</span>
            {note ? <span className="mt-1 block text-[10.5px] leading-snug text-amber-700">{note}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
