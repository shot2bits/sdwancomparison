# Living Procurement Canvas — Phase 2, RFP Builder disclosure hotfix checkpoint

**Date:** 14 August 2026
**Branch:** `living-procurement-canvas-phase-2-hotfix-rfpbuilder-disclosure` (based on `origin/main` at `ed1ff32`, the deployed round-4 merge)
**Not yet pushed, merged or deployed** — this specific change was not part of the push/merge/deploy authorisation Robert gave for round 4; it is a new finding from smoke testing and stops here for review, per his own instruction ("implement and verify this hotfix at one final checkpoint").

## Part 1: the four production smoke checks

Run against live production (`netify.co.uk`), driven by real browser automation, using a genuinely live (non-test-flagged) publish Robert explicitly authorised ("We have no supply side yet so it's fine") after I flagged that `?test=1` did not actually persist to the saved record.

| # | Check | Result |
|---|---|---|
| 1 | Draft reveals no project-specific vendors | **Confirmed**, via two independent paths: the ProjectDesk chat flow's locked-outcome panel (no `rankedFits`, no vendor rows, no count), and the Project Overview pre-publish view. |
| 2 | Publish reveals matched and invited vendors | **Confirmed** via direct inspection of the live `/publish` response JSON: `matched_vendors` and `invited` are populated from the real `buildShortlist()` selection (8 vendors, including "NTT DATA / NTT Ltd." and "Verizon Business"), correctly diverging from the separate, simpler `market_report.matched.names` figure — the same divergence round 4's own fixtures prove structurally. |
| 3 | Reload preserves them | **Confirmed**, but not through `ProjectDesk`'s own resume UI — the test project ended up as a plain network/wizard-engine record, not `security_sourcing`, so ProjectDesk's resume gate correctly declined to reopen it there ("This project isn't a Security Sourcing engagement yet"). Verified instead via a hard reload of the Project Overview page (persisted "Published. 8 vendors invited.") and a direct `/api/rfp/[id]/report` fetch (`frozen: true`, matching `matched_vendors`/`invited_vendors`). |
| 4 | QA/evaluation still preserves them | **Not independently demonstrated live** — this requires a real third-party vendor to submit a response first, which I do not control and was not going to fabricate given the "do not broaden the investigation" instruction. Coverage instead rests on round 4's own automated fixture (`validate-published-resume-hydration.ts` Part A2, 31/31 passing), which seeds qa/evaluation statuses directly at the route level and proves the same persistence logic. |

During check 1–2, I found the RFP Builder disclosure this hotfix addresses (below) — a different, older code path (`RfpBuilder.tsx`) from the one all of rounds 1–4 fixed (`ProjectDesk.tsx`).

## Part 2: the hotfix

### The finding

`RfpBuilder.tsx` — reached from the Project Overview page's own "Review and edit" link (`src/app/project/[id]/page.tsx:286`, `/rfp-builder/[id]`) — disclosed real, project-specific matched vendor names and a narrowed match count **before publication**, live on production: *"Aryaka, AT&T Business, BT Business / BT Global and 18 more fit what you described."*

Root cause: `GET /api/rfp/match` has no project id or status parameter at all — it cannot distinguish a pre-publish caller from a post-publish one — yet it spread `matchSuppliers()`'s full result (`count`, `names`, `slugs`, all narrowed by scope/region/model) directly into its public, unauthenticated JSON response. `RfpBuilder.tsx` fetched it with no publish-status gate and rendered the names and count as-is. This is the exact disclosure class the whole Phase 2 engagement exists to close (`validate-pre-publish-vendor-disclosure.ts`), reached through a code path none of rounds 1–4 touched — flagged as a known, deliberately out-of-scope gap in an earlier round, now fixed at Robert's explicit instruction.

### The fix

**`src/app/api/rfp/match/route.ts`** — the API boundary. Now returns only `{ ok: true, total, methodology }`: the whole evaluated-market size (filter-independent, per `supplier-match.ts`) and the methodology label. `count`, `names` and `slugs` — all narrowed by the caller's scope/region/model — are dropped at the route, not left to each caller's discretion. This makes the leak structurally impossible for *any* consumer of this endpoint, not just the one Robert named.

**`src/components/RfpBuilder.tsx`** — the UI boundary:
- `matchInfo`'s own type narrowed to `{ total: number } | null` — a code path that tried `matchInfo.names`/`.count` today fails to *compile*.
- The fetch effect type-guards on `d.total`, not `d.count`.
- Every pre-publish render site that quoted `matchInfo.count`/`.names` ("Submit to your N matched vendors", the no-fallback names-list block, the sticky bar, the walkthrough strip) now reads generic, vendor-agnostic copy. The one aggregate-safe use (`matchInfo.total`, "the marketplace's N verified vendors") is unchanged.
- The Market Report panel's pre/post-publish gate used the narrow `project.status !== "published"` / `=== "published"` equality — the same Round-4-finding-1 bug pattern already fixed elsewhere in this codebase. Not itself an active leak (the upstream `/report` route already gates correctly), but it mislabelled a qa/evaluation-status project as still "previewing," which is the same "post-publication vendor results" surface Robert's instruction names. Now uses the shared `hasPublished()` predicate.

