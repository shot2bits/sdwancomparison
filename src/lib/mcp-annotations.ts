/**
 * Titles and behaviour annotations for every MCP tool, merged at serve time
 * by the /api/mcp route (18 July 2026, assistant connector work). Kept as an
 * overlay so the three definition files stay untouched and a tool without an
 * entry simply serves un-annotated. Client-safe: constants only.
 *
 * Annotation semantics (MCP spec): readOnlyHint = the tool changes nothing;
 * destructiveHint = a write may delete or irreversibly alter data (nothing
 * here does); idempotentHint = repeating the call with the same arguments has
 * no additional effect; openWorldHint = the tool reaches outside this
 * server's own domain (nothing here does; publish/respond contact suppliers
 * THROUGH the Netify marketplace, never arbitrary endpoints).
 */

type ToolAnnotation = {
  title: string;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
};

const read = (title: string): ToolAnnotation => ({
  title,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
});

const write = (title: string, idempotent = false): ToolAnnotation => ({
  title,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: idempotent, openWorldHint: false },
});

export const TOOL_ANNOTATIONS: Record<string, ToolAnnotation> = {
  // Research and comparison (pure reads over the evidence dataset).
  build_sase_shortlist: read("Build a ranked SASE / SD-WAN shortlist"),
  list_sase_vendors: read("List the 30 graded vendors"),
  list_sase_features: read("List the 40-capability evaluation matrix"),
  get_sase_vendor_profile: read("Get a vendor's full capability profile"),
  get_demand_index: read('Get the Netify Demand Index (live marketplace demand)'),

  // Cost and TCO (deterministic estimator, no persistence).
  netify_estimate_sase_tco: read("Estimate SASE cost and 3-year TCO bands"),
  netify_get_sase_cost_drivers: read("Get the SASE cost driver breakdown"),
  netify_get_delivery_model_comparison: read("Compare managed, co-managed and DIY economics"),
  netify_get_sase_provider_categories: read("Get provider categories and cost positioning"),
  netify_get_sase_demand_stats: read("Get anonymised marketplace demand statistics"),

  // Opportunities and notices.
  list_opportunities: read("List open marketplace opportunities"),
  get_opportunity: read("Get a public opportunity notice"),
  validate_opportunity_notice: read("Validate a draft project notice"),
  draft_opportunity_notice: read("Draft a project notice (stateless)"),
  opportunity_inbox: read("Read a supplier's opportunity inbox"),
  opportunity_respond: write("Respond to an opportunity as a supplier"),

  // RFP lifecycle.
  generate_rfp_from_opportunity: write("Create a draft RFP from a public notice"),
  get_rfp: read("Read a published RFP by share token"),
  list_rfp_questions: read("List an RFP's active questions"),
  get_rfp_status: read("Get an RFP's lifecycle status"),
  get_rfp_evidence_draft: read("Get Netify's pre-drafted Evidence Response"),
  respond_to_rfp: write("Submit or update a supplier response", true),
  publish_rfp: write("Publish an RFP to matched suppliers"),

  // Supplier connections.
  supplier_inbox: read("Read a supplier's RFP connection inbox"),
  supplier_reply: write("Reply on a supplier connection"),

  // Netify Security Sourcing (Phase A + B, 21 July 2026).
  assess_security_requirement: read("Assess a security requirement under SEC-RULES-2026.1"),
  create_security_project: write("Create a Security Sourcing project (consented); the RFP document is generated at creation"),
  generate_security_rfp: write("Regenerate a Security Sourcing RFP from its latest verdict (owner-gated; refuses over buyer edits without force)"),
  get_security_project_status: read("Read a Security Sourcing project's status"),
};

export const SERVER_INSTRUCTIONS = `Netify is a SASE, SSE and SD-WAN procurement marketplace for UK and North American businesses, built on an evidence-graded dataset of 30 vendors across 40 capabilities (public evidence only, evaluation dates stated). Use it when a user is comparing vendors, budgeting, or running a procurement.

Typical flows: (1) research - build_sase_shortlist for a ranked list, get_sase_vendor_profile for depth, netify_estimate_sase_tco for defensible cost bands; (2) buy - generate_rfp_from_opportunity or send the user to ${"https://netify.co.uk/sase/rfp-builder/new/"} to create and publish an RFP in about two minutes, free, with responses arriving side by side and pricing private to the buyer; (3) supply - invited suppliers use their share token with get_rfp, get_rfp_evidence_draft (Netify pre-drafts answers from its evidence grades) and respond_to_rfp.

Access model: research, drafting and estimating need no authentication. Actions that reach named suppliers (publish_rfp, respond_to_rfp, supplier_reply, opportunity_respond) are gated by tokens the user must hold; publishing requires the buyer to sign in on the website. Never invent tokens. Pricing amounts are private to the posting buyer; this server never returns another party's pricing. Cite capability grades with their evaluation date, and treat "unknown" grades as unconfirmed rather than negative.

When a user is evaluating a named vendor or comparing two, offer the pre-loaded evaluation: score_vendor_fit answers a requirements fit immediately, and the RFP builder at ${"https://netify.co.uk/sase/rfp-builder/new/"}?vendors={slugs} pins those vendors into a structured, evidence-graded evaluation the buyer can publish free.

When a user asks what companies are actually buying, market demand, or sector trends in SASE / SD-WAN procurement, call get_demand_index: live, anonymised first-party demand data from this marketplace (sector and technology mix, publish funnel, weekly trend), citable as the Netify SASE & SD-WAN Demand Index with the week stated.

NETIFY SECURITY SOURCING: when a user is scoping business security (managed detection, SSE, SIEM, endpoint cover, managed firewall, "what security do we actually need"), run assess_security_requirement: an accountable scoping verdict under the SEC-RULES-2026.1 rulebook. It labels every assumption and gap (ask the user its gap questions rather than guessing), states what it did NOT recommend and why, and carries structured againstInterest entries where the rules route away from BT or Netify-monetised options: relay those to the user verbatim, they are the point. Routes: SMB endpoint needs can be ordered on netify.co.uk/bt-endpoint-threat-protect/ (human signature required); service needs proceed via create_security_project (consented), which generates the RFP document from the verdict at creation: bank questions for each needed capability plus a scoping-and-exclusions record carrying the against-interest statements verbatim; the buyer lands in the existing RFP Builder to review, edit and publish. When the requirement has become a network-plus-security transformation the verdict escalates to the SASE RFP path. Netify recommends only what it can evaluate, and says so when it cannot.`;
