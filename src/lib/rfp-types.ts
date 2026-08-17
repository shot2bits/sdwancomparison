/**
 * RFP entity model. Client-safe: pure types and Zod schemas, no Node imports.
 * Shared by the store, the API routes, the agent and the UIs.
 */

import { z } from "zod";
import { SecurityRequirementInputSchema, SecurityScopeVerdictSchema } from "@/lib/security/rulebook";
import { UnderstandingSchema } from "@/lib/workspace/understanding";
import { SourceLedgerEntrySchema } from "@/lib/workspace/source-ledger";
import { DecisionLedgerEntrySchema } from "@/lib/workspace/decision-ledger";

// "not_stated" is a value, not a gap to fill (Robert's intake-truth ruling,
// 28 Jul 2026): the Demand Index reported 96 per cent Full SASE because this
// schema defaulted the field, and the platform publishes that index with a
// suggested citation. A guess must never be recorded as a fact; unstated
// records as unstated everywhere, and the question engine may still work to
// full-coverage as an internal assumption without writing it down.
export const PRODUCT_SCOPES = ["not_stated", "full_sase", "sse_only", "sdwan_only", "single_vendor_sase", "best_of_breed"] as const;
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
  product_scope: z.enum(PRODUCT_SCOPES).default("not_stated"),
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

/* ------------------------------------------------------------------ */
/* Procurement engine layer (Phase B step 1, 21 July 2026).            */
/* The Project is the RFP record promoted to a constitutional object:  */
/* engine label, immutable verdict artefacts, append-only history and  */
/* an explicit consent ledger. All fields optional/defaulted so every  */
/* existing record validates unchanged (spec 1.2).                     */
/* ------------------------------------------------------------------ */

export const ENGINE_IDS = ["security_sourcing"] as const;
export type EngineId = (typeof ENGINE_IDS)[number];

export const PROJECT_PHASE = [
  "scoping", "scoped", "drafting", "drafted", "published", "qa",
  "evaluation", "awarded", "transacting", "complete", "closed",
] as const;
export type ProjectPhase = (typeof PROJECT_PHASE)[number];

/** Immutable verdict artefact: stored verbatim, versioned, never edited.
 *  Re-scoping appends the next version (Articles 3 and 9). */
export const ProjectVerdictSchema = z.object({
  version: z.number().int().min(1),
  verdict: SecurityScopeVerdictSchema, // Project Foundation Piece 2 (7 Aug 2026):
  // was z.unknown(); the two remaining untyped engine_data leaves are now the
  // real runtime schema (rulebook.ts). engine_data itself stays optional on
  // ProjectDetailsSchema below - this only validates it WHEN present.
  input_digest: z.string(),      // provable identity of the input (Article 3)
  created_at: z.number(),
  via: z.enum(["web", "mcp", "handoff"]),
}).strict();
export type ProjectVerdict = z.infer<typeof ProjectVerdictSchema>;

/** One generated-document version (Phase B step 3): a snapshot of the
 *  sections the adapter produced from a verdict, so every generation
 *  remains recoverable (Article 9; acceptance check 8). The live,
 *  editable document stays rfp_sections; snapshots are the Record. */
export const ProjectArtefactSchema = z.object({
  version: z.number().int().min(1),
  kind: z.literal("rfp_sections"),
  input_digest: z.string(),      // the verdict digest this was generated from
  created_at: z.number(),
  via: z.enum(["web", "mcp", "handoff"]),
  sections_snapshot: z.array(RfpSectionSchema),
}).strict();
export type ProjectArtefact = z.infer<typeof ProjectArtefactSchema>;

export const ProjectEngineDataSchema = z.object({
  verdicts: z.array(ProjectVerdictSchema).default([]),
  requirement: SecurityRequirementInputSchema.optional(), // engine input as last submitted; was z.unknown().optional()
  artefacts: z.array(ProjectArtefactSchema).default([]),
}).strict();
export type ProjectEngineData = z.infer<typeof ProjectEngineDataSchema>;

/** One human sign-off request (D5, approval lite): request, decide,
 *  record. Named "signoff" in code because rfp:{id}:approvals and
 *  listApprovals already belong to the agent proposal queue (deal room
 *  slice 1); the buyer-facing wording remains "approval". Lives in the
 *  rfp:{id}:signoffs sub-collection (never phase or history); the token
 *  is the approver's purpose-scoped credential: read the document and
 *  decide, nothing else. */
