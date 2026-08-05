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

import { useEffect, useRef } from "react";

/* Fix (correction pass 2, Priority 4 — Tests 59/60): the sensible ceiling
 * on how tall the textarea is allowed to auto-grow before it starts
 * scrolling its own content instead. ~260px comfortably shows a genuinely
 * long multi-paragraph message (a dozen-plus lines) while still leaving
 * Send and the rest of the page reachable without scrolling the whole
 * window — matched against `45vh` too (via the className's `max-h-[...]`
 * below) so a short mobile viewport gets a proportionally smaller cap
 * rather than this fixed pixel value alone crowding out Send on a small
 * screen. Both the inline style below and the Tailwind class express the
 * SAME cap; keeping them numerically identical is deliberate, not
 * redundant — the inline style drives the JS grow-while-typing logic, the
 * CSS class is the belt-and-braces backstop for any path that sets
 * `value` without going through this onChange (e.g. a future paste
 * handler), so the box can never render taller than the cap either way.
 */
const MAX_TEXTAREA_HEIGHT_PX = 260;

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

  /* Fix (input box height doesn't reset after a long submission): the
   * onChange handler below grows the textarea by writing a pixel height
   * straight to the DOM element (`e.target.style.height = ...`), outside
   * React's own render cycle. That works fine while typing, but when the
   * parent clears `value` back to "" after a successful submit
   * (QuickSorWorkspace's setInput("")), nothing ever undid that earlier
   * imperative height write — React re-renders the now-empty textarea, but
   * the leftover inline `style.height` from the long message stays put, so
   * a short box that just handled a long submission stays tall/expanded
   * for a run of short, unrelated follow-ups afterwards. Resetting to
   * "auto" whenever the controlled value becomes empty (mount, or the
   * moment a submit clears it) lets the browser recompute natural height
   * from the `rows` attribute, matching what a first-load or freshly
   * cleared box already looks like. Only fires on the empty transition, so
   * this never fights the ordinary grow-while-typing behaviour above. */
  useEffect(() => {
    if (value === "" && ref.current) {
      ref.current.style.height = "auto";
    }
  }, [value]);

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
          /* Fix (correction pass 2, Priority 4 — Tests 59/60: pasting
           * ~5,000 words or a long unspaced token grew this box past
           * 12,000px, pushing Send and everything below it off-screen):
           * grow to fit content exactly as before, but only up to
           * MAX_TEXTAREA_HEIGHT_PX — past that, the box stops growing and
           * scrolls its own content internally instead, so Send and the
           * rest of the page stay in place and reachable regardless of
           * how much text is pasted. `min(...,45vh)` keeps the cap
           * sensible on short mobile viewports too, where a fixed 260px
           * could otherwise still crowd out Send on a small screen. */
          const el = e.target;
          el.style.height = "auto";
          const next = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX);
          el.style.height = `${next}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim() && !busy) onSubmit();
          }
        }}
        className={
          started
            ? "w-full max-h-[min(260px,45vh)] overflow-y-auto resize-none rounded-[10px] border border-[#EAE7E1] bg-white p-3.5 text-[15px] leading-relaxed text-[#141414] outline-none transition-colors focus:border-[#141414] disabled:opacity-60"
            : "w-full max-h-[min(260px,45vh)] overflow-y-auto resize-none rounded-[14px] border-2 border-[#D8D5CE] bg-white p-5 text-[16.5px] leading-relaxed text-[#141414] outline-none transition-colors focus:border-[#141414] disabled:opacity-60 sm:text-[17px]"
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
