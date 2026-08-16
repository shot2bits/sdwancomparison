/**
 * Opportunity / project notice: a buyer publishes a structured project notice
 * (procurement-notice style) describing a need, from underlay circuits to full
 * SASE. Suppliers browse in the clear and sign in to respond. Each opportunity
 * also carries the live activity feed ("room") for comments and pricing.
 *
 * Backwards compatibility: every field added for the project-notice model has
 * a zod default, so opportunities stored before the notice rebuild still parse.
 */

import { z } from "zod";
import { noticeDisplayTitle } from "@/lib/notice-title";
import { siteBandLabelFor, siteFigureIsIdentifying } from "@/lib/notice-options";

export const OPP_SCOPES = [
  "underlay_circuits",
  "sd_wan",
  "sse",
  "sase",
  "managed_service",
  "firewall_fwaas",
  "ztna",
  "swg",
  "casb",
  "connectivity",
  "managed_security",
  "not_sure",
] as const;
export type OppScope = (typeof OPP_SCOPES)[number];

export const OPP_SCOPE_LABELS: Record<OppScope, string> = {
  underlay_circuits: "Underlay circuits",
  sd_wan: "SD-WAN",
  sse: "SSE",
  sase: "Full SASE",
  managed_service: "Managed service",
  firewall_fwaas: "Firewall / FWaaS",
  ztna: "ZTNA",
  swg: "Secure web gateway",
  casb: "CASB",
  connectivity: "Connectivity",
  managed_security: "Managed security",
  not_sure: "Not sure yet",
};

export const PricingSchema = z.object({
  model: z.enum(["per_site_monthly", "per_user_monthly", "total_monthly", "one_off", "indicative"]).default("indicative"),
  amount: z.number().nonnegative().nullable().default(null),
  currency: z.string().default("GBP"),
  unit_note: z.string().default(""),
  notes: z.string().default(""),
}).strict();
export type Pricing = z.infer<typeof PricingSchema>;

// "introduction" (29 Jul 2026, Robert's E4 ruling): the buyer's acceptance
// of an introduction to one supplier, recorded append-only on the feed.
// Visible only to the buyer and the introduced supplier (maskedFeed drops
// it for everyone else); contact details pass on this event and never
// before it.
export const FEED_TYPES = ["post", "comment", "pricing", "interest", "decline", "award", "closed", "response", "question", "introduction"] as const;
export type FeedType = (typeof FEED_TYPES)[number];

