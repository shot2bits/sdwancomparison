# Row-8 hotfix — market-unlock correction round

**Date:** 16 August 2026
**Amends:** `reports/row8-checkpoint-16aug2026.md` (the original row-8 checkpoint, commit `60c70e5`) and `reports/stage-b-canonical-envelope-design-16aug2026.md` (amended in place — see its own inline amendment markers, §3.5 and revised §5).
**Scope:** a focused correction round, per your explicit instruction. No Stage B implementation beyond what is strictly necessary to establish the canonical market-unlock boundary.
**Status:** complete, validated, bundled. **Not pushed, not merged, not deployed.**
**Branch:** `fix/row8-pre-publish-supplier-disclosure` (same branch as the original row-8 commit)
**New commit:** delivered as a second commit on this branch, on top of `60c70e5` — see §7 for the exact hash and the bundle.

This report stands on its own but assumes the original row-8 checkpoint as background. Per your framing: the original commit `60c70e5` is treated here as technically useful, real work correctly amended by this round — not as a completed Row-8 release. It is not discarded; this round builds on it.

---

## ROUND 3 AMENDMENT (16 August 2026, same day) — READ THIS FIRST

**Do not merge, push or deploy the commit this report originally described (`7608a09`).** Your review of that commit found it still violated the non-negotiable product rule and had an unsafe persistence ordering. This is a second, focused correction round on the SAME branch (`fix/row8-pre-publish-supplier-disclosure`), delivered as a THIRD commit on top of `7608a09`. Everything below this notice (§§0–11) describes the round-2 implementation **as it stood before this round's corrections** and is preserved for the historical record; where round 3 changed something, this notice says so plainly rather than silently editing the history below. **The claims in §2, §7 and §9 below about `list_on_board: false` producing a valid, still-unlocking "unlisted" Opportunity are WRONG and have been reversed — do not act on them.**

**Your instruction, quoted in full, is what actually governs this round:**

> A project unlocks vendor identities, project-specific matching, invitations, supplier-room access, messages, responses and exports only after it has been successfully published as a PUBLIC opportunity on the Opportunities Board. An unlisted/private Opportunity does not satisfy this rule. Do not reinterpret 'not listed on the board' as 'listed privately.' If a future private-market workflow is desired, that requires a separately named lifecycle and explicit product approval. It is not part of this change.

**What round 3 corrects, against round 2's own §2 "judgement call":** round 2 (§2 below) made an explicit, flagged judgement call — that `list_on_board: false` should still create a real `Opportunity` (with `visibility: "unlisted"`) and still commit a `MarketUnlock` against it, reasoning that "a private-invite path with no board record at all would have reintroduced a second, ungated route into the same class of defect this round closes." Your review rejected this outright, in the terms quoted above. The judgement call was wrong. Round 3's fix: `list_on_board: false` now creates **no `Opportunity` of any visibility, and commits no `MarketUnlock`** — the publish attempt returns a locked result immediately, with no supplier-facing side effect whatsoever.

**Checkpoint discipline honoured before any round-3 edit:** per your instruction, the three named defects were reproduced fresh, with real evidence, against the exact code this report originally described (commit `7608a09`), before any correction began:

1. **unlisted Opportunity unlocking the market** — reproduced: `isMarketUnlocked() === true` and a share-token read returned `200` for a project whose ONLY board listing was `visibility: "unlisted"`.
2. **board failure leaving project status published** — reproduced: a board-listing failure (a real `publicNoticeQualityGate()` refusal) left `project.status === "published"` and a real invited vendor, with no board listing and no unlock.
3. **MarketUnlock existing before its frozen snapshot** — reproduced: `commitMarketUnlock()` accepted a `published_revision_id` for which no `PublishedSnapshot`/frozen revision had ever actually been persisted, and `isMarketUnlocked()` read `true` against it.

Before/after machine-readable evidence for all three: `reports/row8-repro/round2-before-evidence.json` (all three `VIOLATION: true`, captured against `7608a09` before any round-3 edit) and `reports/row8-repro/round2-after-evidence.json` (all three `VIOLATION: false`, captured against the corrected code — the "after" run additionally drives the real production route with real business-email verification against `netify.co.uk` for the board-failure defect, not just the hermetic layer functions).

