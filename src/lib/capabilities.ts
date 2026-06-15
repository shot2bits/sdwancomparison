/**
 * The marketplace capability catalogue: a single, agent-readable description of
 * what the tool can do, which surfaces expose it, and what authorisation each
 * needs. Served at /capabilities.json and used for the WebApplication
 * featureList so AI engines and agents can read the whole workflow without
 * signing in. Access model: "open" actions are pull-based and need no identity
 * (agents can drive them anonymously); "identified" actions are push actions
 * that reach named suppliers and accept a human magic-link OR an agent token.
 */

import { SITE_URL } from "@/lib/structured-data";

export type Access = "open" | "identified";

export type Capability = {
  id: string;
  title: string;
  description: string;
  access: Access;
  page: string | null;        // human surface
  api?: string;               // REST surface
  mcp?: string;               // MCP tool name
  data?: string;              // machine-readable twin
};

export const CAPABILITIES: Capability[] = [
  {
    id: "discover_vendors",
    title: "Discover and compare vendors",
    description: "Read 30+ SASE, SSE and SD-WAN vendors graded against a 40-feature methodology, including alternatives and head-to-head comparisons.",
    access: "open",
    page: "/vendors",
    mcp: "list_sase_vendors, get_sase_vendor_profile",
    data: "/shortlist/data.json",
  },
  {
    id: "build_shortlist",
    title: "Build a ranked shortlist",
    description: "Filter by sector, region, organisation size, delivery model and the 40 capabilities to produce a ranked, graded shortlist. No sign-in.",
    access: "open",
    page: "/shortlist",
    api: "/api/openapi/build_sase_shortlist",
    mcp: "build_sase_shortlist",
    data: "/shortlist/data.json",
  },
  {
    id: "build_rfp",
    title: "Build a SASE and SD-WAN RFP",
    description: "Create a methodology-backed RFP conversationally with the AI advisor or by picking scope and delivery model, with compliance mapping. Fully open, no sign-in.",
    access: "open",
    page: "/rfp-builder",
    api: "/api/rfp, /api/rfp/[id]/agent",
    data: "/methodology.json, /question-bank.json",
  },
  {
    id: "post_opportunity",
    title: "Post a need to the public board",
    description: "Post an opportunity or a quick pricing request for underlay circuits or overlay SD-WAN/SSE/SASE. Pull-based: verified suppliers discover and respond, so this is open and agent-drivable with no identity.",
    access: "open",
    page: "/opportunities",
    api: "/api/opportunity (POST)",
    mcp: "list_opportunities",
    data: "/opportunities/board/data.json",
  },
  {
    id: "read_board",
    title: "Read the live opportunity board",
    description: "List open opportunities with scope, region, format and activity counts. Open to crawlers and agents; pricing amounts stay private to the posting buyer.",
    access: "open",
    page: "/opportunities/board",
    api: "/api/opportunity (GET)",
    mcp: "list_opportunities",
    data: "/opportunities/board/data.json",
  },
  {
    id: "publish_rfp",
    title: "Publish an RFP to the curated supplier list",
    description: "Invite the best-fit graded vendors to a built RFP and move it to published. Push action: reaches named suppliers, so it needs a buyer magic-link sign-in or the RFP manage_token. An authorised agent passes the manage_token (issued when it created the RFP) over REST or MCP.",
    access: "identified",
    page: "/rfp-builder",
    api: "/api/rfp/[id]/publish",
    mcp: "publish_rfp",
  },
  {
    id: "supplier_respond",
    title: "Respond and bid as a supplier",
    description: "A verified supplier reads invitations and the board and submits comments, bids and structured pricing. Identity required: a domain-verified magic-link sign-in for people, or a per-supplier token for an agent.",
    access: "identified",
    page: "/for-suppliers",
    mcp: "opportunity_inbox, opportunity_respond, get_rfp, respond_to_rfp",
  },
  // Supervised agentic layer. These need buyer identity (a magic-link session or
  // the RFP manage_token). The agent remembers, holds a goal, reviews bids and
  // monitors, but every supplier-facing action is approval-gated, never sent
  // automatically.
  {
    id: "buyer_memory",
    title: "Remember buyer context across RFPs",
    description: "For a signed-in buyer, persist durable preferences across projects: preferred and avoided vendors, compliance baseline, regions, organisation size, risk tolerance, budget patterns and past RFP outcomes. Additive and conflict-safe, transparent and editable by the buyer. The RFP advisor reads it to avoid re-asking and writes durable facts back.",
    access: "identified",
    page: "/account",
    api: "/api/buyer/memory",
  },
  {
    id: "procurement_goal",
    title: "Set a standing procurement goal",
    description: "Attach a standing outcome to an RFP (must-haves, response deadline, minimum bids). The agent reviews incoming bids against it and the monitoring digest tracks progress. Needs a buyer session or the RFP manage_token.",
    access: "identified",
    page: "/rfp-builder",
    api: "/api/rfp/[id]/goal",
  },
  {
    id: "review_supplier_bid",
    title: "Agent review of incoming supplier bids",
    description: "When a supplier submits a bid, the agent reviews it automatically without a buyer prompt: deterministic evidence checks (required-question coverage, hedging detection, compliance must-have coverage via the regulation engine) kept separate from an LLM quality judgement, a cross-check of the supplier's claim against Netify's independent vendor grade with overreach flagged, and drafted clarification questions. Clarifications are queued for buyer approval; nothing is sent automatically.",
    access: "identified",
    page: "/rfp-builder",
    api: "/api/rfp/[id]/approvals",
  },
  {
    id: "monitor_and_digest",
    title: "Monitor live RFPs and recommend next actions",
    description: "On a schedule, the agent reviews live RFPs with an active goal and writes a buyer-only digest of recommended next actions (deadline risk, missing bids, weak answers, pending gaps, stale approvals). Supervised: it recommends and drafts only, never contacts a supplier, every run is audited and reports zero outbound sends. Approve any drafted action via the approvals surface.",
    access: "identified",
    page: "/rfp-builder",
    api: "/api/agent/run, /api/rfp/[id]/approvals",
  },
];

export function capabilitiesDocument() {
  return {
    "@context": "https://schema.org",
    name: "Netify SASE and SD-WAN marketplace capabilities",
    url: `${SITE_URL}/capabilities.json`,
    description:
      "Agent-readable catalogue of what the marketplace can do. Open capabilities need no identity and can be driven anonymously by an AI agent (they are pull-based). Identified capabilities require a buyer or supplier identity: either push actions that reach named suppliers, or the supervised agentic layer (persistent buyer memory, a standing procurement goal, automatic agent review of incoming bids, and scheduled monitoring that recommends next actions). In the agentic layer the agent remembers, plans, reviews and monitors, but every supplier-facing action is queued for human approval and never sent automatically. Browsing, building an RFP and posting to the board are always open.",
    access_model: {
      open: "No identity required. Pull-based: results and board posts are discovered by suppliers, not pushed at them. Fully usable by anonymous agents.",
      identified: "Reaches named suppliers (push). Accepts a human magic-link sign-in or an agent token, so an authorised agent can also perform it.",
    },
    mcp_endpoint: `${SITE_URL}/api/mcp`,
    capabilities: CAPABILITIES.map((c) => ({
      ...c,
      page: c.page ? `${SITE_URL}${c.page}` : null,
    })),
  };
}

/** Short feature strings for WebApplication featureList JSON-LD. */
export function featureList(): string[] {
  return CAPABILITIES.map((c) => `${c.title} (${c.access})`);
}
