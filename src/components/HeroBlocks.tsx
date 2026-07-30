/**
 * The hero blocks (Robert's v6 Perplexity ruling, 26 Jul 2026): the
 * prompt takes the top of the page and every paragraph of the canon
 * becomes its own shaded block beneath it, two by two, stacking to one
 * column on phones. The words are Robert's (the v5 canon), with joins
 * adjusted only so no card repeats its own heading in its first line.
 * The amber block acts; the three neutral blocks explain. Block one's
 * body carries id="page-subhead" so the speakable schema keeps a live
 * target. The roster band closes the hero. Server component, rendered
 * into the desk through ProjectDesk's afterPrompt slot.
 */

import MarketRoster from "@/components/MarketRoster";

function Strong({ children }: { children: React.ReactNode }) {
  return <b className="font-semibold text-zinc-800">{children}</b>;
}

export default function HeroBlocks() {
  return (
    <>
      <div className="mx-auto mt-4 grid w-[min(860px,100%)] gap-3 sm:grid-cols-2">
        <section aria-label="Start with a single prompt" className="rounded-[14px] border border-amber-200 bg-amber-50/60 p-4">
          <h3 className="m-0 flex items-center gap-2 text-[13px] font-semibold text-zinc-900">
            <span aria-hidden="true" className="grid h-[22px] w-[22px] flex-none place-items-center rounded-[7px] border border-amber-500 bg-amber-500 text-[11px] text-zinc-950">&#9998;</span>
            Start with a single prompt
          </h3>
          <p id="page-subhead" className="m-0 mt-1.5 text-[12.5px] leading-relaxed text-zinc-600">
            The Netify SASE Security &amp; SD-WAN buying assistant translates your high-level needs into technical
            requirements. <Strong>Build</Strong> your Statement of Requirements, RFI or RFP. <Strong>Publish</Strong> it
            to our global opportunity board.
          </p>
        </section>
        <section aria-label="Start receiving responses" className="rounded-[14px] border border-zinc-200 bg-zinc-50 p-4">
          <h3 className="m-0 flex items-center gap-2 text-[13px] font-semibold text-zinc-900">
            <span aria-hidden="true" className="grid h-[22px] w-[22px] flex-none place-items-center rounded-[7px] border border-zinc-200 bg-white text-[11px] text-zinc-500">&#8634;</span>
            Start receiving responses
          </h3>
          <p className="m-0 mt-1.5 text-[12.5px] leading-relaxed text-zinc-600">
            Responses arrive from vendors and managed service providers, all without a single call.{" "}
            <Strong>Message</Strong> vendors and providers to request demos and reach their local teams.{" "}
            <Strong>Get</Strong> bids and pricing. <Strong>Shortlist</Strong> the solutions that match.
          </p>
        </section>
        <section aria-label="Connected in real time" className="rounded-[14px] border border-zinc-200 bg-zinc-50 p-4">
          <h3 className="m-0 flex items-center gap-2 text-[13px] font-semibold text-zinc-900">
            <span aria-hidden="true" className="grid h-[22px] w-[22px] flex-none place-items-center rounded-[7px] border border-zinc-200 bg-white text-[11px] text-zinc-500">&#8599;</span>
            Connected in real time
          </h3>
          <p className="m-0 mt-1.5 text-[12.5px] leading-relaxed text-zinc-600">
            Connected in real time to 30+ SASE &amp; SD-WAN vendors and managed service providers, from Gartner leaders
            to niche players. Used by UK &amp; North American national and multinational businesses.
          </p>
        </section>
        <section aria-label="Evidence you can sign" className="rounded-[14px] border border-zinc-200 bg-zinc-50 p-4">
          <h3 className="m-0 flex items-center gap-2 text-[13px] font-semibold text-zinc-900">
            <span aria-hidden="true" className="grid h-[22px] w-[22px] flex-none place-items-center rounded-[7px] border border-zinc-200 bg-white text-[11px] text-zinc-500">&#10003;</span>
            Evidence you can sign
          </h3>
          <p className="m-0 mt-1.5 text-[12.5px] leading-relaxed text-zinc-600">
            <Strong>Netify</Strong> is a UK research and procurement platform for SASE, SD-WAN and network security:
            evaluated vendor intelligence with dates on every grade, and an anonymous route to market that only you
            can sign.
          </p>
        </section>
      </div>
      <MarketRoster />
    </>
  );
}
