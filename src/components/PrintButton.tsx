"use client";

/** Print/save-as-PDF button for server-rendered document views. */
export default function PrintButton({ label = "Print / save as PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="w-full rounded-full border border-[var(--ink-300,#ccc)] px-5 py-2.5 text-sm text-[var(--ink-800)] transition-colors hover:border-[var(--ink-900)] print:hidden"
    >
      {label}
    </button>
  );
}
