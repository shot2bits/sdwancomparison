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
  awarded_vendor_slug: z.string().nullable().default(null),
  buyer_token: z.string(),       // buyer manage token
  invited: z.array(z.string()).default([]),  // vendor slugs invited
  feed: z.array(FeedItemSchema).default([]),
}).strict();
export type Opportunity = z.infer<typeof OpportunitySchema>;
