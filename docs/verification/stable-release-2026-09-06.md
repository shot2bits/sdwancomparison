# Release hardening acceptance record

Scope: buyer-facing workspace and all exposed routes/actions; public provider evidence; MCP and OpenAI submission readiness. Freeze features; retain existing capabilities. Baseline bc32503 (production), repo receipt 1013600.

## Gates
1. Inventory and truthful assessment UX: no misleading procurement-ready certification; show actionable findings, no dropped controls.
2. Buyer journeys: manufacturing 5 UK sites, 15 sites (10 UK/5 overseas) with 30 remote users, and global enterprise; save/reopen/correct; all document depths and bespoke questions; imports; private publication review.
3. Comparisons, sourced pricing and ancillary workspace controls: every exposed control inventory, failure/empty states and account boundaries.
4. Code/API/persistence/permissions and MCP: real public tool calls; controlled fixtures for private writes and notifications; connector compatibility documented.
5. Public evidence: accessible and accurately labelled SASE RFP and vendor/provider evidence; canonical/robots/schema/link checks; no guaranteed citations or unsupported supplier participation claims.
6. Production candidate, regression, promotion and live smoke; rollback reference and known limitations; submission materials, no unverified attestations.

Each stage records its evidence and defect disposition before moving on. No fictional notices or emails will be sent to live suppliers. “Passed” means the recorded checks passed, not mathematical absence of defects. End-to-end identity/email delivery and published marketplace traffic require separate evidence; fixture tests must not be labelled live results.

## Feature inventory
Workspace: New project; saved drafts; project/account; Basic requirements; Short RFP; Detailed RFP; RFP/RFI upload; voice; Google document import; requirement questions and revisions; recommended and bespoke questions; section switching; supplier pack; document settings; preferences; review/publish; activity/version review; Memories; Skills; All tools; Connections; sidebar collapse/mobile navigation.
Market: named comparisons; vendor vs managed-provider category research; needs-based shortlist; saved project responses; opportunity board; cost/TCO estimate; circuit request (UK/international, sites/remote/SIM, bandwidth/resilience/router optional UK edge/device protection); market-response notifications.
Protected: verified buyer/company publication, project ownership, unpublished export/matching boundary, supplier identity, consent, authentication failures, concurrency, private URL handling.

## Checks completed for this release
- Full `npm run validate` passed. TypeScript check passed. Marketplace foundation suite passed, including controlled publication, ownership, project persistence and MCP cases.
- Five sector browser journeys: Manufacturing, Healthcare, Retail, Financial Services and Government; 15 sites, 10 UK/5 overseas and 30 remote users; save/resume, Short/Detailed modes, bespoke question and publication review. Government save-status wait timed out in the combined run; isolated rerun passed. This timing failure remains recorded, not counted as a confirmed data-loss defect.
- Pure extraction/checker matrix: all five sectors at 5/15/120 sites. These are code tests, not 15 full browser journeys.
- Assistant desktop/mobile fixtures: save/reload/forget memory, selected memories in skills, reviewed handoff, retained draft, stale revision rejection and responsive layout passed. Reload test corrected to use the existing Resume saved project gate.
- Account tests: signed out does not request private records; authenticated empty state; failed fetch is not displayed as empty. Cost estimate minimum, input invalidation and late response race passed.
- Circuit UI/API controlled tests: UK/international restrictions, optional edge/protection, reviewed publication, private ownership, quote idempotency and failed-notification retry passed. These do not prove real supplier quotes or live email delivery.
- TXT import exact source and oversized-input rejection passed. Comparison-to-project handoff passed.
- SASE worked example: HTML, JSON/text parity, both depths, all 43 detailed questions, bespoke question, invalid depth, desktop/mobile and checker deep link passed.
- MCP read-only HTTP checks: 46 tools, initialization, named comparison/handoff, provisional costs, circuit validation, denied private reads, example resources passed. No live notice or email was created.
- Real connected tools: vendor catalogue and healthcare shortlist calls succeeded. Installed connector exposes 32 older tool definitions whereas the current server exposes 46; it needs rescan/review. This is an OpenAI readiness gap, not an approved listing.
- Release header: 1440/390px on workspace, SASE example and circuit page; correct 10-digit timestamp, visible at top, no horizontal overflow. Time-zone unit cases include BST, GMT and midnight rollover.

