# Netify action-first release: independent review

Reviewed 30 September 2026, 21:00 to 22:15 UTC. Scope: SASE app `shot2bits/sdwancomparison` (production branch `release/2026-09-30`), apex site `netify-bt-broadband-reseller` (production branch `codex/bt-reseller-release-1`), the release documents named in the brief, and the live public surfaces on netify.co.uk. Nothing was deployed, merged, sent or altered. No credential values were read or printed.

## 0. State of the estate at review time (supersedes the brief's figures)

| Item | Brief said | Verified now | Evidence |
|---|---|---|---|
| SASE production commit | c56a2a7 (dpl_8KfqXjBh…) | **683e953** "Configure owner-approved sourcing desk working hours", dpl_7Q2YDjG3zjs7aSFWev3Vw77rTzYW, READY, created 20:56 UTC | Vercel list_deployments, target=production |
| Overdue threshold | null | **8 working hours, 09:00 to 17:00 Europe/London**, weekends excluded, bank holidays not excluded | `data/sourcing-operations.json` at 683e953; docs/HANDOFF.md new section |
| Apex production | d097f64, dpl_AAbMGg3S… | Confirmed unchanged, READY, branch codex/bt-reseller-release-1 | Vercel list_deployments |
| PR #8 | Draft, conflicting, unmerged | **Superseded.** `main` (e8cdcbd, 22:02 BST) now contains 683e953 via PR #9 "codex/reconcile-action-first-main". PR #8 head = 683e953 = merge-base with main, so it no longer conflicts. `codex/action-first-sourcing` is 0 ahead / 13 behind main. | `git ls-remote refs/pull/8/head`, `git merge-base`, `git rev-list --count` |
| Production vs main | not stated | **Production (release/2026-09-30) is 6 commits behind main.** Main carries today's Harry retest fixes (CircuitPricing.tsx +9, ProjectDesk.tsx, workspace/extract.ts, draft.ts, labels.ts) that are not in production. | `git diff --stat origin/release/2026-09-30 origin/main`: 22 files |
| Latest SASE deployment | | dpl_C8XaGSW4a2X81VBxKA8Y22d1Af5j BUILDING at 21:02 UTC, target null (preview, presumably main) | Vercel get_project |

Consequence: the release doc's "Final Step 9 deployment: SASE c56a2a7" is historical. Anything that reads production behaviour must be checked against 683e953, and the next production release must come from main (or a branch rebased onto it) or the Harry fixes will be lost again.

Access limitations, stated exactly:
- Vercel env var listing returned 403 for this token, so I cannot confirm that `SOURCING_DESK_EMAIL`, `RESEND_API_KEY` or `AUTH_FROM_EMAIL` exist in Production. The release doc's "SOURCING_DESK_EMAIL configured in Vercel Production" is unverified.
- Neon is not configured in my clone, so every matching probe ran on `snapshot_fallback` (30 providers, same identities as live JSON per HANDOFF). The action-first suite Codex ran also runs on the snapshot.
- I could not send a real request (forbidden by the brief), so production Resend delivery and the production KV are untested by me.
- The apex worktree's git metadata lives outside the connected folder (`gitdir: /Users/robertsturt/netify-bt-broadband-reseller/.git/worktrees/...`), so apex history was read from Vercel and docs, not git.
- `gh` is not installed in the review container; PR state was derived from git refs.

## 1. Prioritised findings

Severity scale: **Critical** = a real buyer loses their request or their project; **High** = journey breaks for a common path or public claims are false; **Medium** = misleading, recoverable, or a future failure with a known date; **Low** = cosmetic or hygiene.

### F1. Critical: a confirmed buyer cannot get back into their project from any other browser, and the email tells them they can

- **Impact.** The buyer's confirmation email (`src/lib/sourcing-notifications.ts:103`) ends: "Open this link in the browser where you confirmed your request, or sign in with your buyer account." The confirmation page says "No account has been created" (`src/components/SourcingConfirmation.tsx:72-80`). The only credential is the `netify_sourcing_<project>` cookie (30 days, `Path=/sase/`, `src/lib/sourcing-access.ts:12-29`). A buyer who opens the email on their phone, in a second browser, after clearing cookies, on a locked-down corporate machine, or after day 30, is locked out. Sign-in is refused.
- **Where.** `src/app/api/auth/request/route.ts:115-140`. Buyer sign-in requires `publicationBound`: the project must have `pending_submit.list_on_board === true` or be `isMarketUnlocked`, or the email must own a consented circuit record (`circuitBuyerCanSignIn`, `src/lib/circuit-store.ts:90-97`). A sourcing project is created by `entranceToProjectDetails` (`src/lib/sourcing-store.ts:195-205`) and is never published or market-unlocked by design. There is no sourcing branch in the gate, although the error text at line 138 already mentions "short project brief", which suggests one was intended.
- **Reproduction (isolated, hermetic, fake KV, fake Resend).** `scripts/review-probes-2.ts`, PROBE G:
  ```
  PROBE G confirm: 200 project: rfp_e0e7… cookie issued: true
  PROBE G buyer mail tells them: "Open this link in the browser where you confirmed your request, or sign in with your buyer account."
  PROBE G sign-in with valid bot proof: 403 {"error":"Prepare an RFP, short project brief or circuit-pricing request and approve its review before verifying your work email.","publish_required":true}
  ```