export const FeedItemSchema = z.object({
  id: z.string(),
  actor_type: z.enum(["buyer", "supplier"]),
  actor_slug: z.string().nullable().default(null),
  actor_name: z.string(),
  type: z.enum(FEED_TYPES).default("comment"),
  body: z.string().default(""),
  pricing: PricingSchema.nullable().default(null),
  // Evidence links (URLs to case studies, SLA schedules, certifications…).
  // URL-based rather than uploads: no blob storage needed, and buyers can
  // verify sources. Defaulted for pre-existing feed items.
  links: z.array(z.string()).default([]),
  // Structured response answers: evidence-request key (see notice-options
  // EVIDENCE_OPTIONS) or free label → the supplier's answer text. Used by
  // the "response" feed type; empty for everything else.
  answers: z.record(z.string(), z.string()).default({}),
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

/**
 * What the buyer is asking suppliers for. Presentation-level intent that sits
 * on top of the engagement mechanics (quote_room / auction feeds).
 */
export const RESPONSE_MODES = [
  "indicative_pricing",
  "discovery_calls",
  "written_responses",
  "quote_room",
  "reverse_auction",
  "shortlist",
  "full_rfp",
] as const;
export type ResponseMode = (typeof RESPONSE_MODES)[number];

export const RESPONSE_MODE_LABELS: Record<ResponseMode, string> = {
  indicative_pricing: "Indicative pricing",
  discovery_calls: "Discovery calls",
  written_responses: "Written responses",
  quote_room: "Quote room",
  reverse_auction: "Reverse auction",
  shortlist: "Netify-assisted shortlist",
  full_rfp: "Full RFP responses",
};

/** open = any verified vendor matching scope may bid; invited = only invited slugs. */
export const ELIGIBILITY_TYPES = ["open", "invited"] as const;
export type Eligibility = (typeof ELIGIBILITY_TYPES)[number];

/** public = listed on the crawlable board; unlisted = reachable only by token. */
export const VISIBILITY_TYPES = ["public", "unlisted"] as const;
export type Visibility = (typeof VISIBILITY_TYPES)[number];

/** named = buyer organisation shown publicly; anonymous = sector/size shown, name withheld. */
export const BUYER_VISIBILITY_TYPES = ["named", "anonymous"] as const;
export type BuyerVisibility = (typeof BUYER_VISIBILITY_TYPES)[number];

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
  // When the notice left the open state (epoch ms). Closed notices stay
  // published forever (Robert's ruling, 28 Jul 2026): the public record
  // needs the date the market question ended, not just that it did. Set at
  // the close and award writes; null on open notices and on notices closed
  // before this field existed (the projection falls back to updated).
  closed_at: z.number().nullable().default(null),
  // Engagement model. Defaults preserve the original quote-room behaviour.
  engagement_type: z.enum(ENGAGEMENT_TYPES).default("quote_room"),
  auction_format: z.enum(AUCTION_FORMATS).default("open"),
  deadline: z.number().nullable().default(null), // epoch ms; set for timed auctions
  eligibility: z.enum(ELIGIBILITY_TYPES).default("invited"),
  visibility: z.enum(VISIBILITY_TYPES).default("public"),
  awarded_vendor_slug: z.string().nullable().default(null),
  buyer_token: z.string(),       // buyer manage token
  invited: z.array(z.string()).default([]),  // vendor slugs invited
  // Vendor slugs the buyer has accepted an introduction with (Robert's E4
  // ruling, 29 Jul 2026): contact details pass to a supplier only after
  // the buyer accepts, and never before. The queryable state; the feed's
  // "introduction" item is the append-only record of each acceptance.
  // Never in any public projection.
  introduced: z.array(z.string()).default([]),
  feed: z.array(FeedItemSchema).default([]),

  /* --- Project notice fields (2026 marketplace rebuild). All defaulted. --- */
  buyer_visibility: z.enum(BUYER_VISIBILITY_TYPES).default("named"),
  buyer_sector: z.string().default(""),
  buyer_size_band: z.string().default(""),
  users_band: z.string().default(""),
  remote_users_band: z.string().default(""),
  cloud_platforms: z.array(z.string()).default([]),
  current_environment: z.string().default(""),
  desired_outcomes: z.string().default(""),
  compliance_requirements: z.array(z.string()).default([]),
  evidence_requested: z.array(z.string()).default([]),
  evaluation_priorities: z.array(z.string()).default([]),
  response_mode: z.enum(RESPONSE_MODES).default("quote_room"),
  response_deadline: z.number().nullable().default(null),   // epoch ms
  decision_target: z.number().nullable().default(null),     // epoch ms
  go_live_target: z.number().nullable().default(null),      // epoch ms
  ai_summary: z.string().default(""),
  ai_assumptions: z.array(z.string()).default([]),
  ai_gap_flags: z.array(z.string()).default([]),
  methodology_version: z.string().default(""),
  // The published instrument's true shape (Robert's R8 ruling on Harry's
  // Section 1, 28 Jul 2026: the notice showed no requirement content at
  // all). Section titles and question counts only, never the questions:
  // the full set opens to participating suppliers. Null on notices that
  // carry no document.
  rfp_shape: z.object({
    version: z.string().default(""),
    total: z.number().int().min(0),
    sections: z.array(z.object({ title: z.string(), questions: z.number().int().min(0) })),
  }).nullable().default(null),
  owner_email: z.string().default(""), // publishing account (private, never in public projection)
  // When the notice was auto-listed from a published full RFP, the source RFP
  // id. Public flag only ("this buyer issued a full RFP"); the RFP's private
  // respond link is never exposed here.
  source_rfp_id: z.string().default(""),
  // Market-unlock correction round 2 (16 Aug 2026), requirement 3: the exact
  // FrozenRevision (published-snapshot.ts) this listing is bound to. Set the
  // moment the Opportunity is created/refreshed FROM a publish attempt (see
  // rfp-publish.ts's saga, step C), never editable afterwards by any other
  // path. This is what commitMarketUnlock()'s integrity check
  // (market-unlock.ts) verifies against -- "the Opportunity is bound to that
  // exact revision" -- rather than trusting a caller-supplied claim. Private:
  // never exposed on PublicOpportunity/toPublicOpportunity below.
  source_published_revision_id: z.string().default(""),
}).strict();
export type Opportunity = z.infer<typeof OpportunitySchema>;

/**
 * Public projection of an opportunity for the crawlable board, the public
 * notice page, data.json feeds and agent reads. The need is public; commercial
 * pricing amounts, contact details, buyer tokens and (for anonymous notices)
 * the buyer name stay private. We expose that bids exist and how many, never
 * the figures.
 */
