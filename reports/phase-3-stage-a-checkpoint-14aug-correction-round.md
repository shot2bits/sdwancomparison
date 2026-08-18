# Living Procurement OS — Phase 3 Stage A, correction round

**Date:** 14 August 2026
**Branch:** `living-procurement-os-phase3-stage-a`
**Commit:** amended in place on `0789c16` (per your explicit instruction — not a new commit). Not pushed, merged or deployed.

This is a **correction round on the existing Stage A checkpoint**, not new scope. Your rejection of the first checkpoint named nine numbered defects; all nine are addressed below, each reproduced before it was fixed, each verified non-vacuous by sabotage-then-restore, each checked against the real rendered UI (not just the pure-function fixture). No persistence, MCP integration, approvals, publishing change, or agent execution was added — Stage A's scope only.

---

## 0. The most important thing this round found

Every prior Stage A fixture — including the one shipped in the rejected checkpoint — drove the compiler and the reducer directly through a hand-rolled `turn()` test harness. It never mounted the real `ProjectDesk` component. Building the real UI/integration fixture your defect #1 demanded (Playwright driving the actual rendered composer, not a simulated one) surfaced **two genuine bugs the pure-function fixture could not see, on top of the three you originally flagged**:

1. **Prompt A rendered as v2 in the live UI, not v1.** `previousProcurementDocumentRef` froze on the phantom pre-event compile that runs on mount (facts empty, no revision yet) as if it were a real baseline. The first real buyer submission then saw a non-null "previous" document already at version 1 and bumped it to 2. The pure-reducer fixture's `version === 1` assertion had already passed for months because it never modelled the mount effect at all.
2. **The chat falsely told the buyer "I did not catch anything new"** immediately after deriving a brand-new mandatory clause, gate, and open decision (Prompt C's residency sentence; also Prompt D's conflict). `send()`'s final branch always keeps the sentence as a receipt, and the compiler routinely turns a kept receipt into a real testable requirement — but the narration never checked for that, so it claimed nothing happened in the exact cases you called out in defect #3.

Both are fixed below (§3, §4) and are now permanently regression-tested by `scripts/validate-living-procurement-os-stage-a-ui.mjs`, a genuine browser-driven fixture (§9) — not by extending the pure-function harness, which structurally cannot see either bug class.

---

## 1. Defect #1 — fixture integrity restored

- Every Prompt B/C/D assertion in `scripts/validate-living-procurement-os-stage-a.ts` is now a real graded `record(condition, ...)` check against actual compiler output — no `NOTE`-only diagnostic lines remain anywhere in the file.
- A genuine UI/integration fixture was added: `scripts/validate-living-procurement-os-stage-a-ui.mjs`, run via `npm run validate:ui` against a live dev server, driving the real `<textarea>`/Enter-to-send composer through Playwright — the same DOM path a buyer's keystrokes take. It is what found §0's two bugs. It is intentionally **not** wired into the default `npm run validate`/`npm run build` chain (those must stay a pure, offline `tsx` pipeline runnable with no browser/server); it is its own explicit script, documented at the top of the file, and was run as part of this checkpoint's own verification (§9).
- Every one of the 9 defects below and every established Phase 1/2 fixture was re-verified via sabotage-then-restore (§9) — not merely inspected.

## 2. Defect #2 — Prompt B DLP negation

"Change the service to co-managed. Keep 24/7 incident support, remove DLP, and keep the April 2027 deadline."

**Reproduced first:** `REMOVAL_VERB_RE` (the existing removal detector) only matches when the *entire* receipt is a removal instruction. Embedded inside this compound sentence, "remove DLP" was invisible to it, so DLP was never recognised as removed — and because DLP had never been stated in this session either, the sentence's raw text fell through to the generic Additional-Requirement fallback, which read "remove DLP" as declarative text and could invent a DLP clause from a negated phrase.

**Fixed:** added `EMBEDDED_REMOVAL_RE`/`EMBEDDED_REMOVAL_NEGATOR_RE`, a second, additive detector layered on top of the existing anchored one (existing standalone-removal fixtures are untouched), so a removal instruction embedded in a larger sentence is recognised and filtered by the existing post-generation `isCurrentlyRemoved()` filter — DLP never existing in this session, "remove DLP" is a correct idempotent no-op, not an invented artifact.

