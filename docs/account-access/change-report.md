# Account access and commercial validation, 31 October 2026

Status: implemented and locally checked, NOT released. Work branch codex/account-access-and-demand-20261031. Inherits the separately approved, unreleased comparison-menu work; no existing edits were reverted. User authorised the access fixes, clearer journey, evidence-led record review, draft follow-ups and meaningful commercial measurement. No customer contact, approval, invitation, production record change or synthetic production mail.

## File / before / after

| File | Before | After |
| --- | --- | --- |
| src/lib/access-control.ts | Default admins omit Robert | Adds only rsturt@netify.co.uk alongside existing admins; an explicit ADMIN_EMAILS setting remains authoritative |
| src/lib/auth.ts | Existing admin buyer sessions cannot reach netify-role desk | Normalises a valid session for an explicitly listed administrator to netify role; ordinary buyers and non-admin Netify addresses remain unchanged |
| src/app/api/auth/request/route.ts | Missing outcome counters; review-queued responses indistinguishable from successful sends; admin may get buyer role | Bounded daily outcome counts, explicit access_pending flag, admin operational role; all existing eligibility/bot/rate/delivery gates retained |
| src/app/api/auth/verify/route.ts | No standalone access outcome counter | Records actual successful verification and failed-token/code outcomes privately; internal/admin counts separated |
| src/lib/auth-access-report.ts (new) | No access attempt/outcome report | Daily production counters with bounded audience/entry/stage fields, 90-day expiry, 30-day reader, no identities/tokens/URLs; historical gaps not backfilled |
| src/app/api/admin/access-report/route.ts (new) | No protected access report | Administrator-only private/no-store reader; errors never substituted with zero |
| src/components/AccessReport.tsx and admin/access-report/page.tsx (new) | No report view | Protected endpoint client with clear attempts-versus-people and provider-acceptance-versus-delivery definitions |
| src/app/(marketing)/admin/page.tsx | Only older outcome links | Adds access report link |
| src/app/(marketing)/account/page.tsx | Generic buyer sign-in; new-requirement link goes to dead /sase/#describe anchor | Distinct new requirement, returning workspace, supplier and reseller paths; new requests go to current shortlist; existing private panels and source copy retained except broken handoff wording |
| src/components/SignIn.tsx | Review-queued request exposes code-entry UI; project-required error is a dead end | Queued review status does not claim email sent or show a new code-entry panel; project-required refusal offers current requirement route; alert accessible |
| src/components/NetifyEvents.tsx | Every consenting account route fires buying_entry | account_view is browsing only; buying_entry restricted to actual workflow entries; bounded access-entry and route-choice events |
| src/lib/analytics-privacy.ts | No safe audience-route choice properties | Adds bounded enums only; private URL/query/identity redaction retained |
| src/lib/nav.ts | Sign in label does not identify workspace | Workspace Sign In label, same URL |
| src/app/api/cron/daily-digest/route.ts | Pending submission described as an ignored sent email; mixed access queue called vendors; internal sessions may be buyers | Distinguishes prepared submissions/contact/bounces, queue roles, internal sign-ins and legacy aggregate totals |
| scripts/test-account-access.ts (new), package.json | No owner/desk/access-counter regression gate | Isolated real-handler test for owner request and verification, existing admin desk role, ordinary-user denial, project-first gate, pending review semantics, protected private counters and explicit admin override; added to validation |

Apex companion branch codex/workspace-access-menu-20261031 changes only components/mega-nav.tsx and lib/nav.ts labels to Workspace Sign In, retaining the destination.

## Commercial work

Private shortlist and six draft messages are outside Git in Project Netify Reseller Marketplace/Commercial validation/2026-10-31/commercial-validation.html. Three existing buyer records and three relevant supplier-domain entries were prioritised. Identity, current requirement, prior correspondence and authority remain to be confirmed; a company domain does not prove a genuine authorised requester. No prospects contacted. No supplier response or introduction is promised before consent and supplier agreement. Payment terms are not invented.

The operating process is requirement confirmation -> reviewed brief -> buyer-approved recipients -> supplier agreement -> substantive response -> buyer feedback -> evidenced proposal/revenue. Public research remains open; no empty-account registration path introduced. No rates, provider profiles, evidence dates or review guards changed.

## Actual validation

- Focused ESLint on changed components, auth/report helpers/routes and daily digest: passed.
- scripts/test-account-access.ts: passed. Real request/verification handlers use in-memory storage and an intercepted mail transport; no external mail or production storage.
- scripts/test-activity-report-access.ts: passed, including unauthorised report/correction denial.
- scripts/test-buying-funnel.ts: passed, including deduplication, privacy, access protection and failure isolation.
- Source TypeScript check: passed using /tmp/netify-account-typecheck.json extending the unchanged project configuration and excluding generated .next files. Standard tsc found pre-existing iCloud conflict copies .next/types/cache-life.d 2.ts and routes.d 2.ts. Those files and original source configuration were not changed.
- git diff --check: passed.
- npm run build: FAILED at the existing sourcing-operations preflight, before Next compilation: 23 expired sector/UK-carrier evidence reviews. No dates, review qualification, clock or guard was altered to force a release.
- No new deployment, production promotion, public-browser acceptance or complete production build is claimed.

## Release prerequisite

The exact 23 review records listed by scripts/validate-sourcing-operations.ts need an actual evidence review and authorised disposition. After that: fetch/rebase the work branch, complete production build/CI, review the diff, release through the repository Git integration process, and verify the public account routes, role separation, queue response, protected report and apex label. Do not use preview promotion or CLI production deployment to bypass the failed gate. The access report begins collecting only after release.
