/**
 * The journey strip (the sourcing engine recut, Robert's build ruling,
 * 28 Jul 2026): five stations in one thin band, replacing the four v6
 * hero blocks. Labels are his ruled comprehension-first set ("make each
 * stage understandable to someone who has never seen Netify"); station
 * one is marked current because the visitor is standing at it. Flat
 * panels, hairlines, no glow: the instrument-grade law. Server
 * component, rendered through ProjectDesk's afterPrompt slot.
 *
 * Every line traces to ruled words or estate truth: anonymous
 * publication, signature-only sending, pricing privacy, evidenced fit
 * with reasons stated, structured responses side by side.
 */

const STATIONS: { n: string; title: string; detail: string; current?: boolean }[] = [
  { n: "01", title: "Describe your project", detail: "Your words start it. One sentence is enough.", current: true },
  { n: "02", title: "Develop the requirement", detail: "Facts, named inferences and open questions, one at a time." },
  { n: "03", title: "Identify suitable suppliers", detail: "Evaluated fit across the market, with the reasons stated." },
  { n: "04", title: "Publish anonymously", detail: "Your notice, your signature. Your identity stays off it." },
  { n: "05", title: "Compare responses", detail: "Structured responses side by side. Pricing private to you." },
];

export default function JourneyStrip() {
  return (
    <ol
      aria-label="The sourcing journey"
      className="mx-auto mt-5 grid w-[min(860px,100%)] list-none grid-cols-1 overflow-hidden rounded-md border border-zinc-200 bg-white p-0 sm:grid-cols-5"
    >
      {STATIONS.map((s) => (
        <li
          key={s.n}
          className={`border-b border-zinc-200 p-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${
            s.current ? "bg-amber-50/50 shadow-[inset_0_2px_0_#f59e0b]" : ""
          }`}
        >
          <span className="block font-mono text-[9.5px] text-zinc-400">{s.n}</span>
          <span className="mt-0.5 block text-[12px] font-semibold leading-tight text-zinc-900">{s.title}</span>
          <span className="mt-0.5 block text-[10.5px] leading-snug text-zinc-500">{s.detail}</span>
        </li>
      ))}
    </ol>
  );
}
