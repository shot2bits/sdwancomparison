# Anonymous outcome publication — 30 September 2026

## Operating process

1. In `/sase/admin/sourcing/`, select a confirmed sourcing project. Record actual activity and supplier-confirmed proposals using the existing controls.
2. In **Optional anonymous outcome**, prepare a draft. This freezes a snapshot of recorded evidence: sector, initial site/user bands, providers approached/acknowledged/responded/declined and weekdays to the first recorded current-scope proposal.
3. Edit the public scope and outcome summary. Review the underlying evidence and identification risk across the complete combination of facts. Remove names, specific geography, exact dates, prices, proposal extracts and identifying circumstances. Automated contact-pattern checks are only an extra guard, not an anonymisation guarantee.
4. Save the reviewed version. The buyer opens **Anonymous outcome (optional)** in the same private project and sees the exact public rendering. Publication is separate and optional; buyer can approve, decline or withdraw. No automatic outreach or email notification is introduced in this release; use the existing agreed buyer communication process.
5. Staff publish the approved version. It appears in the shortlist Market Record, the Market Record navigation destination and the JSON feed, with a stable anonymous outcome URL.
6. Edits reset buyer approval. Withdraw before editing a published record. Buyer or staff withdrawal removes the outcome from Netify's public views and direct page. Already copied/indexed content cannot be recalled automatically.

## Controls

- Staff cannot grant buyer permission. Approval requires the original buyer's verified sourcing grant or matching buyer account; generic project-management tokens do not confer publication consent.
- Every mutation checks origin, role, project identity, revision and transition state under a project lock.
- Review needs recorded evidence and explicit staff redaction attestation. Proposal-related stages require recorded current-scope supplier responses.
- Public IDs are random and unrelated to private project IDs. Public projection omits emails, original briefs, evidence URLs, account details, approvals and audit history.
- Consent text, actor, revision, timestamp and prior state are kept privately. Withdrawal is immediate on new reads; public pages are dynamic and the feed is no-store.
- This release supports anonymous participants only. Do not insert supplier names or exact prices into free text; separately permissioned named/price publication would require another workflow.
- Counts and summaries describe a frozen case, not expected future performance. Working-day measure counts weekdays only, does not exclude public holidays and measures proposal recording, not independently verified arrival time.

## Verification

- Hermetic route-level test uses real confirmation grants, role/session handling and private storage against in-memory KV; no external network or real mail.
- Verified staff-only drafting/review, hidden unreviewed drafts, exact buyer consent, refusal of staff self-approval, stale and edited approvals, separate staff publication, cross-project and origin denial, broad bands, current-scope proposal filtering and weekday calculation.
- Verified decline prevents publication, withdrawal removes feed and direct-page results, and original consented versions remain privately auditable.
- Synthetic browser walkthrough: staff reviews → buyer approves → staff publishes → anonymous public page → buyer withdraws → public page not found. No real project was used or outcome published.
- A React key warning in the first synthetic fixture came from activity rows lacking fixture IDs; fixture rows were corrected. No application key change was needed.
- Full application validation/build passed; new routes compiled as dynamic. TypeScript and focused lint passed. The new test is part of `test:action-first`.
- Existing unrelated duplicate source files were left untouched. Duplicate generated type-cache files were preserved outside the compiler path to resolve local type-definition conflicts.

## Live release verification

Source 8c16a8c deployed through the established production Git branch. Vercel deployment dpl_B2P9ud6kCbNemn7E6Mvgo8h74jwH is READY and confirmed as production target.

Public shortlist and Market Record return 200, display the new build and the honest empty state. JSON feed returns market-record/2.0.0 with zero records and Cache-Control: no-store. Unauthenticated private outcome endpoint returns 401; unknown public outcome returns 404. Live browser reports no errors or warnings. No production project mutations or messages were used for release verification.