**What else round 3 changed, beyond the `list_on_board:false` reversal (§2's own numbered requirements):**

1. **Unlisted-market unlock removed entirely** (above) — `list_on_board: false` never creates an `Opportunity`, public or unlisted, and never commits a `MarketUnlock`. `listRfpOnBoard()` (`rfp-publish.ts`) no longer accepts a `visibility` option at all; it always creates a PUBLIC Opportunity, or is never called.
2. **`project.status` no longer flips to `"published"` before board publication succeeds.** Round 2's `executePublish()` (§3 below) still wrote `project.status = "published"` as a bookkeeping step BEFORE attempting the board listing — exactly reproduced defect 2 above. A new, internal-only `PublicationAttempt` record (new file, `src/lib/publication-attempt.ts`) now carries in-progress publish state instead; `project.status` transitions to `"published"` strictly AFTER the market genuinely unlocks (saga step F, below). A board failure, a storage failure, or an explicit `list_on_board: false` leaves the project non-published, market-locked, with no exposed vendor identities, matching, invitations, connections, supplier-room access or exports, and a retryable `PublicationAttempt` on record.
3. **The frozen revision is now persisted BEFORE the `MarketUnlock`, not after.** Round 2's `MarketUnlock` committed while `publishedRevisionId` was only a minted identifier — the corresponding `PublishedSnapshot` was stored later in the sequence (exactly reproduced defect 3 above). A new, minimal, genuinely-immutable `FrozenRevision` type (`published-snapshot.ts`) is now persisted early, before the board listing or the unlock. `commitMarketUnlock()` (`market-unlock.ts`, rewritten) now REFUSES to commit unless the referenced `FrozenRevision` exists, the public board `Opportunity` exists, both belong to the same project, the `Opportunity` is bound to that exact revision, and the matching-basis hash agrees with the frozen revision's own `content_hash` — derived internally, never accepted from a caller. `isMarketUnlocked()`/`getMarketUnlock()` re-run this SAME integrity check (`verifyMarketUnlockBinding()`) on every read, not just at commit time, so a forged or dangling KV row is treated as locked on every read, not just refused once at write time.
4. **A recoverable publication saga (A–G), matching your lettering exactly**, now structures `executePublish()`: (A) validate eligibility/ownership/consent/D5 — unchanged position; (B) resume-or-mint an idempotent `PublicationAttempt` + persist the immutable `FrozenRevision`, not yet externally exposed; (C) create the PUBLIC Opportunities Board listing bound to that revision — `list_on_board: false` skips this step entirely and returns locked; (D) persist the matching basis and invitation plan into the `PublicationAttempt`, computed once, reused verbatim on resume; (E) atomically commit the `MarketUnlock` (idempotent by the `(project_id, published_revision_id, board_opportunity_id)` triple — an exact-triple replay returns the existing record unchanged, never moving `unlocked_at`); (F) transition `project.status` to published, strictly after E succeeds; (G) create invitations idempotently from the frozen invitation plan, persisting `invited_slugs` incrementally so a partial failure resumes without re-inviting. Failures before E leave the project market-locked and non-published; failures after E resume idempotently without changing the frozen revision, shortlist or original `unlocked_at`.
5. **UI lifecycle language corrected** (`RfpBuilder.tsx`, `DescribeWizard.tsx`): while market-locked, "Re-send to your matched vendors" is hidden, "Your submission is in" is never shown, and a "Publication incomplete" state with a "Try publication again" / "Complete Opportunities Board publication" action explains plainly that no vendor has been invited and nothing supplier-facing has unlocked (new `publicationLocked` derived state, sourced from a new server-derived `publication_attempted`/`publication_locked_reason` pair on `GET /api/rfp/[id]/list-on-board`). The pre-publish CTA is now board-first: "Submit to your matched vendors" → "Publish opportunity" (`RfpBuilder.tsx`'s panel heading, sticky bar and vendor-panel button; `DescribeWizard.tsx`'s step-5 heading and CTA). `DescribeWizard.tsx`'s "list on board" checkbox — previously an untickable, genuine choice whose copy claimed unticking sent the RFP "to your matched vendors only" — is now static, non-optional text: under this rule there is no longer a real "matched vendors only" path, so offering it as a checkbox was actively misleading once round 3 landed; `list_on_board` is now always sent as `true` from that flow.
6. **Non-vacuous failure fixtures**, extended: `scripts/validate-rfp-builder-match-disclosure.ts` grew a new Part D2b (an unlisted-but-otherwise-perfectly-bound Opportunity is refused by `commitMarketUnlock()`) and a new Part E (four fixtures: a forged/dangling `MarketUnlock` referencing a missing snapshot; a matching-basis-hash mismatch; a `MarketUnlock` claiming a revision its bound Opportunity does not actually reference; cross-project binding refusal) — **167/167** passing (up from round 2's 147/147). `scripts/verify-publish-route-live-demo.ts` (a real-network, real-route "live demo," deliberately not wired into `npm run validate`) grew two new scenarios driving the REAL production path with real business-email verification against `netify.co.uk`: Scenario 2 proves `list_on_board: false` stays locked through the real route; Scenario 3 proves a REAL board quality-gate failure (a real, pre-existing sector-label/catalogue-key bridging gap in the security-sourcing intake path — flagged separately below, out of this round's scope) leaves the project non-published and market-locked. **Sabotage-and-restore proof, a scope decision documented honestly here rather than silently presented as exhaustive:** rather than sabotaging all 13 of your named fixtures individually, two COMBINED sabotage passes were run against the shared integrity mechanism — (1) read-side: `verifyMarketUnlockBinding()` forced to `return true` unconditionally, confirmed 7 fixtures fail (the E1/E2/E3 read-side checks); (2) write-side: `commitMarketUnlock()`'s four inline refusal checks disabled, confirmed 2 fixtures fail (D2b, E4). Both passes restored cleanly, confirmed byte-identical to a saved golden copy via `diff`. Full log: `reports/market-unlock-round2/sabotage-proof/log.txt`.
7. **This document, the Stage B design, and this checkpoint's own §2/§7/§9 claims about unlisted-market unlock are corrected** — see the Stage B design's own round-2 amendment markers (its §3.5 and §5), and treat every "public or unlisted" claim below (§2, §7, §9) as superseded by this notice, not by a silent edit to that prose.

**A genuinely out-of-scope, pre-existing finding surfaced while building the real-network fixtures above, flagged for your separate attention rather than fixed here:** `verify-publish-route-live-demo.ts`'s Scenario 3 needed a REAL board quality-gate failure to test against, and the most natural way to get one — publishing a security-sourcing-created project with its real, production sector value (`organisation.sector: "Healthcare & pharma"`, exactly what `ProjectDesk.tsx` and `SecuritySourcingAdvisor.tsx` send today) — trips `publicNoticeQualityGate()`'s catalogue-sector check every time, because `src/lib/security/create-project.ts`'s `buyerFrom()` never bridges that free-text label to the board's catalogue KEYS (`"healthcare"`, not `"Healthcare & pharma"`) the way `NoticeBuilder.tsx`/`draft.ts`'s `SECTOR_KEY_BRIDGE` does elsewhere. As far as this round could tell without expanding scope, this means a real security-sourcing-created project publishing today with `list_on_board: true` and a real sector stated would ALWAYS fail the board quality gate on sector alone — worth a look, but deliberately not touched here (not one of your seven numbered requirements, and unrelated to the MarketUnlock saga this round corrects).

**Round 3 changed-file list** (in addition to, not replacing, §9's round-2 list below): `src/lib/publication-attempt.ts` (new), `src/lib/market-unlock.ts` (rewritten), `src/lib/published-snapshot.ts` (`FrozenRevision` type + functions added), `src/lib/opportunity-types.ts` (`source_published_revision_id` field added), `src/lib/rfp-publish.ts` (`executePublish()` restructured into the A–G saga; `listRfpOnBoard()`, `retryBoardPublication()`, `recoverUnlistedPublish()` updated), `src/app/api/rfp/[id]/list-on-board/route.ts` (`publication_attempted`/`publication_locked_reason` added), `src/components/RfpBuilder.tsx` and `src/components/DescribeWizard.tsx` (UI lifecycle language), `scripts/fake-kv-harness.ts` (`seedVerifiedMarketUnlock()` helper), `scripts/validate-published-resume-hydration.ts` and `scripts/validate-rfp-builder-match-disclosure.ts` (updated to the new signatures; new Part D2b/E), `scripts/verify-publish-route-live-demo.ts` (Scenario 1 fixed to `list_on_board: true`; Scenarios 2–3 added), `scripts/repro-market-unlock-round2-after.ts` (new — the after-evidence capture script), `scripts/capture-market-unlock-round2-screenshots.mjs` (new — the desktop/mobile screenshot capture script), `scripts/validate-row8-vendor-disclosure-ui.mjs` (button-name references updated to "Publish opportunity"). Full validation (`tsc --noEmit`, `npm run validate`, targeted lint parity, `npm run build`) re-run clean after every change — see the round-3 evidence bundle for saved output.

---

## 0. What you found, in your own words

Quoting your instruction in full is the most accurate way to state the defect this round closes:

> The Row-8 implementation successfully blocks supplier disclosure while the internal project status is a draft, but it does not yet implement Robert's actual product rule: Vendor identities, project-specific matches, invitations, connections, supplier-room access, exports and other post-publication capabilities must unlock only after the project has been successfully published to the Opportunities Board. The supplied post-fix evidence proves the current mismatch: a named invited vendor is visible while the UI says "Not on the public board yet." Therefore `hasPublished(project.status)` is not the canonical unlock boundary.

You are right, and the evidence you cited is exactly what this round set out to reproduce cleanly and then close: `reports/row8-repro/after-fix-vendor-panel-post-publish.png` (delivered with the original checkpoint) showed a named vendor's response link visible in the connections list at the same moment the "Not on the public board yet" banner was also showing — because the original fix's gate, `hasPublished(project.status)`, only asked "has this project's internal state machine crossed into published/qa/evaluation," never "did the Opportunities Board listing this publish attempted actually succeed." Those are two different, independently-observable facts, and the original fix conflated them.

---

## 1. Reproduction (your step 1)

Reproduced fresh this round, against the current (corrected) code, using the same harness the original checkpoint used (`scripts/reproduce-row8-disclosure.mjs`, a real Next.js dev server against the real route handlers, with `fake-kv-server.mjs` standing in only for the Upstash REST network hop): a draft project is created, its status is flipped directly to `"published"` (bypassing the publish orchestration entirely — no board listing is ever attempted), and every governed surface is read.

**Evidence delivered alongside this report:**
- `reports/row8-repro/market-unlock-correction-evidence.json`
- `reports/row8-repro/market-unlock-correction-vendor-panel-pre-publish.png`
- `reports/row8-repro/market-unlock-correction-vendor-panel-post-publish.png`

The exact state you described — `project.status` satisfies `hasPublished()`; the Opportunities Board was never listed; the internal state machine alone says "published" — now behaves correctly:

- `share_token_read_post_publish` → **`404 "RFP not found."`** (previously `200`, leaking `rfp_sections`).
- `connect_invite_post_publish` → **`409`**, `{"error":"This RFP's market has not unlocked yet — publish (and, if the board listing hasn't completed, list on the board) before inviting or contacting vendors.","code":"market_locked"}` (previously `200`, a real persisted `SupplierConnection`).
- The vendor panel's own copy now reads: *"Step 3. Your submission is in. Your matched vendors and service providers are invited the moment your board listing completes — see the notice below."* — sitting directly above the pre-existing "Not on the public board yet... List on the board" banner, with no vendor name, connection, or suggest button rendered anywhere on the page. The screenshot shows both notices together, honestly: the internal status has moved on, but nothing supplier-facing has, and the UI says so in the same panel rather than in two contradictory ones.

This is the same reproduction methodology the original checkpoint used and you already trust; only the code under test and the resulting evidence are new.

---

## 2. The canonical market-unlock record (your step 2)

> **SUPERSEDED by the ROUND 3 AMENDMENT above.** The "one judgement call" flagged below — that `list_on_board: false` should still produce a real, unlocking `Opportunity` with `visibility: "unlisted"` — was reviewed and explicitly rejected. `market-unlock.ts` was rewritten in round 3: `board_visibility` is now a literal `"public"` (never `"unlisted"`), `commitMarketUnlock()` refuses any Opportunity that is not public, and `list_on_board: false` creates no `Opportunity` and no `MarketUnlock` at all. The `MarketUnlock` shape below is also stale (round 3 simplified `commitMarketUnlock()`'s caller-facing input to just three ids, deriving `matching_basis_hash` internally) — left as-is here for the historical record; see the round-3 notice above for the corrected shape and rewrite.

New file: **`src/lib/market-unlock.ts`**. A single, server-derived, persisted record — never inferred from `status`, `phase`, or any other broad lifecycle value — proving all three of your named conditions simultaneously:

```ts
MarketUnlock {
  id
  project_id
  published_revision_id     // the frozen Living Procurement Document revision this unlock is bound to
  board_opportunity_id      // the Opportunities Board listing this unlock is bound to
  board_visibility           // "public" | "unlisted" — see the judgement call below
  matching_basis_hash        // content hash of the ledger state matching was/will be run against
  invitation_snapshot_id     // the snapshot carrying the frozen invited/matched vendor lists
  unlocked_at                // immutable once set
}
```

`isMarketUnlocked(projectId)` — the one predicate every governed route now calls — answers exactly one question: does a committed `MarketUnlock` record exist for this project. Keyed in KV as `rfp:{projectId}:market_unlock`.

**One judgement call, flagged explicitly for your review, per your own instruction to choose the shape that best fits the repository:** `list_on_board: false` ("matched suppliers only," a pre-existing, legitimate product choice) no longer skips Opportunities Board record creation entirely. It now creates a real `Opportunity` record with `visibility: "unlisted"` — a field that already existed in the schema (`opportunity-types.ts`) but was previously hardcoded to `"public"` — and still binds a real `MarketUnlock` to it. `listPublicOpportunities()` already filters strictly on `visibility === "public"`, so an unlisted listing correctly never appears on the public board page or its feed, matching the buyer's actual choice. I made this call because your instruction is explicit that "board publication is a prerequisite, not an optional action" — a private-invite path with no board record at all would have reintroduced a second, ungated route into the same class of defect this round closes. If you intended `list_on_board: false` to mean "never unlocks the market at all" rather than "unlocks privately," that is a one-line change (`commitMarketUnlock` simply never gets called in that branch) and I can make it on your instruction.

**Idempotency:** `commitMarketUnlock()` is idempotent by the `(project_id, published_revision_id, board_opportunity_id)` triple — a retried call describing the exact same triple returns the existing record unchanged, `unlocked_at` never moving. Proven by fixture (§5, D5).

---

## 3. The corrected publish sequence (your step 3)

`src/lib/rfp-publish.ts`'s `executePublish()` was restructured so board publication is a genuine prerequisite:

**Before this round:** compute the matched shortlist → invite every selected vendor (real, persisted `SupplierConnection` writes) → set project status to published → attempt the board listing, with its success or failure having no bearing on anything already done.

**After this round:** validate eligibility (min-content gate, business-email verification) → the D5 declined-approval gate (moved up — see the independent finding below) → freeze the canonical revision (mint `publishedRevisionId`, a pure id mint, no I/O) → transition the project's own status/history (bookkeeping only, still no supplier-facing effect) → create/list the board opportunity → **if it fails: stop.** Return a locked result — no invited vendors, no matched vendors shown, no `MarketUnlock` committed, and (deliberately) no publish-idempotency state committed either, so a retry is a genuine, safe re-attempt, not a silent no-op → **if it succeeds:** commit the `MarketUnlock` record → only then compute matching and create invitations → merge the real invite list onto the project record → build the market report, send notifications, freeze the `PublishedSnapshot` under the *same* pre-minted revision id, and commit publish idempotency state last, so a genuine mid-sequence failure never poisons a later real retry.

**An independent finding beyond what you named, closed by the same restructuring:** in the pre-correction code, the invite loop ran *before* the D5 declined-approval gate check, and before the project's status ever moved off `"draft"`. A publish blocked by D5 (a declined approval with no explicit confirmation) still resulted in real invitations sent to real named vendors, even though the function then threw `DeclinedApprovalError` and the project never actually left `"draft"` status — an invitation dispatched from behind a thrown exception, for a project the buyer never actually published. Moving the D5 gate ahead of the freeze/board/unlock/invite sequence closes this the same way it closes your named defect.

**Recovery path:** `retryBoardPublication(project, sessionEmail)` (new, exported) — the standing `/list-on-board` route's `POST` now calls this instead of listing the board in isolation, so recovering a "published but market locked" project also completes the deferred unlock-and-invite step, not just the board record. Idempotent: a no-op if the market is already unlocked; otherwise re-runs the board-then-unlock-then-invite tail against the project's *current* content (re-freezing a fresh revision, since the content may have changed since the failed attempt).

---

## 4. `hasPublished()` replaced with the canonical check (your step 4)

Every route your instruction named now calls `isMarketUnlocked()` instead of `hasPublished(project.status)`:

- **`RfpBuilder.tsx`** — the vendor panel's own `published` flag now reads `marketUnlocked` (new, separate client state, sourced from the server on every project read/publish/list-on-board response — kept deliberately outside the `project` object itself, since `ProjectDetailsSchema` is `.strict()` and the builder's PUT handler spreads the full `project` state back into its save body; merging it in would have broken every save with "Invalid RFP shape").
- **`suggestSuppliers()`** — guarded independently of the button's own visibility.
- **`POST`/`GET /api/rfp/[id]/connect`** — the connect/invite/message route.
- **`GET /api/rfp/[id]`** — the share-token supplier read (main project route), and the owner read now also carries `market_unlocked`/`market_unlock` as sibling JSON keys (never merged into the strict-schema project object, for the same reason as above).
- **`GET /api/rfp/[id]/report`** — the market-report/matching output route.
- **`GET /rfp-builder/[id]/preview/download`** — the Word/PDF/JSON export route.
- **`nda`, `thread`, `evidence-draft`, `respond`** (the supplier room's constituent routes, `supplier-capability-access.ts`'s adjacent surface) — each now applies the canonical gate before resolving any supplier principal. `respond` keeps its own, different pre-existing check (`status === "published" || "qa"`, a *different* rule: responses close once evaluation starts) and gets the market-unlock check *additionally*, not as a replacement, since the two check different things.

**A gap beyond the specific routes you named, closed the same way:** `supplier-capability-access.ts`'s `resolveSupplierPrincipal()` has a "claimed session" lazy-issuance branch that mints a fresh per-vendor bearer credential for any vendor with an approved profile claim and a session, for *any* rfp id, regardless of whether that vendor was ever invited or whether the project's market has unlocked at all. Closed by adding the `isMarketUnlocked()` precondition to the top of the nda/thread/evidence-draft routes' supplier-facing branches, before any principal resolution — the same "respond identically to not found" pattern the original row-8 fix established, so this cannot be used as a lifecycle oracle either.

---

## 5. Authentication ordering fixed in `connect` (your step 5)

`POST /api/rfp/[id]/connect` now: loads the project → parses only the body fields owner authentication needs → authenticates/authorises via `requireRfpOwner` → **only then** checks `isMarketUnlocked()` → only then processes the invite/message. Previously the row-8 fix's own publish-state check ran *before* ownership was ever proven, which meant an unauthorised caller could distinguish a draft (`409`) from other lifecycle states purely from the response shape, without ever proving they owned the project. Fixed by reordering; proven by fixture (`partB9`, §6).

---

## 6. Stage B design amended (your step 6)

`reports/stage-b-canonical-envelope-design-16aug2026.md` amended **in place**, with inline amendment markers (not a separate document, matching your instruction to amend the existing design):

- **New §3.5** states the invariant this round's implementation had to satisfy and the design must preserve: a frozen `DocumentRevision` (§3) is *necessary but never sufficient* for market unlock. It defines the envelope-native `market_unlock` field (mirroring `market-unlock.ts`'s shape) that would carry this under Stage B, bound to the exact `published_revision_id` — never "whichever revision happens to be current," which matters once draft editing can continue past publish.
- **§5 revised**: every downstream projection — board listing, the supplier room, matching, exports — must read the *same* `market_unlock` record for the *same* `published_revision_id`, and none of them may independently infer "the market is unlocked" from a local signal. This is stated as the same class of invariant as §4's "no newer compiler version may silently alter the live opportunity," extended from compilation to unlock state.
- **§6** corrected: the original text said this design "does not touch `supplier-capability-access.ts`"; this round's implementation did (§4 above), so the amendment records that narrowly and explains why it was still the minimum necessary change.

---

## 7. Fixtures (your step 7) — non-vacuous, sabotaged, restored

> **PARTIALLY SUPERSEDED by the ROUND 3 AMENDMENT above.** The fixture counts below (37/147) are the round-2 figures; round 3 added Part D2b and a new Part E (four fixtures) and the suite now passes 167/167. Part D's own "`list_on_board: false` producing a real but unlisted, still-unlocking Opportunity" (below) is exactly the reversed claim — round 3's Part D2a/D2b instead prove `listRfpOnBoard()` can no longer produce anything but public, and that `commitMarketUnlock()` actively refuses an unlisted Opportunity. See the round-3 notice above for the corrected fixture/sabotage summary.

**`scripts/validate-rfp-builder-match-disclosure.ts`** — extended, not replaced:

- **New Part B9** (structural, 24 assertions): the client `marketUnlocked` state and its threading, the connect route's gate and its auth-before-unlock ordering, every governed route's gate, and `rfp-publish.ts`'s own sequencing (revision-freeze-before-board, D5-before-freeze, unlock-commit-before-invite-loop) — all checked against the real source text.
- **Part C rewritten**: the exact reproduction from §1 above, now against the real route handlers — asserting the LOCKED state (404/409/`market_locked`, zero persisted connections, `market_unlocked:false` on the owner's own read) where the pre-correction fixture incorrectly asserted success. A new respond-route assertion proves the market-unlock check is *additive* to the route's own pre-existing status check, not redundant with it.
- **New Part D** (real board listing + `MarketUnlock` commit, 37 assertions): successful public board publication unlocking every governed route (owner/anonymous/share-token, connect, report); `list_on_board: false` producing a real but unlisted, still-unlocking Opportunity absent from the public feed; a board **quality-gate failure** (a title tripping the real `TITLE_MARKERS` check) leaving no `Opportunity`, no `MarketUnlock`, and a still-refused share-token read; a real **storage failure** (via `fake-kv-server.mjs`'s new `outage()`/`restore()` methods — an actual closed-then-reopened TCP listener, not a mock) followed by a genuine successful retry; **idempotent replay** of `commitMarketUnlock()` returning the identical record and timestamp; the market staying unlocked through `qa`/`evaluation` status transitions; and the export/NDA routes moving from locked (403/404) to gate-passed once the market genuinely unlocks.
- Covers every scenario in your item-7 list: draft; internal-published-no-board-listing; explicit `list_on_board:false`; board quality-gate failure; board storage failure; successful publication; idempotent replay; owner/anonymous/share-token access; qa/evaluation after a valid publication; no identities/invitations/connections/exports before unlock; identities/exports available after unlock; no partial side effects on board failure.

**A real end-to-end publish through `executePublish()`/`POST /api/rfp/[id]/publish` was deliberately not attempted inside this wired fixture**, for the same reason `validate-living-canvas-phase2-lifecycle.ts` (an existing, pre-dating-this-round fixture) already documents: `executePublish()` always calls `verifyBusinessEmail()`, which does real DNS/HTTPS against the publishing email's domain — not something a build-gate script can depend on. Part D instead calls `listRfpOnBoard()` and `market-unlock.ts` directly — the exact library calls `executePublish()` itself makes once its own eligibility gates pass — against real route handlers and a real fake-kv backend. `executePublish()`'s own internal ordering is proven structurally, against the real source, in Part B9.

**A pre-existing, unrelated fixture regressed and was fixed as a necessary consequence:** `scripts/validate-published-resume-hydration.ts`'s Part A2 (from an earlier round, 14 Aug) exercised the `/report` route against a project whose status was flipped directly to `qa`/`evaluation`/`published` via the same KV-bypass technique, without ever creating a real board listing — under the new canonical gate, that state is correctly locked, which is exactly this round's own point, but it meant the pre-existing fixture's assertions (written when `hasPublished()` alone was sufficient) started failing. Fixed by adding a real `commitMarketUnlock()` call to each of that fixture's three scenarios, immediately after the status-flip, so it now proves what it always intended to prove — that a post-publish project sees the full report — against the boundary that actually governs it today.

**Sabotage-and-restore proof** (your step 8's explicit instruction): the `connect` route's and the main project route's canonical checks were reverted to the original `hasPublished(project.status)` gate, and the fixture suite re-run. Result: **15 assertions genuinely fail** — the exact Part B9/C/D assertions that exercise the corrected boundary — confirming the fixtures are not vacuous. Saved as `reports/sabotage-proof-output-16aug-market-unlock-correction.txt`. The sabotage was then reverted; the suite passes clean again (**147/147**, confirmed twice).

---

## 8. Full validation chain (your step 8)

- `npx tsc --noEmit -p tsconfig.json` — **exit 0**, zero errors.
- `npm run validate` (all wired fixtures, including the extended/fixed ones above) — **ALL PASS, zero `FAIL` lines, no script errors.** Saved as `reports/full-validate-output-16aug-market-unlock-correction.txt`.
- Lint parity: `npx eslint` across every file this round touched reports the *identical* "20 problems (8 errors, 12 warnings)," confined entirely to `RfpBuilder.tsx` — the same pre-existing count already confirmed against the unmodified baseline in the original row-8 checkpoint work (via `git stash` comparison). Zero new lint errors from this round's changes. `npm run lint` remains a separate script, not wired into `validate`/`build`.
- `npm run build` — **`✓ Compiled successfully`**, exit 0. Saved as `reports/build-output-16aug-market-unlock-correction.txt`. (As with the original checkpoint, this sandbox has no network route to `fonts.googleapis.com`; the build was run with a temporary, fully-reverted local stub of the `next/font/google` import in `layout.tsx` — confirmed via `git diff --stat` showing zero diff on that file at commit time — a pre-existing sandbox limitation unrelated to this change.)

---

## 9. Changed-file list

> **Extended by the ROUND 3 AMENDMENT above** — see its own "Round 3 changed-file list" paragraph for what round 3 additionally touched (`publication-attempt.ts` new; `market-unlock.ts` rewritten again; the A–G saga; the UI lifecycle language; the new/extended fixtures and live-demo scenarios). The list below is the round-2 file list, unchanged, for the historical record.

```
src/lib/market-unlock.ts                              (new — the canonical record + predicate)
src/lib/rfp-publish.ts                                 (executePublish() sequencing corrected; retryBoardPublication() new)
src/app/api/rfp/[id]/connect/route.ts                  (isMarketUnlocked() gate, auth-before-unlock ordering)
src/app/api/rfp/[id]/route.ts                          (share-token gate; owner read carries market_unlocked/market_unlock)
src/app/api/rfp/[id]/report/route.ts                   (isMarketUnlocked() gate)
src/app/api/rfp/[id]/publish/route.ts                  (response carries market_unlocked)
src/app/api/rfp/[id]/list-on-board/route.ts            (POST now calls retryBoardPublication(); GET carries market_unlocked)
src/app/api/rfp/[id]/nda/route.ts                      (isMarketUnlocked() gate on supplier-facing branches)
src/app/api/rfp/[id]/thread/route.ts                   (isMarketUnlocked() gate on supplier-facing branches)
src/app/api/rfp/[id]/evidence-draft/route.ts            (isMarketUnlocked() gate)
src/app/api/rfp/[id]/respond/route.ts                   (isMarketUnlocked() gate, additive to the existing status check)
src/app/rfp-builder/[id]/preview/download/route.ts       (isMarketUnlocked() gate replacing status equality)
src/components/RfpBuilder.tsx                           (marketUnlocked client state; published now delegates to it; third Step-3 copy branch)
scripts/lib/fake-kv-server.mjs                          (outage()/restore() added for the storage-failure fixture)
scripts/validate-rfp-builder-match-disclosure.ts         (Part B8 trimmed; new Part B9; Part C rewritten; new Part D; +394 net lines)
scripts/validate-published-resume-hydration.ts           (Part A2's three scenarios each now commit a real MarketUnlock; +47 net lines)
reports/stage-b-canonical-envelope-design-16aug2026.md    (amended in place — new §3.5, revised §5, corrected §6)
reports/R0-repository-reconciliation-16aug2026-v3.md      (second status note; §15 amended)
```

15 source/script files changed (1,022 insertions, 212 deletions), one new library file, two documents amended in place. No file outside this list was touched. `reports/` evidence output (JSON, screenshots, logs) is untracked, matching this repository's existing convention.

---

## 10. What this round does not cover

- **A real, DNS-dependent end-to-end publish through `executePublish()` itself** is not exercised inside the wired `npm run validate` chain, for the reason stated in §7 — matching this repository's own established convention for exactly this limitation. If you want that coverage, it belongs in a hand-run `verify-*-live-demo.ts` script (the existing pattern), not the build gate.
- **The `list_on_board: false` → unlisted-Opportunity judgement call** (§2) is exactly that: a judgement call, not something your instruction explicitly settled either way. Flagged for your decision.
- **`resolveSupplierPrincipal()`'s own vendor-principal resolution logic** was not touched — only a precondition gate was added ahead of it. Any deeper issues within that resolution logic itself remain out of scope for this focused round.
- Stage B implementation, beyond the market-unlock record itself (which your instruction explicitly authorised as strictly necessary to establish the canonical boundary), has not been started.

---

## 11. Explicit confirmation

Nothing in this round has been pushed to any remote, merged into `main`, or deployed. `main` remains at `f14a956a`, untouched. All work lives on the local branch `fix/row8-pre-publish-supplier-disclosure`, as a new commit on top of `60c70e5` (see the accompanying bundle). To bring it into `main`, apply the bundle and merge it yourself once reviewed — exactly the same process as the original checkpoint, extended by one more commit.

**Round 3 re-confirmation (16 August 2026, same day):** commit `7608a09` (the commit this report §§0–11 originally described) is explicitly NOT to be merged, pushed or deployed, per your instruction. Round 3 is delivered as a THIRD commit on the SAME branch, on top of `7608a09`, not a replacement of it — `git log` on the branch shows the honest history: the original defect, the round-2 attempt, and this round's correction of that attempt, each as its own reviewable commit. `main` remains untouched at the same commit as above. Stopping here for your review, exactly as instructed.
