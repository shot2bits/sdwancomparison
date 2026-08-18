# Living Procurement Canvas — Phase 2, Round 2 checkpoint

**Date:** 14 August 2026
**Branch:** `living-procurement-canvas-phase-1-2`
**Commit:** `8bd55f4` (on top of `4d75761`, the accepted Phase 2 bundle)
**Scope:** exactly Robert's scoped instruction below — nothing broader.

## What prompted this round

Robert's read-only audit of the `4d75761` bundle found one major product-rule conflict:

> "ProjectDesk exposes project-specific vendor names and rankings before publication, although the new report route correctly withholds them until publication."

His audit also recommended a much larger integration (`LivingProcurementDocument` as the single production document, consumed uniformly by matching, board projection, invitations, reports and exports). Given the scope difference between a small urgent fix and that architectural rebuild, Robert was asked to choose. His answer, quoted in full, is the authoritative scope for this round:

> "Fix only the pre-publish vendor disclosure in `ProjectDesk`. Before publication, do not expose project-specific vendor names, rankings, match counts, positions, evidence badges, invitation selections, or supplier links. Replace "WHO FITS" with a locked outcome/readiness panel showing only non-identifying information such as the total evaluated marketplace, document readiness, remaining decisions, and what publishing unlocks. Keep matching computation server-side if needed, but do not return identifying match data to the browser before publication. Enforce the boundary in the API as well as the JSX so it cannot be bypassed. After publication, display the frozen matched and invited suppliers from the published snapshot — not a freshly recalculated workspace fit. Add regression fixtures proving the API and UI cannot reveal supplier identities before publication. Do not begin the broader `LivingProcurementDocument` production integration in this change. Stop at a checkpoint for review."

Every constraint in that instruction is addressed below. The broader `LivingProcurementDocument` integration was **not started**.

## What changed

### 1. `src/app/api/workspace/fit/route.ts` — the API boundary

`GET /api/workspace/fit` has no project id and no publish-state concept: it scores the buyer's ad hoc in-progress draft, which within the Canvas journey means it is **always** a pre-publication call (there is no post-publish caller — the page reads the frozen publish response instead, see below). The route now strips three fields from every response, unconditionally, not toggled by any query parameter:

- `suppliers` — per-vendor names, slugs, positions, evidence, marketplace links
- `directory` — the full named vendor list
- `count` — **this project's own matched-vendor count**

That third one was a genuine gap in the first pass at this fix. Robert's instruction bans "match counts" as a distinct item, separate from vendor names — a number like "22 of 30 match" is identifying even with no name attached, because it reveals how well this specific project's requirement narrows the market. An earlier version of this round's fix stripped `suppliers`/`directory` but left `count` in the response, still reachable by any client hitting the route directly. This was caught while writing this round's own regression fixtures (see below) and fixed before this checkpoint.

