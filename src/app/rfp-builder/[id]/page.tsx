import type { Metadata } from "next";
import RfpBuilder from "@/components/RfpBuilder";

export const metadata: Metadata = { title: "Your SASE & SD-WAN RFP", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }> };

export default async function RfpProjectPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="mb-8">
        <p className="eyebrow mb-2">Agentic RFP builder</p>
        <h1 className="text-2xl">Your SASE and SD-WAN RFP</h1>
      </div>
      <RfpBuilder initialId={id} />
    </div>
  );
}
