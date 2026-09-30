# Buyer walkthrough and code review — 30 September 2026

Scope: action-first shortlist, matching API, request/email contract, confirmation, existing ProjectDetails creation, desk queue, assistant tools and public evidence. Fix commit: `4c9d12b`. Production unchanged. This is not a completed audit of the entire historic procurement platform.

## Findings fixed

| Severity | Failure | Correction and evidence |
|---|---|---|
| High | A buyer could change sites/region/need after preparing a plan, then approve the old supplier summary against the new requirements. | Requirement changes invalidate the plan and block approval until refresh; consent resets. Generated summaries refresh, while custom edits remain visible for explicit review. Browser acceptance recorded below. |
| High | After a fast buyer confirmed, the mail sender could overwrite the confirmed record with its stale pending copy. | Store mail acceptance separately. Regression confirms within the mail-provider callback, then verifies the completed status survives the sender returning. |
| High | A confirmed request and desk queue membership were separate writes. Failure could report confirmed while the desk had no item. | Atomic, lock-owner-fenced Redis commit for status plus queue membership. Interrupted commit leaves request pending; retry reuses the project and credentials. Older interrupted membership is repairable. Tested with injected storage failure. |
| Medium | An interrupted mail transport left an idempotency reservation; retry reported success even though acceptance was not known. | Retry checks the stored acceptance receipt and returns an explicit uncertainty message. It does not silently send another email or claim delivery. Definite rejection still clears the reservation for retry. |
| Medium | Retrying an expired pending request returned pending confirmation with an unusable link. | Server rejects expired pending requests; client clears the expired attempt key so an explicit retry can prepare a fresh request. |
| Medium | Preparing a plan again overwrote the buyer's custom supplier brief. | Preserve edited text; only auto-generated text is automatically replaced. Refresh clears approval and instructs the buyer to check the retained text against current requirements. |
| Medium | The directory's review button bypassed the first form's native validation. | All prepare paths validate the brief schema; invalid counts cannot prepare a plan. |
| Medium | Inputs could change during request submission, leaving a success message beside a different brief. | Disable the complete sourcing editor while submission is in flight. |
| Low | Confirmation response contained private brief data without an explicit private/no-store header; request body had no explicit limit. | Private/no-store on every response and a small confirmation payload limit, covered by route tests. |

## Verified backend boundaries

- Request-specific work-email confirmation, hashed token storage and exact-payload binding.
- Opening a confirmation link is read-only; explicit confirmation is required.
- Missing consent, invented supplier slugs, duplicate recipient/actions and invalid tokens are rejected.
- Non-matching Origin is rejected. Anonymous callers and buyer sessions cannot read the desk; a staff session can.
- Multiple providers/actions remain in one approved request and one existing-format project.
- Confirmation retries do not replace project credentials or create supplier invitations.
- Mail acceptance, rejection, interrupted transport and rapid-confirmation races were tested with captured email and isolated storage. No external buyer or supplier messages were sent.
- Web and MCP prepare calls return identical matches for the same brief.
- Existing project-entrance and provider-matching tests pass; existing MCP project guards pass.
- TypeScript and focused ESLint pass.

The Redis fixture emulates the commands used, including atomic commit semantics; it is not a live Redis fault-injection experiment. Supplier fulfilment was not exercised.

## Regression suite caveat

`test:provider-match-preview` fails on a source-text assertion expecting `buildShortlist(scoped, translated.input, FEATURE_NAMES)`. The actual expression also merges `projectMatchingInput(project)`. The same expression exists at original base e850476, so this mismatch predates the sourcing implementation. The test was not weakened to make it pass. The entire historic validation suite is not certified.

## Remaining release blockers

- Confirmed requests still lack the complete private return journey through RFP editing, connectivity pricing and proposal comparison. Existing project creation is not end-to-end procurement acceptance.
- Buyer status access currently uses the one-hour confirmation token; long-lived, request-scoped access and renewal remain unfinished.
- Production matching feed credentials are not configured in this preview; the labelled reviewed snapshot is used. 68 flagged sector rows remain to be adjudicated.
- Supplier response targets, introduction acknowledgements, completed real sourcing records and final copy remain unconfirmed.
- Clean logged-out acquisition baseline, consent coverage measurement and Bing citation capture remain incomplete.

Verdict: improved and meaningfully tested preview, not approved for production or a claim of AI recommendation uplift.

## Deployed browser acceptance

Preview: https://sasecomparison-mvfnavekk-netifymarketplace.vercel.app/sase/shortlist/
Build: `4c9d12b`, Vercel deployment https://vercel.com/netifymarketplace/sasecomparison/8RQ57sKCE99nHPopfkxGqNyCEB8j . Production build and focused test suite passed on Vercel.

Observed in the actual browser:
1. Manufacturing preset selected; SD-WAN preparation returned two evidence matches.
2. Edited the supplier brief, then changed ten sites to twelve: stale-plan warning appeared; approval and submission were disabled.
3. Refreshed the plan: custom supplier text was preserved, rather than silently overwritten. The buyer then updated it to twelve sites and reapproved.
4. Selected Cisco demo plus Aryaka proposals; submitted a synthetic example.org address. Preview explicitly blocked email delivery, and re-enabled the editor. No mail sent.
5. All 30 provider cards remained available. Browser console warning/error capture was empty.
6. Switched to healthcare: zero evidence matches plus explicit missing-evidence qualification; no false claim that suppliers cannot deliver.

Screenshot: reviewed-request-walkthrough.png in the review archive.

Additional low-priority accessibility finding: the shortlist page currently renders a main landmark inside the marketing layout main landmark. This does not block the tested controls, but should be corrected before accessibility acceptance. This review does not certify WCAG conformance or all responsive layouts.
