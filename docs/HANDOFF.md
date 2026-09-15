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

## Git production and origin verification

Git production deployment dpl_37XpL4bXQrMANFCywDDHKjWktrjN built commit 220253707ca15f5dd43c60fb98739e20230bc611 from codex/publication-first-comparison. Registered project domain project-8q2xb.vercel.app reads back the new code. JSON preservation check passes: same 30 providers, dataset, order, grades, counts and dates; only four intended public narrative excerpts differ.

Initial apex acceptance correctly failed: the BT application's rewrite targets the historical team alias sasecomparison-netifymarketplace.vercel.app, which still resolves to dpl_BSSXHwUcKr2rp4A4VBQCAU4LBFUH. BT work commit 6680c05 changes only those four internal origins to the registered Git-managed production domain. No manual alias move or deployment promotion. Apex acceptance remains pending the BT Git release.

## Final apex acceptance — 15 September 2026, 22:13 UTC

BT integration 6680c0593570640aa608d7fb6a418f6ffc843a54 deployed from Git as dpl_EDZer6Fvg1zVB66HpRohDbFFhupy. SASE integration 220253707ca15f5dd43c60fb98739e20230bc611 deployed from Git as dpl_37XpL4bXQrMANFCywDDHKjWktrjN. After the internal origin repair, netify.co.uk serves SASE 2202537.

Actual verification: 36 live route checks passed, zero failed; six SASE page/canonical/source checks passed; same 30 provider records, order, grades, evidence counts and dates with only four narrative changes; MCP initialise/47 tools/read calls and private denial passed. Builder hydrated; Cato/Cisco comparison rendered; calculator recalculated 12 Connect licences to £163.41 with ten call plans unchanged; no browser errors. CTA/Through Netify retained; all three calculator phone links +443332021011. Google live test: URL available, page indexable, merchant listings no items, breadcrumbs and dataset valid. Indexing request accepted. No live writes, invitations or messages in validation. No migration or rollback. Full evidence in agentic-fixes-2026-09-15/Release.md in the task outputs.
