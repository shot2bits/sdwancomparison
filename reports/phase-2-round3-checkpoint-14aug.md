# Living Procurement Canvas — Phase 2, Round 3 checkpoint

**Date:** 14 August 2026
**Branch:** `living-procurement-canvas-phase-1-2`
**Commit:** `3988626` (on top of `8bd55f4`, the round-2 fix, on top of `4d75761`)

## What this round reconciles

An independent read-only inspection was run against baseline `4d75761ae2a5baaeff695883b324212ef4497ea8` — explicitly *not* treating the round-2 checkpoint or evidence as an instruction or as the source baseline. That audit reproduced, line-by-line, the same class of finding round 2 (`8bd55f4`) already fixed, plus one genuine gap round 2 missed. This report reconciles the audit's eight sections against the actual current source.

### Already resolved by round 2 (`8bd55f4`) — verified against current source

| Audit section | Current state |
|---|---|
| 1. "WHO FITS" rendering, "Show the N that fit" | Panel replaced with the locked outcome panel; no `rankedFits`, no per-vendor rows, no supplier links. `readyToFit` still gates CTA visibility but the CTA reads "See what publishing unlocks," not a count. |
| 2. `fittingCount`, `rankedFits`, `keptFits`, `fitSlugs`, `pins` folding in computed matches | `FitState` no longer carries `suppliers`/`directory`/`count`; `rankedFits`/`keptFits`/`fittingCount` don't exist in the file; `pins = [...new Set(added)].slice(0, 5)` — buyer input only. |
| 3. Fit API has no publication gate | Still true structurally (the route has no project id) — but the route now strips `suppliers`, `directory` **and** `count` unconditionally, so an ungated route returns nothing identifying regardless of caller. |
| 4. Server-side identity-bearing response (`workspaceFit()`, `matchSuppliers()`) | Unchanged by design — the `workspace_cycle` MCP tool needs the full shape server-side. The finding's own conclusion ("the identity leak exists at the API boundary even if the JSX were hidden") is exactly what the round-2 API fix addresses. |
| 5. Typed commands (`dropPartner`, `dropName`/`keepName`, `why`), the main "N of M still fit" count, URL-provided vendors into `pins` | All three command paths now refuse honestly. The "understanding band" no longer shows a match count (this was the one thing round 2 caught *while writing its own fixtures* — see the round-2 checkpoint). `pins` never folds in URL-seeded vendors' computed rank, only genuine buyer intent. |
| 7. Publish call and response use, post-publish shortlist not reading the frozen snapshot | `signAndPublish()` no longer sends `excluded_vendors`; `published` now carries `matched`/`invited` read directly from `data.market_report.matched`/`data.invited` — the same object the snapshot freezes. The "Your matches" panel reads `published.matched.names`/`published.invited`, never `keptFits` (retired). |
| 8. Existing locked-outcome convention (the report route) | The redesigned panel follows the same convention: readiness/gaps/estimate/whole-market total pre-publish, frozen match data only after. |

### Genuinely new — item 6, fixed this round

> "There is no stored `project.status`... The resume fetch... receives a project, but its local type omits `status`... It sets `created`, but never reconstructs `published`... The current component cannot reliably gate on durable publication state."

This was accurate and current — round 2 did not touch the resume path. A buyer reopening an **already-published** project through ProjectDesk's `?id=` resume flow saw the pre-publish locked outcome panel again, because `published` is local React state, set only by the live `signAndPublish()` response handler, and resets to `null` on every fresh page load.

This is **not an identity leak** — the fit API's redaction is unconditional and holds regardless of this gap, and it was never possible to reach vendor-identifying data through it — but it is a real durability failure in the requirement Robert's round-2 instruction itself named: "After publication, display the frozen matched and invited suppliers from the published snapshot." That only means something if it survives a reload.

## The fix

`src/components/ProjectDesk.tsx`'s resume effect:

1. The resume-fetch response type now also reads `status` and `invited_vendors` — both already present on the owner-gated `GET /api/rfp/[id]` response; nothing changed server-side, this type was simply narrower than the data the route already returns.
2. When `proj.status === "published"`, it fetches `GET /api/rfp/[id]/report` — the **same** owner-gated, frozen-snapshot route every export already reads (its own doc comment: "every reader of this route sees the SAME frozen market report the snapshot cached at publish time") — for `market_report.matched`.
3. It cross-references `invited_vendors` (slugs) against the public, non-project-specific `/api/workspace/market` vendor directory to resolve display names (the same directory the market-count band already reads; `invited_vendors` itself carries no name, only slugs).
4. It reconstructs `published` from those two frozen/general sources — never a fresh recompute, never `fit`/`rankedFits`.
5. It calls `setPhase("fits")` on success: the matches section lives inside the same `phase === "fits"` block as the locked panel, and `phase` defaults to `"live"`, so without this the rehydrated `published` state would sit correctly but never actually render.
6. The "reopened" confirmation message is gated on a local `rehydratedPublished` flag — the *actual* hydration outcome — never on `proj.status` alone, so a failed best-effort fetch (network hiccup, or a pre-Phase-2 record with no snapshot) can never falsely claim matches are showing.
7. Every step is best-effort: any failure leaves `published` at `null`, exactly today's (round-2) behaviour — resume itself is never blocked on this.

