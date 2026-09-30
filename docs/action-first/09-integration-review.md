# Integration review — 30 September 2026

Production is frozen. This is a tested preview implementation, not proof of AI recommendation uplift or a supplier-backed completed procurement.

## Completed engineering

- Confirmed sourcing request opens the existing private RFP under its original project ID. Project-scoped HttpOnly cookie lasts 30 days; existing owner account access remains supported.
- Requirements, private Word/Markdown exports, connectivity requirements and supplier proposal comparison share that ID and existing stores. No public listing is needed. Connectivity edits survive tab switching.
- Staff-only proposal recording requires an approved supplier and an asserted written source. Retries cannot silently replace a proposal or duplicate a completed review. Provider display names come from the provider dataset.
- Comparisons separate currency and charging basis; missing prices remain missing. No requirements is no longer reported as 100% coverage. Publication remains an optional separate action, not an implication of email confirmation.
- Auth-specific market responses use private, no-store caching. Private brief material is excluded from the supplier-facing requirement text unless separately approved.
- Server-confirmed sourcing requests and projects receiving proposals have distinct, replay-deduplicated reporting. Preview events are excluded from production totals. Consent-change handling added to SASE.

## Validation

Action-first contract and request/confirmation route tests pass, including shared project IDs, access isolation, expiry, consent, replay, concurrent mail/confirmation, owner recovery, private export, proposal retry recovery and zero required-question handling. Sector adjudication, comparison, buying funnel, MCP and circuit pricing checks pass. Focused lint passes. Non-mutating Next.js production build passes. The legacy full validation command is not certified for the changed publication policy.

A local browser walkthrough used an isolated synthetic storage/mail fixture and demonstrated the RFP, connectivity and proposal tabs. It was not a real buyer, supplier proposal or commercial transaction. A final hosted public-page check and live-source report are recorded separately below.

## Source review

72 rows have dispositions, including the 68 remaining rows: 24 verified named, 6 anonymous, 1 partner case, 12 adjacent service, 7 outside taxonomy, 17 insufficient source, 4 wrong sector, 1 planned not delivered. Only qualified evidence informs dated preview projections. Source adjudication is complete; replacement evidence for the 17 insufficient rows and human release approval are not.

## Outstanding acceptance

- Supplier commitments, introduction acknowledgements and Harry-approved copy: pending external evidence. See 10-commercial-copy-approval.md. No outreach sent.
- Clean logged-out search baseline: Safari Private Browsing requires user unlock. Existing signed-in tests excluded. Baseline rows remain not_collected.
- Measurement: both Vercel projects enabled with data, but apex and SASE consent behaviour differs; direct SASE consent collection, coverage denominator and later operational outcome stages still require acceptance. No before/after uplift claim.
- Operational pilot: authenticated proposal API exists; polished staff intake UI, controlled amendment after connectivity approval, and actual supplier-response handling require pilot acceptance.
- Projection expiry is 30 October 2026 and must trigger renewed review. No Neon data writes were performed.

## Hosted acceptance — code commit b0aa0a6

Preview: https://sasecomparison-j8l5ngbkf-netifymarketplace.vercel.app/sase/shortlist/
Consumer deployment dpl_5bEmbdrQnox82iYrhwCRpmpjDwQh is READY. Producer deployment dpl_46ciZhJ7FGQHSQHtnXoxZYyLMJeS is READY on companion commit 497046f. Only preview-branch credentials and data URL were configured; production credentials and branches were unchanged. The authenticated feed now returns source neon, 30 providers and provider-match-records/2.0.0. HTTP 200, noindex/nofollow, and no snapshot-fallback notice were verified.

Read-only hosted tests: healthcare SASE 0 evidence matches; healthcare SD-WAN 0; manufacturing SD-WAN 2 (Cisco, Aryaka); financial-services SD-WAN 0. Public evidence inspection shows HPE has healthcare and finance evidence, Lumen partial healthcare, and BT/Netskope finance, but these profiles have UK/Ireland coverage not_confirmed. These are geography-evidence gate exclusions, not proof they cannot supply. This is a release blocker for automatic sector shortlisting. Repair UK delivery provenance; do not manufacture positive grades or infer current supplier-confirmed fit. The manual desk route remains available.

The healthcare browser flow reached the draft plan, recipient approval and work-email stages without sending a request. The live MCP prepare_sourcing_plan result is retained in hosted-mcp-check.json; matching must agree with the web result.
