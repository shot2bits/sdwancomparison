/**
 * Live opportunity ("tender room"): a buyer posts a need, from just underlay
 * circuits to full SASE, and graded suppliers reply in near real time with
 * comments and pricing. One unified activity feed everyone in the room sees.
 */

import { z } from "zod";

export const OPP_SCOPES = ["underlay_circuits", "sd_wan", "sse", "sase", "managed_service"] as const;
export type OppScope = (typeof OPP_SCOPES)[number];

export const OPP_SCOPE_LABELS: Record<OppScope, string> = {
  underlay_circuits: "Underlay circuits",
  sd_wan: "SD-WAN",
  sse: "SSE",
  sase: "Full SASE",
  managed_service: "Managed service",
};

export const PricingSchema = z.object({
  model: z.enum(["per_site_monthly", "per_user_monthly", "total_monthly", "one_off", "indicative"]).default("indicative"),
  amount: z.number().nonnegative().nullable().default(null),
  currency: z.string().default("GBP"),
  unit_note: z.string().default(""),
  notes: z.string().default(""),
}).strict();
export type Pricing = z.infer<typeof PricingSchema>;

export const FEED_TYPES = ["post", "comment", "pricing", "interest", "decline", "award", "closed"] as const;
export type FeedType = (typeof FEED_TYPES)[number];

export const FeedItemSchema = z.object({
  id: z.string(),
  actor_type: z.enum(["buyer", "supplier"]),
  actor_slug: z.string().nullable().default(null),
  actor_name: z.string(),
  type: z.enum(FEED_TYPES).default("comment"),
  body: z.string().default(""),
  pricing: PricingSchema.nullable().default(null),
  created: z.number(),
}).strict();
export type FeedItem = z.infer<typeof FeedItemSchema>;

export const OPP_STATUSES = ["open", "closed", "awarded"] as const;
export type OppStatus = (typeof OPP_STATUSES)[number];

/**
 * Engagement type. A quote_room is the conversational live room (post a need,
 * suppliers reply with comments and quotes). An auction is competitive: bids
 * are ranked, and a timed auction closes on a deadline.
 */
export const ENGAGEMENT_TYPES = ["quote_room", "auction"] as const;
export type EngagementType = (typeof ENGAGEMENT_TYPES)[number];

export const AUCTION_FORMATS = ["open", "timed"] as const;
export type AuctionFormat = (typeof AUCTION_FORMATS)[number];

/** open = any verified vendor matching scope may bid; invited = only invited slugs. */
export const ELIGIBILITY_TYPES = ["open", "invited"] as const;
export type Eligibility = (typeof ELIGIBILITY_TYPES)[number];

/** public = listed on the crawlable board; unlisted = reachable only by token. */
export const VISIBILITY_TYPES = ["public", "unlisted"] as const;
export type Visibility = (typeof VISIBILITY_TYPES)[number];

export const OpportunitySchema = z.object({
  id: z.string(),
  created: z.number(),
  updated: z.number(),
  buyer_org: z.string().default(""),
  title: z.string().min(1),
  scope: z.array(z.enum(OPP_SCOPES)).min(1),
  sites: z.number().int().nullable().default(null),
  regions: z.array(z.string()).default([]),
  summary: z.string().default(""),
  budget_note: z.string().default(""),
  timeline_note: z.string().default(""),
  status: z.enum(OPP_STATUSES).default("open"),
  // Engagement model. Defaults preserve the original quote-room behaviour.
  engagement_type: z.enum(ENGAGEMENT_TYPES).default("quote_room"),
  auction_format: z.enum(AUCTION_FORMATS).default("open"),
  deadline: z.number().nullable().default(null), // epoch ms; set for timed auctions
  eligibility: z.enum(ELIGIBILITY_TYPES).default("invited"),
  visibility: z.enum(VISIBILITY_TYPES).default("public"),
  awarded_vendor_slug: z.string().nullable().default(null),
  buyer_token: z.string(),       // buyer manage token
  invited: z.array(z.string()).default([]),  // vendor slugs invited
  feed: z.array(FeedItemSchema).default([]),
}).strict();
export type Opportunity = z.infer<typeof OpportunitySchema>;

/**
 * Public projection of an opportunity for the crawlable board and agent reads.
 * The need is public; commercial pricing amounts stay buyer-only. We expose
 * that bids exist and how many, never the figures.
 */
export type PublicOpportunity = {
  id: string;
  created: number;
  updated: number;
  buyer_org: string;
  title: string;
  scope: OppScope[];
  sites: number | null;
  regions: string[];
  summary: string;
  budget_note: string;
  timeline_note: string;
  status: OppStatus;
  engagement_type: EngagementType;
  auction_format: AuctionFormat;
  deadline: number | null;
  eligibility: Eligibility;
  invited_count: number;
  bid_count: number;       // number of pricing submissions, no amounts
  comment_count: number;
  last_activity: number;
};

/** Strip an opportunity to its public projection (no pricing amounts, no tokens). */
export function toPublicOpportunity(o: Opportunity): PublicOpportunity {
  const bids = o.feed.filter((f) => f.type === "pricing").length;
  const comments = o.feed.filter((f) => f.type === "comment").length;
  const last = o.feed.reduce((m, f) => Math.max(m, f.created), o.updated);
  return {
    id: o.id,
    created: o.created,
    updated: o.updated,
    buyer_org: o.buyer_org,
    title: o.title,
    scope: o.scope,
    sites: o.sites,
    regions: o.regions,
    summary: o.summary,
    budget_note: o.budget_note,
    timeline_note: o.timeline_note,
    status: o.status,
    engagement_type: o.engagement_type,
    auction_format: o.auction_format,
    deadline: o.deadline,
    eligibility: o.eligibility,
    invited_count: o.invited.length,
    bid_count: bids,
    comment_count: comments,
    last_activity: last,
  };
}
