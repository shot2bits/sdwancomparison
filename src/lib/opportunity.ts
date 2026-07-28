/** Shared opportunity helpers for the API, agent and MCP. */

import { getOpportunity, saveOpportunity, inviteToOpportunity, resolveOpportunityToken, newId } from "@/lib/rfp-store";
import { getShortlistDataset } from "@/lib/vendors";
import { notifyBuyerOfSupplierActivity } from "@/lib/notify";
import { pingIndexNow, noticePingPaths } from "@/lib/indexnow";
import { FEED_TYPES, PricingSchema, type FeedItem, type FeedType, type Opportunity, type Pricing } from "@/lib/opportunity-types";

export function vendorName(slug: string): string | null {
  return getShortlistDataset().find((v) => v.slug === slug)?.name ?? null;
}

/**
 * Feed privacy masking. The marketplace promise is "pricing stays private to
 * the posting buyer" — so pricing AMOUNTS are only ever returned to the buyer
 * (proven by buyer_token). Everyone else — public room viewers, other
 * suppliers, supplier agents — sees that pricing was submitted, never the
 * figures. A supplier does see its own submitted amounts. Anonymous buyers'
 * organisation names are masked in feed actor names everywhere public.
 */
export function maskFeedItem(f: FeedItem, opts: { anonymousBuyer: boolean; ownVendorSlug?: string | null }): FeedItem {
  const own = Boolean(opts.ownVendorSlug && f.actor_slug === opts.ownVendorSlug);
  return {
    ...f,
    actor_name: opts.anonymousBuyer && f.actor_type === "buyer" ? "Buyer" : f.actor_name,
    pricing: f.pricing && !own
      ? { ...f.pricing, amount: null, unit_note: "", notes: "Pricing details are private to the buyer." }
      : f.pricing,
  };
}

export function maskedFeed(opp: Opportunity, ownVendorSlug: string | null = null): FeedItem[] {
  const anonymousBuyer = opp.buyer_visibility === "anonymous";
  return opp.feed.map((f) => maskFeedItem(f, { anonymousBuyer, ownVendorSlug }));
}

/** Buyer actor name for feed posts: never the organisation name when anonymous. */
export function buyerActorName(opp: Opportunity): string {
  return opp.buyer_visibility === "anonymous" ? "Buyer" : (opp.buyer_org || "Buyer");
}

/** Keep only plausible http(s) evidence links; cap count and length. */
export function sanitiseLinks(links: unknown): string[] {
  if (!Array.isArray(links)) return [];
  return links
    .filter((l): l is string => typeof l === "string")
    .map((l) => l.trim())
    .filter((l) => /^https?:\/\/[^\s]+$/i.test(l) && l.length <= 300)
    .slice(0, 5);
}

/** Cap and clean a structured-answers map (evidence key → answer text). */
export function sanitiseAnswers(answers: unknown): Record<string, string> {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(answers as Record<string, unknown>).slice(0, 20)) {
    if (typeof v === "string" && v.trim()) out[k.slice(0, 80)] = v.slice(0, 2000);
  }
  return out;
}

export async function addFeedItem(
  opp: Opportunity,
  actorType: "buyer" | "supplier",
  actorSlug: string | null,
  actorName: string,
  type: FeedType,
  body: string,
  pricing: Pricing | null = null,
  links: string[] = [],
  answers: Record<string, string> = {},
): Promise<Opportunity> {
  const t: FeedType = (FEED_TYPES as readonly string[]).includes(type) ? type : "comment";
  const item: FeedItem = {
    id: newId("feed"), actor_type: actorType, actor_slug: actorSlug, actor_name: actorName,
    type: t, body, pricing: pricing ? PricingSchema.parse(pricing) : null, links: sanitiseLinks(links), answers: sanitiseAnswers(answers), created: Date.now(),
  };
  const status = t === "award" ? "awarded" : t === "closed" ? "closed" : opp.status;
  // The moment a notice leaves the open state is a public fact the record
  // keeps forever (Robert's ruling, 28 Jul 2026): stamp closed_at once, at
  // the transition, and never overwrite it on later feed activity.
  const leavingOpen = opp.status === "open" && status !== "open";
  const saved = await saveOpportunity({
    ...opp,
    status,
    ...(leavingOpen && !opp.closed_at ? { closed_at: Date.now() } : {}),
    feed: [...opp.feed, item],
  });
  // Single choke point for buyer notifications: every supplier post — via the
  // web room or the MCP — lands here. Best effort and rate-limited inside.
  if (actorType === "supplier") {
    try { await notifyBuyerOfSupplierActivity(saved, actorName, t); } catch { /* never blocks the post */ }
  }
  // A close or award is news: tell IndexNow the notice, board and sitemap
  // changed. Best effort; the ping never blocks or fails the post.
  if (leavingOpen && saved.visibility === "public") {
    try { await pingIndexNow(noticePingPaths(saved.id)); } catch { /* accelerant, never a dependency */ }
  }
  return saved;
}

export async function inviteSupplierToOpportunity(opp: Opportunity, vendorSlug: string): Promise<{ token: string; opp: Opportunity } | { error: string }> {
  const name = vendorName(vendorSlug);
  if (!name) return { error: `Unknown vendor slug: ${vendorSlug}` };
  const token = await inviteToOpportunity(opp.id, vendorSlug);
  const updated = opp.invited.includes(vendorSlug) ? opp : await saveOpportunity({ ...opp, invited: [...opp.invited, vendorSlug] });
  return { token, opp: updated };
}

export { getOpportunity, saveOpportunity, resolveOpportunityToken };
