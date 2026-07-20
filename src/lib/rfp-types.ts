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
  source: z.enum(["methodology", "custom", "bank"]).default("methodology"),
  buyer_lens: z.string().default(""),
  supplier_lens: z.string().default(""),
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
  /** Vendors the buyer named for evaluation (?vendors= prefill). Pinned
   *  into the publish invite list; validated against dataset slugs, max 5. */
  pinned_vendors: z.array(z.string()).default([]),
  notes: z.string().default(""),
}).strict();
export type BuyerContext = z.infer<typeof BuyerContextSchema>;

/**
 * NDA gate. When required, a supplier must record an acceptance of the buyer's
 * NDA (click-to-accept with an audit record) before the full RFP detail and the
 * response form unlock. `version` is bumped whenever the buyer changes the NDA
 * text or link, which forces suppliers to re-accept the current terms.
 */
export const NdaConfigSchema = z.object({
  required: z.boolean().default(false),
  source: z.enum(["template", "buyer"]).default("template"), // Netify standard template, or the buyer's own
  text: z.string().default(""),  // the NDA wording the supplier accepts
  link: z.string().default(""),  // optional link to the buyer's NDA document
  version: z.number().int().min(1).default(1),
  updated: z.number().default(0),
}).strict();
export type NdaConfig = z.infer<typeof NdaConfigSchema>;

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
  manage_token: z.string().default(""), // buyer/agent credential for push actions (publish, invite); held by the creator
  // Creation source (20 July 2026): segments the funnel honestly. "wizard"
  // = the UI, "mcp" = agent-created via tools, "unknown" = pre-stamp records.
  source: z.string().default("unknown"),
  owner_email: z.string().default(""), // buyer account that owns this RFP (private, never in public projection); empty for anonymous drafts
  methodology_version: z.string().default("2026.1"),
  nda: NdaConfigSchema.default({ required: false, source: "template", text: "", link: "", version: 1, updated: 0 }), // defaulted so RFPs created before NDAs still validate
  // Consent record for the wizard's submit-to-marketplace agreement: which
  // wording version the buyer agreed to and when they pressed the button.
  // Absent on drafts created before 15 July 2026 or via the review-first path.
  consent: z.object({ version: z.string(), agreed_at: z.number(), flow: z.string() }).optional(),
  // Submit intent from the wizard's agreement step, carried server-side so
  // the magic-link click completes the submission on any device. Cleared by
  // the publish core the moment it executes.
  pending_submit: z.object({
    shortlist_size: z.number().optional(),
    list_on_board: z.boolean().optional(),
    marketing_opt_in: z.boolean().optional(),
    requested_at: z.number(),
  }).optional(),
  // Response window: suppliers can respond until this time (set at submit,
  // default 14 days). The respond API enforces it; both sides see the timer.
  response_deadline: z.number().optional(),
}).strict();
export type ProjectDetails = z.infer<typeof ProjectDetailsSchema>;

/**
 * A supplier's click-to-accept of the buyer's NDA. This is the audit record:
 * who accepted (organisation + signatory + email), which NDA version, when, and
 * the request fingerprint. One acceptance per organisation per RFP (re-accepting
 * a new version overwrites the prior record, keeping the latest version).
 */
export const NdaAcceptanceSchema = z.object({
  id: z.string(),
  rfp_id: z.string(),
  vendor: z.string().min(1),                 // organisation name as the supplier entered it
  vendor_slug: z.string().nullable().default(null),
  signatory_name: z.string().min(1),         // typed name of the person accepting
  email: z.string().default(""),             // from the signed-in session, if any
  nda_version: z.number().int().min(1).default(1),
  accepted: z.number(),
  ip: z.string().default(""),
  user_agent: z.string().default(""),
}).strict();
export type NdaAcceptance = z.infer<typeof NdaAcceptanceSchema>;

/** Netify standard mutual NDA, offered to buyers who don't have their own. */
export const NETIFY_NDA_TEMPLATE = `MUTUAL NON-DISCLOSURE AGREEMENT

This agreement is between the buyer organisation that issued this RFP ("Discloser") and the responding supplier organisation ("Recipient"), together the "Parties".

1. Purpose. The Parties wish to exchange confidential information so the Recipient can assess and respond to the Discloser's SASE / SD-WAN requirement.

2. Confidential Information. Any non-public information disclosed through this RFP, including the Discloser's requirements, site and network details, commercial information, pricing and any response, whether marked confidential or not, that a reasonable person would treat as confidential.

3. Obligations. The Recipient will: (a) use the Confidential Information only to assess and respond to this RFP; (b) not disclose it to any third party except employees and professional advisers who need it and are bound by equivalent confidentiality obligations; and (c) protect it with at least the same care it uses for its own confidential information.

4. Exclusions. Obligations do not apply to information that is or becomes public through no fault of the Recipient, was lawfully known before disclosure, is independently developed, or is required to be disclosed by law (with notice to the Discloser where lawful).

5. Term. Confidentiality obligations continue for three (3) years from acceptance.

6. No licence. No intellectual property right or licence is granted by disclosure.

7. Governing law. This agreement is governed by the laws of England and Wales.

By accepting, the Recipient confirms it has authority to bind its organisation to these terms.`;

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
  // Deal room slice 1 (15 July 2026): first time the supplier opened their
  // private link (buyer sees "3 of 5 viewed"), and when the admin forwarded
  // the link during the brokered phase before supplier registration.
  viewed_at: z.number().optional(),
  forwarded_at: z.number().optional(),
}).strict();
export type SupplierConnection = z.infer<typeof SupplierConnectionSchema>;
