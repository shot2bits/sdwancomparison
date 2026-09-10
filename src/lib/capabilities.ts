import { PRICING_ROUTES } from "@/lib/pricing-routes";
/**
 * The marketplace capability catalogue: a single, agent-readable description of
 * what the tool can do, which surfaces expose it, and the exact boundary of
 * each (identity, approval, external send/execution, who may invoke it). Served
 * at /capabilities.json and used for the WebApplication featureList.
 *
 * The boundary flags exist so an AI agent can decide, from structure alone and
 * without guessing, what it may and may not do. Wording matches live behaviour:
 * read/compute is open, the agent can draft and recommend, and anything that
 * reaches a customer, supplier or BT is human-approved and never sent
 * automatically. No capability claims fully autonomous execution.
 */

import { SITE_URL } from "@/lib/structured-data";

export type Access = "open" | "identified";
export type CapabilityStatus = "live" | "planned" | "experimental";
export type HumanSupervision = "none" | "required" | "approval-gated";
export type AccessLevel = "public" | "signed-in" | "token-gated" | "admin";
export type CapabilityType =
  | "read" | "compute" | "draft" | "recommend" | "monitor"
  | "approval-gated-action" | "external-execution";

export type Capability = {
  id: string;
  title: string;
  description: string;
  access: Access;                 // legacy open|identified, kept for back-compat
  page: string | null;
  api?: string;
  mcp?: string;
  data?: string;
  // Machine-readable boundary flags:
  status: CapabilityStatus;
  capabilityType: CapabilityType;
  accessLevel: AccessLevel;
  requiresIdentity: boolean;
  requiresApproval: boolean;
  sendsExternally: boolean;        // pushes to a named customer / supplier / BT
  executesExternally: boolean;     // submits/orders against an external party or system
  invocableByExternalAgent: boolean;
  humanSupervision: HumanSupervision;
  evidence: string;                // what proves it is live
  boundaries: string;              // what it cannot do
};

