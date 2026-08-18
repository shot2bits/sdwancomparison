import type { Metadata } from "next";
import PartnerWorkspace from "@/components/PartnerWorkspace";

export const metadata: Metadata = { title: "BT Business reseller workspace", robots: { index: false, follow: false } };

export default function PartnerPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="mb-8">
        <p className="eyebrow mb-2">Agent-assisted reselling</p>
        <h1 className="text-2xl mb-1">Your BT Business reseller workspace</h1>
        <p className="text-sm text-[var(--ink-600)]">The assistant remembers your profile, holds your goal, and produces sales plans, scripts, objection handling, commission models and follow-up tasks. It drafts customer, account-manager and BT outreach for your approval, and never sends anything on its own.</p>
      </div>
      <PartnerWorkspace />
    </div>
  );
}
