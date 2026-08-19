# Living Procurement Canvas — Phase 2, Round 4 checkpoint

**Date:** 14 August 2026
**Branch:** `living-procurement-canvas-phase-1-2`
**Commit:** `bcd3bd0` (on top of `3988626`, the round-3 fix, on top of `8bd55f4`, on top of `4d75761`)

## What this round reconciles

Robert's independent technical audit of round 3 opened with: "Round 3 improves reload durability, but I would not sign it off yet. The original pre-publish disclosure remains closed; the remaining defects are post-publication correctness issues," and closed with: "The pre-publication leak fix remains sound. Round 3 correctly identifies the need for durable hydration, but its current implementation does not yet guarantee 'matched and invited vendors exactly as published.'"

Five findings, all post-publication correctness gaps in the round-3 fix itself — none reopen the pre-publish disclosure fix, which round 4 does not touch.

## The five findings and their fixes

### 1. Published projects stopped hydrating after entering QA or evaluation

**Finding:** `ProjectDesk.tsx` gated hydration on `proj.status === "published"`, and the report route gated on `project.status !== "published"`. But `STATUS_FOR_PHASE` in `project-machine.ts` maps every phase from `published` onward — including the four post-evaluation phases (`awarded`, `transacting`, `complete`, `closed`), which have no legacy status of their own — onto one of exactly three legacy statuses: `published`, `qa`, `evaluation`. A project that moved into QA or evaluation had unquestionably crossed the publication boundary, but both gates treated it as if it never published.

**Fix:** Added a single shared predicate, `hasPublished(status): boolean`, exported from `project-machine.ts`:

```ts
export const POST_PUBLISH_STATUSES: readonly RfpStatus[] = ["published", "qa", "evaluation"];
export function hasPublished(status: RfpStatus): boolean {
  return (POST_PUBLISH_STATUSES as readonly string[]).includes(status);
}
```

Both `ProjectDesk.tsx`'s resume effect and `report/route.ts`'s gate now call `hasPublished()` instead of testing narrow equality.

### 2. Legacy published projects without a snapshot were described as frozen when freshly recomputed

**Finding:** `snapshot?.market_report ?? buildMarketReport(project)` silently recomputes for a legacy record with no snapshot, but `ProjectDesk` still said "exactly as published" — a claim that can be false since vendor data, matching, and estimates may have changed since the original publication.

**Fix:** The report route now returns `frozen: snapshot !== null` alongside the (possibly recomputed) `market_report`. `ProjectDesk`'s `published` client state carries this through as `frozen: boolean`, and the "Your matches" copy is now conditional:

> `{N} matched out of {M} evaluated{frozen ? ", from this publish's own frozen match" : ", recomputed today — no frozen snapshot exists for this project from before publication tracking began"}.`

A legacy no-snapshot project is now honestly described as a fresh recompute, never as frozen.

### 3. Invited vendors could disappear from the resumed UI

**Finding:** Live evidence: invited = Cato Networks, Fortinet, AT&T Business; `matched.names` = Aryaka, AT&T, BT, Cato, Cisco, Cloudflare, Colt, Cradlepoint. Fortinet was invited but absent from `matched.names`. The UI iterated only `published.matched.names.map(...)` and checked invited-ness with `published.invited.find((v) => v.name === name)` — an invited vendor absent from the matched list never rendered at all, and the badge match itself was fragile (name equality, not identity).

**Fix:** The invited badge now matches by slug (`published.invited.some((iv) => iv.slug === v.slug)`), and a second, clearly labelled section renders any invited vendor **not** in the matched set — the "stable union" Robert suggested:

```tsx
const matchedSlugs = new Set(published.matchedVendors.map((v) => v.slug));
const invitedOnly = published.invited.filter((v) => !matchedSlugs.has(v.slug));
```

rendered under "Also invited (your own pinned vendor(s), not part of the ranked match):" — correctly accounting for buyer-pinned vendors, which can be invited without being part of Netify's own ranked shortlist.

### 4. "Matched" was not the publish shortlist

