/** Shared opportunity helpers for the API, agent and MCP. */

import { getOpportunity, saveOpportunity, inviteToOpportunity, resolveOpportunityToken, newId } from "@/lib/rfp-store";
import { getShortlistDataset } from "@/lib/vendors";
import { FEED_TYPES, PricingSchema, type FeedItem, type FeedType, type Opportunity, type Pricing } from "@/lib/opportunity-types";

export function vendorName(slug: string): string | null {
  return getShortlistDataset().find((v) => v.slug === slug)?.name ?? null;
}

export async function addFeedItem(
  opp: Opportunity,
  actorType: "buyer" | "supplier",
  actorSlug: string | null,
  actorName: string,
  type: FeedType,
  body: string,
  pricing: Pricing | null = null,
): Promise<Opportunity> {
  const t: FeedType = (FEED_TYPES as readonly string[]).includes(type) ? type : "comment";
  const item: FeedItem = {
    id: newId("feed"), actor_type: actorType, actor_slug: actorSlug, actor_name: actorName,
    type: t, body, pricing: pricing ? PricingSchema.parse(pricing) : null, created: Date.now(),
  };
  const status = t === "award" ? "awarded" : t === "closed" ? "closed" : opp.status;
  return saveOpportunity({ ...opp, status, feed: [...opp.feed, item] });
}

export async function inviteSupplierToOpportunity(opp: Opportunity, vendorSlug: string): Promise<{ token: string; opp: Opportunity } | { error: string }> {
  const name = vendorName(vendorSlug);
  if (!name) return { error: `Unknown vendor slug: ${vendorSlug}` };
  const token = await inviteToOpportunity(opp.id, vendorSlug);
  const updated = opp.invited.includes(vendorSlug) ? opp : await saveOpportunity({ ...opp, invited: [...opp.invited, vendorSlug] });
  return { token, opp: updated };
}

export { getOpportunity, saveOpportunity, resolveOpportunityToken };
