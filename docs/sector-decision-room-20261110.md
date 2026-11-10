# Sector decision room

Replaces the sector feature questionnaire with one shared buying brief across priorities, design choices, provider evidence and a decision pack. All ten existing sectors, all operating and geographic choices, all additional requirements and all available providers remain accessible. Business outcomes propose preferred requirements; the buyer alone sets mandatory requirements. Architecture choices create acceptance and responsibility questions, not unsupported provider grades.

## Data preservation

The published provider API remains the read-only source. No Neon rows, source dates, private commercial records or publication settings are changed. The public loader preserves unknown metadata and future fields. Each provider exposes the full interpreted research and original public record; search can be cleared to restore every row. Large text fields are rendered without character cuts or line clamps. Showing six providers at a time is explicit pagination, with access to every remaining provider and mandatory mismatch.

Word and Markdown exports offer a complete selected-provider research appendix, selected by default in the interface. All record fields, identifiers, sources, source dates, cases and qualifiers are retained. A compressed complete-library archive retains every available provider, including mandatory mismatches, and refuses a partial source load. The separate complete research JSON includes original public records, interpreted comparison records, the full comparison context and original buyer checklists. Existing stale-evidence fingerprint checks protect every export format. The original 30 checklists and 38 dated fact checks remain intact.

## Requirement reading

The optional brief review reuses the existing model-first workspace_ingest service, including its paragraph chunking and provenance checks. Buyer notes are sent in full within the existing 6,000-character brief allowance. Oversized text remains in the browser and is explicitly rejected rather than shortened. The review shows whether a model or structured fallback was used and keeps stated and inferred suggestions separate. It cannot change mandatory requirements, evidence grades, selected providers or publish anything. All output is rendered as text. Exports label any accompanying review as unconfirmed advisory material, separate from source-linked evidence.

## Validation

Regression tests cover all ten sectors, scenario-specific acceptance tests, architectural responsibility tensions, complete review input, source metadata and future fields, long research text and contextual decision packs. UI tests cover progression, shared choices, request payloads, complete appendix default, oversized text retention, stale export invalidation and honest AI fallback. Existing provider evidence, 30-checklist and live-site checks continue to apply.