**Finding (the deeper cause of #3):** `executePublish()` selects invitations with `buildShortlist()`, frozen as `PublishedSnapshot.matched_vendor_ids`. But `market_report.matched` comes from a different, simpler function, `matchSuppliers()` — a broad market count capped at eight names. Round 3 hydrated `market_report.matched`, not `snapshot.matched_vendor_ids`, so "Your matches" did not necessarily represent the actual publish shortlist.

**Fix:** `PublishedSnapshot` gained `matched_vendors: {slug, name}[]` (round 4 addition, see finding 5), frozen at publish time from the same `buildShortlist()` call that already produced `matched_vendor_ids`/`invited_vendor_ids`. `PublishResult` now also carries `matched_vendors`, computed once in `executePublish()` and threaded through:

- the publish route's own immediate response (`publish/route.ts`) — fixing the bug for a live publish's own view, not only a later resume, since the live route never returned shortlist data at all before this round;
- the idempotent-replay path (`replayResultFrom()` in `rfp-publish.ts`), which independently constructs a `PublishResult`-shaped object and needed the same field, falling back to resolving `matched_vendor_ids` via `vendorBySlug()` when replaying a pre-round-4 snapshot;
- the report route, which now returns `matched_vendor_ids`/`matched_vendors` directly from the snapshot, never derived from `market_report.matched`.

`market_report.matched` is now read only for its aggregate `total_evaluated_market` figure (which names no vendor and cannot silently drop one) — never as the source of the matched-vendor set.

### 5. Invited display names were not actually frozen

**Finding:** Resume resolved invited slugs against the current `/api/workspace/market` directory on every read. If a supplier was renamed or removed, the displayed result would differ from what was actually published; missing entries degraded to raw slugs. That is acceptable only if labelled as current directory data — incompatible with "exactly as published."

**Fix:** `PublishedSnapshot` gained two new **optional** fields, added at the end of the existing id-list fields so older snapshots stay valid:

```ts
matched_vendors?: { slug: string; name: string }[];
invited_vendors?: { slug: string; name: string; supplier_url: string }[];
```

frozen at publish time from the same `buildShortlist()`/invite-selection call. `ProjectDesk`'s resume hydration derives `namesFrozen = Boolean(reportBody.matched_vendors && reportBody.invited_vendors)`: when true (a live publish, or a snapshot written after this schema addition), names render exactly as frozen. When false (an older snapshot, or a legacy no-snapshot record with only `project.invited_vendors` slugs), names are resolved from the live `/api/workspace/market` directory as a fallback, and the UI now says so:

> "Vendor names below are resolved from the current marketplace directory, not frozen at the moment of publication."

— rendered only when `frozen && !namesFrozen`, so a legacy no-snapshot project (already labelled "recomputed today" per finding 2) doesn't also carry this redundant caveat.

## Three real provenance states, not a binary flag

The combination of `frozen`/`namesFrozen` produces exactly the fidelity gradient Robert's findings 2 and 5 describe, worded honestly at every point:

| State | `frozen` | `namesFrozen` | Copy |
|---|---|---|---|
| Live publish, or a resumed project with a round-4-schema snapshot | `true` | `true` | "from this publish's own frozen match" |
| Resumed project with an older snapshot (real ids, no frozen names) | `true` | `false` | "from this publish's own frozen match" + the live-directory caveat |
| Legacy published project with no snapshot at all | `false` | `false` | "recomputed today — no frozen snapshot exists..." |

## Regression fixtures

**`scripts/validate-published-resume-hydration.ts`** — fully rewritten for round 4 (Part A unchanged from round 3; Part A2 and most of Part B are new):

- **Part A** (unchanged, 9 assertions): the pre-existing route-level data-contract checks for a fresh draft.
- **Part A2** (new, 31 assertions): direct unit coverage of `hasPublished()` for all five `RfpStatus` values; a route-level test seeding a project with `status: "qa"` directly into the fake KV via `store.command(["SET", key, JSON.stringify(value)])` — the exact format `setJson()` itself uses, bypassing only `saveProject()`'s write-side invariants (which don't run on read) — and confirming the report route now serves the full published projection with `frozen: false` and null id/name fields, closing Robert's explicitly-named test gap ("The new fixture does not exercise a published project without a snapshot"); the same for `status: "evaluation"`; and a scenario seeding a real `PublishedSnapshot` whose `matched_vendor_ids`/`matched_vendors` deliberately include a vendor absent from `market_report.matched.names`, proving the report route serves the real shortlist and not the market-report proxy.
- **Part B** (rewritten, 66 assertions total across Parts B1–B8): the round-3 structural checks (B1, B3–B5) updated where the underlying code changed; B2 rewritten to check for `hasPublished(proj.status as RfpStatus)` and confirm the old narrow equality check is fully gone; new B3b checks that the hydration block reads `frozen`/`namesFrozen`/`matched_vendor_ids`/`invited_vendor_ids` and never sources the matched set from `market_report.matched.names`; new B6 checks the `published` state's type declaration for the new fields and confirms the old `matched: {count, names, ...}` shape is gone; new B7 checks the render block's slug-based invited matching and the stable-union "also invited" block; new B8 checks the frozen/namesFrozen-conditional copy.

