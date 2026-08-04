"use client";

/**
 * Phase 0 vertical slice — the one persistent input (W0 preview, isolated
 * route only). Same convention as the live production textarea (see
 * ProjectDesk.tsx and the retired LiveWorkspace.tsx): one growing textarea,
 * Enter submits, Shift+Enter adds a line. Used for the first description
 * AND every later addition, correction or clarification request — there is
 * no separate "edit" affordance, exactly as the Phase 0 spec asks for.
 *
 * Milestone 1, Commit 11A — first-load hierarchy only. `started` already
 * carried the exact signal needed to distinguish "nobody has submitted
 * anything yet" from "the workspace is continuing" (QuickSorWorkspace's own
 * `entries.length > 0`), so this commit branches presentation on the same
 * existing prop rather than adding a new one: no API change, no new prop,
 * no change to onSubmit/onChange/runCycle. The `<label>` IS the first-load
 * instruction (kept as a real <label htmlFor="quick-sor-input">, not a
 * separate heading) so the size/weight increase below is pure styling, not
 * a new element competing with page.tsx's own <h1> or changing label
 * association. The provenance reassurance paragraph and the submit
 * button's disabled/busy logic are byte-identical in both states — only
 * size, spacing, border weight and copy differ.
 *
 * Correction (same commit): the first-load placeholder previously read a
 * fictional example sentence ("We are a UK retail business with 50 sites
 * and 200 remote users…"), which conflicts with the NO EXAMPLE OPENERS
 * ruling in ProjectDesk.tsx (no fictional site counts, named standards,
 * named products, or example companies proposed to the buyer). Replaced
 * with an open instruction that guides without proposing project facts.
 */

import { useRef } from "react";

export default function PersistentAssistantInput({
  value,
  onChange,
  onSubmit,
  busy,
  started,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  started: boolean;
  error?: string | null;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  return (
    <div className={started ? "mt-6" : "mt-1"}>
      <label
        htmlFor="quick-sor-input"
        className={
          started
            ? "m-0 mb-1.5 block text-[12px] text-[#6E6C67]"
            : "m-0 mb-2.5 block text-[21px] font-semibold leading-snug text-[#141414] sm:text-[24px]"
        }
      >
        {started
          ? "Add more, correct something, or ask a question — one box, the whole conversation."
          : "Tell Netify about your project."}
      </label>
      {!started && (
        <p className="m-0 mb-3.5 text-[14px] leading-relaxed text-[#6E6C67]">
          Describe what you are buying, changing or trying to solve. One sentence is enough to start.
        </p>
      )}
      <textarea
        id="quick-sor-input"
        ref={ref}
        value={value}
        rows={started ? 1 : 4}
        disabled={busy}
        placeholder={
          started
            ? "e.g. \"Actually, we have 52 sites\" or \"I don't know what you mean, can you explain?\""
            : "Describe what your organisation is trying to buy, change or solve…"
        }
        onChange={(e) => {
          onChange(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim() && !busy) onSubmit();
          }
        }}
        className={
          started
            ? "w-full resize-none rounded-[10px] border border-[#EAE7E1] bg-white p-3.5 text-[15px] leading-relaxed text-[#141414] outline-none transition-colors focus:border-[#141414] disabled:opacity-60"
            : "w-full resize-none rounded-[14px] border-2 border-[#D8D5CE] bg-white p-5 text-[16.5px] leading-relaxed text-[#141414] outline-none transition-colors focus:border-[#141414] disabled:opacity-60 sm:text-[17px]"
        }
      />
      <div className={started ? "mt-2 flex items-center justify-between" : "mt-3 flex items-center justify-between"}>
        <p className="m-0 text-[11px] text-[#8C8A85]">
          Every fact traces back to your own words or a named inference. Nothing is invented.
        </p>
        <button
          type="button"
          disabled={busy || !value.trim()}
          onClick={onSubmit}
          className={
            started
              ? "rounded-full bg-[#141414] px-4 py-1.5 text-[13px] font-medium text-white transition-opacity disabled:opacity-40"
              : "rounded-full bg-[#141414] px-5 py-2 text-[14px] font-medium text-white transition-opacity disabled:opacity-40"
          }
        >
          {busy ? "Reading…" : started ? "Send" : "Start"}
        </button>
      </div>
      {error && <p className="m-0 mt-2 text-[12.5px] text-red-700">{error}</p>}
    </div>
  );
}
