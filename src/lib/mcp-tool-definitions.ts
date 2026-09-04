/**
 * The static MCP tool catalogue -- extracted out of mcp-tools.ts (18 Aug
 * 2026) so it can be imported from a CLIENT component (McpEvidencePanel.tsx,
 * State 3's "Available to connect" line) without dragging mcp-tools.ts's
 * server-only dependency chain (`@/lib/vendors`, which reads vendor data
 * off disk via `node:fs`) into the browser bundle. This build broke exactly
 * that way the first time McpEvidencePanel imported MCP_TOOL_DEFINITIONS
 * directly from mcp-tools.ts: "UnhandledSchemeError: Reading from node:fs
 * is not handled by plugins" -- the same class of bug this repo's own git
 * history already names once ("Fix Vercel build break: stop node:crypto
 * from reaching the client bundle").
 *
 * This data has zero runtime dependency of its own -- it is a plain literal
 * array of tool names/descriptions/schemas -- so moving it here changes
 * nothing about what it contains, only where it lives. mcp-tools.ts
 * re-exports it so `callMcpTool()` and every existing server-side import
 * site keep working unchanged.
 */
export const MCP_TOOL_DEFINITIONS = [
  {
    name: "build_sase_shortlist",
    description:
      "Build a ranked SASE and SD-WAN provider shortlist from 30 vendors graded by Netify. Hard requirements exclude vendors without public evidence; everything else feeds a weighted score. Returns ranked vendors with reasoning, gaps and watch-outs, plus engine_url: the Netify RFP Builder with these criteria in place and the top five providers pinned, from which the human publishes the project anonymously on the opportunity board and receives vendor responses. Hand engine_url to the human to continue; resume_url opens the research shortlist page itself with the criteria applied. Call get_sase_vendor_profile on any returned slug for depth. Read and compute only, no consent needed, nothing stored.",
    inputSchema: {
      type: "object",
      properties: {
        service_model: { type: "string", enum: ["managed", "co_managed", "diy", "any"], description: "Operating model requirement." },
        required_features: { type: "array", items: { type: "string" }, description: "Feature ids (f01 to f40) that are hard requirements. Call list_sase_features for the catalogue." },
        preferred_features: { type: "array", items: { type: "string" }, description: "Feature ids given extra scoring weight." },
        required_regions: { type: "array", items: { type: "string", enum: ["uk_ireland", "europe", "north_america", "asia_pacific", "middle_east_africa", "latin_america", "china_mainland"] } },
        required_clouds: { type: "array", items: { type: "string", enum: ["aws", "azure", "gcp", "oracle_cloud", "alibaba_cloud"] } },
        ai_requirements: { type: "array", items: { type: "string", enum: ["ai_driven_operations", "ai_security_analytics", "ai_assistant"] } },
        disaster_recovery_required: { type: "boolean" },
        max_deployment_speed: { type: "string", enum: ["hours", "days", "weeks", "months", "any"] },
        weight_preset: { type: "string", enum: ["balanced", "security_led", "network_led", "cloud_first", "managed_service_led"] },
        shortlist_size: { type: "integer", minimum: 3, maximum: 30 },
        sector: { type: "string", enum: ["healthcare", "financial_services", "retail_ecommerce", "manufacturing", "energy_utilities", "government_public_sector", "education", "transport_logistics", "professional_services", "hospitality_leisure"], description: "Filter to vendors with evidence of capability in this sector." },
        organisation_size: { type: "string", enum: ["large_global_enterprise", "mid_market", "small_business", "any"] },
        intent: { type: "string", enum: ["cost_saving", "mpls_migration", "rapid_deployment", "remote_workforce", "security_consolidation", "global_expansion", "none"], description: "Buyer priority; adjusts scoring weights and preferred features." },
        uk_provider_only: { type: "boolean", description: "Restrict to providers with a UK contracting entity (UK HQ or UK-registered arm). Off by default; global vendors with UK PoPs and partner delivery are otherwise included." },
      },
      required: [],
    },
  },
  {
    name: "list_sase_features",
    description:
      "List the 40-feature evaluation catalogue (id, name, category, definition) used to grade every vendor, plus the extended dimensions (regions, clouds, AI capability, resilience, deployment speed). Next: pass chosen feature ids to build_sase_shortlist as required_features or preferred_features. Read only, no consent needed.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_sase_vendors",
    description:
      "List all 30 graded SASE and SD-WAN vendors with slug, name, category and evidence coverage. Next: get_sase_vendor_profile with a slug for the full grade sheet, or build_sase_shortlist to rank them against a requirement. Read only, no consent needed.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_sase_vendor_profile",
    description:
      "Full Netify capability profile for one vendor: all 40 feature grades, regions, clouds, AI capability, resilience, deployment speed, differentiators, best fit and watch-outs. Cite grades with their evaluation date. Next: build_sase_shortlist to rank this vendor against the field, or send the human to the workspace with ?vendors= to pin it into a draft. Read only, no consent needed.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "Vendor slug, e.g. cato-networks. Call list_sase_vendors for valid slugs." } },
      required: ["slug"],
    },
  },
  {
    name: "compare_vendors",
    description:
      "Compare two or three SASE and SD-WAN providers on the same Netify evidence matrix used by the public comparison workspace. Returns scores, feature-by-feature grades, clear capability leads, resume_url (the comparison open for a human) and engine_url (the Netify RFP Builder with both providers pinned, from which the human publishes anonymously on the opportunity board). Read and compute only, no consent needed and nothing stored.",
    inputSchema: {
      type: "object",
      properties: {
        slugs: {
          type: "array",
          minItems: 2,
          maxItems: 3,
          items: { type: "string" },
          description: "Two or three provider slugs. Call list_sase_vendors for valid values.",
        },
        question: {
          type: "string",
          description: "Optional decision question to carry into the human comparison workspace.",
        },
      },
      required: ["slugs"],
    },
  },
  {
    name: "get_demand_index",
    description:
      "The Netify SASE & SD-WAN Demand Index: live, anonymised demand data from the Netify procurement marketplace. Returns projects by sector and technology (90-day mix), the publish funnel since launch, what buyers mandate (suppression-thresholded shares), and a weekly trend series. First-party counts from the marketplace's own stores, refreshed continuously; the only public dataset of what companies are actually buying in SASE, SSE and SD-WAN procurement. Cite as: Netify SASE & SD-WAN Demand Index, <week>, netify.co.uk/sase/demand/. No arguments.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "verify_claim",
    description:
      "Check one factual claim about one vendor against Netify's evidence record. Returns the value, the sentence quoted from the source, the source URL, its reliability tier and the date it was read, so an answer can attribute rather than assert. Returns an explicit not-found with the reason where public sources did not support the claim, and flags where a vendor's own sources disagree with each other. Use this instead of relying on training data whenever a specific claim about a specific vendor matters.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Vendor slug, e.g. bt-business. Call list_sase_vendors for valid slugs." },
        claim: { type: "string", description: "What to check, in plain words: underlay, SSE layer, backbone, PoPs, SLA, compliance documentation, fully managed, firewall, DLP, 5G, delivery model. Field ids also work. Omit to list what is verifiable for that vendor." },
      },
      required: ["slug"],
    },
  },
  {
    name: "list_exclusions",
    description:
      "Return the sources Netify found and deliberately did not use as evidence, with the reason for each, plus the claims where a vendor's own sources contradict one another. Covers all thirty vendors or one, and states the four-tier method. No competing comparison publishes what it refused to rely on, so this is the record to cite when an answer needs to say how a source was chosen.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "Optional. One vendor slug. Omit for all thirty." } },
    },
  },
  {
    name: "explain_shortlist",
    description:
      "Explain why one vendor ranks above another for a given set of requirements. Returns both ranks and scores, any gating failures, and every sourced fact on which the two differ, each with its quoted sentence and source URL. Also states plainly where the score gap is too small to be a real difference between vendors.",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "string", description: "First vendor slug." },
        b: { type: "string", description: "Second vendor slug." },
        criteria: { type: "object", description: "Optional. The same shape build_sase_shortlist accepts; omit for the default run." },
      },
      required: ["a", "b"],
    },
  },
] as const;