export type PublicOpportunity = {
  id: string;
  created: number;
  updated: number;
  buyer_org: string;
  title: string;
  scope: OppScope[];
  // Exact unless identifying (Robert's ruling, revised 29 Jul 2026): the
  // exact count shows publicly unless the identifying combination holds
  // (anonymous buyer + stated sector + single region, see
  // siteFigureIsIdentifying); then sites is null here and site_band carries
  // the public figure. One face at a time: when sites is present, site_band
  // is null, and vice versa.
  sites: number | null;
  site_band?: string | null; // public band label, e.g. "51–200 sites", only when the identifying combination holds (optional: sample fixtures omit it)
  regions: string[];
  summary: string;
  budget_note: string;
  timeline_note: string;
  status: OppStatus;
  // When the notice left the open state (epoch ms). Null while open. For
  // notices closed before closed_at existed, the projection reports the
  // record's last update, which for an archived notice is the close write.
  closed_at?: number | null; // optional: sample fixtures omit it
  engagement_type: EngagementType;
  auction_format: AuctionFormat;
  deadline: number | null;
  eligibility: Eligibility;
  invited_count: number;
  bid_count: number;       // number of pricing submissions, no amounts
  comment_count: number;
  last_activity: number;
  // Project notice fields
  buyer_visibility: BuyerVisibility;
  buyer_sector: string;
  buyer_size_band: string;
  users_band: string;
  remote_users_band: string;
  cloud_platforms: string[];
  current_environment: string;
  desired_outcomes: string;
  compliance_requirements: string[];
  evidence_requested: string[];
  evaluation_priorities: string[];
  response_mode: ResponseMode;
  response_deadline: number | null;
  decision_target: number | null;
  go_live_target: number | null;
  ai_summary: string;
  ai_assumptions: string[];
  ai_gap_flags: string[];
  methodology_version: string;
  rfp_shape?: { version: string; total: number; sections: Array<{ title: string; questions: number }> } | null; // optional: sample fixtures omit it
  has_full_rfp?: boolean; // true when this notice was listed from a published full RFP (optional: sample fixtures omit it)
};

/** Strip an opportunity to its public projection (no pricing amounts, no tokens, no contact). */
export function toPublicOpportunity(o: Opportunity): PublicOpportunity {
  const bids = o.feed.filter((f) => f.type === "pricing").length;
  const comments = o.feed.filter((f) => f.type === "comment").length;
  const last = o.feed.reduce((m, f) => Math.max(m, f.created), o.updated);
  return {
    id: o.id,
    created: o.created,
    updated: o.updated,
    // Anonymous notices never leak the organisation name to any public surface.
    buyer_org: o.buyer_visibility === "anonymous" ? "" : o.buyer_org,
    // Display title, derived when the stored title carries no information
    // ("Untitled SASE / SD-WAN RFP", the F1 numeric-sector artefact). One
    // application point so every public client renders the same word
    // (Article 17); the stored title itself is never rewritten.
    title: noticeDisplayTitle(o),
    scope: o.scope,
    // Exact unless identifying (Robert's ruling, 29 Jul 2026): the exact
    // count is public by default; the band replaces it only when the
    // identifying combination holds. Exact figures always remain with the
    // buyer's own face and participating suppliers.
    sites: siteFigureIsIdentifying(o) ? null : o.sites,
    site_band: siteFigureIsIdentifying(o) ? siteBandLabelFor(o.sites) : null,
    regions: o.regions,
    summary: o.summary,
    budget_note: o.budget_note,
    timeline_note: o.timeline_note,
    status: o.status,
    // Open notices carry null; closed and awarded notices carry the close
    // moment, falling back to the record's last update for notices closed
    // before closed_at existed (that update was the close write).
    closed_at: o.status === "open" ? null : (o.closed_at ?? o.updated),
    engagement_type: o.engagement_type,
    auction_format: o.auction_format,
    deadline: o.deadline,
    eligibility: o.eligibility,
    invited_count: o.invited.length,
    bid_count: bids,
    comment_count: comments,
    last_activity: last,
    buyer_visibility: o.buyer_visibility,
    buyer_sector: o.buyer_sector,
    buyer_size_band: o.buyer_size_band,
    users_band: o.users_band,
    remote_users_band: o.remote_users_band,
    cloud_platforms: o.cloud_platforms,
    current_environment: o.current_environment,
    desired_outcomes: o.desired_outcomes,
    compliance_requirements: o.compliance_requirements,
    evidence_requested: o.evidence_requested,
    evaluation_priorities: o.evaluation_priorities,
    response_mode: o.response_mode,
    response_deadline: o.response_deadline,
    decision_target: o.decision_target,
    go_live_target: o.go_live_target,
    ai_summary: o.ai_summary,
    ai_assumptions: o.ai_assumptions,
    ai_gap_flags: o.ai_gap_flags,
    methodology_version: o.methodology_version,
    rfp_shape: o.rfp_shape ?? null,
    has_full_rfp: Boolean(o.source_rfp_id),
  };
}
