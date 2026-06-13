/**
 * RFP entity model. Client-safe: pure types and Zod schemas, no Node imports.
 * Shared by the store, the API routes, the agent and the UIs.
 */

import { z } from "zod";

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
  answers: z.record(z.string(), z.string()).default({}), // question id -> response
  submitted: z.number().nullable().default(null),
  created: z.number(),
}).strict();
export type RfpResponse = z.infer<typeof RfpResponseSchema>;