**Post-publication vendor results**, verified already sourced correctly and left untouched: the "Vendors and service providers" panel reads the owner-gated `/api/rfp/[id]/connect` route; the publish confirmation message quotes `data.invited` from the publish response itself; the Market Report panel reads the owner-gated, snapshot-backed `/api/rfp/[id]/report`. None of RfpBuilder.tsx's post-publish rendering was ever sourced from `/api/rfp/match` — the leak was purely pre-publish.

**`DescribeWizard.tsx`** — a second, independent consumer of the same endpoint (a pre-project onboarding panel, not named by Robert) — left untouched. Verified it degrades safely: its own `typeof d.count === "number"` guard now never fires (the field no longer exists), so its `match` state stays `null` permanently and every render site falls through to its already-existing generic fallback copy. No crash, no leak, no code change needed — consistent with "do not start another general audit."

### Regression fixture

**`scripts/validate-rfp-builder-match-disclosure.ts`** (new, wired into `npm run validate`), covering the normal Project Overview → Review and edit route as instructed:

- **Part A** (route-level, the real `GET /api/rfp/match` handler): non-vacuous by calling `matchSuppliers()` directly first and confirming it *does* carry narrowed `count`/`names`/`slugs` for four realistic scenarios; then asserts the route's JSON has none of those three keys, no vendor name string anywhere in the serialized body, and still carries the aggregate-safe `total`/`methodology`.
- **Part B** (structural, same TOOLING LIMITATION convention as `validate-pre-publish-vendor-disclosure.ts`'s own Part B — `RfpBuilder.tsx` is stateful/hook-heavy, no jsdom in this repo): confirms the Project Overview page's "Review and edit" link genuinely routes here; `matchInfo`'s type carries no `count`/`names`; no live code references `matchInfo.count`/`.names`; the fetch effect guards on `total`, not `count`; the specific leaked copy fragments are gone; the pre-publish heading/button/sticky-bar all read generic copy; both Market Report gates use `hasPublished()`; the vendors panel and publish message are sourced from the owner-gated `/connect` route and the publish response's own `data.invited`, never `/api/rfp/match`.
- **Verified non-vacuous by hand**: every one of the 31 new assertions was confirmed to fail (`git stash` of the two source files, re-run, `git stash pop`) against the pre-fix code before being confirmed green against the real fix — 37/68 passed against the reverted source, 31 genuine failures, all in the newly-added checks; 68/68 against the fix.

Result: **68/68 assertions pass** (44 in Part A, 68 cumulative through Part B).

## Verification chain

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean (exit 0) |
| `npx eslint` on every touched file (`route.ts`, `RfpBuilder.tsx`, the new fixture script) | `RfpBuilder.tsx`: same 6 pre-existing `react-hooks/set-state-in-effect` errors and 12 warnings as every prior round's baseline (line numbers only shifted by the one added import line) — zero new issues. `route.ts` and the new fixture script: zero issues. — `reports/phase2-hotfix-lint-output-14aug.txt` |
| `npm run validate` (full suite, all prior rounds' scripts + the new one) | **474/474 pre-existing named assertions pass, 0 fail, exit 0** — every prior round's script still green, plus the new script's 68/68 — `reports/phase2-hotfix-full-validate-output-14aug.txt` |
| `npm run build` (production build) | Succeeds, via the established sandbox-only `next/font/google` workaround to `layout.tsx`, reverted immediately with a confirmed zero `git diff` |

## Files changed this round

```
package.json                                        |  2 +-
scripts/validate-rfp-builder-match-disclosure.ts     | new file (231 assertions across 4 API scenarios + structural checks)
src/app/api/rfp/match/route.ts                       | 26 ++++++++++++++++++++++----
src/components/RfpBuilder.tsx                        | 33 +++++++++++++++++----------------
```

## Scope

Exactly the confirmed RFP Builder disclosure and its direct dependents, per Robert's four bullet points: the API boundary, the pre-publish UI, the post-publication sourcing (verified already correct, no change needed), and the regression fixture. Did not touch `ProjectDesk.tsx`, `ConstellationScene.tsx`, or any of rounds 1–4's own work. Did not extend into `DescribeWizard.tsx`'s code (verified its own guard clause makes it degrade safely instead) or the other structurally-similar `status === "published"` call sites flagged in earlier rounds' greps (`mcp-rfp-tools.ts`, `RfpResponder.tsx`, `MegaNav.tsx`, `api/rfp/[id]/route.ts:173`) that Robert did not name and that are not part of this specific leak — deliberately left out, consistent with "keep the change limited to this leak; do not start another general audit."

## Stopping point

Checkpoint for review. No push, merge or deploy performed for this hotfix — it was surfaced mid-smoke-test as a new finding, not pre-authorised the way round 4's push/merge/deploy was. Awaiting your go-ahead to push and merge this branch the same way, or any further instruction.
