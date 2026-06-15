import type { Metadata } from "next";
import Link from "next/link";
import SignIn from "@/components/SignIn";

export const metadata: Metadata = {
  title: "Respond to an RFP | Netify supplier",
  description: "How suppliers respond to a Netify RFP: open the private link the buyer sent you, or sign in to your supplier dashboard.",
  robots: { index: false, follow: false },
};

// Landing for the bare /rfp-builder/supplier path. A specific RFP is answered
// via /rfp-builder/supplier/<token> (the private link the buyer sends), so this
// page explains that rather than trying to load a non-existent RFP.
export default function RfpSupplierLanding() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <p className="eyebrow mb-3">Suppliers</p>
      <h1 className="mb-3">Respond to an RFP</h1>
      <p className="text-[var(--ink-700)] mb-4">
        To answer a specific RFP, open the <strong>private link the buyer sent you</strong>. It looks like
        {" "}<code>/rfp-builder/supplier/&lt;your-link&gt;</code> and opens your response form straight away. There is no RFP to load on this page on its own.
      </p>
      <p className="text-[var(--ink-700)] mb-6">
        Don&rsquo;t have a link yet? Sign in to your supplier dashboard to see the opportunities and invitations waiting for you.
      </p>
      <div className="flex flex-wrap gap-3 mb-8">
        <Link href="/supplier" className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400">Go to supplier dashboard</Link>
        <Link href="/for-suppliers" className="rounded-full border border-[var(--ink-900)] px-5 py-2.5 text-sm no-underline transition-colors hover:bg-[var(--ink-900)] hover:text-white">For vendors and providers</Link>
      </div>
      <SignIn role="supplier" prompt="Sign in with your work email to see RFPs and opportunities you have been invited to." />
    </div>
  );
}