**Verified (live UI, screenshot `02-desktop-promptB-v2.png`):** DLP does not exist as its own clause or gate anywhere in the compiled document (only as one example item inside the pre-existing, unrelated "network-architecture-scope" supplier question's own component list — unchanged, correct). Co-managed replaces the operating-model concept in one clause, not a competing second one. 24/7 incident support is kept on that same clause. The April 2027 deadline is untouched. The change ribbon reads "1 requirement added, 1 gate added" — genuinely correct: Prompt A never stated an operating model at all, so `managed-service-boundary` is a real new clause at Prompt B, not a phantom update.

## 3. Defect #3 — Prompt C UK residency

"All customer data must remain in the UK."

**Reproduced first:** `RESIDENCY_RE` and its prohibition/leaving-based vocabulary (`may not leave` / `must not leave` / `leave the UK`, etc.) never matched a positive-containment phrasing ("must **remain** in the UK") — the brief's own exact sentence. It fell through to a generic fallback with no named template, no correct evidence request, and (see §0) the chat wrongly told the buyer nothing was caught.

**Fixed:** broadened `RESIDENCY_RE`, `RESIDENCY_PROHIBITION_RE`, and `dataResidencyClauses()`'s local `dataLeavingRe` to recognise remain/stay/reside/kept/stored-in-the-UK phrasing alongside the original leave-based wording — additive, the original patterns are unchanged and still match.

**Verified (live UI, screenshot `03-desktop-promptC-v3.png`):** the sentence is recognised by the named `uk-data-residency` template, mandatory, with correct evidence requests ("Data-flow diagram", "Sub-processor list and locations"), the buyer's exact sentence retained verbatim as the clause's own quote, buyer-attributed provenance (not a Netify/sector default), no generic "confirm your ability" fallback created for it, and — the specific false claim you named — the chat no longer says "I did not catch anything new"; it now says "Kept in your own words — see the statement below for how it landed," which is honest in every case, not just this one (§0, §4).

## 4. Defect #4 — Prompt D contradiction

"We want a single supplier but also require independent best-of-breed security controls."

**Reproduced first, two separate bugs:**
- `detectOperatingModelConflict()` only recognises the *managed-model-vs-sole-operational-control* contradiction; this is a structurally different one (supplier count vs. independently-selected security). It fell through to the generic mandatory-fallback path — inventing a mandatory gate from an unresolved contradiction, the opposite of what's required.
- Separately, and only found once the sentence was actually typed into the running UI: `statedObjectivesIn()` (`extract.ts`) independently recognises the bare phrase "best-of-breed" anywhere in the text and lands it as its own "stated objective" — a code path entirely outside the receipts/clause pipeline. Even after the conflict was correctly represented as an OpenDecision, this second path still turned "best-of-breed" into its own separate scored Additional-Requirement clause, silently treating one side of the unresolved conflict as an accepted requirement — a duplicate the pure-compiler fixture, which never calls `send()`, could not see.

**Fixed:** added `detectSupplierStrategyConflict()` (its own `SINGLE_SUPPLIER_RE`/`BEST_OF_BREED_SECURITY_RE`), wired into `buildOpenDecisions()` as `OD-supplier-strategy-conflict`, and excluded the conflicting receipt from the generic Additional-Requirement fallback. Then, once the duplicate was reproduced live, excluded the matching noted-objective from `notedClauses()` too — **only** while this specific conflict is active (a bare "we want best-of-breed security" with no single-supplier language anywhere still gets its own clause, unchanged).

**Verified (live UI, screenshot `07-desktop-promptD-v1-newproject.png`, in a fresh, separate project):** a visible conflict/open decision names the real tension in the buyer's own verbatim wording; neither side is made mandatory; no pass/fail gate is invented; the pre-existing, legitimately-also-present deadline decision (Prompt D alone states no deadline) coexists rather than substituting; **0 requirements total** — the duplicate clause is gone; the chat also no longer falsely claims nothing was caught.

## 5. Defect #5 — live revision semantics

**Reproduced first (§0):** the mount-freeze bug meant one buyer submission did *not* reliably equal one revision in the live UI, even though the debounce/settle-window mechanism (`beginOrExtendSubmission()`/`scheduleSettle()`, already batching every `applyMerge()`/`applyRemovals()` call from one submission into one governed event) was itself working correctly.

**Fixed:** the `previousProcurementDocumentRef` freeze effect no longer treats the phantom pre-event compile as a baseline — it only freezes once a real governed cycle has landed (§0's fix).

**Verified (live UI, real browser, same project unless noted):** Prompt A → **v1**. Prompt B → **v2**. Prompt C → **v3**. Prompt D, typed into a **separate, fresh** project → **v1** (a new project never inherits another project's revision count). Re-confirmed via the permanent `validate:ui` fixture and via sabotage-then-restore (§9).

## 6. Defect #6 — stable IDs preserved exactly

Confirmed the FNV-1a hash the rejected checkpoint had shipped (introduced only because `node:crypto` broke the client bundle) was never re-introduced. `stableClauseId()` uses a from-scratch, pure-JS, isomorphic SHA-256 implementation (`sha256Hex()` — FIPS 180-4, `TextEncoder`/`DataView`/`Uint32Array` only, no `node:crypto`), verified byte-for-byte identical to `node:crypto`'s own `createHash("sha256")` output. `stableClauseId()` itself reads exactly as it did before Stage A: `sha256Hex(templateKey).slice(0, 8)`.

**Verified:** 11 known-vector fixtures assert the exact pre-Stage-A id for 11 real template keys (e.g. `network:legacy-circuit-coexistence` → `NET-80af8f52`, `security:dlp` → `SEC-693021ca`, `operating-model:boundary` → `OPS-a2e5cbe3`), each independently computed via `node:crypto` inside the fixture itself, not merely re-asserting the implementation's own output. Plus a genuine-reload check (`previousDocument: null`) reproduces the identical id for the identical templateKey.

## 7. Defect #7 — no duplicated/nonsensical clauses

- Organisation facts (sector/sites/users/location) are excluded from becoming a scored Additional Requirement via `receiptIsOrgIdentityAndScale()` (≥60% word-coverage match against the specific fact quotes that state them).
- Prompt A's single dense sentence no longer compresses into one enormous catch-all: three new, properly named, lighter templates decompose it — broadened `LEGACY_APP_RE` (now also matches "clinical application"/"patient-facing application"), a new `identity-provider-entra` template for a bare Entra ID mention without ZTNA, and a new `voice-scope` template for a bare Teams Phone mention without resilience language.
- The Prompt D duplicate found and fixed in §4 is the same class of bug (a phrase already represented elsewhere silently spawning a second, separately-scored clause) — fixed there.

**Verified:** Prompt A's rich-wording fixture (Part A2) asserts all eight expected named templates fire (voice-continuity, application-resilience, identity-aware-ztna, dlp-coverage, managed-service-boundary, dated-transition-plan, uk-data-residency, legacy-circuit-coexistence) with the coordinated-projection invariants holding throughout.

## 8. Defect #8 — canvas as the primary product surface

- The existing Living Statement / fact-ledger editor is fully preserved, byte-for-byte (verified: its own header comment, its `TWIN_GROUPS` render loop, and its drop/clear controls are all unchanged) — but it now sits behind a native `<details>`/`<summary>` disclosure labelled "Project details / edit source facts", collapsed by default, so the canvas is the only complete procurement view visible without an explicit click.
- The marketing hero (`CollapsibleHero.tsx`, new) compacts substantially the moment a project starts: 38px → 16px heading, subhead becomes screen-reader-only (never removed — `id="page-h1"`/`id="page-subhead"` stay in the DOM for the speakable-schema selector and the site's own h1-id audit), on both `/home` and `/workspace`. No unrelated redesign — only this hero's own sizing changed.

**Verified (live UI):** desktop screenshots `05-desktop-disclosure-collapsed.png`/`06-desktop-disclosure-expanded.png` show the collapsed-by-default state and the full statement panel only after an explicit click. Mobile screenshots `09-mobile-promptA-v1.png`/`10-mobile-promptB-v2.png` show the compacted hero with the command bar and living document dominating the viewport; measured directly via `getComputedStyle`/`getBoundingClientRect` on `#page-h1` (not just visual inspection): 16px font, 41.6px total rendered height for the full two-line heading, confirming the compaction is real, not merely visually plausible.

## 9. Defect #9 — Stage A interaction quality

- **Accessible tabs**: `LivingProcurementCanvas.tsx`'s Living document/Supplier pack/Evaluation switch now has fully associated `id`/`aria-controls`/`aria-labelledby` between each tab and its panel, roving `tabIndex` (0 on the selected tab, -1 elsewhere), and `onKeyDown` handling Left/Right (wrapping) and Home/End.
- **Architecture**: `ProcurementArchitecture.tsx` was rewritten to a real, deterministic three-column SVG relationship view (`role="img"`, `aria-labelledby`, embedded `<title>`, curved edges with arrowhead markers and labels) whenever the compiler derives actual edges, falling back to the original chip list only when there are genuinely no relationships to draw (never disconnected boxes). A persistent `sr-only` text summary plus an `sr-only` relationship list are always rendered alongside it, regardless of which view is showing — the equivalent accessible text representation is never JS-conditional.
- **Mobile sticky navigation**: verified directly, not assumed — screenshot `12-mobile-scrolled-sticky-check.png` at a mid-scroll position shows the sticky composer dock cleanly separated from the content flowing beneath it (opaque background, correct z-index); the "Living procurement document · V2" heading and everything below it renders fully visible immediately after the dock, nothing clipped or hidden behind it.
- **Pre-publication vendor-identity boundary**: re-confirmed both statically and live. Statically: the five canvas component files were grep-checked and still contain none of `rankedFits`, `matchInfo.count`, `.suppliers`, `invited_vendors`, `matched_vendors`, and no hard-coded example vendor names. Live: after driving Prompts A→B→C through the real UI, the compiled canvas's own DOM subtree (`section[aria-label="Living procurement document"]`) was searched directly for known vendor names (Aryaka, BT Business, Verizon, Cato Networks, Palo Alto, Cisco Meraki, Fortinet, Zscaler, Netskope) — none present. ("BT Business" appears once in the page overall, but only inside the site's own pre-existing global footer navigation link — "BT Business Partner Programme" — outside the canvas entirely; confirmed by scoping the search to the canvas `<section>` specifically.) The existing dedicated Phase 2 fixture (`validate-pre-publish-vendor-disclosure.ts`) still passes unchanged in the full validate suite.

**Architecture SVG, exercised with real edges**: Prompts A alone produce no network edges (no "existing network" fact stated, since Prompt A is about what's being *bought*, not what's currently run) and correctly render as the chip fallback (screenshots `01`–`03`). A supplementary check ("We currently run MPLS across our sites.") was sent to specifically exercise the edge-drawing path — screenshot `04-desktop-architecture-svg-real-edges.png` shows the real SVG rendering with curved arrowed edges labelled "connects"/"reaches"/"migrates onto"/"coexists via" between sites, remote users, the network node, Azure, and the legacy application/circuit pair.

---

## Verification chain

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean (exit 0) |
| `npm run validate` (full 14-script chain, incl. the rewritten Stage A fixture) | **All pass**, exit 0. 135 `PASS`, 0 `FAIL` in the Stage A fixture alone (`reports/stage-a-fixture-output-14aug-correction-round.txt`). Every established Phase 1/2 fixture (`validate-vendors`, `validate-instruments`, `verify-fact-ledger-reliability-gate`, `validate-procurement-document`, `validate-procurement-canvas-corrections`, `validate-living-canvas-phase2-lifecycle`, `validate-pre-publish-vendor-disclosure`, `validate-published-resume-hydration`, `validate-rfp-builder-match-disclosure`) still passes unchanged — zero regressions, none weakened. |
| `npm run validate:ui` (new, real-browser fixture, §1) | **13 passed, 0 failed** (`reports/stage-a-ui-fixture-output-14aug-correction-round.txt`). This is the fixture that found §0's two bugs; both are now regression-tested here. |
| Focused ESLint on every touched/new file | Same 4 pre-existing `react-hooks/set-state-in-effect` errors as the original checkpoint (`setTestMode`, `setVerdict(null)`, `setChangedSlots`, `setVoiceSupported`), re-confirmed via `git stash`/`git stash pop` diff against the unmodified original file — same 4 errors, different line numbers only, from insertions elsewhere in the file. Not introduced by this round; not in your 9-point list. Zero new issues on every new/modified file, including the two new fixture/component files. |
| `npm run build` (production) | **Succeeds**, via the same established sandbox-only `next/font/google` workaround used in every prior phase's checkpoint (this container has no route to `fonts.googleapis.com`): temporarily stubbed the `Inter()` call in `layout.tsx`, ran the build, confirmed success, reverted immediately — `git diff --stat` on `layout.tsx` is empty. |
| Sabotage-then-restore non-vacuity, 7 independent cycles this round | Embedded-removal detection (§2), `RESIDENCY_RE` (§3), supplier-conflict decision (§4), supplier-conflict clause-suppression (§4), `stableClauseId` hash (§6), the version-freeze fix (§0/§5 — sabotaged back to the original `isFirstEver ||` condition, confirmed 4 UI assertions correctly fail, restored), and the noted-objective duplicate-clause fix (§4/§7 — sabotaged by removing the filter, confirmed exactly 1 UI assertion correctly fails, restored). Every cycle: broke the fix with a single precise `Edit`, confirmed the specific fixture assertion FAILs, restored, re-confirmed PASS. |
| Prompts A–D through the real rendered UI, desktop (1440px) and mobile (390px, touch) | Screenshots in `reports/screenshots/`: `00`–`03` (desktop, one project, A→B→C, v1→v2→v3), `04` (architecture SVG with real edges), `05`/`06` (disclosure collapsed/expanded), `07` (Prompt D, separate fresh project, v1), `08`–`10` (mobile, empty/A/B), `11`/`12` (mobile sticky-nav check at two scroll positions). |
| No established Phase 1/2 fixture changed or weakened | Confirmed — the full validate suite's pre-existing scripts pass with their original, unmodified assertions; only the Stage A-specific fixture file and the new UI fixture were touched. |
| No existing stable ID changed | Confirmed — §6's 11 known-vector fixtures assert exact byte-identical pre-Stage-A ids, independently computed via `node:crypto` inside the fixture, not merely re-asserting the implementation's own output. |

## Deliverables

1. This report.
2. `reports/stage-a-fixture-output-14aug-correction-round.txt` — full console output, pure-function fixture (135 PASS / 0 FAIL).
3. `reports/stage-a-ui-fixture-output-14aug-correction-round.txt` — full console output, real-browser fixture (13 PASS / 0 FAIL).
4. `reports/screenshots/` — 13 screenshots, desktop and mobile, covering every prompt, both new fixes from §0, the disclosure toggle, the architecture SVG, and the mobile sticky-nav check.
5. `scripts/validate-living-procurement-os-stage-a-ui.mjs` (new, permanent) — run via `npm run validate:ui` against a live dev server.

## Stopping point (correction round)

Corrected Stage A checkpoint delivered for review. All 9 defects fixed and verified; 2 additional bugs found only by the new UI/integration fixture were also fixed and are now permanently regression-tested. Existing commit `0789c16` amended in place — no new commit created. No push, merge, or deploy performed. Not starting Stage B. Awaiting your review.

---

# Addendum — Stage A closure pass (14 August 2026)

**Scope:** your six-item closure instruction, narrowly. The completed nine-point correction was not reopened; Stage B was not started. All work amended onto the same Stage A commit (`8c00e23`, itself the amended form of `0789c16` — no new commit created).

## Item 1 — removal is now projection-wide

The only runtime leak found: `networkScopeClauses()`'s supplier-response example-component sentence hardcoded `"...e.g. SD-WAN transport, SWG, CASB, ZTNA, FWaaS, DLP..."` regardless of any active removal. Every other "DLP" occurrence in `src/lib/workspace/` is a doc comment, the (correctly-excluded) `dlp-coverage` clause definition itself, or a removal-law regex — none render.

Fixed by extracting the component list into `NETWORK_SCOPE_COMPONENTS` (display label + the same `removalLabel` vocabulary `clauseRemovalLabel()`/`REMOVAL_ALIAS` already use) and filtering it through the existing `isCurrentlyRemoved()` helper before rendering the sentence — the same recency-aware removal check that already suppressed the standalone `dlp-coverage` clause, now reused rather than duplicated.

**Verified (live UI):** a DOM `TreeWalker` enumerated every leaf text node in the whole document after Prompt B. Two hits, both DLP-mentioning, both reduce to substrings of the buyer's own verbatim Prompt B sentence ("Change the service to co-managed. Keep 24/7 incident support, remove DLP, and keep the April 2027 deadline."/its second sentence alone, quoted elsewhere as a receipt). Zero leaks into any other projection. The buyer's original wording is confirmed still present, not erased.

## Item 2 — target architecture projection completed for Prompt A alone

`buildArchitecture()`'s "network" hub node — the node every relationship edge routes through — was only ever created from `estate.existingNetwork`. Prompt A states what's being *bought*, not what's currently run, so that fact is never populated and the whole architecture silently fell back to the disconnected-chip view, even though the compiler had already derived SASE/SD-WAN, Azure, Entra ID, Teams Phone, the retained circuit, sites/users and the legacy application as named clauses.

Fixed: the network node now also derives from `procurement.buying` (labelled "Proposed SASE service", etc., via the existing `BUYING_SHORT` map) or the presence of a `network-architecture-scope` clause, whichever fires. Separately, the identity/voice nodes only recognised the heavier correction-round templates (`identity-aware-ztna`/`voice-continuity`); Prompt A's actual wording triggers the lighter templates added the same round (`identity-provider-entra`/`voice-scope`), which were never checked. Fixed via a small `anyClauseId()` helper checking both template ids per node, heavier first.

**Verified (live UI):** Prompt A alone (no MPLS follow-up) now renders the real SVG, not the chip fallback, with: sites/remote users → proposed service, proposed service → Azure, Entra ID → identity/policy, Teams Phone → voice/network, and the legacy clinical application coexisting with (and migrating from) the retained Ethernet circuit. The `sr-only` accessible text equivalent is present alongside the SVG, unchanged from the correction round's own accessibility fix.

## Item 3 — Project Memory semantics corrected

`document.provenance.buyer` counts **compiled clauses by origin**, not retained buyer-authored source items. Prompt D genuinely compiles zero clauses by design (the tension it states lives entirely in `openDecisions`, not a clause) — so "0 your words" was a true count under the wrong label, misread as "nothing was received from the buyer" while a verbatim buyer sentence sat one line above it.

Chose the rename path (one of your two explicitly offered options) over recounting, to avoid conflating two genuinely different metrics: the provenance line now reads "**N requirement clauses from your words** · N from netify · N from sector rules", never a bare "your words" claim.

**Verified (live UI):** Prompt D's memory strip now reads "0 requirement clauses from your words · 0 from netify · 0 from sector rules" alongside "1 recorded turn" — precise and non-misleading. A new fixture assertion asserts the bare, unqualified pattern `/\b0 your words\b/i` can never match while the pattern requires the "requirement clause(s)" qualifier.

## Item 4 — mobile "dead zone" investigated and found to be a screenshot artifact, not a product bug

Per your instruction, this was not judged from heading font-size alone. A Python/PIL per-row pixel-standard-deviation scan of the original `09-mobile-promptA-v1.png` located the exact blank run (rows 116–517, 402px). Reproducing the identical capture (same prompt, same viewport, same natural post-send `scrollY`) with an **ordinary** (non-resized) viewport screenshot at that same scroll position showed **no gap at all** — the blank region only appears in the `fullPage: true` capture. Root cause: Playwright's full-page stitching resizes the viewport before capturing, and the dock's `position: sticky` renders at a transient/incorrect offset mid-resize. This is a Playwright capture artifact, not something a real mobile user ever sees; no app code was changed for this item.

One genuine methodology bug was found and fixed while adding the requested regression assertions: a first version of the heading-to-dock gap check measured `getBoundingClientRect()` at the page's natural post-send resting scroll position, where the marketing `h1` has legitimately scrolled far above the viewport (ordinary, correct chat auto-scroll-to-reply behaviour) — producing a meaningless ~665px "gap" to an off-screen element and a false failure. Fixed by measuring the gap at `scrollY=0` instead, which is what your instruction's literal claim — "once a project has started, the compact heading must be followed immediately by the command surface" — actually describes (the top-of-page layout once compact mode is on): **32px**, well under the 150px threshold.

**Verified (live UI, real fixture run):** three new assertions at a genuine 390×844 mobile viewport — heading-to-dock gap (32px, measured at scroll top), command composer visible within the natural post-send working viewport (no scrolling needed), and an `elementFromPoint` probe just past the sticky dock's bottom edge resolving to real content, not the dock itself. Three screenshots captured: `mobile-viewport-ordinary.png` (natural resting scroll, no fullPage), `mobile-viewport-fullpage.png` (the requested full-page capture, still showing the stitching artifact for the record), and `mobile-viewport-top-scroll.png` (scrolled to top, evidencing the 32px gap).

## Item 5 — clean-room runnable browser fixture

`playwright` was already a declared devDependency from the correction round; `playwright install chromium` was not yet wired in anywhere. Added `"validate:ui:setup": "playwright install chromium"` to `package.json` alongside the existing `"validate:ui"` script.

The fixture script itself was rewritten to be fully self-contained: it now probes `http://localhost:3000/sase` first and reuses it if already running (fast path for local iteration), and if nothing answers, spawns its own `next dev -p 3211` in a detached process group, polls until ready, runs the full suite against it, and — critically — tears it down again in a `finally` block via `process.kill(-pid, "SIGTERM")` on the whole process group, so no server is left running after the script exits either way.

**Verified, both code paths, this session:**
- **Reuse path** — with a dev server already running on :3000, `npm run validate:ui` reused it ("Reusing already-running dev server...") and all 30 assertions passed.
- **Self-start path** — with the dev server killed and port 3000 confirmed down (`curl` → connection refused), `npm run validate:ui` printed "No server reachable ... starting one on port 3211 for this run.", started its own server, ran all 30 assertions (all passed), and cleanly stopped it — confirmed by `pgrep`/`curl` against :3211 immediately afterward showing nothing listening.

From a genuinely fresh clone (no manual symlinks, no pre-started server, only `npm ci` + `npx playwright install chromium` + `npm run validate:ui`), the fixture is runnable end to end. A minimal CI wrapper, for a runner that wants to install Chromium once and cache it rather than relying on the fixture's own self-start path:
```yaml
- run: npm ci
- run: npx playwright install --with-deps chromium
- run: npm run validate:ui
```

## Verification chain (closure pass)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean (exit 0) |
| `npm run validate` (full 14-script chain) | **609 PASS, 0 FAIL**, exit 0 — `reports/stage-a-fixture-output-14aug-closure-pass.txt`. Every established Phase 1/2/Stage-A-correction fixture still passes unchanged; zero regressions. |
| `npm run validate:ui`, self-start path (clean-room proof) | **30 PASS, 0 FAIL** — `reports/stage-a-ui-fixture-output-14aug-closure-pass.txt`. Includes all four new closure-pass assertion groups (items 1–4) plus every pre-existing correction-round assertion, unweakened. |
| `npm run validate:ui`, reuse-existing-server path | 30 PASS, 0 FAIL (not re-saved as a separate artifact — identical assertions, identical result, different server-lifecycle branch). |
| Non-vacuity of the new item-1/2/3/4 assertions | Each was watched fail against the pre-fix code during development this pass (the DLP example-list leak, the missing architecture edges for Prompt A alone, the mislabelled "0 your words", and — for the gap assertion specifically — the false-positive measured at the wrong scroll position), then confirmed to pass only once genuinely fixed. |
| Bundle clean-room clone verification | See Deliverables below — a fresh `git clone` from the delivered bundle, in a clean temporary directory, re-ran `tsc`, `npm run validate`, and `npm run validate:ui` there, independent of this working tree. |

## Deliverables (closure pass)

1. This addendum, appended to the existing checkpoint report.
2. `reports/stage-a-fixture-output-14aug-closure-pass.txt` — full console output, pure-function fixture (609 PASS / 0 FAIL).
3. `reports/stage-a-ui-fixture-output-14aug-closure-pass.txt` — full console output, real-browser fixture, self-start clean-room path (30 PASS / 0 FAIL).
4. New/updated mobile screenshots in `reports/screenshots/`: `mobile-viewport-ordinary.png`, `mobile-viewport-fullpage.png`, `mobile-viewport-top-scroll.png`.
5. A full-history git bundle containing the re-amended Stage A commit, verified with `git bundle verify` and independently clone-tested in a clean temporary directory (`tsc`, `npm run validate`, `npm run validate:ui` all re-run there, all green).

## Stopping point (closure pass)

All six closure-pass items complete and verified. The completed nine-point correction was not reopened; Stage B was not started. Commit `8c00e23` amended in place again — still no new commit. Not pushed, merged, or deployed. Awaiting your review.