export const ProjectSignoffSchema = z.object({
  token: z.string(),
  name: z.string(),
  role: z.string(),           // free text: "CISO", "Legal"
  email: z.string(),
  requested_at: z.number(),
  decided_at: z.number().optional(),
  decision: z.enum(["approved", "declined"]).optional(),
  note: z.string().optional(),
}).strict();
export type ProjectSignoff = z.infer<typeof ProjectSignoffSchema>;

/** One append-only history entry. detail never carries private figures
 *  (Article 15); consent-bearing events set consent: true (Article 13). */
export const ProjectHistoryEventSchema = z.object({
  at: z.number(),
  actor: z.enum(["buyer", "assistant", "supplier", "netify", "system"]),
  actor_ref: z.string().default(""),
  via: z.enum(["web", "mcp", "admin", "cron", "system"]),
  event: z.string(),             // dot-namespaced, spec 1.6
  detail: z.record(z.string(), z.unknown()).default({}),
  consent: z.boolean().optional(),
}).strict();
export type ProjectHistoryEvent = z.infer<typeof ProjectHistoryEventSchema>;

/** The consent ledger: what was agreed, by whom, via which client, with
 *  the consent line shown recorded verbatim (Article 13). */
export const ProjectConsentSchema = z.object({
  at: z.number(),
  action: z.string(),            // e.g. "create", "publish"
  granted_by: z.string(),        // buyer email
  via: z.enum(["web", "mcp"]),
  text: z.string(),              // the exact consent wording shown
}).strict();
export type ProjectConsent = z.infer<typeof ProjectConsentSchema>;

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
  // Procurement engine layer (Phase B step 1): optional on every record so
  // pre-engine projects validate unchanged; absent means pre-engine.
  engine: z.enum(ENGINE_IDS).optional(),
  engine_data: ProjectEngineDataSchema.optional(),
  /**
   * Milestone 3 (9 Aug 2026), corrected the same day after an architecture
   * check: the canonical, engine-INDEPENDENT expression of buyer intent —
   * objective, drivers, estate, geography, timescale, existing suppliers,
   * vendors under consideration, technologies, constraints and bespoke
   * requirements, each with provenance, plus a deterministic completeness
   * read. Explicitly NOT under `engine_data`: `engine_data` was scoped in
   * Project Foundation Piece 2 as engine-OWNED data. Its WRITE path is
   * strictly gated on `engine === "security_sourcing"`
   * (assertEngineArtefactsIntact throws otherwise); a second, exhaustive
   * pass over every read site (9 Aug 2026) found two call sites that read
   * `engine_data` without that literal runtime check — project-story.ts and
   * market-report.ts — but both consume it exclusively as security_sourcing-
   * shaped content (a hard cast to SecurityScopeVerdict; a comment naming it
   * "the security engine's stated estate"). No generic or engine-independent
   * data has ever been stored under `engine_data` anywhere in the codebase,
   * gated or not — which is why Understanding, a genuinely engine-
   * independent concept, does not belong there even before this file's
   * write gate is considered. See openSecurityGaps and project-health.ts for
   * further engine === "security_sourcing" reads, and
   * the Project/Understanding/projections architecture (docs/netify-
   * project-and-projections-DRAFT-2026-08-03.md) treats Understanding as
   * canonical Project-level state that engines and other artefacts (SoR,
   * RFI, RFP) are PROJECTIONS derived from, not something any one engine
   * owns. Sits here at the same level as `engine_data`, `phase` and
   * `history` — every existing record without it validates unchanged. */
  understanding: UnderstandingSchema.optional(),
  /**
   * Fact Ledger Reliability Gate, FOURTH amendment (13 Aug 2026): the
   * canonical, structured, immutable log of the buyer's own verbatim
   * wording — every entry keeps its own stable id, timestamp, exact text
   * and input channel (typed / paste / drop). See source-ledger.ts for
   * the full rationale. Sits at this same top level, alongside
   * `understanding`, for the identical reason that field does: it is
   * engine-independent Project state, not something any one engine owns,
   * so it is never nested under `engine_data` (whose write path is
   * gated to authorised engine writers only — this field is not, since
   * every save/create/re-scope path across every engine needs to append
   * to it). `buyer.notes` may still carry a human-readable PROJECTION
   * built from this ledger (extract.ts's notesWithSourceTurns), but this
   * field — never notes — is the durable store a future Canvas compiler
   * or any other reader should walk. Defaults to an empty array so every
   * record from before this amendment validates unchanged. Entries are
   * appended only (mergeSourceLedger): nothing here is ever edited or
   * removed by any write path in this codebase.
   */
  source_ledger: z.array(SourceLedgerEntrySchema).default([]),
  /**
   * Living Procurement UK Decision-Maker Blueprint, correction pass
   * (Robert, 15 Aug 2026), defects 3 and 4: the canonical, structured,
   * immutable log of every NextQuestion card the buyer has actually
   * resolved -- answered (items/note), dismissed, or a sector suggestion
   * declined/accepted. Sits at this same top level, alongside
   * `source_ledger`, for the identical reason: engine-independent Project
   * state that every save/re-scope path needs to append to, not gated by
   * `engine_data`'s authorised-writer invariants. See
   * workspace/decision-ledger.ts for the full rationale, the merge rule
   * (mergeDecisionLedger, identical accretion-only semantics to
   * mergeSourceLedger) and the replay/resume functions
   * (replayDecisionLedger, resumeDecisionsFromProject). Defaults to an
   * empty array so every record from before this correction pass validates
   * unchanged.
   */
  decision_ledger: z.array(DecisionLedgerEntrySchema).default([]),
  phase: z.enum(PROJECT_PHASE).optional(),
  history: z.array(ProjectHistoryEventSchema).default([]),
  consents: z.array(ProjectConsentSchema).default([]),
  // The automatic business verification evidence (Robert's Ruling Two,
  // 29 Jul 2026): recorded at the publish click, private to the record and
  // the internal list, never in any public projection. Optional so every
  // pre-ruling record validates unchanged. Loose object rather than a
  // duplicated shape: verify-business.ts owns the structure.
  business_verification: z.record(z.string(), z.unknown()).optional(),
  /** Integration-test record (spec 1.7): expires in two hours, sends no
   *  emails, joins no buyer index or moderation queue, and is excluded
   *  from telemetry funnels. */
  test: z.boolean().optional(),
  /**
   * 2030 blueprint, Checkpoint B (17 Aug 2026): the canonical envelope's
   * OWN schema version -- distinct from `methodology_version` (the
   * question-methodology matrix's version) and from `PublishedSnapshot`'s
   * `compiler_version` (an alias of `methodology_version`, see that
   * file's scope note). This one field versions the SHAPE of
   * `ProjectDetails` itself, so a future breaking change to this record
   * (a field renamed, restructured, or made mandatory) has a formal,
   * checkable migration boundary instead of ad hoc self-repair scattered
   * across read paths (the pre-existing pattern: `healSectionCategories`
   * in rfp-store.ts silently fixes one known corruption on every read,
   * with no version check at all -- undiscoverable and unbounded, since
   * nothing marks which records still need it once fixed).
   * `migrateProjectDetails()` (rfp-store.ts) is the single place that
   * reads this field and brings an older record up to
   * `CURRENT_ENVELOPE_SCHEMA_VERSION`. Optional so every record written
   * before this field existed still validates unchanged; `getProject()`
   * treats a missing value as version 1 (the version every record before
   * this change is retroactively defined to be, since none of them have
   * ever needed a real structural migration yet) and stamps the current
   * version on next save via `saveProject()`.
   */
  envelope_schema_version: z.number().int().min(1).optional(),
}).strict();
export type ProjectDetails = z.infer<typeof ProjectDetailsSchema>;

/**
 * The canonical envelope's current schema version. Bump this, and add a
 * step to `migrateProjectDetails()` (rfp-store.ts), the day a change to
 * `ProjectDetailsSchema` is genuinely structural (a field renamed, a shape
 * changed, a previously-optional field now required in practice) rather
 * than the routine, backward-compatible additive change every field in
 * this schema has been so far (each new field arrives `.optional()` or
 * `.default(...)`, which is why this constant has never needed to move
 * past 1 yet -- this file's own history is the proof: every dated comment
 * above added a field without breaking an existing record).
 */
export const CURRENT_ENVELOPE_SCHEMA_VERSION = 1;

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

This agreement is between the buyer organisation that issued this RFP ("Discloser") and the responding vendor organisation ("Recipient"), together the "Parties".

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
  // Piece 3B-2 (9 Aug 2026): matched at creation, same convention as
  // RfpResponseSchema.vendor_slug and NdaAcceptanceSchema.vendor_slug —
  // added so a thread's owning vendor can be checked deterministically at
  // read time instead of re-running fuzzy matchVendorSlug() on every GET.
  vendor_slug: z.string().nullable().default(null),
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