export const CAPABILITIES: Capability[] = [
 {id:'circuit_pricing',title:'Request real circuit market pricing',description:'Buyer-reviewed UK and international circuit requirements, optional UK remote device protection, and Netify-entered private supplier quotes with buyer notification.',access:'identified',page:'/circuit-pricing/',api:'/api/circuits/',mcp:'netify_validate_circuit_request, netify_read_circuit_responses',status:'live',capabilityType:'approval-gated-action',accessLevel:'token-gated',requiresIdentity:true,requiresApproval:true,sendsExternally:true,executesExternally:false,invocableByExternalAgent:true,humanSupervision:'approval-gated',evidence:'Authenticated circuit request storage, anonymous Opportunity Board publication, admin quote entry and Resend notification status.',boundaries:'MCP validates without saving, or reads an owner-issued scoped token. Publication is web-only after verified buyer consent. No automatic carrier ordering or instant quote generation. CrowdStrike package and billing period must be confirmed in the quote.'},
  {
    id: "discover_vendors",
    title: "Discover and compare vendors",
    description: "Read sourced SASE, SSE and SD-WAN provider profiles, capability grades, alternatives and public named-provider comparisons.",
    access: "open", page: "https://netify.co.uk/marketplace/", mcp: "list_sase_vendors, get_sase_vendor_profile, compare_vendors, list_sase_features, verify_claim, list_exclusions, explain_shortlist", data: "/shortlist/data.json",
    status: "live", capabilityType: "read", accessLevel: "public",
    requiresIdentity: false, requiresApproval: false, sendsExternally: false, executesExternally: false,
    invocableByExternalAgent: true, humanSupervision: "none",
    evidence: "list_sase_vendors and get_sase_vendor_profile MCP tools and /shortlist/data.json return live graded vendor data.",
    boundaries: "Read-only. Does not contact any vendor or take any action.",
  },
  {
    id: "build_shortlist",
    title: "Preview aggregate provider coverage",
    description: "Preview aggregate market coverage for a sector, region, organisation size, delivery model and requirements. Public named-provider comparisons are separate; personalised matches unlock after publication.",
    access: "open", page: "/shortlist/", api: "/api/openapi/build_sase_shortlist", mcp: "build_sase_shortlist", data: "/shortlist/data.json",
    status: "live", capabilityType: "compute", accessLevel: "public",
    requiresIdentity: false, requiresApproval: false, sendsExternally: false, executesExternally: false,
    invocableByExternalAgent: true, humanSupervision: "none",
    evidence: "build_sase_shortlist (MCP and REST) returns aggregate coverage for given criteria, without personalised provider identities.",
    boundaries: "Does not return personalised rankings or contact providers. Publication and verified ownership are required to retrieve unlocked matches.",
  },
  {
    id: "build_rfp",
    title: "Build a SASE and SD-WAN RFP",
    description: "Create a Short or Detailed RFP, retain bespoke supplier questions, or start with a basic statement of requirements. Review imported RFP or RFI material before using it.",
    access: "open", page: "https://netify.co.uk/sase-sd-wan-rfp-builder/", api: "/api/rfp, /api/rfp/[id]/agent", data: "/methodology.json, /question-bank.json",
    status: "live", capabilityType: "draft", accessLevel: "public",
    requiresIdentity: false, requiresApproval: false, sendsExternally: false, executesExternally: false,
    invocableByExternalAgent: true, humanSupervision: "none",
    evidence: "/api/rfp creates an RFP; /api/rfp/[id]/agent drafts methodology-mapped questions.",
    boundaries: "Creates a private RFP draft. Does not invite, notify or contact any vendor.",
  },
  {
    id: "live_sourcing_workspace",
    title: "Draft a sourcing requirement from one sentence",
    description:
      "The Live Sourcing Workspace: describe an SD-WAN, SASE or managed security need in plain words and the statement of requirements assembles itself, every claim carrying provenance (the buyer's words, a named inference, or a labelled assumption), with a deterministic network diagram, the security rulebook's verdict where in scope, and aggregate market context. A separate review and verified buyer approval are required before an anonymous notice is published.",
    access: "open", page: "https://netify.co.uk/sase-sd-wan-rfp-builder/", api: "/api/workspace/extract, /api/workspace/fit", mcp: "workspace_cycle, workspace_ingest", data: "/methodology.json, /workspace/questions.json",
    status: "live", capabilityType: "draft", accessLevel: "public",
    requiresIdentity: false, requiresApproval: false, sendsExternally: false, executesExternally: false,
    invocableByExternalAgent: true, humanSupervision: "none",
    evidence: "POST /api/workspace/extract returns provenance-marked field updates; workspace_cycle returns the same loop's output including the assembled brief.",
    boundaries: "These workspace drafting tools are stateless; personalised provider identities are not returned before publication. Publishing requires the buyer's recorded consent and a verified work email; no vendor is contacted before that signature. Provenance is never dropped: inferences and assumptions stay labelled all the way to the published notice.",
  },
  {
    id: "post_opportunity",
    title: "Post a project notice to the public board",
    description: "Draft and preview a project notice in the clear (staged wizard, AI improvement, exact public preview); publishing requires a signed-in buyer session so every notice is tied to an accountable business identity. Verified vendors and service providers discover and respond.",
    access: "identified", page: "/opportunities/new", api: "/api/opportunity (POST, session required)", data: "/opportunities/board/data.json",
    status: "live", capabilityType: "approval-gated-action", accessLevel: "signed-in",
    requiresIdentity: true, requiresApproval: true, sendsExternally: false, executesExternally: false,
    invocableByExternalAgent: false, humanSupervision: "required",
    evidence: "/api/opportunity POST returns 401 without a session; the wizard carries the draft through sign-in.",
    boundaries: "Drafting, AI improvement and preview are fully open. Publishing is gated behind magic-link sign-in. Publishes to the Netify public board (pull-based); pricing amounts stay private to the buyer.",
  },
  {
    id: "agent_notice_tools",
    title: "Agent: draft, validate and read project notices",
    description: "Public MCP tools for buyer agents: draft_opportunity_notice normalises rough fields into a publish-ready draft with completeness gaps; validate_opportunity_notice scores a draft deterministically; get_opportunity returns one notice's full public projection.",
    access: "open", page: "/opportunities/board", api: "/api/mcp/", mcp: "draft_opportunity_notice, validate_opportunity_notice, get_opportunity", data: "/opportunities/board/data.json",
    status: "live", capabilityType: "compute", accessLevel: "public",
    requiresIdentity: false, requiresApproval: false, sendsExternally: false, executesExternally: false,
    invocableByExternalAgent: true, humanSupervision: "none",
    evidence: "POST /api/mcp/ tools/call with these tool names; draft/validate are stateless and store nothing.",
    boundaries: "Draft and validate tools are stateless. Public notice reads exclude private pricing, buyer contact details and credentials. Publication requires verified buyer approval.",
  },
  {
    id: "read_board",
    title: "Read the live opportunity board",
    description: "List open opportunities with scope, region, format and activity counts. Pricing amounts stay private to the posting buyer.",
    access: "open", page: "/opportunities/board", api: "/api/opportunity (GET)", mcp: "list_opportunities", data: "/opportunities/board/data.json",
    status: "live", capabilityType: "read", accessLevel: "public",
    requiresIdentity: false, requiresApproval: false, sendsExternally: false, executesExternally: false,
    invocableByExternalAgent: true, humanSupervision: "none",
    evidence: "/api/opportunity GET and /opportunities/board/data.json return open opportunities.",
    boundaries: "Read-only. Bid and pricing amounts are not exposed.",
  },
  {
    id: "publish_rfp",
    title: "Publish an RFP to the curated vendor list",
    description: "Prepare to publish an RFP. The MCP tool validates the project credential and returns a browser sign-in handoff; it does not publish on possession of a token alone.",
    access: "identified", page: "https://netify.co.uk/sase-sd-wan-rfp-builder/", api: "/api/rfp/[id]/publish", mcp: "publish_rfp",
    status: "live", capabilityType: "approval-gated-action", accessLevel: "token-gated",
    requiresIdentity: true, requiresApproval: true, sendsExternally: false, executesExternally: false,
    invocableByExternalAgent: true, humanSupervision: "required",
    evidence: "publish_rfp validates the manage_token and returns an auth_required browser handoff.",
    boundaries: "The buyer must complete verified sign-in and explicit publication approval in Netify. An opaque token is not publication consent.",
  },
  {
    id: "supplier_respond",
    title: "Respond and bid as a vendor or service provider",
    description: "A verified vendor reads invitations and the board and submits comments, bids and structured pricing.",
    access: "identified", page: "/for-suppliers", mcp: "opportunity_inbox, opportunity_respond, get_rfp, list_rfp_questions, get_rfp_evidence_draft, get_rfp_status, supplier_inbox, supplier_reply",
    status: "live", capabilityType: "external-execution", accessLevel: "token-gated",
    requiresIdentity: true, requiresApproval: false, sendsExternally: true, executesExternally: true,
    invocableByExternalAgent: true, humanSupervision: "required",
    evidence: "Opportunity and connection tools require the appropriate per-supplier credential. RFP response submission uses the web form; respond_to_rfp cannot establish supplier identity through the current MCP transport.",
    boundaries: "Acts only for the verified vendor's own organisation, on its own behalf. Cannot act for another vendor or for a buyer.",
  },
  // Supervised agentic layer. Requires a signed-in buyer (or the RFP manage_token).
  // The agent remembers, plans, reviews and monitors; every customer/supplier/BT-facing
  // action is approval-gated and never sent or executed automatically. These are not
  // invocable by an arbitrary external agent: they belong to the buyer's own workspace.
  {
    id: "buyer_memory",
    title: "Remember buyer context across RFPs",
    description: "For a signed-in buyer, persist durable preferences across projects: preferred and avoided vendors, compliance baseline, regions, organisation size, risk tolerance, budget patterns and past RFP outcomes. Additive and conflict-safe, transparent and editable by the buyer.",
    access: "identified", page: "/account", api: "/api/buyer/memory",
    status: "live", capabilityType: "compute", accessLevel: "signed-in",
    requiresIdentity: true, requiresApproval: false, sendsExternally: false, executesExternally: false,
    invocableByExternalAgent: false, humanSupervision: "none",
    evidence: "/api/buyer/memory GET/POST live; editable in the /account panel; the RFP advisor reads it and writes durable facts via the remember tool.",
    boundaries: "Stores the buyer's own preferences only. Private to that buyer, never shared across buyers, no external effect. Conflicting facts are surfaced, not silently overwritten.",
  },
  {
    id: "procurement_goal",
    title: "Set a standing procurement goal",
    description: "Attach a standing outcome to an RFP (must-haves, response deadline, minimum bids). The agent reviews incoming bids against it and the monitoring digest tracks progress.",
    access: "identified", page: "https://netify.co.uk/sase-sd-wan-rfp-builder/", api: "/api/rfp/[id]/goal",
    status: "live", capabilityType: "compute", accessLevel: "signed-in",
    requiresIdentity: true, requiresApproval: false, sendsExternally: false, executesExternally: false,
    invocableByExternalAgent: false, humanSupervision: "required",
    evidence: "/api/rfp/[id]/goal persists the goal; the review and digest read it. Needs a buyer session or the RFP manage_token.",
    boundaries: "An internal target for the buyer's own RFP. No external effect.",
  },
  {
    id: "review_supplier_bid",
    title: "Agent review of incoming vendor bids",
    description: "When a vendor submits a bid, the agent reviews it automatically without a buyer prompt: deterministic evidence checks (required-question coverage, hedging detection, compliance must-have coverage via the regulation engine) kept separate from an LLM quality judgement, a cross-check of the claim against Netify's independent vendor grade with overreach flagged, and drafted clarification questions.",
    access: "identified", page: "https://netify.co.uk/sase-sd-wan-rfp-builder/", api: "/api/rfp/[id]/approvals",
    status: "live", capabilityType: "recommend", accessLevel: "signed-in",
    requiresIdentity: true, requiresApproval: true, sendsExternally: false, executesExternally: false,
    invocableByExternalAgent: false, humanSupervision: "approval-gated",
    evidence: "Fires on /api/rfp/[id]/respond submission; the review and pending clarifications are readable at /api/rfp/[id]/approvals. Verified live.",
    boundaries: "Drafts clarifications only. Does not send them. Nothing reaches a vendor without explicit buyer approval.",
  },
  {
    id: "monitor_and_digest",
    title: "Monitor live RFPs and recommend next actions",
    description: "The agent reviews live RFPs with an active goal and writes a buyer-only digest of recommended next actions (deadline risk, missing bids, weak answers, pending gaps, stale approvals). Runs on demand now; the scheduled cadence activates once the cron secret is set.",
    access: "identified", page: "https://netify.co.uk/sase-sd-wan-rfp-builder/", api: "/api/agent/run, /api/rfp/[id]/approvals",
    status: "live", capabilityType: "monitor", accessLevel: "signed-in",
    requiresIdentity: true, requiresApproval: true, sendsExternally: false, executesExternally: false,
    invocableByExternalAgent: false, humanSupervision: "approval-gated",
    evidence: "Digest generation verified live via manual trigger; run report records sends=0. The scheduled cron run is built and deployed but its first production run is pending the CRON_SECRET ops step.",
    boundaries: "Creates a buyer-only digest and pending proposals. Sends nothing (sends=0). Does not contact any vendor, account manager or BT. The /api/agent/run trigger is cron-secret or admin gated, not callable by an arbitrary agent.",
  },
];

