# Row-8 Hotfix Checkpoint — pre-publication supplier-identity disclosure

**Date:** 16 August 2026
**Scope:** narrowly scoped security-boundary hotfix only, per Robert's explicit instruction. Stage B has not been started.
**Status:** complete, validated, bundled. **Not pushed, not merged, not deployed.**
**Branch:** `fix/row8-pre-publish-supplier-disclosure`
**Commit:** `60c70e5fb7b416435b0b3899622aba5d64e98252` (single commit, off `main` at `f14a956a`)
**Bundle:** `/tmp/row8-hotfix.bundle` (delivered alongside this report), verified with `git bundle verify`

This is the checkpoint referenced in `R0-repository-reconciliation-16aug2026-v3.md`. It stands on its own: what row 8 actually was, what was fixed, how it was proven, and what is explicitly still open.

---

## 1. What row 8 was

R0's reconciliation classified the brief's "pre-publish identity boundary" claim as **Partial**, not Live: the rule buyers are told holds — pre-publication views may show only aggregate marketplace information, never supplier identities or project-specific matching details — was enforced in the newer `ProjectDesk.tsx` / `compileProcurementDocument()` system, but the older `RfpBuilder.tsx` / `rfp_sections` / `executePublish()` system (the one that is actually saved, published and exported) had three real, live gaps. None of them were caught by the existing regression fixture (`validate-rfp-builder-match-disclosure.ts`'s Part B8), which checked that the vendor panel *reads from* an owner-gated route, but never checked *publication state* at all — so it passed against the unfixed code.

### 1.1 Disclosure path 1 — the vendor panel itself had no publish-state gate

`RfpBuilder.tsx`'s "Vendors and service providers" panel rendered unconditionally once a project existed, regardless of status. On a draft:
- the "Suggest best-fit vendors" button was present and worked, returning real ranked vendor names, slugs and match scores;
- the connections list rendered any already-invited supplier's real name, message thread, viewed/declined status and per-vendor response link;
- the panel's own `published` flag was a local re-derivation (`status !== "draft" && status !== "review"`) rather than the canonical `hasPublished()` predicate — a parallel reimplementation that happened to agree with the canonical rule today, but is exactly the pattern that has drifted before in this codebase (per the code comments already present at the canonical predicate's definition).

### 1.2 Disclosure path 2 — inviting/messaging a supplier had no status check

`POST /api/rfp/[id]/connect` created a persisted, real `SupplierConnection` (with a real vendor slug, a real connection token, and a message thread) whenever the caller satisfied `requireRfpOwner` — with no check that the project had been published first. An owner (or anyone able to satisfy ownership, e.g. via a leaked manage token) could invite and message a named supplier while the project was still a private draft, i.e. before the buyer had committed to publishing anything.

### 1.3 Disclosure path 3 — the share-token read had no status check

`GET /api/rfp/[id]?token=<share_token>` returned the full `supplierView()` projection (real `rfp_sections`, buyer sector, matched-vendor context) to anyone holding the share token — and the share token is minted at **project creation**, not at publish. The RFP Builder UI exposes a "Response link" control containing this token that is visible from the very start of drafting, well before publication. This meant a draft's supplier-facing data was reachable by anyone who obtained that link, with no publication gate at all.

---

## 2. What was fixed

All three paths now delegate to the same canonical predicate, `hasPublished(status)` (`src/lib/project-machine.ts`), which checks membership in `POST_PUBLISH_STATUSES = ["published", "qa", "evaluation"]`. No new predicate was invented; the existing canonical one was reused everywhere a parallel or missing check previously existed.

**`src/components/RfpBuilder.tsx`**
- `published` now reads `hasPublished(project.status)` instead of a local, duplicate status comparison.
- `suggestSuppliers()` refuses to run (guard at function entry) unless `hasPublished(project.status)` — defense in depth behind the UI gate.
- The mount-time `refreshConnections()` effect only fires post-publish (explicit post-publish call sites elsewhere, e.g. right after publish/invite/message actions, are untouched).
- The "Suggest best-fit vendors" button, the suggestions list, the "no vendors invited yet" / viewed-count messaging, the decline-reasons block, and the entire connections list are all now wrapped in `{published && (...)}`.
- Pre-publish, the panel shows a generic, aggregate-only locked notice instead: *"Vendor matches, invitations, messages and replies are locked until you publish — publishing is what invites your matched vendors and starts the conversation."*

**`src/app/api/rfp/[id]/connect/route.ts`**
- `POST` now returns `409 { error: "Publish the RFP before inviting or contacting vendors.", code: "not_published" }` if `!hasPublished(project.status)`, checked before `requireRfpOwner` and before body parsing — this is a publication-state rule that applies even to the project's own owner, not an ownership rule, so it is checked first.
- `executePublish()` itself calls `inviteSupplier()` directly (via `rfp-connect.ts`), bypassing this route entirely, so the publish flow's own auto-invitation of top-ranked vendors is unaffected by this gate.

