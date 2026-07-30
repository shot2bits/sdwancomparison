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
  {
    id: "discover_vendors",
    title: "Discover and compare vendors",
    description: "Read 30+ SASE, SSE and SD-WAN vendors graded against a 40-feature methodology, including alternatives and head-to-head comparisons.",
    access: "open", page: "/vendors", mcp: "list_sase_vendors, get_sase_vendor_profile", data: "/shortlist/data.json",
    status: "live", capabilityType: "read", accessLevel: "public",
    requiresIdentity: false, requiresApproval: false, sendsExternally: false, executesExternally: false,
    invocableByExternalAgent: true, humanSupervision: "none",
    evidence: "list_sase_vendors and get_sase_vendor_profile MCP tools and /shortlist/data.json return live graded vendor data.",
    boundaries: "Read-only. Does not contact any vendor or take any action.",
  },
  {
    id: "build_shortlist",
    title: "Build a ranked shortlist",
    description: "Filter by sector, region, organisation size, delivery model and the 40 capabilities to produce a ranked, graded shortlist. No sign-in.",
    access: "open", page: "/shortlist", api: "/api/openapi/build_sase_shortlist", mcp: "build_sase_shortlist", data: "/shortlist/data.json",
    status: "live", capabilityType: "compute", accessLevel: "public",
    requiresIdentity: false, requiresApproval: false, sendsExternally: false, executesExternally: false,
    invocableByExternalAgent: true, humanSupervision: "none",
    evidence: "build_sase_shortlist (MCP and REST) returns a deterministic ranked, graded shortlist for given criteria.",
    boundaries: "Computes a ranking only. Takes no action on any vendor.",
  },
  {
    id: "build_rfp",
    title: "Build a SASE and SD-WAN RFP",
    description: "Create a methodology-backed RFP conversationally with the AI advisor or by picking scope and delivery model, with compliance mapping. Fully open, no sign-in.",
    access: "open", page: "https://netify.co.uk/", api: "/api/rfp, /api/rfp/[id]/agent", data: "/methodology.json, /question-bank.json",
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
      "The Live Sourcing Workspace: describe an SD-WAN, SASE or managed security need in plain words and the statement of requirements assembles itself, every claim carrying provenance (the buyer's words, a named inference, or a labelled assumption), with a deterministic network diagram, the security rulebook's verdict where in scope, and evidence-graded vendor fit with real evaluation dates. One signature publishes: anonymous notice on the open board, full brief to matched signed-in vendors and service providers.",
    access: "open", page: "/workspace", api: "/api/workspace/extract, /api/workspace/fit", mcp: "workspace_cycle, workspace_ingest", data: "/methodology.json, /workspace/questions.json",
    status: "live", capabilityType: "draft", accessLevel: "public",
    requiresIdentity: false, requiresApproval: false, sendsExternally: false, executesExternally: false,
    invocableByExternalAgent: true, humanSupervision: "none",
    evidence: "POST /api/workspace/extract returns provenance-marked field updates; workspace_cycle returns the same loop's output including the assembled brief.",
    boundaries: "Drafting and fit are open and side-effect free. Publishing requires the buyer's recorded consent and a verified work email; no vendor is contacted before that signature. Provenance is never dropped: inferences and assumptions stay labelled all the way to the published notice.",
  },
  {
    id: "post_opportunity",
    title: "Post a project notice to the public board",
    description: "Draft and preview a project notice in the clear (staged wizard, AI improvement, exact public preview); publishing requires a signed-in buyer session so every notice is tied to an accountable business identity. Verified vendors and service providers discover and respond.",
    access: "identified", page: "/opportunities/new", api: "/api/opportunity (POST, session required)", mcp: "draft_opportunity_notice, validate_opportunity_notice", data: "/opportunities/board/data.json",
    status: "live", capabilityType: "compute", accessLevel: "public",
    requiresIdentity: true, requiresApproval: false, sendsExternally: false, executesExternally: false,
    invocableByExternalAgent: false, humanSupervision: "required",
    evidence: "/api/opportunity POST returns 401 without a session; the wizard carries the draft through sign-in.",
    boundaries: "Drafting, AI improvement and preview are fully open. Publishing is gated behind magic-link sign-in. Publishes to the Netify public board (pull-based); pricing amounts stay private to the buyer.",
  },
  {
    id: "agent_notice_tools",
    title: "Agent: draft, validate and read project notices; seed an RFP",
    description: "Public MCP tools for buyer agents: draft_opportunity_notice normalises rough fields into a publish-ready draft with completeness gaps; validate_opportunity_notice scores a draft deterministically; get_opportunity returns one notice's full public projection; generate_rfp_from_opportunity seeds a draft RFP from a public notice.",
    access: "open", page: "/opportunities/board", api: "/api/mcp/", mcp: "draft_opportunity_notice, validate_opportunity_notice, get_opportunity, generate_rfp_from_opportunity", data: "/opportunities/board/data.json",
    status: "live", capabilityType: "compute", accessLevel: "public",
    requiresIdentity: false, requiresApproval: false, sendsExternally: false, executesExternally: false,
    invocableByExternalAgent: true, humanSupervision: "none",
    evidence: "POST /api/mcp/ tools/call with these tool names; draft/validate are stateless and store nothing.",
    boundaries: "Public tools expose only public projections: never pricing amounts, buyer contact details or tokens. Publishing a notice and downloading a final RFP remain sign-in gated for humans.",
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
    description: "Invite the best-fit graded vendors to a built RFP and move it to published. Push action: reaches named vendors. Needs a buyer magic-link sign-in or the RFP manage_token.",
    access: "identified", page: "/rfp-builder", api: "/api/rfp/[id]/publish", mcp: "publish_rfp",
    status: "live", capabilityType: "external-execution", accessLevel: "token-gated",
    requiresIdentity: true, requiresApproval: false, sendsExternally: true, executesExternally: true,
    invocableByExternalAgent: true, humanSupervision: "required",
    evidence: "/api/rfp/[id]/publish invites graded vendors and sets the RFP to published; gated by buyer session or the RFP manage_token.",
    boundaries: "Only invites vendors already graded in the Netify marketplace. Requires the manage_token or a buyer sign-in; not anonymous. The identity holder authorises the invite by presenting the credential.",
  },
  {
    id: "supplier_respond",
    title: "Respond and bid as a vendor or service provider",
    description: "A verified vendor reads invitations and the board and submits comments, bids and structured pricing.",
    access: "identified", page: "/for-suppliers", mcp: "opportunity_inbox, opportunity_respond, get_rfp, respond_to_rfp",
    status: "live", capabilityType: "external-execution", accessLevel: "token-gated",
    requiresIdentity: true, requiresApproval: false, sendsExternally: true, executesExternally: true,
    invocableByExternalAgent: true, humanSupervision: "required",
    evidence: "opportunity_respond / respond_to_rfp MCP tools submit a vendor's own bid; domain-verified sign-in or per-vendor token required.",
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
    access: "identified", page: "/rfp-builder", api: "/api/rfp/[id]/goal",
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
    access: "identified", page: "/rfp-builder", api: "/api/rfp/[id]/approvals",
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
    access: "identified", page: "/rfp-builder", api: "/api/agent/run, /api/rfp/[id]/approvals",
    status: "live", capabilityType: "monitor", accessLevel: "signed-in",
    requiresIdentity: true, requiresApproval: true, sendsExternally: false, executesExternally: false,
    invocableByExternalAgent: false, humanSupervision: "approval-gated",
    evidence: "Digest generation verified live via manual trigger; run report records sends=0. The scheduled cron run is built and deployed but its first production run is pending the CRON_SECRET ops step.",
    boundaries: "Creates a buyer-only digest and pending proposals. Sends nothing (sends=0). Does not contact any vendor, account manager or BT. The /api/agent/run trigger is cron-secret or admin gated, not callable by an arbitrary agent.",
  },
];

