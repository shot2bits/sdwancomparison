import type { Metadata } from "next";
import QuickSorWorkspace from "@/components/preview/QuickSorWorkspace";

/**
 * /preview/quick-sor/ (public path /sase/preview/quick-sor/ once merged and
 * deployed from this branch — NOT linked from any nav, NOT the live /home
 * or /workspace route). Phase 0, vertical slice 1: journey choice → Quick
 * Understanding → real extraction/merge cycle → capture receipt →
 * readable living Understanding → persistent input for corrections and
 * clarification.
 *
 * noindex: this is a preview route for review, not a public page.
 */

export const metadata: Metadata = {
  title: "Netify preview — Quick Understanding",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <div className="relative bg-[#fbfaf8]">
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-6 sm:pt-12">
        <div className="mx-auto mb-8 max-w-3xl rounded-[10px] border border-amber-300 bg-amber-50 p-3 text-center">
          <p className="m-0 text-[12px] text-amber-900">
            Preview build — Phase 0 vertical slice. Not linked from the live site. Feedback welcome before this
            merges.
          </p>
        </div>
        <h1 className="mx-auto mb-2 max-w-3xl text-center text-2xl font-semibold text-[#141414] sm:text-3xl">
          Describe your project
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-center text-[15px] leading-relaxed text-[#52525b]">
          Netify structures your words into a living Understanding — facts in your own words, named inferences, and
          nothing invented.
        </p>
        <QuickSorWorkspace />
      </main>
    </div>
  );
}
