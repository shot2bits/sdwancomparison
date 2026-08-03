"use client";

/**
 * Phase 0 vertical slice — the one persistent input (W0 preview, isolated
 * route only). Same convention as the live production textarea (see
 * ProjectDesk.tsx and the retired LiveWorkspace.tsx): one growing textarea,
 * Enter submits, Shift+Enter adds a line. Used for the first description
 * AND every later addition, correction or clarification request — there is
 * no separate "edit" affordance, exactly as the Phase 0 spec asks for.
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
    <div className={started ? "mt-6" : "mt-2"}>
      <label htmlFor="quick-sor-input" className="m-0 mb-1.5 block text-[12px] text-[#6E6C67]">
        {started
          ? "Add more, correct something, or ask a question — one box, the whole conversation."
          : "Describe your project in your own words. One sentence is enough to start."}
      </label>
      <textarea
        id="quick-sor-input"
        ref={ref}
        value={value}
        rows={1}
        disabled={busy}
        placeholder={
          started
            ? "e.g. \"Actually, we have 52 sites\" or \"I don't know what you mean, can you explain?\""
            : "We are a UK retail business with 50 sites and 200 remote users…"
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
        className="w-full resize-none rounded-[10px] border border-[#EAE7E1] bg-white p-3.5 text-[15px] leading-relaxed text-[#141414] outline-none transition-colors focus:border-[#141414] disabled:opacity-60"
      />
      <div className="mt-2 flex items-center justify-between">
        <p className="m-0 text-[11px] text-[#8C8A85]">
          Every fact traces back to your own words or a named inference. Nothing is invented.
        </p>
        <button
          type="button"
          disabled={busy || !value.trim()}
          onClick={onSubmit}
          className="rounded-full bg-[#141414] px-4 py-1.5 text-[13px] font-medium text-white transition-opacity disabled:opacity-40"
        >
          {busy ? "Reading…" : started ? "Send" : "Start"}
        </button>
      </div>
      {error && <p className="m-0 mt-2 text-[12.5px] text-red-700">{error}</p>}
    </div>
  );
}
