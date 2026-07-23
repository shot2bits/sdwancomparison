/**
 * The sector bridge (Robert's go, 24 Jul, the citation play): the top
 * cited sector pages hand their readers straight into the apex workspace
 * with a sector-shaped sentence already waiting in the prompt. The ?q=
 * handoff runs the desk's ordinary cycle on arrival, so the bridge lands
 * on a position, not a pitch.
 *
 * Honesty rules: the prefill is an editable plain sentence in the buyer's
 * voice with no invented numbers; the deep claim ("DSPT, clinical change
 * windows and HSCN are already part of the conversation") renders ONLY for
 * healthcare, where the sector pack genuinely holds it. Every other sector
 * gets the generic claim, which is true everywhere: provenance on every
 * claim, evaluated suppliers, an anonymous notice only a human signs.
 * Server-rendered, no client state.
 */

const APEX = "https://netify.co.uk";

const PREFILL: Record<string, string> = {
  healthcare: "We are a healthcare provider replacing legacy connectivity with managed SD-WAN and SASE across our sites.",
  financial_services: "We are a financial services firm consolidating network and security into SASE.",
  retail_ecommerce: "We are a retailer needing a PCI DSS compliant network across our stores.",
  manufacturing: "We are a manufacturer securing IT and OT across our plants with managed SASE.",
  energy_utilities: "We are an energy and utilities operator connecting remote and critical sites with resilient, secure networking.",
  government_public_sector: "We are a public sector organisation buying SD-WAN and SASE with UK data residency.",
  education: "We are an education provider connecting campuses and sites with managed SD-WAN.",
  transport_logistics: "We are a transport and logistics operator connecting depots and sites with resilient SD-WAN.",
  professional_services: "We are a professional services firm consolidating security into SASE for hybrid work.",
  hospitality_leisure: "We are a hospitality operator connecting sites with managed SD-WAN.",
};

const GENERIC_PREFILL = "We are replacing legacy connectivity with managed SD-WAN and SASE.";

export default function SectorBridge({ sectorKey, sectorLabel }: { sectorKey?: string; sectorLabel?: string }) {
  const prefill = (sectorKey && PREFILL[sectorKey]) || GENERIC_PREFILL;
  const href = `${APEX}/?q=${encodeURIComponent(prefill)}`;
  const label = sectorLabel ?? "your sector";
  const healthcare = sectorKey === "healthcare";
  return (
    <section aria-label="Describe your requirement in the workspace" className="mb-10 rounded-xl border border-amber-200 bg-amber-50/50 p-5">
      <p className="eyebrow mb-2">From research to a living requirement</p>
      <p className="m-0 text-[15px] leading-relaxed text-[var(--ink-800,#27272a)]">
        Reading about {label.toLowerCase()} is one way in. The faster way: describe your requirement once at netify.co.uk
        and watch evaluated suppliers take position around it, provenance on every claim.
        {healthcare
          ? " The workspace already understands healthcare: NHS DSPT, clinical change windows and HSCN are part of the conversation from your first sentence."
          : " Your sector becomes part of the conversation from your first sentence, and an anonymous notice reaches the market only when you sign."}
      </p>
      <p className="m-0 mt-2 text-[12.5px] italic text-[var(--ink-500,#71717a)]">&ldquo;{prefill}&rdquo; · editable before anything runs on the record</p>
      <a
        href={href}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2.5 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400"
      >
        Describe your {label.toLowerCase()} requirement
        <span aria-hidden="true">→</span>
      </a>
    </section>
  );
}
