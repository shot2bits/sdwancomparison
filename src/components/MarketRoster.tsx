/**
 * The connected market roster (Robert's hero ruling, 25 Jul 2026,
 * mockup v4): every name rendered from the live graded dataset, never
 * hand-typed, so the page can never claim a vendor the dataset does not
 * grade. Equal visual weight for every name on purpose: "Gartner leaders
 * to niche players" is Robert's sentence about the range of the market,
 * not a per-vendor status this dataset asserts, so no name is singled
 * out. Server component, no client code, no motion.
 */

import { getShortlistDataset } from "@/lib/vendors";

export default function MarketRoster() {
  const names = getShortlistDataset().map((v) => v.name);
  return (
    <section aria-label="The connected market" className="mx-auto mt-3 w-[min(860px,100%)] rounded-[14px] border border-zinc-200 bg-white px-5 py-3.5">
      <p className="m-0 text-[10px] font-semibold uppercase tracking-[.13em] text-zinc-400">
        The connected market &middot; every grade dated and sourced
      </p>
      {/* Each name holds together; the spaces around the separator give
          the browser its break points (the first render shipped with no
          whitespace between spans and overflowed as one line). */}
      <p className="m-0 mt-1.5 text-[11px] leading-[2] text-zinc-400">
        {names.map((n, i) => (
          <span key={n}>
            <span className="whitespace-nowrap">{n}</span>
            {i < names.length - 1 ? <span className="text-zinc-300" aria-hidden="true">{" · "}</span> : null}
          </span>
        ))}
      </p>
    </section>
  );
}
