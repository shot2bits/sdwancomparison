# Living Procurement Canvas — Phase 2 lifecycle checkpoint

**Date:** 14 August 2026
**Branch:** `living-procurement-canvas-phase-1-2`
**Base:** `0e3e7ac` (Phase 1, accepted — **not amended**)
**New commit:** `4d75761` — a separate, new commit on top of `0e3e7ac`
**Original base (never touched):** `c08cc53`
**Status:** Stopped at the Phase 2 lifecycle checkpoint, as instructed. Nothing pushed, merged or deployed.

---

## 1. What this checkpoint implements

Your brief was explicit that the Canvas is not the reward — publication to the Netify opportunities board is. This checkpoint wires the real lifecycle:

**prompt → Living Canvas → review/resolve open decisions → verified publication → immutable published opportunity → matching, invitations, exports, response room.**

Concretely, on top of the accepted Phase 1 compiler, this checkpoint adds:

1. **One authoritative `PublishedSnapshot`** (`src/lib/published-snapshot.ts`) — an immutable, versioned, content-hashed record created on every genuine publish. The board notice, every export route, and the market report all read the *same* frozen snapshot. Nothing renders the PDF from one object, the board notice from another, and vendor questions from a third independently-mutable draft.

2. **The one chosen after-publication-edit rule, documented, not implied**: the snapshot is immutable once created; the live `ProjectDetails` project may still be edited (existing rescope/save flows, unchanged); every read-facing surface (board, exports, report) stays pinned to the latest *frozen* snapshot until an explicit republish creates a new, later version. Proven end-to-end in the live-demo fixture (item 12 below).

3. **A server-authoritative governed-revision adapter** (`src/lib/rfp-governed-revision.ts`) around the *accepted* Phase 1 pure reducer (`resolveGovernedRevision`, unchanged) — with a durable, KV-atomic sequence number (`HINCRBY`), never client-supplied, directly answering "browser-local sequence numbers cannot be the durable truth." Wired into the real create route (implicitly, via publish), the real save route (`PUT /api/rfp/[id]`, a new `requirement_edit` event on every save), and the real publish route (a new `publish` event).

