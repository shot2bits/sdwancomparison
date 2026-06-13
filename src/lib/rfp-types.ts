/**
 * RFP entity model. Client-safe: pure types and Zod schemas, no Node imports.
 * Shared by the store, the API routes, the agent and the UIs.
 */

import { z } from "zod";

export const PRODUCT_SCOPES = ["full_sase", "sse_only", "sdwan_only", "single_vendor_sase", "best_of_breed"] as const;
export type ProductScope = (typeof PRODUCT_SCOPES)[number];

export const RFP_STATUSES = ["draft", "review", "published", "qa", "evaluation"] as const;
export type RfpStatus = (typeof RFP_STATUSES)[number];

/** A single question inside a section, traceable to a methodology feature. */
export const RfpQuestionSchema = z.object({
  id: z.string(),
  feature_id: z.string(),
  text: z.string().min(1),
  evidence_requested: z.string().default(""),
  rationale: z.string().default(""), // why this question is here (the citation)
  priority: z.enum(["required", "recommended", "optional"]).default("recommended"),
  source: z.enum(["methodology", "custom"]).default("methodology"),
  mandatory: z.boolean().default(false), // buyer flags a hard requirement
  weight: z.number().int().min(1).max(5).default(3), // evaluation weighting
}).strict();
export type RfpQuestion = z.infer<typeof RfpQuestionSchema>;

/** One methodology category as an RFP section. */
export const RfpSectionSchema = z.object({
  category: z.string(),
  included: z.boolean().default(true),
  questions: z.array(RfpQuestionSchema).default([]),
}).strict();
export type RfpSection = z.infer<typeof RfpSectionSchema>;

export const BuyerContextSchema = z.object({
  organisation: z.string().default(""),
  sector: z.string().nullable().default(null),
  organisation_size: z.string().default("any"),
  site_count: z.number().int().nullable().default(null),
  regions: z.array(z.string()).default([]),
  compliance: z.array(z.string()).default([]),
  operating_model: z.string().default("any"),
  product_scope: z.enum(PRODUCT_SCOPES).default("full_sase"),
  notes: z.string().default(""),
}).strict();
export type BuyerContext = z.infer<typeof BuyerContextSchema>;

export const ProjectDetailsSchema = z.object({
  id: z.string(),
  created: z.number(),
  updated: z.number(),
  status: z.enum(RFP_STATUSES).default("draft"),
  title: z.string().default("Untitled SASE / SD-WAN RFP"),
  buyer: BuyerContextSchema,
  rfp_sections: z.array(RfpSectionSchema).default([]),
  invited_vendors: z.array(z.string()).default([]),
  share_token: z.string(), // suppliers use this to view and respond
  methodology_version: z.string().default("2026.1"),
}).strict();
export type ProjectDetails = z.infer<typeof ProjectDetailsSchema>;

/** Supplier clarification thread (the Q&A loop). */
export const RfpThreadSchema = z.object({
  id: z.string(),
  rfp_id: z.string(),
  vendor: z.string().min(1),
  category: z.enum(["technical", "commercial", "timeline", "scope", "other"]).default("other"),
  question: z.string().min(1),
  status: z.enum(["open", "answered"]).default("open"),
  buyer_answer: z.string().default(""),
  created: z.number(),
  answered: z.number().nullable().default(null),
}).strict();
export type RfpThread = z.infer<typeof RfpThreadSchema>;

/** A supplier's response to the RFP questions. */
export const RfpResponseSchema = z.object({
  id: z.string(),
  rfp_id: z.string(),
  vendor: z.string().min(1),
  vendor_slug: z.string().nullable().default(null), // matched Netify matrix vendor
  answers: z.record(z.string(), z.string()).default({}), // question id -> response
  submitted: z.number().nullable().default(null),
  created: z.number(),
}).strict();
export type RfpResponse = z.infer<typeof RfpResponseSchema>;

/* ------------------------------------------------------------------ */
/* Two-sided marketplace: buyer <-> supplier connections and messaging */
/* ------------------------------------------------------------------ */

export const MESSAGE_TYPES = [
  "intro",            // buyer's opening message on invite
  "message",          // free-text either side
  "demo_request",     // buyer asks for a demo
  "demo_response",    // supplier proposes demo details
  "contact_request",  // buyer asks for contact details
  "contact_share",    // supplier shares contact details (payload)
  "decline",          // either side declines
] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const ConnectionMessageSchema = z.object({
  id: z.string(),
  from: z.enum(["buyer", "supplier"]),
  type: z.enum(MESSAGE_TYPES).default("message"),
  body: z.string().default(""),
  payload: z.record(z.string(), z.string()).default({}), // contact details, demo slots, etc.
  created: z.number(),
  read: z.boolean().default(false),
}).strict();
export type ConnectionMessage = z.infer<typeof ConnectionMessageSchema>;

export const CONNECTION_STATUSES = ["invited", "engaged", "demo_requested", "contact_shared", "declined"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const SupplierConnectionSchema = z.object({
  id: z.string(),
  rfp_id: z.string(),
  vendor_slug: z.string(),       // ties the supplier to the graded vendor directory
  vendor_name: z.string(),
  token: z.string(),             // per-connection supplier access token
  status: z.enum(CONNECTION_STATUSES).default("invited"),
  messages: z.array(ConnectionMessageSchema).default([]),
  created: z.number(),
  updated: z.number(),
}).strict();
export type SupplierConnection = z.infer<typeof SupplierConnectionSchema>;