## Changes
The checker describes topic coverage rather than declaring an RFP procurement-ready. All findings and suggested questions remain accessible. Numerical compatibility fields remain in the API with explicit limitations. Government-specific topic checks added. The initial workspace explains building and publishing directly. Shared top-of-page version uses build time in Europe/London, DDMMYYHHmm; it does not change on refresh.

## Known limits / outstanding acceptance evidence
The legacy `validate-rfp-builder-flow-ui.mjs` still targets retired navigation; it was stopped at an obsolete hidden control. Its updated wording assertions do not make that entire old suite current. Current-layout journeys and dedicated coverage/header tests provide the checks for this release.

Voice permissions across browsers, real identity/email delivery, authenticated external-client end-to-end publication, all file types with representative real documents, and every ancillary control permutation have not been fully re-certified in this pass. The platform is not declared defect-free or submission-approved. A production login and connector rescan/reviewer journey are required before claiming submission readiness. No suppliers, real customer outcomes, citation gains or final sourced prices are fabricated. Supplier participation is still developing; MCP connectivity does not guarantee search citations.

Additional checks: dedicated current-layout coverage review passed against the actual local checker endpoint (eight sections, expandable full findings, no readiness-score headline). Draft storage tests passed both normal saving and injected quota failure with a visible failure message. Targeted ESLint and final TypeScript passed. All these checks preceded production promotion.

## Candidate rejection and fix
Candidate 15edd5b was not explicitly promoted, but a direct public check later showed it had reached Netify through Vercel’s automatic project alias despite --skip-domain. The automatic alias was explicitly restored to baseline deployment ggiryl9fh; Vercel’s production rollback command alone did not restore it because the formal production pointer was already the baseline. Live candidate browser checks detected React hydration errors and differing timestamps (1553/1554) between pages: next.config evaluated a new clock separately in build workers. Replaced that with a build wrapper that supplies one inherited NETIFY_BUILD_TIME to validation and Next workers; next.config no longer generates time. Strengthened the header check to require exactly one version across all pages/viewports as well as zero page errors. Replacement candidate must pass before promotion.

## Final release receipt
- Code commit: 104c674 (includes 15edd5b feature changes and shared-clock fix).
- Deployment: https://sasecomparison-n1j2p7wk6-netifymarketplace.vercel.app
- Public version: **0609261556** (6 September 2026, 15:56 Europe/London, fixed build-start time).
- Formal promotion succeeded; automatic proxy alias explicitly assigned to the same deployment.
- Replacement candidate: full build/validation/TypeScript passed; zero page errors in header and example checks; identical timestamp across 1440/390px workspace, example and circuit pages; full/short/RFI/sidebar layout checks passed; actual checker review passed after waiting for its response before navigating to Supplier pack.
- Public canonical builder, example and circuit pages: same version at both widths, no horizontal overflow or observed page errors. Live read-only MCP regression passed with 46 tools.
- Rollback reference: https://sasecomparison-ggiryl9fh-netifymarketplace.vercel.app (bc32503). The proxy alias `sasecomparison-netifymarketplace.vercel.app` must also be explicitly reassigned when rolling back; formal production state alone is insufficient.
- Future staged releases must not assume `--skip-domain` isolates the public proxy. Inspect/hold this automatic alias separately or change the proxy to a controlled production alias before relying on candidate isolation.

The remaining external-client/identity/email and exhaustive-control acceptance limitations above still apply. This receipt certifies the recorded checks, not a zero-defect platform or OpenAI approval.