**Non-vacuity, verified by hand** (each sabotaged, run, confirmed to fail, then restored and re-confirmed passing):

| Sabotage | Assertions that failed |
|---|---|
| Report route gate reverted to `status !== "published"` | Hard script error (`market_report` undefined) — the entire A2 scenario set depends on it |
| ProjectDesk resume gate reverted to `status === "published"` | Both B2 assertions |
| Invited badge reverted to name-equality | B7's slug-match assertion |
| `invitedOnly` union removed | B7's stable-union assertion |
| Frozen/namesFrozen copy reverted to unconditional "exactly as published" | Both B8 assertions |
| `namesFrozen` hardcoded to `true` | B3b's `namesFrozen` derivation assertion |
| Report route's `matched_vendor_ids`/`matched_vendors` forced to `null` | Both of A2's finding-3/4 divergence assertions |

**Result: 66/66 assertions pass.** The pre-existing pre-publish-disclosure fixture (`validate-pre-publish-vendor-disclosure.ts`) is unaffected: **82/82**, unchanged from round 3.

## Verification chain

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean (exit 0) |
| `npx eslint` on every touched file | Same 4 pre-existing, unrelated `react-hooks/set-state-in-effect` errors at their existing line numbers; **zero new issues** — `reports/phase2-round4-lint-output-14aug.txt` |
| `npm run validate` (full chain, all `validate-*.ts`/`verify-*.ts` scripts) | **ALL PASS** — `reports/phase2-round4-full-validate-output-14aug.txt` |
| `npm run build` (production build) | Succeeds, via the established sandbox-only `next/font/google` workaround to `layout.tsx`, reverted immediately with a confirmed zero `git diff` — `reports/phase2-round4-build-output-14aug.txt` |

## Files changed this round

```
scripts/validate-published-resume-hydration.ts     | 338 ++++++++++++++++---
src/app/api/rfp/[id]/publish/route.ts               |  10 +-
src/app/api/rfp/[id]/report/route.ts                |  58 ++++-
src/components/ProjectDesk.tsx                      | 239 +++++++++----
src/lib/project-machine.ts                          |  22 ++
src/lib/published-snapshot.ts                       |  17 ++
src/lib/rfp-publish.ts                               |  26 +-
7 files changed, 609 insertions(+), 101 deletions(-)
```

## Scope

Narrowly scoped to Robert's five named post-publication findings and their direct dependents, exactly as instructed. Deliberately did **not** touch: the pre-publish disclosure fix itself (round 2, unaffected); other pre-existing `status === "published"` equality checks found via a broader grep (`RfpBuilder.tsx`, `mcp-rfp-tools.ts`, `RfpResponder.tsx`, `MegaNav.tsx`, `api/rfp/[id]/route.ts:173`) — these share the same bug pattern but are outside the files Robert named and outside "narrowly scoped Round 4"; and the `LivingProcurementDocument` production integration, explicitly excluded again by Robert's own closing instruction.

## Stopping point

Checkpoint for review, consistent with every prior round. No push, merge, or deploy performed. The bundle `living-procurement-canvas-phase2-round4-bcd3bd0.bundle` contains the complete history (`c08cc53` → `0e3e7ac` → `4d75761` → `8bd55f4` → `3988626` → `bcd3bd0`), verified with `git bundle verify`.
