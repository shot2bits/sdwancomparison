"use client";

/**
 * Phase 0 vertical slice — journey chooser (W0 preview, isolated route only).
 *
 * Presentational only, typed props, no Base44 SDK/runtime dependency. The
 * visual pattern (three cards, one active, two named-but-not-yet-built) is
 * adapted from the Base44 `netify_ai_platform` Workspace.jsx home treatment
 * documented in the porting audit, rebuilt natively against this repo's own
 * ink/amber design tokens (see globals.css --ink-* vars and JourneyRail's
 * amber #F5A21B accent) rather than Base44's Radix/shadcn components, which
 * this repo does not and must not depend on.
 *
 * Does not touch ProjectDesk.tsx, the live /home or /workspace routes, or
 * any production journey-progress component (JourneyRail, JourneyStrip).
 */

export type JourneyId = "ask_netify" | "quick_sor" | "full_rfp";

export interface JourneyOption {
  id: JourneyId;
  title: string;
  detail: string;
  available: boolean;
}

const OPTIONS: JourneyOption[] = [
  {
    id: "ask_netify",
    title: "Ask Netify",
    detail: "Open-ended questions about SASE, SD-WAN and security procurement, answered from Netify's evaluated market data.",
    available: false,
  },
  {
    id: "quick_sor",
    title: "Quick Statement of Requirements",
    detail: "Describe your project in your own words. Netify captures what you say, asks what's missing, and builds a living Statement of Requirements as you go.",
    available: true,
  },
  {
    id: "full_rfp",
    title: "Full RFI/RFP Build",
    detail: "A structured requirement pack for formal tender, evaluated against the full Netify question bank and ready to publish.",
    available: false,
  },
];

export default function JourneySelector({
  current,
  onSelect,
}: {
  current: JourneyId;
  onSelect: (id: JourneyId) => void;
}) {
  return (
    <div className="mb-8">
      <p className="m-0 mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-500)]">
        Choose how you want to work with Netify
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {OPTIONS.map((opt) => {
          const isCurrent = opt.id === current;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={!opt.available}
              onClick={() => opt.available && onSelect(opt.id)}
              aria-current={isCurrent ? "true" : undefined}
              className={
                "rounded-[13px] border p-4 text-left transition-colors " +
                (isCurrent
                  ? "border-[#F5A21B] bg-[#FFF7E8]"
                  : opt.available
                    ? "border-[#EAE7E1] bg-white hover:border-[#141414]"
                    : "cursor-not-allowed border-[#EAE7E1] bg-[#FBFAF8] opacity-70")
              }
            >
              <div className="flex items-center justify-between gap-2">
                <p className="m-0 text-[14px] font-semibold text-[#141414]">{opt.title}</p>
                {!opt.available && (
                  <span className="rounded-full border border-[#EAE7E1] bg-white px-2 py-0.5 text-[10px] font-medium text-[#8C8A85]">
                    Coming soon
                  </span>
                )}
                {isCurrent && opt.available && (
                  <span className="rounded-full bg-[#F5A21B] px-2 py-0.5 text-[10px] font-semibold text-[#141414]">
                    Active
                  </span>
                )}
              </div>
              <p className="m-0 mt-1.5 text-[12.5px] leading-snug text-[#6E6C67]">{opt.detail}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
