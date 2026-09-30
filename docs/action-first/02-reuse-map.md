# Reuse map — source inspected 30 September 2026

| Page / action | Existing implementation | Change |
|---|---|---|
| Shortlist entrance | src/app/(marketing)/shortlist/page.tsx | Replace comparison-first content; keep URL |
| Live data | src/lib/live-shortlist.ts, provider-match-source.ts, getLiveShortlistDataset | Repair evidence projection, reuse source |
| Public ordering / feed | public-provider-evidence.ts; shortlist/data.json/route.ts | Coverage descending then name; open named matching |
| Evidence match | shortlist-core.ts buildShortlist | Reuse hard gates; no recommended/suitable output |
| Provider detail | Existing marketplace_url on provider | Link openly; no identity collection |
| Brief → RFP | Existing ProjectDetails, rfp-store.ts, project entrance / RFP APIs | Same internal project ID; no publication prerequisite for sourcing request |
| Connectivity | CircuitPricing component; circuit-store.ts; circuit-schema.ts; /api/circuits | Existing connectivity workflow; no new estimator |
| Public estimates | /api/cost/estimate, mcp-cost-tools.ts | Existing versioned estimator only |
| Proposal comparison | BidComparison.tsx, bid-review.ts | Reuse after written supplier response, not fictional comparisons |
| Email/storage | activity-mail.ts, rfp-store.ts KV helpers | Request-bound confirmation; no account creation; existing non-production isolation |
| Agent / MCP | api/mcp/route.ts, mcp-tool-definitions.ts | Add sourcing actions with same validation as web |
| Market Record | New redacted contract, no existing equivalent | Empty public rows until permissioned completed evidence exists |
| Mockup example suppliers, prices, decision recommendations | DELETE | No production equivalent |
| Mockup pick-two comparison | DELETE from entrance | Keep provider evidence table |
| Mockup second workspace | DELETE | Use existing project and response machinery |

An adapter is not proof of a working integration. Project creation, access, circuit links and response rendering require an end-to-end test before release.
