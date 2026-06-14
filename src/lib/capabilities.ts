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
    id: "supplier_respond",
    title: "Respond and bid as a supplier",
    description: "A verified supplier reads invitations and the board and submits comments, bids and structured pricing. Identity required: a domain-verified magic-link sign-in for people, or a per-supplier token for an agent.",
    access: "identified",
    page: "/for-suppliers",
    mcp: "opportunity_inbox, opportunity_respond, get_rfp, respond_to_rfp",
  },
];

export function capabilitiesDocument() {
  return {
    "@context": "https://schema.org",
    name: "Netify SASE and SD-WAN marketplace capabilities",
    url: `${SITE_URL}/capabilities.json`,
    description:
      "Agent-readable catalogue of what the marketplace can do. Open capabilities need no identity and can be driven anonymously by an AI agent (they are pull-based). Identified capabilities are push actions that reach named suppliers and accept either a human magic-link sign-in or an agent token. Browsing, building an RFP and posting to the board are always open.",
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