export const MCP_ACCESS_GROUPS = [
 {title:"Private circuit quote access",access:"circuit-read-token",description:"Read private specifications and real sourced quotes with an owner-issued one-hour token. No writes, publication or ordering. Replacing a token revokes it.",tools:["netify_read_circuit_responses"]},
  { title: "Public research and computation", access: "public", description: "No sign-in. Named-provider comparisons and sourced evidence are public; shortlist previews return aggregate coverage only. Cost bands are indicative. These tools do not publish or contact suppliers.", tools: ["netify_validate_circuit_request", "build_sase_shortlist", "list_sase_features", "list_sase_vendors", "get_sase_vendor_profile", "compare_vendors", "get_demand_index", "verify_claim", "list_exclusions", "explain_shortlist", "list_opportunities", "get_opportunity", "draft_opportunity_notice", "validate_opportunity_notice", "netify_estimate_sase_tco", "netify_get_sase_provider_categories", "netify_get_sase_demand_stats", "netify_get_sase_cost_drivers", "netify_get_delivery_model_comparison", "assess_security_requirement", "workspace_cycle", "workspace_ingest"] },
  { title: "Private project drafts", access: "project-credential", description: "Creating a draft stores private project data and returns its credential. Later changes require that credential and any consent or revision checks stated by the tool. No supplier publication is implied.", tools: ["start_project", "update_requirements", "preview_provider_matches", "prepare_publication", "generate_rfp_from_opportunity", "create_security_project", "generate_security_rfp", "rescope_security_project", "get_security_project_status", "continue_security_conversation"] },
  { title: "Verified buyer actions", access: "verified-buyer", description: "These tools require the verified owner and project credential. Publication also checks the current revision and exact consent. Personalised matches require completed publication. An external client without the supported buyer identity must continue in Netify.", tools: ["publish_opportunity", "get_project_status", "get_unlocked_matches"] },
  { title: "Buyer browser handoff", access: "browser-handoff", description: "The project credential allows a publication handoff. The buyer completes sign-in and approval in Netify; the tool does not publish using a token alone.", tools: ["publish_rfp"] },
  { title: "Supplier credentials", access: "supplier-credential", description: "Reads and responses require the share, invitation or per-supplier credential specified by each tool. A share token alone is not sufficient for an evidence draft or every supplier action. Pricing and responses remain permission-controlled.", tools: ["get_rfp", "list_rfp_questions", "get_rfp_evidence_draft", "get_rfp_status", "supplier_inbox", "opportunity_inbox", "opportunity_respond", "supplier_reply"] },
  { title: "Continue on the website", access: "unavailable-transport", description: "respond_to_rfp currently refuses MCP submission because the transport cannot establish the required supplier identity. Use the verified web response form. This is not an active external-agent submission capability.", tools: ["respond_to_rfp"] },
] as const;

