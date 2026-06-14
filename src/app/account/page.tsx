import type { Metadata } from "next";
import BuyerMemoryPanel from "@/components/BuyerMemoryPanel";

export const metadata: Metadata = { title: "Your account and agent memory", robots: { index: false, follow: false } };

export default function AccountPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-8">
        <p className="eyebrow mb-2">Your account</p>
        <h1 className="text-2xl mb-1">What the agent remembers about you</h1>
        <p className="text-sm text-[var(--ink-600)]">Transparent and editable. The agent uses this to avoid re-asking what it already knows, and carries it across all your RFPs.</p>
      </div>
      <BuyerMemoryPanel />
    </div>
  );
}