`workspaceFit()` (the underlying library function) is **unchanged** — it still returns the full identifying shape, `count` included — because the `workspace_cycle` MCP tool calls it directly, server-side, for a distinct, out-of-scope surface (an agent-parity tool explicitly designed to mirror the page's own evidence). Only the HTTP boundary that reaches a buyer's browser is redacted.

**Before** (what the route used to return verbatim — `reports/phase2-round2-fit-response-before-14aug.json` is the underlying library call for reference):

```json
{
  "mode": "graded",
  "count": 22,
  "total": 30,
  "suppliers": [
    { "slug": "aryaka", "name": "Aryaka", "category": "...", "matched": [...], "marketplace_url": "https://netify.co.uk/marketplace/aryaka/" },
    { "slug": "att-business", "name": "AT&T Business", "...": "..." }
  ],
  "directory": [
    { "slug": "arista-velocloud", "name": "Arista / VeloCloud" },
    { "slug": "aryaka", "name": "Aryaka" }
  ]
}
```

**After** (the real route, same query params — `reports/phase2-round2-fit-response-after-14aug.json`):

```json
{
  "ok": true,
  "mode": "graded",
  "total": 30,
  "methodology": "Netify vendor dataset, live",
  "checks": [{ "id": "buying:sase", "label": "Full SASE platform" }]
}
```

`total` stays: it's `matchSuppliers()`'s own `all.length`, the whole evaluated market, never narrowed by this project's scope — exactly the "total evaluated marketplace" figure Robert's instruction says is safe pre-publish.

### 2. `src/components/ProjectDesk.tsx` — the JSX boundary

- **The `FitState` client type** no longer carries `suppliers`, `directory` or `count` — matching the API. Any code path that tried to read one of them now fails to *compile*, not just fails a fixture.
- **The "WHO FITS" ranked panel** (vendor list with names, categories, evidence badges, positions, keep/drop checkboxes, "why position N" expansions, marketplace/contact links) is replaced with a locked outcome panel showing only: the total evaluated marketplace size, document readiness percentage, and remaining open decisions — plus a description of what publishing unlocks. No per-vendor data anywhere in it.
- **A second leak, found while writing this round's fixtures:** the "understanding band" — a widget shown unconditionally in *every* phase, not just the retired ranked panel — displayed "`{fittingCount}` of `{marketTotal}` still fit," where `fittingCount` was `fit.count`: the same project-specific match count the API now redacts. This is exactly the kind of gap Robert's "cannot be bypassed" wording anticipates: fixing one visible panel while a sibling display keeps rendering the same class of data. Fixed alongside the main panel; the band now shows only the safe `marketTotal`.
- **`pins`** (the buyer-selected-vendor field persisted onto the draft) previously folded in `fitSlugs` — survivors of Netify's own computed ranking — alongside genuinely buyer-supplied `added` vendors (arrived via a `?vendors=` link). That contaminated the "buyer input" channel with Netify's own match data, directly matching Robert's "invitation selections" prohibition. `pins` now derives from `added` only.
- **Three conversational command paths** could leak vendor identity into the assistant's text/voice thread even with the visual panel hidden — a real bypass vector: `dropPartner` (used to drop ranked rows by evidence grade), the vendor-matching branch of `dropName`/`keepName`, and `why` (used to open a ranked row's evidence detail). All three now return an honest refusal ("part of what publishing unlocks") instead of silently degrading or leaking.
- **Post-publish rendering** ("Your matches") now reads `published.invited` / `published.matched` — populated, in `signAndPublish()`, directly from the publish route's own JSON response (`data.invited`, `data.market_report.matched`) — never a client-side recompute. This satisfies "display the frozen matched and invited suppliers from the published snapshot" without a new endpoint, since `market_report` is the same object the publish flow caches onto the project's frozen `PublishedSnapshot`.

### 3. `src/components/ConstellationScene.tsx` — the frozen-data companion fix

The Constellation was already correctly gated to post-publish only (`if (!published) return null` — R1b, "distance IS fit, so a ranked view is the half that generates at publish, not before"). But even in that gated state, its evidence-line visualization read a **live, still-recomputing** `fit.suppliers` rather than the frozen publish response — a subtler version of the same leak Robert's "not a freshly recalculated workspace fit" line addresses. `fitBySlug` now derives from nothing but an empty map (per-vendor/per-check grade data has no safe source anywhere, pre- or post-publish, so evidence lines honestly draw fewer lines rather than a guessed one); vendor dots and capability-ring positioning still work correctly from `published.invited` (frozen) via the `fitSlugs` prop, which the caller now populates from `published.invited.map(v => v.slug)` instead of a live ranking.

### 4. `scripts/validate-pre-publish-vendor-disclosure.ts` — regression fixtures (new)

Wired into `npm run validate`. Two halves, per Robert's "proving the API and UI cannot reveal supplier identities":

**Part A — API boundary**, against the real `GET` route handler (never a hand-reimplemented substitute), across four scenarios (graded/SASE, graded/SD-WAN with model+cloud+want checks, compiled/managed-security, and the bare default request):

