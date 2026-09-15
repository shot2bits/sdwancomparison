# SASE audit fixes — 15 September 2026

Work branch: codex/agentic-audit-fixes-2026-09-15. Base: f785b0c2609ce8b8c9b2f7bc66096b2dc384c2ce, matching the inspected production source metadata. Do not replace this base with stale main.

## Changes

- Public shortlist labels, related FAQ and MCP resource descriptions describe evidence order. URLs, titles and H1s retained.
- Four concise provider summary excerpts replace corporate histories in public list/table outputs. Full governed histories and all grades remain unchanged. Source links are recorded in provider-summary-copy.ts.
- Typed private-session failures return project_authentication_required and a safe sign-in handoff. Missing, expired and invalid sessions use the same response; no existence or credential detail leaks. Conflicts require readback; unknown failures do not encourage blind write retries.
- Discovery regression checks required tools and unique names instead of a brittle exact total.
- Two historical validation assertions were corrected. The canvas assertion expected a legacy requirement to override canonical confirmed facts. Updated that assertion to require the confirmed title to remain; revision/no-op/replay checks are retained. The lifecycle assertion now recognises the existing zero-invitation wording instead of expecting every zero-response publication to await responses.

## Release discipline

Production Git branch was inspected in Vercel and incorrectly tracked main. It was changed to codex/publication-first-comparison and read back after reload. The agreed SASE integration branch is codex/publication-first-comparison. Release must use its fast-forward from this tested work branch with corrected branch tracking; do not use production CLI uploads or promotions. Never rebase/force-push integration. Current production rollback reference: dpl_BSSXHwUcKr2rp4A4VBQCAU4LBFUH.

No customer data changes, publication, supplier messages, grade imports or migrations. Live verification must read through netify.co.uk. Deployment and final verification recorded after release.

## Pre-release verification

Full npm run build (including validation suite) passed. Public evidence ordering, canonical buyer facts and new audit-fix regression tests passed. Read-only MCP discovery passed on isolated local storage; invalid private session returned the safe authentication error. Browser comparison of Cato and Cisco rendered capability rows with no console errors. No live write tools used.