**`src/app/api/rfp/[id]/route.ts`**
- The `GET` share-token branch now returns the identical `404 { error: "RFP not found." }` response used for a genuinely invalid id/token if `!hasPublished(project.status)`, before building `supplierView()`. The response is deliberately indistinguishable from "no such project," so this path cannot be used as an existence oracle to confirm a draft project's mere existence, let alone its contents.

No other route, and no ownership/authentication logic, was touched. `requireRfpOwner` itself was already correct; the gap was a missing, orthogonal publish-state check alongside it, not a broken ownership boundary.

---

## 3. Reproduction evidence

Per Robert's step 1, each disclosure path was reproduced with exact evidence, both before and after the fix, against a faithful local runtime of the exact commit under test: real route handlers, real `rfp-store` / `rfp-connect` / `project-machine` business logic, with `fake-kv-server.mjs` (an in-memory Upstash-REST-protocol stand-in) substituted only for the KV backend. This runs the real production code paths without touching real production data.

**Why not reproduce directly against `https://netify.co.uk/`:** the write-side path (disclosure path 2) creates a real, persisted, addressable `SupplierConnection` against a real vendor slug and sends a real message. Reproducing it against production directly would itself perform the exact harm being demonstrated and fixed — a real invitation to a real vendor from a throwaway draft. The read-side paths (1 and 3) could in principle have been reproduced read-only against production, but were captured against the same faithful local clone for a single consistent, paired before/after evidence set. This is a judgment call, not a shortcut: the code under test is byte-identical to what is in the repository at the commit in question, only the KV backend differs.

Evidence files (delivered alongside this report):
- `reports/row8-repro/before-fix-evidence.json` + `before-fix-vendor-panel-pre-publish.png`
- `reports/row8-repro/after-fix-evidence.json` + `after-fix-vendor-panel-pre-publish.png` + `after-fix-vendor-panel-post-publish.png`

**Before fix**, against a freshly created draft (`rfp_msvsbzgdpa2nrv`):
- `share_token_read_pre_publish` → `200`, leaking 5 `rfp_sections` and the buyer's sector.
- `connect_invite_pre_publish` → `200`, persisting a real connection (`conn_msvsc106pthi9c`, vendor `cato-networks` / "Cato Networks", token `stok_msvsc106pc27ta`) with a message thread, while the project was still `status: "draft"`.
- `connect_list_after_pre_publish_attempt` → `200`, `connection_count: 1` — the persisted connection is durable, not just an in-flight response.
- UI screenshot of the pre-publish panel shows the "Suggest best-fit vendors" button live and the full vendor-matching copy, with no gate.

**After fix**, against a fresh draft (`rfp_msvser4yd3zpw8`):
- `anonymous_read_pre_publish` → `401` (unrelated existing boundary, confirmed unaffected).
- `share_token_read_pre_publish` → `404 "RFP not found."` (previously `200` with leaked sections).
- `connect_invite_pre_publish` → `409 not_published` (previously `200` with a persisted connection).
- `connect_list_after_pre_publish_attempt` → `200`, `connection_count: 0`.
- UI screenshot of the pre-publish panel shows the "Suggest best-fit vendors" button absent and the generic locked-notice copy in its place.
- A fourth leg proves the intended reveal is preserved: after publishing the same project, `share_token_read_post_publish` → `200` with 5 sections visible, `connect_invite_post_publish` → `200` with a persisted connection, and the UI screenshot shows the full panel — real vendor names, the connections list, the suggest button — correctly restored.

Owner, anonymous, and share-token access were each tested as separate legs (per step 7), not conflated.

---

## 4. Fixtures

**`scripts/validate-rfp-builder-match-disclosure.ts`** (TypeScript, wired into `npm run validate` and `npm run build`) — Part B8 rewritten and a new Part C added:
- Part B8 (structural): now also asserts the `hasPublished` import exists, `const published = hasPublished(project.status);` is used, and the button / suggestions-block / connections-list gating and the two server routes' new status checks are all present in source — in addition to the two original checks (owner-gated route usage, `data.invited?.length`).
- Part C (new — production-path, per step 5): imports the real route handlers directly (`POST /api/rfp`, `POST`/`GET /api/rfp/[id]/connect`, `GET /api/rfp/[id]`) against a `fake-kv-server.mjs` backend, and exercises owner, anonymous, and share-token access separately, both pre- and post-publish (post-publish reached via `saveProject({...stored, status: "published"})`, not by faking the HTTP publish flow, since the publish workflow itself is out of scope here). This proves names, slugs, rankings, project-specific counts, links and supplier actions are unavailable before publication and correctly available after, against the real code paths rather than reimplemented logic.
- Standalone result: **93/93 PASS**.