- Sanity check first, against the raw `workspaceFit()` library call for the identical inputs: `directory` and (in graded mode) `suppliers`/`count` are genuinely non-empty/present — so the redaction proven next is real, not vacuous.
- The route's JSON response has no `suppliers`, `directory`, or `count` key.
- No real vendor name string appears anywhere in the serialized response body (belt-and-braces, in case a future field leaked one incidentally).
- The safe fields (`ok`, `mode`, `total`, `methodology`, `checks`) are still present — this is a redaction, not an outage.

**Part B — UI/component boundary.** ProjectDesk.tsx is a large, stateful, hook-heavy client component; this repository has no jsdom/`@testing-library/react`, and (unlike the stateless presentational components validated elsewhere in this repo, e.g. `validate-session-activity.ts`) it cannot safely be invoked as a plain function — hooks require a real React dispatcher. Consistent with this repo's established fallback for exactly this situation (`validate-workspace-explanations.ts`), the UI half is proven structurally: reading the component's own source (comments stripped) and asserting, among other things, that the `FitState` type carries no supplier/directory/count fields, that no live code path reads `.suppliers`/`.directory`/`fit.count`/`fit.mode`, that the retired ranked-panel machinery (`rankedFits`, `keptFits`, `fittingCount`, `expandedFit`, `GRADE_WORDS`) is genuinely gone rather than hidden, that `pins` is derived only from `added`, that the three conversational bypass handlers no longer reference per-vendor fields, that `published` is set from exactly one place and that place reads only `data.invited`/`data.market_report.matched`, that the locked panel itself references none of the banned fields, and that `ConstellationScene.tsx` contains no `fit.suppliers`/`fit.directory` reference and still self-gates to post-publish.

**Non-vacuity was verified by hand**, not assumed: both halves were run against a deliberately-reintroduced version of the bug they check for (the pre-fix `route.ts`, a reintroduced `fitSlugs`-in-`pins`, and a reverted `count` strip) and confirmed to fail before being confirmed green against the real fix. Evidence: `reports/phase2-round2-pre-publish-vendor-disclosure-fixture-output-14aug.txt`.

Final run: **120/120 assertions pass** (38 in Part A, 82 in Part B).

## Verification chain

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean (exit 0) |
| `npx eslint` on the four touched files | 4 pre-existing, unrelated `react-hooks/set-state-in-effect` errors (same lines/pattern as the accepted Phase 2 baseline); **zero new issues** — see `reports/phase2-round2-lint-output-14aug.txt` |
| `npm run validate` (full chain, now including the new fixture) | **474/474 pre-existing assertions pass, 0 fail** (unchanged from the accepted Phase 2 baseline) **+ 120/120 new assertions pass** — see `reports/phase2-round2-full-validate-output-14aug.txt` |
| `npm run build` (production build) | Succeeds, via the established sandbox-only `next/font/google` workaround to `layout.tsx`, reverted immediately after with a confirmed zero `git diff` |

## Files changed

```
package.json                          |   2 +-
src/app/api/workspace/fit/route.ts    |  37 ++-
src/components/ConstellationScene.tsx |  33 ++-
src/components/ProjectDesk.tsx        | 418 ++++++++++++++-------------------
scripts/validate-pre-publish-vendor-disclosure.ts | new file
```

## Explicitly out of scope (per Robert's instruction)

- The broader `LivingProcurementDocument` production integration (making it the compiled/persisted document that matching, board projection, invitations, reports and exports all consume) — **not started**.
- `PositionWorkspace.tsx` / `LiveWorkspace.tsx` — confirmed dead/unimported code hitting the same `/api/workspace/fit` route; left untouched.
- `/api/workspace/market` (the generic, non-project-specific vendor directory) and the public `/shortlist` page (`buildShortlist()`, a different function entirely) — legitimately open surfaces, not touched.
- The `workspace_cycle` MCP tool and `workspaceFit()` itself — unchanged, distinct out-of-scope surface.

## Stopping point

This is a checkpoint for review, per Robert's instruction. No push, merge, or deploy has been performed. The bundle `sdwancomparison-living-procurement-canvas-phase2-round2-14aug.bundle` contains the complete history (`c08cc53` → `0e3e7ac` → `4d75761` → `8bd55f4`) and has been verified with `git bundle verify`.
