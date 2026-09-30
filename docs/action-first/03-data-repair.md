# Data repair status — 30 September 2026

The authorised Vercel environment export returns blank PROVIDER_MATCH_DATA_URL and PROVIDER_MATCH_SERVICE_TOKEN values. The governed feed and its row-level source references are therefore unavailable to this local audit. Do not claim the 72 strong-case-study rows have been resolved.

Implemented: remove hard-coded global-managed UK status; represent UK delivery as not confirmed when absent; remove invented zero independent-source count; retain curated sector/UK grades with the original review date in projection provenance; create a source-review queue for strong evidence with non-positive suitability; accept only dated, source-referenced adjudications that have not expired or been superseded. Research matching is open. Current supported manufacturing evidence passes through in tests; strong case-study strength alone does not.

Authority: published governed source per capability. Historic curated grades are evidence for adjudication, not an automatic override. `not_primary` indicates focus rather than inability; it cannot be used as a claim of non-support. Where the upstream feed has collapsed that distinction into `not_supported`, the original source record is required before changing its meaning. Missing evidence is not proof of inability.

BT manufacturing example: the retained curated fact's own note describes Managed Azure Network Services for Rolls-Royce rather than SD-WAN/SASE. Blind restoration of the yes grade would overstate applicability.

Public fallback: captured 30 September public feed, explicitly labelled as a snapshot. No provider score is improved to manufacture a match. Ten-sector table below compares the captured current projection with the proposed preview; unchanged values are deliberate until source adjudication.

| Sector | Before positive | Preview positive | Source adjudication |
|---|---:|---:|---|
|healthcare|0|0|Pending original source records|
|financial_services|0|0|Pending original source records|
|retail_ecommerce|0|0|Pending original source records|
|manufacturing|0|0|Pending original source records|
|energy_utilities|0|0|Pending original source records|
|government_public_sector|0|0|Pending original source records|
|education|0|0|Pending original source records|
|transport_logistics|1|1|Pending original source records|
|professional_services|0|0|Pending original source records|
|hospitality_leisure|0|0|Pending original source records|

The companion source branch now retains sector named evidence, qualifications, verified dates and source IDs in the authenticated match feed. The consumer schema preserves these optional fields and passes them to the conflict queue. This makes adjudication reviewable but does not adjudicate the 72 rows or change their grades. No Neon write was performed.
