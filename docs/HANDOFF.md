# Comparison and attribution repair — 19 September 2026

Work continues from verified production 47c6d64 on `codex/lead-measurement-20260919`; stale `main` was inspected but NOT merged. Repair exact capability mappings, remove unrelated proxy evidence, preserve partial/partner grades in composite SASE, and add six dated vendor-documentation corrections with visible scope, expiry and newer-governed-review precedence. Public comparison and MCP claim verification share these corrections. No supplier invitations, policy-gate changes or database imports.

Add the four shortlist landing paths to attribution, canonicalise the tested old builder alias, rename generic browser form submission to `form_submit_attempt`, and tighten qualified-project reporting cutoffs. Apex's matching attribution patch is on `codex/shortlist-attribution-20260919`. No historical analytics relabelled.

Targeted mapping/evidence, attribution/privacy, activity/access, comparison-interface and MCP-boundary tests passed; TypeScript passed; full validation/build passed before the final MCP parity amendment, with a final candidate build pending. Source-feed credentials are absent locally, so existing live-source tests disclose snapshot fallback. No claim of buyer observations or production deployment yet. Live/private reconciliation currently needs an admin sign-in. Keep actual deployment and apex verification as a separate follow-up entry.

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
# Measurement changes — 19 September 2026

Work branch `codex/lead-measurement-20260919`, based on verified Git production 220253707ca15f5dd43c60fb98739e20230bc611 (dpl_37XpL4bXQrMANFCywDDHKjWktrjN). Production alias project-8q2xb.vercel.app follows this project; no alias reassignment is required.

Retains the private-route Google Analytics guard. Stops nonproduction commercial tracking; consent-gates first-touch storage; carries the apex coarse landing/source category into consented events without identifiers; renames UI source to interaction_source for GA. Principal RFP creation routes store a sanitised, private 90-day attribution sidecar, never in public projects/snapshots. Admin activity reporting now defaults to the trailing seven days and groups attributed draft/publication activity separately from independently qualified projects. Unsupported/historical attribution stays unknown.

Pre-release: full production build including validation suite passes; activity reporting/access tests pass; new measurement attribution/deduplication/environment checks pass; TypeScript passes. No customer publication, invitation, notification or live synthetic enquiry. No schema migrations or matching-policy changes.

Released through Git integration at 47c6d64c8503575216bd0d14d6012291c2855944, production dpl_62v5UL8d5SUXVyHRQAv83AYMYavP. project-8q2xb.vercel.app points to this Ready Git deployment. netify.co.uk/sase-sd-wan-rfp-builder/ rendered the existing saved-project choice, version 1909261144, footer build 47c6d64; no project resumed or created. Only the Vercel analytics loader was present, no Google loader, no browser console errors. Admin activity-report rejects anonymous requests with 403/private,no-store. Apex live regression suite after both deployments: 36 passed, zero failed at 10:47 UTC. Deployment-filtered runtime error search through 10:49 UTC returned no matching logs (limited observation window).