export function capabilitiesDocument() {
  return {
    "@context": "https://schema.org",
    name: "Netify SASE and SD-WAN marketplace capabilities",
    url: `${SITE_URL}/capabilities.json`,
    description:
      "Agent-readable catalogue of what the marketplace can do, with explicit machine-readable boundaries per capability (identity, approval, external send/execution, who may invoke it). Read and compute are open and anonymous-agent drivable. The supervised agentic layer (buyer memory, procurement goal, automatic bid review, monitoring digest) needs a signed-in buyer; the agent remembers, plans, reviews and recommends, but every customer, vendor or BT-facing action is human-approved and never sent automatically. Fully autonomous execution is not claimed.",
    access_model: {
      open: "No identity required. Read/compute and pull-based public board posts. Fully usable by anonymous agents.",
      identified: "Requires a buyer or vendor identity: either push actions that reach named vendors (token or sign-in), or the supervised agentic layer (signed-in buyer).",
    },
    approval_model: {
      read_and_compute: "May run without identity or approval (discover, shortlist, build RFP, read and post to the public board).",
      draft_and_recommend: "The assistant may create drafts and recommendations (RFP questions, clarifications, plans) for a signed-in buyer without approval, because they are internal and send nothing.",
      external_actions_require_human: "Any customer-facing, vendor-facing, BT-facing or buyer-impacting action requires a human: a sign-in or token to publish/bid, and explicit approval to send a drafted clarification or outreach.",
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
    mcp_endpoint: `${SITE_URL}/api/mcp/`,
    capabilities: CAPABILITIES.map((c) => ({
      ...c,
      page: c.page ? `${SITE_URL}${c.page}` : null,
    })),
  };
}

/** Short feature strings for WebApplication featureList JSON-LD. */
export function featureList(): string[] {
  return CAPABILITIES.map((c) => `${c.title} (${c.accessLevel}, ${c.capabilityType})`);
}
