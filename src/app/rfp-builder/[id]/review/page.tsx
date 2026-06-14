import type { Metadata } from "next";
import Link from "next/link";
import AgentReviewPanel from "@/components/AgentReviewPanel";

export const metadata: Metadata = { title: "Agent review and approvals", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }> };

export default async function RfpReviewPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="mb-8">
        <p className="eyebrow mb-2">Agentic procurement</p>
        <h1 className="text-2xl mb-1">Agent review and approvals</h1>
        <p className="text-sm text-[var(--ink-600)]">The agent reviews incoming bids on its own, scores them, flags gaps and drafts clarifications. You approve what gets sent. <Link href={`/rfp-builder/${id}`} className="underline">Back to the RFP</Link></p>
      </div>
      <AgentReviewPanel rfpId={id} />
    </div>
  );
}