## Regression fixtures

**`scripts/validate-published-resume-hydration.ts`** (new, wired into `npm run validate`):

- *Part A* (route-level, real handlers): a fresh draft's owner `GET /api/rfp/[id]` response carries `status`/`invited_vendors` keys (the data contract this fix's client type depends on); a draft's `GET /api/rfp/[id]/report` carries no `market_report` key at all — proving the client's `status === "published"` guard is load-bearing, not redundant.
- *Part B* (structural, same TOOLING LIMITATION convention as round 2's own fixture — ProjectDesk.tsx is stateful/hook-heavy, no jsdom in this repo): the resume-fetch type carries `status?`/`invited_vendors?`; hydration is gated on `proj.status === "published"`; the hydration block fetches the report and market routes and never reads `fit`/`rankedFits`/`fitSlugs`; `setPhase("fits")` is called; the confirmation message is gated on the real outcome, not the raw status flag.
- **Verified non-vacuous by hand**: each of the four structural checks (the status guard, the phase switch, the message gate, `validate-pre-publish-vendor-disclosure.ts`'s updated `setPublished` call-count check) was confirmed to fail against a deliberately-reverted version of the fix before being confirmed green against the real one.
- Result: **30/30 assertions pass** (9 in Part A, 21 in Part B).

**`scripts/verify-round3-resume-after-publish-live-demo.ts`** (new, run by hand — same real-DNS/business-email-verification limitation as the existing `verify-phase2-publish-lifecycle-live-demo.ts`, documented rather than worked around): drives an **actual** publish against `netify.co.uk` (real business-email verification), then replicates the client's exact resume-hydration logic against the real routes, and asserts **byte-for-byte fidelity** between what the live publish response returned and what resume-hydration independently reconstructs — proving the resumed view cannot drift from the original publish. Also re-proves the non-vacuity of the status guard against a second, genuinely-unpublished draft. **Result: ALL PASS**, confirmed against real network — see `reports/phase2-round3-resume-after-publish-live-demo-evidence-14aug.txt`.

`validate-pre-publish-vendor-disclosure.ts`'s own Part B6 was updated: `setPublished(` is now legitimately called from **two** places (the live publish handler and resume hydration), and both are checked to read only frozen/general sources, never `fit`/`rankedFits`/`fitSlugs`.

## Verification chain

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean (exit 0) |
| `npx eslint` on every touched file | Same 4 pre-existing, unrelated `react-hooks/set-state-in-effect` errors as the round-2 and Phase-2 baselines; **zero new issues** — `reports/phase2-round3-lint-output-14aug.txt` |
| `npm run validate` | **474/474 pre-existing assertions pass, 0 fail** (unchanged) **+ 82 (round 2) + 21 (round 3, build-gated half) = 103 new assertions, all passing** — `reports/phase2-round3-full-validate-output-14aug.txt` |
| `verify-round3-resume-after-publish-live-demo.ts` (real network, not build-gated, same convention as the existing Phase 2 live-demo script) | ALL PASS — `reports/phase2-round3-resume-after-publish-live-demo-evidence-14aug.txt` |
| `npm run build` (production build) | Succeeds, via the established sandbox-only `next/font/google` workaround to `layout.tsx`, reverted immediately with a confirmed zero `git diff` |

## Files changed this round

```
package.json                                          |  2 +-
scripts/validate-pre-publish-vendor-disclosure.ts      | 21 +++---
src/components/ProjectDesk.tsx                         | 83 +++++++++++++
scripts/validate-published-resume-hydration.ts         | new file
scripts/verify-round3-resume-after-publish-live-demo.ts| new file
```

## Scope

Still exactly the pre-publish vendor disclosure fix and its direct dependents. This round did not touch matching, board projection, exports, or begin the `LivingProcurementDocument` production integration. The durable-hydration fix was scoped narrowly to what Robert's own round-2 instruction already required ("display the frozen matched and invited suppliers from the published snapshot") — making that requirement survive a page reload, nothing broader.

## Stopping point

Checkpoint for review, consistent with every prior round. No push, merge, or deploy performed. The bundle `sdwancomparison-living-procurement-canvas-phase2-round3-14aug.bundle` contains the complete history (`c08cc53` → `0e3e7ac` → `4d75761` → `8bd55f4` → `3988626`), verified with `git bundle verify`.
