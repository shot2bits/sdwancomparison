// Corrected owner-approved 55-tool decisions. Local replacement surface only.
export const CORE_LEGACY_TOOL_DECISIONS=[
  {
    "name": "prepare_sourcing_plan",
    "decision": "Replace",
    "replacement": "`get_next_action`, `prepare_pricing_request`"
  },
  {
    "name": "request_comparable_proposals",
    "decision": "Replace",
    "replacement": "`prepare_pricing_request`; no supplier sending"
  },
  {
    "name": "get_sourcing_request_status",
    "decision": "Replace",
    "replacement": "Project-scoped `get_project`, `get_supplier_responses`"
  },
  {
    "name": "build_sase_shortlist",
    "decision": "Replace",
    "replacement": "Public multi-provider `get_provider_evidence` for open factual comparisons; gated `get_provider_assessment` only for personalised fit"
  },
  {
    "name": "list_sase_features",
    "decision": "Replace",
    "replacement": "`list_products_and_features`"
  },
  {
    "name": "list_sase_vendors",
    "decision": "Replace",
    "replacement": "`list_providers`"
  },
  {
    "name": "get_sase_vendor_profile",
    "decision": "Replace",
    "replacement": "`get_provider_evidence`"
  },
  {
    "name": "compare_vendors",
    "decision": "Replace",
    "replacement": "Public multi-provider `get_provider_evidence`; no project or capability required for facts"
  },
  {
    "name": "get_demand_index",
    "decision": "Replace",
    "replacement": "Public `get_research(topic=\"demand\")`, plus documented resources"
  },
  {
    "name": "verify_claim",
    "decision": "Replace",
    "replacement": "`get_provider_evidence` with claim/source qualification"
  },
  {
    "name": "list_exclusions",
    "decision": "Replace",
    "replacement": "`get_provider_evidence` exclusions and limitations"
  },
  {
    "name": "explain_shortlist",
    "decision": "Replace",
    "replacement": "`get_provider_assessment` reasons and gaps"
  },
  {
    "name": "get_sector_evidence",
    "decision": "Replace",
    "replacement": "`get_sector_recommendations` plus source-linked provider evidence"
  },
  {
    "name": "read_studio_project",
    "decision": "Replace",
    "replacement": "Capability-scoped `get_project`"
  },
  {
    "name": "save_studio_requirement",
    "decision": "Replace",
    "replacement": "Explicit brief/site/user/RFP commands; no generic unrestricted project overwrite"
  },
  {
    "name": "read_supplier_project",
    "decision": "Retire buyer tool",
    "replacement": "Supplier-side MCP is outside the new buyer surface"
  },
  {
    "name": "request_to_bid",
    "decision": "Retire buyer tool",
    "replacement": "Supplier workspace remains separate; no new buyer dispatch command"
  },
  {
    "name": "message_studio_buyer",
    "decision": "Retire buyer tool",
    "replacement": "Supplier-side messaging is outside this surface"
  },
  {
    "name": "start_project",
    "decision": "Replace",
    "replacement": "`create_project`"
  },
  {
    "name": "update_requirements",
    "decision": "Replace",
    "replacement": "`set_business_brief`, `set_products`, `add_sites`, `apply_shared_plan`, `set_site_exceptions`, `set_user_requirements`"
  },
  {
    "name": "preview_provider_matches",
    "decision": "Replace and split",
    "replacement": "Pure `get_provider_assessment`; any snapshot persistence is a separate explicit write"
  },
  {
    "name": "prepare_publication",
    "decision": "Replace",
    "replacement": "`prepare_pricing_request`, with version and recipient preview"
  },
  {
    "name": "publish_opportunity",
    "decision": "Retire buyer tool",
    "replacement": "Verified-human web approval and dispatch only, after the separately approved later phase"
  },
  {
    "name": "get_project_status",
    "decision": "Replace",
    "replacement": "`get_project_readiness`, `get_next_action`"
  },
  {
    "name": "get_unlocked_matches",
    "decision": "Replace",
    "replacement": "`get_provider_assessment`, gated on reviewed scope, not a new publication requirement"
  },
  {
    "name": "get_rfp",
    "decision": "Replace",
    "replacement": "Capability-scoped `get_living_rfp`"
  },
  {
    "name": "list_rfp_questions",
    "decision": "Replace",
    "replacement": "Public `get_research(topic=\"questions\")` exposes the existing 386-question bank, also a documented resource"
  },
  {
    "name": "get_rfp_evidence_draft",
    "decision": "Replace",
    "replacement": "`get_provider_evidence`, preserving draft versus supplier-confirmed distinction"
  },
  {
    "name": "respond_to_rfp",
    "decision": "Retire buyer tool",
    "replacement": "Supplier response submission is not in the buyer surface"
  },
  {
    "name": "get_rfp_status",
    "decision": "Replace",
    "replacement": "`get_project_readiness`, `get_supplier_responses`"
  },
  {
    "name": "supplier_inbox",
    "decision": "Retire buyer tool",
    "replacement": "Supplier-side capability, outside buyer surface"
  },
  {
    "name": "publish_rfp",
    "decision": "Retire buyer tool",
    "replacement": "Verified-human web approval and dispatch only"
  },
  {
    "name": "list_opportunities",
    "decision": "Keep",
    "replacement": "Public read, board URL and homepage link retained, confirmed by owner on 14 November"
  },
  {
    "name": "opportunity_inbox",
    "decision": "Retire buyer tool",
    "replacement": "Supplier-side capability, outside buyer surface"
  },
  {
    "name": "opportunity_respond",
    "decision": "Retire buyer tool",
    "replacement": "Supplier-side capability, outside buyer surface"
  },
  {
    "name": "supplier_reply",
    "decision": "Retire buyer tool",
    "replacement": "Supplier-side capability, outside buyer surface"
  },
  {
    "name": "get_opportunity",
    "decision": "Keep",
    "replacement": "Existing public opportunity read and URL; private project reads still require capability"
  },
  {
    "name": "draft_opportunity_notice",
    "decision": "Replace",
    "replacement": "`prepare_pricing_request` produces an unissued, versioned preview"
  },
  {
    "name": "validate_opportunity_notice",
    "decision": "Replace",
    "replacement": "`get_project_readiness`, `prepare_pricing_request`"
  },
  {
    "name": "generate_rfp_from_opportunity",
    "decision": "Replace",
    "replacement": "`create_project`, explicit scope writes, `get_living_rfp`; no implicit public-notice conversion"
  },
  {
    "name": "netify_validate_circuit_request",
    "decision": "Replace",
    "replacement": "`get_project_readiness` for the priced site scope"
  },
  {
    "name": "netify_read_circuit_responses",
    "decision": "Replace",
    "replacement": "Capability-scoped `get_supplier_responses`"
  },
  {
    "name": "netify_estimate_sase_tco",
    "decision": "Keep isolated modelling capability",
    "replacement": "Retain the implementation as provisional modelling outside the new buyer pricing tool set. No dependency or data path into `get_price_lines`. Document a separate research access path at Phase 3, not an additional buyer pricing tool."
  },
  {
    "name": "netify_get_sase_provider_categories",
    "decision": "Replace",
    "replacement": "`list_providers`, `list_products_and_features`"
  },
  {
    "name": "netify_get_sase_demand_stats",
    "decision": "Replace",
    "replacement": "Public `get_research(topic=\"demand\")`, plus documented resources"
  },
  {
    "name": "netify_get_sase_cost_drivers",
    "decision": "Replace",
    "replacement": "Public `get_research(topic=\"cost_drivers\")`; no estimate output or assumed prices"
  },
  {
    "name": "netify_get_delivery_model_comparison",
    "decision": "Replace",
    "replacement": "Public `get_research(topic=\"delivery_models\")`, plus documented resources"
  },
  {
    "name": "assess_security_requirement",
    "decision": "Replace",
    "replacement": "`get_sector_recommendations`, `get_project_readiness`, `get_next_action`; suggestions remain unconfirmed"
  },
  {
    "name": "create_security_project",
    "decision": "Replace",
    "replacement": "`create_project`, `set_business_brief`, `set_products`"
  },
  {
    "name": "generate_security_rfp",
    "decision": "Replace",
    "replacement": "`get_living_rfp`, `update_rfp_section`; existing question bank reused"
  },
  {
    "name": "rescope_security_project",
    "decision": "Replace",
    "replacement": "Explicit scope-edit commands with revision checks"
  },
  {
    "name": "get_security_project_status",
    "decision": "Replace",
    "replacement": "Capability-scoped `get_project`, `get_project_readiness`"
  },
  {
    "name": "continue_security_conversation",
    "decision": "Replace",
    "replacement": "`get_next_action` followed by explicit writes on buyer instruction"
  },
  {
    "name": "workspace_cycle",
    "decision": "Replace",
    "replacement": "Explicit scope operations; no hidden writes in a read operation"
  },
  {
    "name": "workspace_ingest",
    "decision": "Replace",
    "replacement": "`import_sites` for locations; reviewed `set_business_brief` and explicit requirement operations for other content"
  }
] as const;
