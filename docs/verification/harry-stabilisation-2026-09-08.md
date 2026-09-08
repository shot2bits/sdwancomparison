# Netify stabilisation verification, 8 September 2026

## Release baseline

Baseline: clean git 5b0e05c; production runtime 01595d5, version 0609262328.
Rollback deployment: sasecomparison-rgl3tq53t-netifymarketplace.vercel.app.
Preserve the main site's explicit engine alias sasecomparison-netifymarketplace.vercel.app when promoting or rolling back. No migrations or feature removals.

## Repairs and evidence

| Area | Change or finding | Verification |
|---|---|---|
| Publication receipt | Removed zero-vendor submission success and unsupported invitation/response promises. Published and saved-unpublished states are separate. | Receipt regression passed. Live empty review did not advance. Publication policy and fake-KV rejection/idempotency checks passed. Local browser completed review, consent, verification and publication. |
| Basic requirements | Opening review while extraction is busy now waits, copies completed facts and provides recovery guidance after a bounded wait. | Live timing failure reproduced before repair. Candidate retained 15 sites, sector, regions and timescale through review. Consent and submit disabled during processing. |
| Return navigation | Preview returns to the workspace. Verification recognises /sase/home and saved-project id links as well as canonical/project links. | Allowed and rejected return-path tests passed. Local browser verified email, returned to the saved project, downloaded Word and used Back to your workspace. |
| RFP preservation | Retained short/detailed depth, all sections, recommended and bespoke questions, original-document entry and exports. | Live bespoke QA wording survived depth switches and reload, found in expanded captured requirements. Local Word import retained provenance and unplaced lines. Local published Word download triggered. Full document/source/export regression suite passed. |
| First action | Added Describe what you need, focusing and scrolling to the composer. | Candidate browser confirmed focused aria-label. |
| Small screens | Input now precedes notice preview. Fixed hidden-icon grid leaving text in a 28px column. | Desktop text column measured 486px after repair. At 390px viewport input precedes notice and page scroll width equals viewport width. This is emulation, not a physical phone test. |
| Accessibility and navigation | Clear Supplier document / Document settings labels; visible native disclosure markers; main headings for Compare/Responses/All tools; darker shared navigation text; lazy-panel loading messages. | Browser opened All tools, Memories, comparison and RFP controls. Visible main heading checked; first-action focus checked. No claim of full screen-reader certification. |
| Captured counts | Replaced incorrect remote-users label with users in scope in summary and architecture. | Browser reproduced 900 total users labelled remote. After repair summary says 900 users in scope. Named location single UK HQ already persisted, visible under View all. No total estate size invented. Input and document tests passed. |
| Circuit specifications | Early connection validation rejects duration-only bandwidth. Preserved UK-only optional edge choices, optional CrowdStrike, contacts, SIM quantities and failover. Correct sentence spacing. Storage failures handled. | Browser tested invalid bandwidth, 1 Gbps, RA02/load balancing/Fortinet, Germany contact rejection and completion, 30 UK remote SIMs with optional protection. Summary 2 locations / 30 remote connections. Bulk update affected UK Ethernet only. |
| Circuit signup | First-time pricing buyers can verify against a validated, explicitly approved private pricing draft without first creating an RFP. Existing ownership and no-overwrite rules retained. | Actual auth-route integration test and browser passed. Browser returned from verification to original addresses/SIMs, required final approval and reached sourcing status. Pre-verification draft creates no notice/session. |
| Circuit operator | Preserved actual quote entry, owner privacy and notification retry. | Browser denied buyer access to operator queue. Operator added GBP325/month quote against correct site. Disabled-mail failure displayed retry; retry left one quote. Store/API tests covered ownership, frozen specs, quote idempotency and accepted-notification deduplication. |
| Requests | Avoided signed-out circuit private-list fetch by checking session first. No auth bypass. | Candidate circuit browser error log empty on signed-out requirements load. Live board and an actual listing opened with no browser errors observed. Previously reported sixteen 404s not reproduced. |
| Comparison/handoff | Preserved public comparisons and provenance. | Live three-provider selection, share link, provider replacement and clearing of prior answer, healthcare requirements handoff to canonical builder. Comparison security/uniqueness and provider-foundation regressions passed. |
| Memory / MCP | No capability removed. | Memory ownership, corrupt records, concurrent revisions, changed-login isolation and approval checks passed. Eight MCP output-schema/continuation checks and marketplace identity/consent/MarketUnlock tests passed. |

## Automated checks

Passed: full npm validate; production npm build; marketplace-foundation suite; targeted publication receipts; circuit-pricing store and actual auth/API checks; acceptance save/history/correction/input/comparison/auth/supplier access; 15 sector/scale combinations; ten-sector profiles; buyer-memory isolation; secondary audit checks; MCP structured continuation; changed-file lint; TypeScript; git diff whitespace check.

Local builds without a live provider-source environment used the reviewed provider snapshot and logged that fallback. Local browser provider matching used an explicitly labelled acceptance fixture. Neither proves production feed freshness by itself.

## Test environment and remaining acceptance limits

Browser interactions used the in-app browser on production public pages and localhost:3137. Local Next routes and React components were real; storage was an isolated Redis-protocol fixture, and email sending was disabled. The fixture was extended to support circuit sorted-set indexes. Restarting it cleared local-only records; no production QA notice or supplier quote was created in this run.

Harry's 157 rows were reconciled against the 158-case plan, including missing S09. This report is evidence for the repaired journeys and regression suites, not a claim that all 158 manual cases and worksheet combinations passed individually. Original blocked/blank cases are not silently converted to passes.

Not certified by this run: delivery into a real inbox; physical iOS/Android and assistive-technology checks; each external AI application's installed-MCP consent interface; real supplier participation; AI citation or OpenAI directory acceptance. The app cannot guarantee supplier responses or citations.

Production deployment and final live results are recorded below after promotion.
