import type { Metadata } from "next";
import OpportunityBuyer from "@/components/OpportunityBuyer";

export const metadata: Metadata = { title: "Live opportunity room | Netify", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }> };

export default async function OpportunityRoomPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <OpportunityBuyer initialId={id} />
    </div>
  );
}