**`scripts/validate-row8-vendor-disclosure-ui.mjs`** (new, real-browser Playwright fixture; wired as `npm run validate:ui:row8`, not part of the auto-run `validate`/`build` chain, matching this repo's existing convention for `.mjs` UI fixtures) — creates a real draft via `POST /api/rfp`, signs in for real (`/api/auth/request` + `/api/auth/verify`), navigates to the real RFP Builder page, and asserts against the live rendered DOM:
- pre-publish: no suggest button, no connections `<details>`, the locked notice present, and none of a list of real vendor-name strings appear anywhere on the page;
- a real click on "Submit to your matched vendors" (awaiting the actual publish response, not a timeout);
- post-publish: the panel reveals, and a real click on "Suggest best-fit vendors" is followed by an assertion against the connections list showing real, named, already-invited vendors (e.g. "Cato Networks") — because `executePublish()` already auto-invites the top-ranked matched vendors as part of publishing, the suggest click legitimately returns zero *new* suggestions post-publish; the fixture asserts on the connections list, which already carries the real data, rather than the suggest-flow's returned set.
- Screenshots: `reports/screenshots/row8-vendor-panel-pre-publish.png`, `reports/screenshots/row8-vendor-panel-post-publish.png` (both delivered alongside this report; visually confirmed).
- Result: **10/10 PASS**.

**Full regression**: `npm run validate` (14 wired fixtures, **724 assertions, ALL PASS**) and `npm run build` (`✓ Compiled successfully`, exit 0) both pass clean at commit `60c70e5`, confirming the fix introduced no regressions elsewhere in the repository. (`npm run build`'s output shows a `next/font/google` fetch failure in this sandbox only, caused by no network route to `fonts.googleapis.com`, a pre-existing sandbox limitation unrelated to this change; it was worked around locally with a temporary font stub that was fully reverted before the commit — confirmed via `git diff --stat` showing zero diff on `src/app/layout.tsx` at commit time.)

---

## 5. Changed-file list

```
package.json                                          (+1 script: validate:ui:row8)
scripts/validate-rfp-builder-match-disclosure.ts       (B8 rewritten, Part C added; +152 net lines)
src/app/api/rfp/[id]/connect/route.ts                  (publish-state gate on POST)
src/app/api/rfp/[id]/route.ts                          (publish-state gate on share-token GET)
src/components/RfpBuilder.tsx                          (canonical hasPublished(), full panel gating; ~130+ lines)
scripts/reproduce-row8-disclosure.mjs                  (new — evidence-gathering harness, not a pass/fail fixture)
scripts/validate-row8-vendor-disclosure-ui.mjs         (new — real-browser fixture)
```

No other file was touched. `reports/` (evidence JSON, screenshots) is untracked, matching this repo's existing convention of not committing scratch/report output.

---

## 6. What this checkpoint does not cover

Flagged explicitly rather than silently left out, per the instruction to record residual findings honestly:

- **`supplier-capability-access.ts`** — a separate, deliberately-designed "hybrid model" / "lazy issuance" subsystem gating NDA, thread, evidence-draft and respond routes via per-vendor bearer credentials or claimed sessions — has the same missing-`hasPublished`-check pattern found at the three paths above. It was not touched here: Robert's eight-step instruction most naturally targets the main project-read route as the one to gate directly; this subsystem is complex enough that a hasty change risks regressing its own vendor-principal resolution logic; and since invitations can no longer be created pre-publish after this fix, the practical exploit surface for these sibling routes is now much narrower — an invitation-derived `svtok` bearer credential cannot exist for a project that has never been published. This is a residual finding for a future, separately scoped pass, not a claim that these routes are already safe by construction.
- Stage B (the versioned canonical procurement envelope, snapshot/hash persistence, and explicit-recompilation semantics) has **not been started**. Per Robert's explicit sequencing decision, only the row-8 boundary defect was addressed in this checkpoint.

---

## 7. Explicit confirmation

Nothing in this checkpoint has been pushed to any remote, merged into `main`, or deployed. `main` remains at `f14a956a`, untouched. All work lives on the local branch `fix/row8-pre-publish-supplier-disclosure` (commit `60c70e5`) and in the bundle `/tmp/row8-hotfix.bundle`, delivered for your review. To bring it into `main`, apply the bundle (`git bundle verify` then `git fetch <bundle> fix/row8-pre-publish-supplier-disclosure:fix/row8-pre-publish-supplier-disclosure`, or unpack it in an environment with push access) and merge it yourself once reviewed.
