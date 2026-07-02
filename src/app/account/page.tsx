import type { Metadata } from "next";
import BuyerMemoryPanel from "@/components/BuyerMemoryPanel";
import BuyerDigests from "@/components/BuyerDigests";
import MyOpportunities from "@/components/MyOpportunities";
import MyRfps from "@/components/MyRfps";

export const metadata: Metadata = { title: "Your account: opportunities, RFPs and agent memory", robots: { index: false, follow: false } };

/**
 * Buyer account hub: everything tied to the signed-in account in one place —
 * published opportunities (with room recovery), saved RFPs, agent memory and
 * digests. The opportunity/RFP panels render nothing when empty or signed
 * out, so the page degrades gracefully.
 */
export default function AccountPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-8">
        <p className="eyebrow mb-2">Your account</p>
        <h1 className="text-2xl mb-1">Your marketplace activity</h1>
        <p className="text-sm text-[var(--ink-600)]">Opportunities you have published, RFPs you have saved, and what the agent remembers — all tied to your signed-in email, recoverable from any device.</p>
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