- **Why the tests missed it.** `scripts/test-sourcing-routes.ts:417-421` fabricates the buyer session with `rfpStore.createSession({role:"buyer", …})`, bypassing `/api/auth/request` entirely. No test in the action-first suite posts to `/api/auth/request` for a sourcing owner. `grep -c "netify_sourcing_" scripts/test-sourcing-routes.ts` = 0 (the cookie name is never asserted; access is tested via the scoped `set-cookie` value only).
- **Now vs should.** Now: 403 with `publish_required`. Should: a confirmed sourcing request (`sourcing:request:<id>` status `desk_review`, `owner_email` matching) is sufficient to issue a buyer magic link, and `ownerBySession` then admits them (`src/lib/rfp-access.ts:40-45` already handles that case).
- **Smallest sound fix.** In `auth/request/route.ts` after the existing `publicationBound` checks, add: if `return_to` names an `rfp_` project whose `entrance_context.raw_input.sourcing_request_id` is set and whose `sourcing:request:<id>` record is `desk_review` with `request.email === email`, set `publicationBound = true`. Also honour the no-`return_to` case by scanning the buyer's owned projects for a sourcing request in `desk_review`. Then either make the buyer email and confirmation page describe that path ("sign in with the same work email") or drop the sign-in sentence.
- **Verification.** New hermetic test: confirm a request, then POST `/api/auth/request` with a valid challenge and the owner email, expect 200 and a magic link; verify with a different-origin request (no cookie) that `/api/sourcing/projects/<id>/` returns 200 under the session. Add the inverse: a non-owner email for the same `return_to` still gets 403.

### F2. Critical: a transport failure during the confirmation email locks the buyer out of that request for 24 hours, and both messages they see are wrong

- **Impact.** If the Resend call throws (socket reset, Vercel function timeout, DNS), the buyer is told to check their brief, then on retry told to check their email. No email exists. The client keeps the same idempotency key while the payload is unchanged (`src/components/SourcingEntrance.tsx:147-149`) and only resets it on the "expired" message (line 166), so every retry hits the lock for 24 hours (`sourcing:idem:*`, `NX EX 86400`, `src/lib/sourcing-store.ts:106-116`). Editing one character of the brief regenerates the key, but the buyer is not told that, and the 3-per-email hourly limit then bites.
- **Where.** `src/lib/sourcing-store.ts:133-146`: the Resend POST has no `try/catch` and no `AbortSignal.timeout` (the notification sender at `sourcing-notifications.ts:131` has a 10 s timeout; the confirmation sender does not). Only `!response.ok` is handled (147-151); a thrown fetch leaves the lock and the record in place with no `sourcing:mail:<id>` marker. Lines 86-87 then return "Confirmation delivery is not yet confirmed. Check your email before preparing a new request."
- **Reproduction.** `scripts/review-probes-2.ts`, PROBE H:
  ```
  PROBE H first attempt during transport failure: 422 {"error":"Request unavailable. Check your approved brief, recipients and work email."}
  PROBE H retry after transport recovered: 422 {"error":"Confirmation delivery is not yet confirmed. Check your email before preparing a new request."} | emails actually sent to buyer on retry: 0
  PROBE H idempotency lock present: true | lock TTL in code: 86400s (sourcing-store.ts:113)
  ```
