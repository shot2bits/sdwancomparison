// Versioned inter-service vocabulary. No new provider claims or commercial adapters.
export const PROVIDER_CAPABILITY_CONTRACT = {
  "version": "netify-provider-capabilities/2026-09-15.1",
  "identity": {"provider_id": "Use the immutable ID from the approved provider record; never derive it from a display name", "slug": "Public route alias, not a substitute for provider_id", "revision_id": "Approved source revision", "dataset_version": "Source catalogue version"},
  "evidence": {"capability_code": "Use the published capability vocabulary for the named dataset", "source_grade": "Preserve the published grade; missing evidence is not positive", "source_url": "Primary supporting source", "verified_at": "Evidence verification time"},
  "computed_recommendations": {"service": "sase", "requires": ["completed_publication", "verified_owner", "project_credential"], "source": "frozen_published_revision"},
  "commercial_adapters": {"bt": {"endpoint": "https://netify.co.uk/api/mcp/", "declared_actions": ["request_design_and_quote", "request_btnet_price", "submit_reseller_application"], "contract_signature": "human_required"}},
  "undeclared_provider_actions": "unsupported_until_explicitly_implemented",
  "service_unification": false
} as const;
