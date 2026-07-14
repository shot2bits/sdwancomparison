import type { Metadata } from "next";
import Link from "next/link";
import BuyerMemoryPanel from "@/components/BuyerMemoryPanel";
import BuyerDigests from "@/components/BuyerDigests";
import MyOpportunities from "@/components/MyOpportunities";
import MyRfps from "@/components/MyRfps";
import SignIn from "@/components/SignIn";

export const metadata: Metadata = { title: "Your account: opportunities, RFPs and agent memory", robots: { index: false, follow: false } };

/**
 * Buyer account hub: everything tied to the signed-in account in one place —
 * published opportunities (with room recovery), saved RFPs, agent memory and
 * digests. This page is also the nav's "Sign in" destination, so it carries
 * the sign-in box itself (SignIn shows "signed in as…" once authenticated)
 * and points suppliers and admins at their own areas — previously neither
 * was reachable from the menu at all (Harry's retest, 03/07/2026).
 */
export default function AccountPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-8">
        <p className="eyebrow mb-2">Your account</p>
        <h1 className="text-2xl mb-1">Your marketplace activity</h1>
        <p className="text-sm text-[var(--ink-600)]">Opportunities you have published, RFPs you have saved, and what the agent remembers — all tied to your signed-in email, recoverable from any device.</p>
      </div>

      <div className="mb-8">
        <SignIn role="buyer" prompt="Sign in with your work email to recover your opportunities and RFPs on this device." />
        <p className="mt-3 text-xs text-[var(--ink-500)]">
          Supplier? <Link href="/for-suppliers#register" className="underline">Register or sign in to bid</Link> · your dashboard is at{" "}
          <Link href="/supplier" className="underline">Supplier area</Link>.
        </p>
      </div>

      <MyOpportunities />
      <MyRfps />

      <div className="mt-4 mb-6">
        <h2 className="text-xl mb-1">What the agent remembers about you</h2>
        <p className="text-sm text-[var(--ink-600)]">Transparent and editable. The agent uses this to avoid re-asking what it already knows, and carries it across all your RFPs.</p>
      </div>
      <BuyerMemoryPanel />

      <div className="mt-12 mb-6">
        <h2 className="text-xl mb-1">Agent digests</h2>
        <p className="text-sm text-[var(--ink-600)]">What the agent found while monitoring your live RFPs, with recommended next actions. It drafts and recommends; it never contacts a supplier without your approval.</p>
      </div>
      <BuyerDigests />
    </div>
  );
}