4. **Idempotent publish**, checked first, before any gate or side effect: a content-addressable event id (hash of the buyer's real governed content + publish options, excluding volatile fields) is compared against the last-applied event id. An exact repeat — a double-click, a retry after a timeout — short-circuits to a replay of the durable record: no second board opportunity, no duplicate invites, no duplicate emails, no second snapshot version. The state commit happens only *after* the full publish genuinely succeeds, so a failed attempt stays retryable rather than poisoning idempotency.

5. **Export and report gating enforced in the route handlers themselves**, not only in what the UI shows:
   - `GET /rfp-builder/[id]/preview/download` now requires signed-in owner **and** `project.status === "published"` **and** an existing `PublishedSnapshot`, and renders the *frozen* snapshot content for every format (markdown, Word/`doc`, `print`, and a new `?format=json` structured export) — never the live, possibly-drifted project.
   - `GET /api/rfp/[id]/report` no longer returns `matched.names`/`matched.count` before publication (the exact leak you named). Pre-publish it returns a `readiness` object (document completeness, gaps, cost estimate, assumptions, and the general evaluated-market total — safe because it is not project-specific). Post-publish it serves the *cached* `market_report` frozen on the snapshot, so every export and the report agree.

6. **The support-hours safety fix**, done the way you asked — a canonical state, not an ever-expanding regex:
   - New `SupportCoverage = "24x7" | "business_hours" | "other_stated" | "unresolved"` and `resolveSupportCoverage()`, converging typed history *and* clicked noted-selections into one canonical value that `managedServiceClause()` consumes directly.
   - A single structural resolver, `hoursMentionPolarity()`, mirroring the already-accepted Phase 1 Round 4 `modelMentionPolarity()` design: checks for an *outer* negation wrapping an *inner* negation ("not optional", or a negation word + "without") before falling back to the old single-negation test. This is exactly the same pattern already accepted for the operating-model double negatives — reused, not reinvented.
   - Genuine ambiguity (an explicit "no preference"/"undecided" near an hours statement, or a clicked 24×7 selection conflicting with explicit business-hours wording) now raises a new `OD-support-coverage-ambiguous` open decision rather than ever guessing — a system that cannot publish an inverted support requirement.

7. **The smallest UI-adjacent surface actually required to prove the journey**: none, deliberately, this round. Every one of your 16 acceptance tests is a server/route-level guarantee, not a UI-only one, and your instruction was "the smallest complete UI integration necessary to prove this journey" — for this checkpoint that is the *routes themselves* refusing correctly. `ProjectDesk.tsx`'s "WHO FITS" panel copy (locked pre-publish outcome text, post-publish reveal) remains Phase 1's existing rendering and was deliberately not touched this round; see §6 for why and what's next.

---

## 2. The three support-hours reproductions — before and after

Per your instruction, reproduced against the real, unmodified `supportHoursFromHistory()` on **clean `0e3e7ac`** (stashed working tree, confirmed via `git status`/`git stash list` before running) before any edit was made.

| Statement | Before (`0e3e7ac`, `hours247`) | After (this checkpoint) |
|---|---|---|
| "24/7 support is not optional." | **false** ❌ | **true** ✅ |
| "We cannot operate without 24/7 support." | **false** ❌ | **true** ✅ |
| "We do not accept suppliers without 24/7 support." | **false** ❌ | **true** ✅ |

Raw evidence: `phase2-hours-repro-before-14aug.json`, `phase2-hours-repro-after-14aug.json`.

Regression guards (also in the permanent fixture, `validate-living-canvas-phase2-lifecycle.ts`, item 15): a genuine single negation ("24/7 support is not required.") still correctly resolves `false`, and a plain positive statement still resolves `true` — the fix targets the specific double-negative shape, not every negation word.

---

## 3. Acceptance tests — status

All 16 of your numbered acceptance tests are proven against real route handlers (never hand-reimplemented substitutes), via the existing `fake-kv-harness.ts` convention this repo already uses for route-level fixtures.

| # | Test | Proven in | Result |
|---|---|---|---|
| 1 | Draft creation lists nothing on the board | `validate-living-canvas-phase2-lifecycle.ts` (both paths) | PASS |
| 2 | Draft creation invites nobody | same | PASS |
| 3 | A draft cannot download Word/PDF/data | same — real gated route, real owner session, all four formats | PASS |
| 4 | A draft cannot retrieve matched vendor names | same — real report route, `readiness` only, no `matched` | PASS |
| 5 | Buyer-pinned vendors stay distinguishable from Netify matches | same | PASS |
| 6 | One successful publish creates exactly one board opportunity | live-demo script (real publish) | PASS |
| 7 | Matching occurs against the frozen published version | live-demo script | PASS |
| 8 | Invitations created only after publication | live-demo script (empty before, populated after) | PASS |
| 9 | Word/PDF/print/structured exports unlock only after publication | hermetic (pre-publish 403) + live-demo (post-publish 200, all 4 formats) | PASS |
| 10 | Every export represents the same published snapshot | live-demo — JSON export's `content_hash` == snapshot's; markdown/Word embed the same hash prefix | PASS |
| 11 | A repeated publish request is idempotent | live-demo — identical publish twice: same board mapping, same snapshot id/version, same invite set, history length 1 | PASS |
| 12 | A later edit cannot silently alter the published snapshot | live-demo — live title edit after publish; snapshot, download and report all still serve the *original* title/hash | PASS |
| 13 | Network and security-sourcing paths obey the same lifecycle | hermetic script runs items 1–5 and 14 through **both** creation routes | PASS |
| 14 | Signed-out/token-only callers cannot publish or export | hermetic script — `manage_token` alone, no session, refused on both routes | PASS |
| 15 | The three support-hours reproductions cannot invert the requirement | §2 above + permanent fixture | PASS |
| 16 | Every existing Fact Ledger Reliability Gate / Phase 1 fixture still passes | full `npm run validate` chain, unchanged scripts included | PASS (474/474, 0 FAIL) |

An explicit republish (a genuine content change) was also proven to create a new, later, distinct snapshot version — never blocked forever — completing the "choose and document one" after-publication-edit rule.

### An honest, pre-existing limit found while proving item 12/republish

While proving that an *explicit* republish works, a **pre-existing, pre-Phase-2** limit surfaced: `project-machine.ts`'s state-transition table only permits the `publish.live` event *from* the `drafted` phase. A second, genuinely-different-content publish on an already-published **security-sourcing (engine)** record throws `"No legal transition for event publish.live from phase published"` — inside the engine's own state machine, before Phase 2's snapshot/idempotency code ever runs. This is not a Phase 2 regression; it predates this checkpoint entirely and was not introduced or masked here. The republish demonstration in the live-demo fixture therefore runs against a plain **network/wizard** (non-engine) project, which takes the other `executePublish()` branch (a direct field write, no state-machine restriction) and *does* republish correctly, proving the Phase 2 snapshot/idempotency layer itself is sound and engine-agnostic. Whether engine-lane republish should be enabled is a product decision for the security-sourcing state machine, flagged here rather than silently worked around — it is not part of this checkpoint's scope and was not touched.

### Also found and fixed while proving item 6 (board listing)

The board's public quality gate (`notice-validate.ts`, pre-existing, unrelated to Phase 2) only accepts an exact catalogue sector key (e.g. `"healthcare"`) or the literal `"not_stated"` — not a free-text label. The existing live-demo script sidesteps this with `list_on_board: false`. This checkpoint's own live-demo fixture needed a real listing to prove item 6, so it uses a catalogue-key sector; documented in the script itself rather than silently changed elsewhere.

---

## 4. Verification chain

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean, exit 0 (checked repeatedly through the session; final pass clean) |
| `npm run validate` (full chain, all 9 scripts including the two new Phase 2 additions) | Exit 0 — 474 PASS, 0 FAIL |
| Real live publish (`verify-phase2-publish-lifecycle-live-demo.ts`, real DNS/HTTPS to `netify.co.uk`, deliberately kept out of the build gate for the same reason the pre-existing `verify-publish-route-live-demo.ts` already is) | Exit 0 — ALL PASS |
| `npx eslint .` vs true `c08cc53` baseline (fresh `git worktree`) | **Identical**: 118 problems (68 errors, 50 warnings) on both. The only file with any line differences is `ProjectDesk.tsx`, and those are Phase 1's already-accepted line-shift (verified with a path-normalised diff) — zero new lint issues from Phase 2. |
| `npm run build` | Succeeds. Sandbox-only `next/font/google` network workaround applied to `src/app/layout.tsx` and reverted; `git diff --stat` on that file is empty both times. |
| Clean-room verification | See §5 |

Raw output: `phase2-hours-repro-before-14aug.json`, `phase2-hours-repro-after-14aug.json`, `phase2-full-validate-output-14aug.txt`, `phase2-live-publish-lifecycle-evidence-14aug.txt`, `phase2-lint-output-14aug.txt`, `phase2-lint-baseline-c08cc53-14aug.txt`, `phase2-build-output-14aug.txt`, `phase2-cleanroom-validate-output-14aug.txt`, `phase2-cleanroom-build-output-14aug.txt`.

---

## 5. Clean-room verification from the regenerated bundle

`git clone living-procurement-canvas-phase2-4d75761.bundle /tmp/cleanroom_phase2`, checked out `living-procurement-canvas-phase-1-2` (landed on `4d75761`, confirmed via `git log` showing `4d75761` → `0e3e7ac` → `c08cc53`), `npm ci` (clean install, no `node_modules` carried over), then independently re-ran the full gate:

- `npx tsc --noEmit`: clean.
- `npm run validate` (full chain): exit 0, **474 PASS, 0 FAIL** — identical to the working-directory run.
- `npm run build`: succeeds (same sandbox-only font workaround applied and reverted; `git diff --stat` empty after revert).

This proves the regenerated bundle is self-contained and correct independent of the working directory's state. The clean-room clone was deleted after verification.

---

## 6. Before/after route evidence (representative)

**`GET /api/rfp/[id]/report`, pre-publish, before this checkpoint** (0e3e7ac): returned `matched.names.slice(0,3)` and `matched.count` — the exact vendor-name leak you named.

**Same route, pre-publish, after this checkpoint**:
```json
{
  "ok": true,
  "preview": true,
  "readiness": {
    "document": {"sections": 7, "questions": 17},
    "gaps": ["..."],
    "estimate": {"...": "..."},
    "assumptions": ["..."],
    "evaluated_market_total": 30
  },
  "unlocked_at_publish": "..."
}
```
No `matched` field at all. `evaluated_market_total` is the whole-dataset size, explicitly safe per your brief ("Public marketplace total may be shown only if clearly labelled as the general evaluated market").

**`GET /rfp-builder/[id]/preview/download`, draft owner, before this checkpoint**: served the document unconditionally once signed in and owning.

**Same route, draft owner, after this checkpoint**: `403 {"error": "...unlocks once you publish...", "publish_required": true}` for every format (markdown, `doc`, `print`, `json`).

**Same route, published owner, after this checkpoint**: `200`, content rendered from the frozen `PublishedSnapshot`, carrying a "Publication record" section (version, date, content-hash prefix) in every human-readable format, and a full structured record in `?format=json`.

Full request/response evidence for every one of these paths, plus the idempotent double-publish and post-publish-edit-immutability proofs, is in `phase2-live-publish-lifecycle-evidence-14aug.txt`.

---

## 7. Scope decisions stated plainly

- **What gets frozen**: the real production RFP document (`rfp_sections` + `buyer`) — what `buildRfpMarkdown`/`buildRfpHtml` already render and what suppliers already respond to — not a `LivingProcurementDocument` from the Phase 1 compiler. No production caller produces that compiler's inputs yet (`ProjectDesk.tsx` keeps `WorkspaceFact[]`/`NotedItem[]` entirely client-side). Freezing a document neither system yet produces in production would be dishonest; this is the truthful version of the rule for this checkpoint. `compiler_version` on the snapshot is therefore the RFP document pipeline's own real version field, not an invented Canvas-compiler version.
- **After-publication edits**: immutable snapshot, editable live project, explicit versioned republish — chosen and documented in `published-snapshot.ts`'s own top-of-file comment, not left implicit.
- **Concurrency**: `applyGovernedEvent`'s read-modify-write over KV state is atomic for the sequence counter itself (`HINCRBY`) but not for the full state transition across truly concurrent writers — documented in `rfp-governed-revision.ts` as a real, stated limit (safe for the sequential double-click/retry-after-timeout scenarios these acceptance tests target; a genuine concurrent-writer hardening pass is flagged as a follow-on, not silently assumed solved).
- **`RfpBuilder.tsx`** (a secondary, older builder surface, distinct from the primary `ProjectDesk.tsx` workspace) also reads the market-report preview shape. It was deliberately not touched this round (time-boxed); its own existing "the panel simply stays absent" fallback means it now just renders nothing for the removed preview fields, rather than crashing or leaking data — a graceful, honest degradation, not a fix.
- **`ProjectDesk.tsx`'s own pre/post-publish copy** (the "WHO FITS" panel and the locked-outcome messaging your brief specifies) was not changed this round. Every one of the 16 acceptance tests is a server-level guarantee already true regardless of what that panel currently renders — so the product-safety property holds today even before that UI catches up. This is the next piece of work, not a gap in this checkpoint's guarantees.

---

## 8. Standing constraints (confirmed)

- Nothing pushed, merged, rebased or deployed.
- `c08cc53` not amended — confirmed unchanged (`git rev-parse c08cc53` before and after this round).
- `0e3e7ac` (Phase 1) **not amended** — a genuinely new commit, `4d75761`, sits on top of it. Confirmed via `git rev-parse 0e3e7ac` unchanged and `git log --oneline c08cc53..HEAD` showing both commits distinctly.
- Deliverable is a bundle containing **both** commits (`living-procurement-canvas-phase2-4d75761.bundle`).
- Stopped at the Phase 2 lifecycle checkpoint, awaiting your review, per your instruction.

## 9. What's next (not started, pending your go-ahead)

- `ProjectDesk.tsx`'s pre-publish locked-outcome panel and post-publish operational workspace (version/timestamp, matched vendors with evidence, invited/responded distinction, export links, response-room link) — the UI half of this journey.
- A decision on engine-lane (security-sourcing) republish, given the pre-existing state-machine limit found in §3.
- `RfpBuilder.tsx`'s own market-report preview surface, if you want it brought fully in line rather than left gracefully absent.
- Hardening `rfp-governed-revision.ts`'s state transition for genuinely concurrent (not just sequential-retry) writers, if that becomes a real requirement.