- **The test encodes the defect as correct.** `scripts/test-sourcing-routes.ts:714-733` throws from the mail transport, then asserts that a retry with a healthy transport returns 422 matching `/delivery is not yet confirmed/`. That is the lockout, asserted as a pass. "PASS adversarial boundaries … ambiguous mail retry" in the fix list is this assertion.
- **Now vs should.** Now: ambiguous failure becomes a 24 h block with no email. Should: an ambiguous failure is retried safely. Resend's `Idempotency-Key` (`sourcing-<record.id>`, line 138) already guarantees at-most-once delivery for the same record for 24 h, so a re-send with the same key is safe.
- **Smallest sound fix (amended after ChatGPT's validation, 30 Sept).** (a) Wrap the POST at 133-146 in try/catch with `signal: AbortSignal.timeout(10000)`. (b) On the existing-lock path (lines 83-88), when the record is `pending_confirmation`, unexpired and has no `sourcing:mail:<id>` marker, re-issue the same Resend POST with the same `Idempotency-Key` instead of throwing; on 2xx set the marker and return `accepted`. (c) Replace the generic "Request unavailable. Check your approved brief…" mapping for transport errors with "We could not reach the email service. Your brief is unchanged; try again in a moment." (d) The client keeps the same request key on retry; it must not generate a new one after an uncertain failure, or two records and two links result. The server re-send is the retry, and because the existing-lock path runs before `limit()`, retries do not consume the hourly allowance. Note the token is not stored in clear, so the resend must reuse the original link text; store the composed mail payload under `sourcing:request:<id>:mail-payload` with the record's 24 h TTL (as the notifier already does per channel at `sourcing-notifications.ts:110-121`) before the first send. This is the same trust level as the record store, which already holds the token hash.
- **Verification.** Invert the assertion at 731-733: after a thrown transport, a retry returns 200, exactly one email is captured, and a second retry captures none. Add a timeout test with a never-resolving fetch.

### F3. High: the "30+ suppliers respond" claim is live Netify copy, not a stale index or an AI invention

- **Impact.** The clean baseline (`docs/action-first/clean-google-baseline-2026-09-30.json`, prompt 6) records Google saying Netify "forces 30+ UK carriers and vendors to respond in one format" and flags it as inaccurate. The release doc treats it as an AI error. It is not. These sentences are live today (fetched 30 Sept, cache-busted):
  - `https://netify.co.uk/sase/how-it-works/`: "get comparable, competing responses from more than 30 verified providers"; "A ranked, filtered shortlist of 30+ vendors graded across 40 features"; "sign in only to bid"; "Competing bids come back structured side by side"; "the prices they quote stay private to you". Source: `src/app/(marketing)/how-it-works/page.tsx:18, 63, 89`. Sitemap priority 0.9 (`src/app/sitemap.xml/route.ts:50`).
  - `https://netify.co.uk/sase/`: H1 "Get competing bids from SASE and SD-WAN vendors and service providers." Paragraph: "publishes it to a curated list of verified vendors and managed service providers. Bids come back in one place, priced privately to you." Source: `src/app/(marketing)/page.tsx:36-41`. Sitemap priority 1.0 (line 49). This page links to `/sase/shortlist/` as "Prepare a sourcing plan", so an agent reading both pages reasonably concludes 30+ suppliers bid.
  - `/sase/rfp-builder/new/`: "Compare SASE and SD-WAN across 30+ vendors and service providers. One two-minute brief and your five best-matched vendors respond with structured answers and private pricing." Source: `src/app/(marketing)/rfp-builder/new/page.tsx:20, 25, 92`, self-canonical.
  - `src/app/api/cron/account-activation/route.ts:52` still emails "Compare 30+ providers with the shortlist builder".
- **Why the acceptance missed it.** The Step 1 acceptance command (`docs/action-first/16-release-fix-list.md:7`) greps only for "authorised access|after publication|verified publication|before publication|unlock after|responses and prices are not guaranteed|participation is developing|participation and response times are not guaranteed". "competing bids", "bids come back", "sign in only to bid", "30+ vendors", "vendors respond" were never in the expression. The "PASS live contacts wording" checks (lines 107-110) cover four URLs only.
- **Now vs should.** Now: the sourcing entrance says "you approve each request before a supplier receives it" while its parent and sibling pages promise competing bids from 30+ verified vendors. Should: one description across every page in the sitemap that describes the service.
- **Smallest sound fix.** Rewrite the hero and "how it works" blocks on `/sase/`, `/sase/how-it-works/` and `/sase/rfp-builder/new/` from `SOURCING_DESCRIPTION` and the three action labels; retire "bid", "competing bids", "30+ vendors respond", "five best-matched vendors respond". Update the cron email line. Harry to write the page copy; Codex to wire the constants.
- **Verification.** Extend the Step 1 grep to `-iE "competing bids|bids come back|sign in only to bid|30\+ (vendors|providers)|vendors respond|providers respond|best-matched vendors respond"` across `src/` and the apex `app/`, expect no matches; re-fetch the three live URLs after release.

### F4. High: the public undertaking is an internal placeholder, published in JSON-LD, llms.txt and the buyer email

- **Where.** `src/lib/sourcing-contract.ts:16-21`. With `SOURCING_TARGET` both null, `sourcingUndertaking()` returns "Agree a response target before outreach. If a supplier declines, we report it and agree what happens next." That string is emitted in the Service JSON-LD description (`sourcingServiceSchema`, lines 23-27), `/sase/llms.txt` line 8 (verified live), page step 3, MCP descriptions and the buyer acknowledgement email (`sourcing-notifications.ts:103`).
- **Impact.** "Agree a response target before outreach" is an instruction to staff, not a promise to a buyer, and it is now the machine-readable description of the service. An AI summariser will either quote it verbatim or invent a number to fill it.
- **Now vs should.** Now: placeholder text is the public contract. Should: either a true undertaking (owner sets both values) or buyer-facing wording that states honestly what happens ("Netify agrees a response date with each provider you approve and tells you if a provider declines").
- **Smallest sound fix.** Change the fallback string only; keep the `valid()` logic. Harry to approve the sentence.
- **Verification.** Existing "PASS sourcing target unset: page step 3, Service JSON-LD, llms and MCP agree" test continues to pass with the new fallback; re-fetch llms.txt.

### F5. High: on 30 October 2026 the sector evidence and the UK carrier classification silently revert

- **Where.** `src/lib/provider-projection-review.ts:206-207`: `applyProjectionReview` returns early when `now >= Date.parse(review.review_due)`. Every adjudication in `data/provider-sector-adjudications.json` and every `UK_CARRIER_REVIEWS` entry has `review_due: "2026-10-30T00:00:00Z"`. Line 212 also drops the override whenever Neon's `record.reviewed_at` is newer than the review, so any re-save of a provider record in Neon removes the sector evidence for that provider without notice.
- **Reproduction.** `scripts/review-probes.ts`, PROBE D:
  ```
  PROBE D now: yes reviewed_override review_due: 2026-10-30T00:00:00Z
  PROBE D at 2026-10-30T00:00:01Z: unknown source_review_required
  ```
- **Impact.** Sector-filtered matching already returns 0 for retail, energy and government and 0 to 3 for the others (PROBE E, snapshot). After the due date the sector gate (`shortlist-core.ts:599-607`) fails for all 19 providers, and `uk_provider_only` returns nothing because `uk_delivery` falls back to `not_confirmed`. No alert, no banner, no log.
- **Now vs should.** Now: a silent cliff. Should: expiry surfaces as a visible "evidence review overdue" state on the card and in the desk, and the queue shows the count of expiring reviews from 14 days out.
- **Smallest sound fix.** Keep the expiry (it is the right governance) but (a) emit `resolution: "review_expired"` rather than `source_review_required` so it is distinguishable, (b) add a desk banner and a `scripts/validate-*` check that fails the build when any review is within 14 days of `review_due` and unsigned, (c) have the owner sign off or extend before 16 October.
- **Verification.** Run PROBE D style test at `review_due - 1s`, `review_due`, and after a Neon `reviewed_at` bump; assert the resolution values and that the desk endpoint reports the expiring count.

### F6. High: the desk notification can fail silently in production and nobody is told

- **Where.** `src/lib/sourcing-notifications.ts:95` (`to: process.env.SOURCING_DESK_EMAIL ?? ""`), 115-116 (throws "Notification destination not configured"), 137-143 (catch, mark `pending`, `console.error` only), 147-151 (outer catch, `console.error` only). `data/sourcing-operations.json` `desk_email` is documentation; the code never reads it.
- **Impact.** If the env var is missing, mistyped or scoped to Preview only, every confirmed request reaches the queue with `desk: pending`, the buyer receives "Netify has your request", and the desk receives nothing. The only signal is the `/admin/sourcing/` page, which staff have no reason to open if no email arrived. There is no cron, no alert, no escalation. The test at `scripts/test-sourcing-routes.ts:835-870` deletes `SOURCING_DESK_EMAIL` and asserts exactly this outcome (desk pending, buyer accepted) as correct behaviour.
- **Cannot verify.** Vercel env listing is forbidden for this token, so the production value is unverified.
- **Now vs should.** Now: silent. Should: a failed or unconfigured desk notification is impossible to miss.
- **Smallest sound fix.** (a) Read the desk address from `data/sourcing-operations.json` with the env var as override, so a missing env var still delivers. (b) Fail the production build (`npm run validate`) if `SOURCING_DESK_EMAIL` is unset when `VERCEL_ENV=production`. (c) Send the buyer mail only after the desk mail is accepted, or include "Netify has not yet acknowledged this request" wording when desk is pending. (d) Add the pending count to an existing daily cron summary.
- **Verification.** Test: unset env, confirm, expect desk accepted via the JSON address; set both to invalid, expect confirm still 200, queue row `desk: pending`, and buyer mail text carrying the pending wording.

### F7. Medium: the confirmation link dies after one hour even for a confirmed request, with a generic 403 and no cookie

- **Where.** `src/lib/sourcing-store.ts:156-160` `readSourcingRequest` always runs `assertRequestConfirmation` (lines 38-51), which rejects on `expires_at <= now` regardless of status. `src/app/api/sourcing/confirm/route.ts:43-47` maps every error to 403 "This confirmation is invalid, expired or unavailable."
- **Reproduction.** `scripts/review-probes.ts`, PROBE B: `reopen after expiry (confirmed request): 403 … set-cookie: none`. PROBE A: two tabs confirming at once return 200 and 403; the losing tab shows "invalid, expired or unavailable" although the request is confirmed.
- **Impact.** The buyer's only link to the project (their email) stops issuing the cookie after an hour, so a buyer who confirms on a laptop, then opens the same email again the next day, sees an error. Combined with F1 there is no route back.
- **Smallest sound fix (amended after ChatGPT's validation, 30 Sept).** Keep the one-hour expiry; an emailed link must not become a standing credential. For `status === "desk_review"` return a distinct response ("This request is already confirmed. Sign in with the same work email to reopen it.") with a link to buyer sign-in, and no cookie after expiry. Recovery is the F1 sign-in path, so F1 must ship in the same release or this message points at a door that does not open. The concurrent-tab case returns the same "already confirmed" response.
- **Verification.** PROBE B expects 200, `already_confirmed: true`, no `set-cookie`; PROBE A's second response expects the same; a follow-on test signs in via `/api/auth/request` and opens the project.

### F8. Medium: sector "Evidence match" hides that the evidence is partial, anonymous or non-UK

- **Where.** `src/lib/shortlist-core.ts:280-285` (`SATISFIES` includes `partial`), 599-607 (gate passes, adds a `gaps` entry). `src/components/SourcingEntrance.tsx:447-452` renders only "Evidence match · supplier confirmation pending"; the `gaps` array and the adjudication `qualification` are never rendered. `src/lib/public-shortlist.ts:8` labels every match `Evidence match` for MCP and JSON.
- **Impact.** Of the 36 positive adjudications, the sign-off sheet marks UK evidence "no" for the large majority (Versa manufacturing: an anonymous Global-200 pharmaceutical manufacturer; Versa retail: an unnamed 600-store retailer; Zscaler government: an Australian pension body; Fortinet healthcare: a California mental-health provider "NOT an NHS organisation"). A UK manufacturing buyer sees Versa as an "Evidence match" with 0 visible caveats. Coverage % is a feature-count metric and is presented next to the match label, which reads as suitability.
- **Data quality, not code:** the adjudications are unsigned (`signed_off_by: ""` on all 19; reviewer "Codex source adjudication; human release sign-off pending"), and `docs/sector-adjudications-signoff-2026-09-30.md` uses the slug `colt` where the data uses `colt-technology-services`.
- **Smallest sound fix.** Render the sector gap line ("Manufacturing: partial evidence") and the first sentence of `qualification` on the card, feed and MCP match; add the sign-off sheet's "UK evidence: yes/no" column to the projection as `uk_sector_evidence` and show it. Owner to sign or strike each row before 30 October (see F5).
- **Verification.** Snapshot test on manufacturing/sdwan: Versa card contains "partial"; JSON match object carries `sector_status` and `qualification`.

### F9. Medium: production is missing today's main-branch fixes

- **Where.** `git diff --stat origin/release/2026-09-30 origin/main`: 22 files, including `src/components/procurement/CircuitPricing.tsx`, `ProjectDesk.tsx`, `lib/workspace/extract.ts`, `draft.ts`, `labels.ts`, `publish-checklist.ts`, and `package.json`. Commits 5d2ad0b, a289c99, 1e54d7b (11:31 to 13:13 today) are on main, not on the production branch.
- **Impact.** The connectivity pricing step inside the private sourcing project (`SourcingProjectJourney` mounts `CircuitPricing`) runs older code than main. Whether that matters depends on what the +9 lines fix; I did not review them.
- **Fix.** Next production deploy from main (Vercel production branch is currently `release/2026-09-30`); do not cherry-pick backwards. Confirm the Vercel production branch setting after.

### F10. Medium: measurement cannot distinguish citation, referral, tool use and confirmed requests

- **Where.** `src/components/SourcingEntrance.tsx:127-134`: `acquisition` comes only from a `?acquisition=` query parameter that no search engine appends. `document.referrer` and `utm_source` (ChatGPT appends `utm_source=chatgpt.com`) are not captured. `recordMarketplaceFunnelEvent` (`src/lib/marketplace-funnel.ts:16-22`) stores `sourcing_confirmed` with source `shortlist|mcp` only. Vercel Web Analytics is not enabled for the project (earlier check), and apex HANDOFF records that GA is deliberately suppressed on `/sase/`.
- **Impact.** The one metric the release exists to move (AI recommendation to click to request) has no instrument. Search Console will show impressions and clicks for `/sase/shortlist/`, which mixes AI Overview and blue-link clicks.
- **Smallest sound fix.** Capture `document.referrer` host and `utm_source` on the plan and request calls (hashed host is enough), map `chatgpt.com`, `copilot.microsoft.com`, `perplexity.ai`, `gemini.google.com`, `google.com` to the existing `acquisition` enum, store it on the funnel event, and add a staff endpoint that counts plan, request, confirm and desk-acknowledged per source per week.
- **Verification.** Unit test on the mapper; one week of data before claiming any uplift.

### F11. Medium: hermetic harness cannot catch TTL and Lua defects

- **Where.** `scripts/fake-kv-harness.ts:114-119`: `SET` ignores `EX`, so nothing in the suite ever expires; `120-141`: `EVAL` is emulated by matching substrings of the Lua source, so a Lua syntax or semantic error in `sourcing-store.ts:211` would pass every test and fail only in production.
- **Impact.** The 24 h record TTL, the 1 h link expiry, the 30-day grant, and the "confirmed record loses its TTL on commit" behaviour that F7 and the cookie depend on are all untested. "42 passed" says nothing about them.
- **Fix.** Add a real-Redis job (Upstash isolated database or `redis-server` in CI) that runs `test-sourcing-routes.ts` once nightly; add explicit TTL assertions using `PTTL` in the fake store.

### F12. Low: `/api/sourcing/plan/` is unauthenticated with no origin check or rate limit

- `src/app/api/sourcing/plan/route.ts` (24 lines) accepts 40 kB bodies and runs the full dataset load and match. Cheap to abuse, and it is the surface MCP agents will hammer. Add the same per-IP limit the request route uses.

### F13. Low: raw enum values leak into buyer-facing and supplier-facing text

- `SourcingEntrance.tsx:92`: the generated anonymous brief contains "Required service: help_deciding" / "secure_access". `SourcingConfirmation.tsx` lists recipients as `{slug}: {action keys}` ("cisco: contacts, demo"). Desk email (`sourcing-notifications.ts:97`) prints `Service: ${b.need}`. Map through `SOURCING_ACTION_LABELS` and a need label table.

### F14. Low: rate limits increment before the idempotency reservation

- `sourcing-store.ts:90-91` then 106-116. A double-submit that loses the `NX` race still consumes one of the three hourly email attempts. Move `limit()` after the successful `SET NX`, or refund on "already being prepared".

## 2. Journey table

| Step | Status | Evidence |
|---|---|---|
| Buyer lands on `/sase/shortlist/`, reads the sourcing entrance | Verified working | Live fetch; copy matches `SOURCING_DESCRIPTION` |
| Buyer reads `/sase/` or `/sase/how-it-works/` first | **Broken (contradictory promise)** | F3, live fetch |
| Brief to plan (matching, cards, coverage) | Verified working on snapshot; not verified on live Neon | PROBE E/F; Codex reports a live UK-only plan returned 4 matches |
| Sector-filtered matching returns useful results | **Broken for retail, energy, government (0); thin elsewhere (0 to 3)** | PROBE E |
| Select recipients, approve, request confirmation email | Verified working (hermetic); production delivery not verified | PROBE G first step; env unverifiable |
| Email transport fails once | **Broken (24 h lockout, wrong messages)** | PROBE H, F2 |
| Click link within 1 h, confirm, cookie, land in project | Verified working (hermetic and Codex isolated preview dpl_2uMD556y…) | doc 13 line 50; PROBE G |
| Two tabs confirm at once | Working but misleading | PROBE A (200/403 generic) |
| Reopen the emailed link after 1 h | **Broken** | PROBE B, F7 |
| Desk email and buyer acknowledgement | Verified working when env is set (hermetic); silent failure when not | F6; test 835-870 |
| Queue age and overdue at 8 working hours | Verified in code and new tests at 683e953 | `queueAge`, test lines 858-868 |
| Buyer returns from another device, cleared cookies, or after 30 days | **Broken** | PROBE G, F1 |
| Private project: RFP editor, Word/Markdown download, connectivity pricing, proposals tab | Not independently exercised by me; code paths are owner-gated correctly (`document`, `connectivity`, `outcome` routes) | Codex doc 13 browser pass |
| Staff records a proposal, buyer sees comparison | Not verified by me beyond tests and code read | tests 454-560 |
| Supplier actually contacted, proposal actually returned | **Awaiting owner input** | Panel `[]`, `SOURCING_TARGET` null, no supplier integration |
| Anonymous outcome consent, publish, withdraw | Not verified beyond code read; gating sound | outcome route 10-27 |
| MCP prepare/request/status | Code read only; descriptions consistent with contract | llms.txt live |
| Public copy, JSON-LD, feed, llms consistent | **Broken on three sitemap pages; placeholder undertaking live** | F3, F4 |
| Evidence still present on 30 October | **Broken on that date** | PROBE D, F5 |
| Attribution of AI referrals | Not measurable | F10 |

## 3. Separation of concerns

**Code defects (Codex can fix now):** F1, F2, F6 (a, b, c), F7, F11, F12, F13, F14, and the mechanical parts of F3 and F8.

**Missing supplier and operational commitments (owner, not code):** `SOURCING_TARGET` both null; `data/response-panel.json` empty, so every card is "Research only" and no supplier has agreed a response time; 19 provider adjudications unsigned; `SOURCING_DESK_EMAIL` presence in Production unverifiable from here; who reads `/admin/sourcing/` and how often; bank-holiday handling accepted as a gap. Until the panel has at least the four UK carriers with named contacts, the service the pages describe cannot be fulfilled except by hand.

**Data-quality limits:** sector evidence is mostly non-UK and partly anonymous (F8); Neon `reviewed_at` bumps drop reviews (F5); tests and my probes ran on the snapshot, not live Neon; the sign-off sheet and data file disagree on the Colt slug; `uk_delivery` for 26 of 30 providers is `not_confirmed`, so `uk_provider_only` + SASE returns 0 to 1 provider.

**Search-distribution uncertainty:** the baseline shows citations on SD-WAN head terms, none visible on SASE head terms, and two named recommendations on action prompts, one of them carrying a false claim that is traceable to Netify's own pages (F3). IndexNow 200 and 11 Google receipts are submission receipts, not indexing. No before/after can be attributed to this release for at least two to four weeks, and only if F10 is fixed first.

**Measurement gaps:** no referrer or utm capture, no per-source funnel, no Web Analytics, GA suppressed on `/sase/`, no supplier-response event at all (proposals are typed in by staff).

## 4. Verdict

I would not trust a real buyer to complete this journey today. The happy path (one browser, one hour, email service healthy, desk env correct) works and is well protected against duplicates. But two ordinary events break it with no recovery: an email transport blip (F2) and opening the project from anywhere other than the original browser (F1, F7). Both produce messages that point the buyer in the wrong direction, and in F1's case the message promises a sign-in that the code refuses. On top of that, the pages an AI or a buyer reads before reaching the entrance still promise competing bids from 30+ verified vendors (F3), and the service's machine-readable promise is a staff placeholder (F4). Nothing on the supply side is committed, so even a perfectly delivered request ends at a human desk with no agreed supplier response.

The sign-off evidence is weaker than it reads. "42 passed" includes two assertions that lock in defects (F2 lockout, F6 silent desk), fabricates the buyer session rather than exercising sign-in (F1), and runs on a fake store that cannot expire keys or execute Lua (F11). The live checks covered four URLs and a phrase list that did not include the words that were actually wrong.

## 5. Ordered fix list for Codex

Work on `main` (e8cdcbd) or a branch rebased onto it, never on `release/2026-09-30`. Preserve untracked `docs/action-first/* 2.md` duplicates. No production data changes, no real emails.

1. **Sign-in for confirmed sourcing buyers (F1).** `src/app/api/auth/request/route.ts` after line 131: treat a `desk_review` sourcing request owned by the email as `publicationBound`, for both the `return_to` and no-`return_to` branches. Update `sourcing-notifications.ts:103` and `SourcingConfirmation.tsx:72-80` to say "sign in with the same work email" (Harry to approve wording). Test: hermetic POST to `/api/auth/request` with a valid challenge returns 200 for the owner and 403 for another email.
2. **Expired or reused links route to sign-in (F7, amended).** Keep the one-hour expiry. In `confirmSourcingRequest` and the `confirm:false` read path, when the record is `desk_review` return `{status:"desk_review", already_confirmed:true}` with the sign-in route and no cookie after expiry; the confirmation page renders "already confirmed, sign in with the same work email". Same response for the losing concurrent tab. Tests: PROBE A and B expectations as amended in F7, plus the sign-in follow-on.
3. **Confirmation send is bounded and retried (F2, amended).** `sourcing-store.ts:133-151`: 10 s timeout, try/catch, persist the composed payload (24 h TTL) before sending, and on the existing-lock path re-send with the same `Idempotency-Key` when no mail marker exists. The client keeps its request key unchanged on retry (no change to `SourcingEntrance.tsx:147-149`; do not add a reset). Invert test 731-733; add a never-resolving fetch test and a test that a retry sends exactly one email.
4. **Desk address and alerting (F6).** Read `desk_email` from `data/sourcing-operations.json` with env override; production validate script fails when neither resolves to an email; buyer mail carries "not yet acknowledged" wording while desk is pending; pending count added to the existing daily cron summary. Rework test 835-870 accordingly.
5. **Copy consistency (F3).** Replace bidding-era copy on `src/app/(marketing)/page.tsx:36-41`, `how-it-works/page.tsx:18,63,89`, `rfp-builder/new/page.tsx:20,25,92`, `api/cron/account-activation/route.ts:52` with text derived from `SOURCING_DESCRIPTION` and `SOURCING_ACTION_LABELS` (Harry writes; SD-WAN as a component of SASE; no "template" in headings). Extend the Step 1 acceptance grep with `competing bids|bids come back|sign in only to bid|30\+ (vendors|providers)|(vendors|providers) respond|best-matched vendors respond` over both repositories.
6. **Undertaking fallback (F4).** Change the fallback string in `sourcing-contract.ts:21` to buyer-facing wording approved by Harry; nothing else changes. Re-fetch `/sase/llms.txt` and the shortlist JSON-LD after release.
7. **Expiry visibility (F5).** `provider-projection-review.ts:206-212`: distinct `review_expired` and `source_newer_than_review` resolutions; desk banner and build-time warning at 14 days; owner to sign or extend before 16 October.
8. **Honest sector labels (F8).** Render the sector gap and the qualification's first sentence on cards, feed and MCP matches; add `uk_sector_evidence` from the sign-off sheet; fix the `colt` slug in the sheet.
9. **Attribution (F10).** Capture referrer host and `utm_source` into `acquisition`; store on funnel events; staff weekly count endpoint.
10. **Real store in CI (F11).** Nightly run of `test-sourcing-routes.ts` against an isolated real Redis; `PTTL` assertions in the fake store for the 24 h, 1 h and 30 d keys.
11. **Hygiene (F12, F13, F14).** Rate limit on `/api/sourcing/plan/`; label mapping for need and actions in brief, confirmation page and desk mail; move `limit()` after the `SET NX`.
12. **Release from main (F9).** Point Vercel production at main (or fast-forward `release/2026-09-30` to main) so the Harry retest fixes reach production; record the deployment ID in `docs/HANDOFF.md`; run the three live URL fetches from step 5 as the acceptance.

## Amendments after ChatGPT's validation (30 September, late)

ChatGPT confirmed F1, F2, F3 and F10 against the code and live pages and proposed two changes to the fixes, both accepted and applied above: the confirmation link is not extended into a standing credential (F7 now routes expired or reused links to buyer sign-in, which makes F1 a hard dependency of the same release), and the client does not generate a new request key after an uncertain email failure (the server re-send with the same Resend idempotency key is the retry). Two items from the original list are not named in ChatGPT's six corrective points and must not drop: F4 (the placeholder undertaking text in JSON-LD, llms.txt and the buyer email) and the owner deadline in F5 (sign off or extend the 19 adjudications and four UK carrier reviews before 16 October, or the sector and UK filters empty on 30 October).

## Appendix: commands run and results

- `git fetch origin release/2026-09-30 main codex/action-first-sourcing`; `git ls-remote origin refs/pull/8/*` → `683e953 refs/pull/8/head`; `git merge-base origin/main origin/release/2026-09-30` → 683e953; `git rev-list --count` → release ahead 0, main ahead 6; `git merge-tree --write-tree` → exit 0 (clean).
- `npm run test:action-first` at c56a2a7 → exit 0, on `snapshot_fallback` ("Provider matching source is not configured").
- `npx tsx scripts/review-probes.ts` (A to F) and `npx tsx scripts/review-probes-2.ts` (G, H): outputs quoted above. Both scripts are in the review clone only; they use the repository's fake KV harness and a fake Resend and touch no external system.
- `npx tsx scripts/review-slugs.ts` → all 23 reviewed slugs present in the 30-provider dataset; `colt` absent, `colt-technology-services` present.
- Vercel: `list_deployments` (both projects, target=production), `get_deployment dpl_8KfqXjBh…`, `get_project prj_confIOHi…`; `filter_project_envs` → 403 forbidden.
- Live fetches (cache-busted): `/sase/how-it-works/`, `/sase/`, `/sase/llms.txt` → quotes above.
- Not run: any request against production APIs, any email, any KV write outside the in-memory harness, any merge or deploy.
