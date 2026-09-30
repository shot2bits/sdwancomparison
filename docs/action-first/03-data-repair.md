# Data repair — 30 September 2026

The private matching-feed credentials exported empty. The public `/api/provider-knowledge/` endpoint nevertheless exposed all 30 governed profiles, which were retrieved read-only. Local capture: workspace `outputs/action-first-source-audit`. No production database write was performed.

## Confirmed defects and code changes

1. The import parser did not recognise “Strong fit” or “Good fit”. An incidental “no” could produce `not_supported`, including a missing-certification caveat. A dedicated sector parser now preserves the assessment and treats unknown/not-primary/conditional as requiring confirmation. Existing technical/editorial publication review still applies.
2. A nonempty case-study narrative was automatically graded strong. New imports leave strength unassessed unless reviewed; having a named-role quote or adjacent product is not enough.
3. The matching-feed producer discarded sector qualifications and source IDs. The companion branch retains them.
4. The feed producer treated a geography heading as positive coverage even where the finding said unknown. The companion branch now requires a positive finding plus source references. Its projection is also applied to the preview snapshot. It does not invent a UK contracting entity.
5. UK delivery is now unconfirmed until evidenced; an absent independent-source count is not zero. Curated grades and dates are retained as provenance for conflict review. Deployment speed stays unconfirmed where no reviewed evidence exists.

## Source adjudication

The 72 strong source rows comprise 66 unknown, three requires_confirmation, one partially_supported and two not_supported. `sector-row-review.csv` lists all 72. **Four have been checked against live primary sources; 68 still need adjudication.** This is not a claim that the full data repair is complete.

Dated preview overrides: Aryaka manufacturing (Albemarle); Cisco manufacturing (Peco Foods) and hospitality (Mitchells & Butlers); BT financial services (managed SD-WAN banking deployment). Cisco's UK deployment and Aryaka's UK regional-network brief/Dublin service description support partial UK/Ireland evidence; exact-site delivery and contracting remain open checks. All source URLs and qualifications are in `src/lib/provider-projection-review.ts`. Overrides expire 30 October and cannot supersede a later governed revision. No SD-WAN manufacturing grade was inferred from BT's Managed Azure evidence.

Authority: published governed source records, corrected projection semantics, and explicitly dated primary-source resolutions. Historic curated grades alone do not overrule newer governed evidence. Source grade means documented evidence, never supplier-confirmed suitability or a current quote.

## Applied sector evidence before / after

| Sector | Before | Preview after |
|---|---:|---:|
|healthcare|0|0|
|financial_services|0|1|
|retail_ecommerce|0|0|
|manufacturing|0|2|
|energy_utilities|0|0|
|government_public_sector|0|0|
|education|0|0|
|transport_logistics|1|1|
|professional_services|0|0|
|hospitality_leisure|0|1|

These counts are sector evidence, not suppliers satisfying every requirement of a brief. The public table retains all 30 providers regardless of matches. Manufacturing acceptance separately checks the UK region and SD-WAN feature gates. No source record or prospective supplier was removed to inflate the result.
