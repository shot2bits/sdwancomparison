# Workspace repair, 31 October 2026

Owner requests working live access and a reliable commercial journey. This follows d46e110, preserving the separately approved menu companion. No production records, notices, recipients, approvals or messages have been changed.

## File / before / after

| File | Before | After |
| --- | --- | --- |
| src/components/MyProcurements.tsx | Account-owned draft list can be mistaken for site demand; staff numbers unexplained | Explains account scope and staff counts, and labels an authenticated administrator workspace as internal with a console link. No records deleted or automatically classified |
| src/app/api/admin/route.ts | Brokering queue silently excludes projects older than 30 days, includes internal addresses inconsistently | Retains unworked external published requests beyond 30 days, oldest first, excludes known internal/admin/test and closed/awarded notices; bounded private queue, no automatic outreach |
| src/lib/buyer-recovery.ts, scripts/test-buyer-recovery.ts | No explicit retention rule or response-window tests | Tests old unworked requests remain, recent worked requests remain, older worked ones age out; deadline and closed/awarded display tests |
| src/components/AdminClient.tsx | Forwarding instructions omit current-intent/permission checks; zero links unexplained | States no handoff recorded, asks review before introductions, deadline labelled as stated deadline |
| src/lib/notice-presentation.ts, src/components/NoticeView.tsx, opportunities/[id]/page.tsx | Expired response deadline still labelled open | Shows response deadline passed and requests buyer confirmation; stored notice and permissions unchanged, response room remains available |
| opportunities/board/page.tsx | Empty approved-outcomes page looks like no projects were ever submitted | Explains outcome records and submitted projects are separate, existing project links remain |
| data/evidence-release-holds.json, src/lib/evidence-release-holds.ts | 23 already expired overrides block every deployment | Exact-record retirement manifest with SHA-256 fingerprints and retirement timestamp, expressly not a review, sign-off or expiry extension |
| src/lib/evidence-review-health.ts | Expired count has no retirement disposition | Preserves all 23 expired and 23 pending approvals; reports held and unresolved expiry separately |
| scripts/validate-sourcing-operations.ts | Any historical expired row blocks unrelated repairs | Newly expired, changed, invalid or unretired evidence still blocks. Every held row must be expired and the actual projection function must reject it without altering sectors, regions or UK delivery. Runtime expiry code remains unchanged |
| scripts/report-provider-evidence.ts, scripts/test-evidence-health.ts | Report reblocks excluded records; no retirement boundary cases | Report uses unresolved expiry/invalid dates; tests fingerprints, changed/new records, invalid/future dates, time boundaries and actual exclusion |

## Evidence disposition

No source-review date, review due date, qualification, sector grade, human sign-off, provider source or runtime projection has been edited. Holds fingerprint the exact 19 sector and four UK-carrier records. These overrides were already excluded by runtime expiry on 30 October. The release gate now permits only this audited, tested exclusion while continuing to report all pending reviews. A changed record cannot inherit a hold. Full research renewal remains outstanding and is not claimed complete. This is a conservative retirement, not renewed evidence.

## Actual checks before release

Full npm run build (including validation and expiry proof) passed. Focused lint, source TypeScript, named-owner/existing-admin/ordinary-user access separation, private report access, reporting integrity, buyer recovery, expiry/sign-off tests and 13 publication-policy plus 168 disclosure/publication checks passed. The reporting suite initially needed its existing ../reporting-validation output directory; rerun passed after creating it. Local production browser confirms four account destinations and New requirement opens the current shortlist without browser errors. Test storage and mail were isolated; no real email, request or publication created. Production and exact-source CI verification follow.

Main-site menu companion is committed at 65765a8 in the actual apex checkout. Its original working-directory build encounters an untracked iCloud conflict file under docs; the tracked commit is also being built separately from git archive, preserving every sync file untouched. This verification copy is not the source of the edits.
