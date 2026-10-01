# Recovery hardening — 1 October 2026

Status: implemented locally on `codex/sourcing-recovery-hardening`. Not pushed or deployed. User approval is required before deployment.

## Approved technical batch

- Confirmed sourcing projects are indexed for the buyer account. Notification retries also repair an absent index, including when both notification receipts already exist. Repair checks confirmed ownership before indexing; an index failure is logged without discarding the request.
- Recovery sign-in carries the buyer back to the private project. Return destinations are restricted to a single valid private-project path. An existing authorised browser gets the project link on confirmation reload. Expired/reused links issue no new cookie.
- Evidence deadlines warn during validation instead of blocking a repair build. Runtime expiry restrictions and the mandatory valid sourcing desk address remain in force. The 16 October owner review deadline is still outstanding.
- Definite mail rejection can release an unconfirmed request only when there has been no earlier uncertain attempt. Atomic cleanup verifies the original lock, pending state and absence of an accepted mail receipt. Ambiguous sends retain the same request, payload and idempotency key. Legacy payloads without attempt metadata are treated conservatively as uncertain.
- New buyer receipts describe a recorded request and direct buyers to current project status. Previously persisted email bodies are preserved for safe idempotent retries; an old queued message may therefore retain its earlier wording.

## Validation

Passed: action-first regression suite; sourcing routes against disposable real Redis 7.4.2; recovery destination and deadline boundary tests; TypeScript; focused ESLint; whitespace checks. The actual confirmation component is rendered in a dedicated test for first confirmation, authorised refresh and another browser. This caught and corrected a project-link display condition during final review. No fresh browser walkthrough or production verification is claimed.

The route tests sign in through actual auth/request and auth/verify, then read rfp/mine; check missing-index repair; exercise definite rejection, ambiguous acceptance, same-key retries and duplicate protection. Mail is captured in tests, not sent to real buyers or suppliers. The real Redis instance is local and disposable, with no production data or credentials.

The production build passed again after the final display correction. Expected failure-injection log messages in regression tests do not represent real delivery failures.

## Release boundaries and remaining work

No production backfill has run. Existing account-index omissions are repaired when the relevant confirmed request is retried through the desk/notification path; this is not a claim that every historic production project has already been repaired.

Provider lists, UK wording, classifications, score labels, schema and public sign-off labels are unchanged. Harry copy approval and evidence owner adjudications remain outstanding. Operational email/error messages changed only within this approved recovery batch. These fixes address reliability; they do not establish an improvement in AI citations or search clicks.
