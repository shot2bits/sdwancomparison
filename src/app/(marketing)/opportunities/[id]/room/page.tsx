import type { Metadata } from "next";
import OpportunityBuyer from "@/components/OpportunityBuyer";

/**
 * The live response room (feed, comments, pricing, invitations). Interactive
 * and private-by-nature, so noindexed. The public, crawlable face of the
 * opportunity is the parent notice page.
 */
export const metadata: Metadata = { title: "Live opportunity room", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }> };

export default async function OpportunityRoomPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <OpportunityBuyer initialId={id} />
    </div>
  );
}
