import type { Metadata } from "next";
import Link from "next/link";
import RfpBuilder from "@/components/RfpBuilder";

export const metadata: Metadata = { title: "Your SASE & SD-WAN RFP", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }> };

export default async function RfpProjectPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Agentic RFP builder</p>
          <h1 className="text-2xl">Your SASE and SD-WAN RFP</h1>
        </div>
        <Link href={`/rfp-builder/${id}/review`} className="flex-none inline-flex items-center rounded-full border border-[var(--ink-300,#ccc)] px-4 py-1.5 text-sm no-underline text-[var(--ink-800)] hover:bg-[var(--ink-100,#f5f5f5)]">Agent review and approvals →</Link>
      </div>
      <RfpBuilder initialId={id} />
    </div>
  );
}
