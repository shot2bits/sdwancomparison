import {cookies} from 'next/headers';
import {getSession} from '@/lib/rfp-store';
import {SESSION_COOKIE} from '@/lib/auth';
import {redirect} from 'next/navigation';
import {getOpportunity} from '@/lib/rfp-store';
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
  const opportunity=await getOpportunity(id).catch(()=>null);
  if(opportunity?.privacy_contract==="opportunity-studio/1"){const session=await getSession((await cookies()).get(SESSION_COOKIE)?.value);
    if(session?.email.toLowerCase()===opportunity.owner_email.toLowerCase())redirect(`/studio-preview/?project=${opportunity.source_rfp_id}`);
    redirect(`/studio/supplier/${opportunity.source_rfp_id}/`);
  }
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <OpportunityBuyer initialId={id} />
    </div>
  );
}