export function capabilitiesDocument() {
  return {
    "@context": "https://schema.org",
    name: "Netify SASE and SD-WAN marketplace capabilities",
    url: `${SITE_URL}/capabilities.json`,
    description:
      "Agent-readable catalogue of what the marketplace can do, with explicit machine-readable boundaries per capability (identity, approval, external send/execution, who may invoke it). Public research and stateless computation are open; private reads and project updates require the credentials stated by each tool. The supervised agentic layer (buyer memory, procurement goal, automatic bid review, monitoring digest) needs a signed-in buyer; the agent remembers, plans, reviews and recommends, but every customer, vendor or BT-facing action is human-approved and never sent automatically. Fully autonomous execution is not claimed.",
    access_model: {
      open: "Public research and stateless computation need no identity. Creating a private draft may return a project credential; posting to the board is not anonymous-agent access.",
      identified: "Private tools require the exact project, buyer or supplier credentials stated in their definitions. A project token does not establish verified buyer identity or publication consent. Circuit publication and supplier RFP submission use the verified web flows.",
    },
    approval_model: {
      read_and_compute: "Public evidence, comparisons, aggregate coverage and stateless drafting may run without identity. Board publication is a separate verified-buyer approval step.",
      draft_and_recommend: "The assistant may create drafts and recommendations (RFP questions, clarifications, plans) for a signed-in buyer without approval, because they are internal and send nothing.",
      external_actions_require_human: "Any customer-facing, vendor-facing, BT-facing or buyer-impacting action requires a human: verified identity and explicit publication consent, or the relevant supplier credential for its own response, and explicit approval to send a drafted clarification or outreach.",
      scheduled_monitoring: "Slice 2 scheduled monitoring creates buyer-only digests and pending proposals only. It does not send externally. The operational assertion is sends=0 per run. Its first production cron run is pending the CRON_SECRET ops step.",
      not_claimed: "Fully autonomous execution is not currently claimed or implemented. The agentic layer is not invocable by an arbitrary external agent; it belongs to the signed-in buyer's workspace and is approval-gated.",
    },
    flag_legend: {
      status: "live | planned | experimental",
      capabilityType: "read | compute | draft | recommend | monitor | approval-gated-action | external-execution",
      accessLevel: "public | signed-in | token-gated | admin",
      requiresIdentity: "true if a sign-in or token is needed",
      requiresApproval: "true if a human must approve before any effect that leaves the buyer",
      sendsExternally: "true if it pushes to a named customer, vendor or BT",
      executesExternally: "true if it submits or orders against an external party or system",
      invocableByExternalAgent: "true if an external agent can call it directly (with any stated credential)",
      humanSupervision: "none | required | approval-gated",
    },
    pricing_routes: PRICING_ROUTES,
    public_evidence: {
      question_bank: "https://netify.co.uk/sase/rfp-builder/questions/",
      question_data: "https://netify.co.uk/sase/question-bank.json",
      manufacturing_example: "https://netify.co.uk/sase/examples/manufacturing-rfp/",
      manufacturing_data: "https://netify.co.uk/sase/examples/manufacturing-rfp/data.json",
      comparisons: "https://netify.co.uk/sase/shortlist/",
      pricing_explained: "https://netify.co.uk/sase/pricing/",
      example_limitations: "Manufacturing output and supplier response comparison are explicitly synthetic, not real quotes or procurement outcomes.",
    },
    mcp_endpoint: `${SITE_URL}/api/mcp/`,
    mcp_access_groups: MCP_ACCESS_GROUPS,
    capabilities: CAPABILITIES.map((c) => ({
      ...c,
      page: c.page ? (c.page.startsWith("https://") ? c.page : `${SITE_URL}${c.page}`) : null,
    })),
  };
}

/** Short feature strings for WebApplication featureList JSON-LD. */
export function featureList(): string[] {
  return CAPABILITIES.map((c) => `${c.title} (${c.accessLevel}, ${c.capabilityType})`);
}
