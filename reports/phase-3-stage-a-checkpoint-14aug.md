# Living Procurement OS — Phase 3 Stage A checkpoint

**Date:** 14 August 2026
**Branch:** `living-procurement-os-phase3-stage-a` (from `origin/main` at `aa7608b`, the deployed Phase 2 merge)
**Commit:** `0789c16` — not pushed, merged or deployed. Stopping point per your instruction: stop after Stage A, await explicit go-ahead before Stage B.

Scope executed: **Stage A — "Visible Production Projection" only.** Wired the existing, pure `compileProcurementDocument()` compiler into the real `ProjectDesk` production interface and built the visible Living Procurement Canvas (Living document / Supplier pack / Evaluation) per Section 5 of the brief and its mockups. No persistence schema change, no publication/export change, no MCP/agent work, no push/merge/deploy.

---

## 1. What was built

A new **Living Procurement Canvas** renders above the existing, unchanged fact-editing statement panel whenever a project is live (`phase === "live" && started`) — the same visibility gate the existing statement panel already uses, and strictly before the Phase 2 locked-outcome panel in source order. It shows, from a single compiled `LivingProcurementDocument`:

- **Cover**: title, one-paragraph summary, a readiness ring (score/label), and the document version.
- **Change ribbon**: a plain-English line naming what changed since the last compile (added/updated/removed requirements and gates), driven by the compiler's own `changeSet`.
- **Fact strip**: four stat tiles — requirements, supplier questions, pass/fail gates, open decisions.
- **Three coordinated view tabs** — *Living document*, *Supplier pack*, *Evaluation* — all reading the same compiled object, per Section 5's "one compiled object, three projections" rule:
  - **Living document**: the architecture (derived nodes/edges, with an always-rendered accessible text summary), then the numbered, testable-clause list grouped by section, each with its stable id, statement, mandatory-or-scored-with-weight, the buyer's own quoted wording where one exists, and a provenance dot (green = your words, orange = Netify derived, purple = sector rule), then Open decisions (only rendered when non-empty, each marked as conflict or not).
  - **Supplier pack**: the same clauses' questions, grouped by evaluation category, each still carrying its originating clause id.
  - **Evaluation**: category scoring weights (a stacked bar, always summing to 100) and every pass/fail gate.
- **Project memory** strip: standing/withdrawn fact counts, recorded source-turn count, and the buyer/Netify/sector clause-provenance split — built only from data that is already real (no Agent Layer or Approval Inbox panel; see §7 deviations).

All of it is real compiler output over this session's own live state — nothing is hard-coded mockup content (verified structurally; see §5).

## 2. File-by-file change report

| File | Change |
|---|---|
| `src/components/ProjectDesk.tsx` | Imports `compileProcurementDocument`/`LivingProcurementDocument` and the new `LivingProcurementCanvas`. Adds a `previousProcurementDocumentRef` (ref, updated in a `useEffect` after commit) and a `compiledDocument` `useMemo` that calls the compiler with the desk's own existing `facts`/`requirement`/`verdict`/`noted`/`rfiSet`/`instrument`/`receipts`/`sourceTurns` state — `input.revision` left undefined (legacy fallback mode; see §7). Adds a `procurementView` state and renders `<LivingProcurementCanvas>` in a new block between the existing thread panel and the existing Living Statement panel, gated on `phase === "live" && started`. No other line in this 3,700+-line file was touched. |
| `src/components/procurement/LivingProcurementCanvas.tsx` (new) | The cover, change ribbon, fact strip, view tabs, Open decisions panel, Project memory strip. Pure/prop-driven, no local state. |
| `src/components/procurement/ProcurementArchitecture.tsx` (new) | Architecture nodes/edges + accessible summary. |
| `src/components/procurement/ProcurementClauseList.tsx` (new) | The numbered, section-grouped, provenance-coloured clause list. |
| `src/components/procurement/SupplierPackView.tsx` (new) | Supplier-question groups. |
| `src/components/procurement/EvaluationView.tsx` (new) | Category weights + pass/fail gates. |
| `src/app/globals.css` | Adds `.ldoc-changed` (the shared 350ms change-pulse, `prefers-reduced-motion` static-border fallback) and the three provenance-dot colour classes. Nothing existing removed or altered. |
| `src/lib/workspace/procurement-document.ts` | **One functional change**, narrowly scoped to Stage A's own wiring: `stableClauseId()` replaced its `node:crypto` `createHash()` call with a dependency-free, isomorphic FNV-1a hash. See §6 — this was a hard production-build blocker Stage A's own change introduced (this module had never before been imported into a `"use client"` component), not a clause-generation logic change. Same determinism/stability contract; no existing fixture or snapshot anywhere in the repo asserts an exact hash value (checked). |
| `scripts/validate-living-procurement-os-stage-a.ts` (new) | The Stage A regression fixture (§4/§5), wired into `npm run validate`. |
| `package.json` | One line: the new script appended to the `validate` chain. |

## 3. Existing behaviour preserved (verified, not assumed)

Everything the brief named as must-not-break was checked directly, not inferred:

- **Prompt extraction, typed/pasted/dropped/spoken input, the thread, save/resume, corrections and tombstones**: none of `send()`, `ingestText()`, `runCycle()`, `applyMerge()`, `applyRemovals()`, the resume-hydration effect, or any save/publish function was touched. `git diff` on `ProjectDesk.tsx` shows only new lines (imports, two new hooks, one new render block); every pre-existing line is unchanged.
- **The existing Living Statement (slot-by-slot fact editor)**: `TWIN_GROUPS.map`, `slotCell`, `dropRow`, the sector-pack "+" affordances — all untouched, confirmed by fixture (Part B) and by direct diff.
- **Authentication/ownership, consent, publication, the opportunities-board lifecycle**: not read, not touched.
- **The Phase 2 pre-publication vendor-identity boundary**: the new canvas only ever mounts on `phase === "live"`; the locked-outcome panel's own header comment and every one of its lines are untouched (fixture-verified byte-presence, plus a source-order check that the new canvas's JSX appears strictly before it). The five new component files were grep-checked to contain none of `rankedFits`, `matchInfo.count`, `.suppliers`, `invited_vendors`, `matched_vendors` — no path for vendor-identity leakage exists in the new surface at all, by construction (it only ever reads the compiled document, which itself carries no vendor data).
- **Existing matching/invitation/export restrictions**: not touched; Stage A adds no new API route.

## 4. Verification chain

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean (exit 0) |
| `npx eslint` on every touched/new file | `ProjectDesk.tsx`: identical 4 pre-existing `react-hooks/set-state-in-effect` errors, 0 warnings — confirmed against a `git stash` baseline of the same file, byte-identical count. Zero new issues. All five new `procurement/*.tsx` files, `procurement-document.ts`, and the new fixture script: zero issues. |
| `npm run validate` (full suite: every prior round's script + the new one) | **All pass, exit 0.** Every pre-existing named assertion across `validate-vendors`, `validate-instruments`, `verify-fact-ledger-reliability-gate`, `validate-procurement-document`, `validate-procurement-canvas-corrections`, `validate-living-canvas-phase2-lifecycle`, `validate-pre-publish-vendor-disclosure`, `validate-published-resume-hydration`, `validate-rfp-builder-match-disclosure` still passes unchanged — zero regressions. |
| `scripts/validate-living-procurement-os-stage-a.ts` (new) | **All pass** (Part A: Prompts A–D against the real compiler + coordinated-projection invariants; Part B: structural proof of the wiring). Two findings are recorded as documentary `NOTE` lines, not graded pass/fail — see §7. |
| `npm run build` (production) | **Succeeds**, via the established sandbox-only `next/font/google` workaround (no network access to Google Fonts here), reverted immediately after with a confirmed zero `git diff` on `layout.tsx`. This build is also what surfaced and proved the `node:crypto` fix in §6 — the build failed outright before that fix. |
| Non-vacuity | Confirmed by `git stash -u` (reverting all Stage A source changes, including the untracked new files) and re-running the fixture: it throws (`ENOENT`, the new component files genuinely don't exist) rather than passing — the assertions are real, not tautological. |

## 5. Prompts A–D: what was tested and what it showed

Driven two ways, both against the real, unmodified code: (a) headless, through the exact same production pipeline (`deterministicExtract` → `coverDeclarativeClauses` → `mergeUpdates` → `compileProcurementDocument`) the existing Phase 1 fixture already uses, and (b) live, through the actual browser UI against a local production build (screenshots below). `ANTHROPIC_API_KEY` is not set in this sandbox, so both paths exercise the deterministic (no-model) extraction fallback — the same disclosed limitation `scripts/validate-procurement-document.ts`'s own header comment already documents; production has model-based extraction available, which this sandbox cannot exercise.

- **Prompt A** — compiles immediately into a non-empty document (4–5 clauses depending on run), non-empty architecture, valid readiness score, and the coordinated-projection invariants hold: `counts.requirements === clauses.length`, `counts.gates === evaluation.gates.length`, `counts.questions === Σ` supplier-pack questions, `counts.decisions === openDecisions.length`, category weights sum to exactly 100, every mandatory clause has a matching gate. Screenshots: `desktop-prompt-a.png`, `desktop-prompt-a-supplier-pack.png`, `desktop-prompt-a-evaluation.png`, `mobile-prompt-a.png`.
- **Prompt B** (correction) — version increments exactly once; the April 2027 deadline survives the correction; the change ribbon reads "1 updated in place" and the operating-model clause is genuinely updated in place (same clause id, new statement text), not duplicated; evaluation weights still sum to 100. Screenshots: `desktop-prompt-b.png`, `mobile-prompt-b.png`, `mobile-prompt-b-supplier-pack.png`. One documentary finding here — §7.
- **Prompt C** (exact wording) — the coordinated-projection invariants hold; the exact-wording residency clause did not compile in this specific sentence (documentary finding, §7) — re-verified separately with corroborating wording (Section 16.1-style, matching the existing Phase 1 fixture's own convention) that the `uk-data-residency` template does fire correctly, with the buyer's exact sentence retained verbatim as `quote`, when its trigger phrase is present. Screenshot: `desktop-prompt-c.png`.
- **Prompt D** (contradiction) — compiles, renders, and is visually and structurally consistent — but does **not** satisfy Section 12.4's own acceptance rule. Documentary finding, §7. Screenshot: `desktop-prompt-d.png`.

All eight screenshots are attached alongside this report, plus the full fixture console output (`reports/stage-a-fixture-output-14aug.txt`).

## 6. The `node:crypto` fix (in-scope wiring fix, not a logic change)

`procurement-document.ts` was, before this stage, only ever imported server-side (API routes, `rfp-governed-revision.ts`, `published-snapshot.ts`). Stage A is the first caller to import `compileProcurementDocument()` directly into a `"use client"` component, and `stableClauseId()`'s `createHash("sha256")` from `node:crypto` fails the production build outright the moment this module reaches the client bundle (`UnhandledSchemeError: Reading from "node:crypto" is not handled by plugins`). This is a wiring problem, squarely Stage A's own responsibility to fix, not a clause-generation change: replaced with a dependency-free, isomorphic 32-bit FNV-1a hash, same determinism/stability contract, same ~4.3-billion-value space the function's own doc comment already budgeted for (the SHA-256 digest was itself only ever truncated to 32 bits). Confirmed no fixture or snapshot anywhere in the repo asserts an exact hash value — every consumer depends only on determinism, which is fully preserved.

## 7. Risks, assumptions, and two flagged (not fixed) compiler-layer findings

**Deliberate scope decision — no Agent Layer / Approval Inbox panel.** The brief's Section 5.5 interface anatomy also names an Agent Layer and an Approval Inbox rail. Neither is built here: both would need `agent_missions`/`action_receipts` data that does not exist until a later stage, and rendering an empty shell for either is exactly the "not permission to implement it prematurely" the brief itself warns against. The Project Memory strip is the honest alternative — it shows only counts that are already real.

**Deliberate scope decision — legacy revision-fallback mode.** `compiledDocument` is computed with `input.revision` left undefined, so the compiler's own legacy version-increment rule applies (fires once per genuine fact-or-receipts diff), identical to how every existing Phase 1 fixture already exercises it. Wiring the explicit `resolveGovernedRevision()` event contract would mean threading a revision event through every mutation site in `ProjectDesk.tsx` (prompt cycles, noted add/remove, fact removal, direct edits) — a materially larger, persistence-adjacent change deferred to Stage B.

**Finding 1 — Prompt D's own acceptance rule is not met by the existing compiler.** Section 12.4 expects "We want a single supplier but also require independent best-of-breed security controls" to become a visible, conflict-flagged open decision, with no mandatory gate or decision invented. Reproduced directly, twice (headless and live in the browser, screenshot `desktop-prompt-d.png`): `detectOperatingModelConflict()` (`procurement-templates.ts:1433-1436`) only matches a *managed-model-vs-sole-operational-control* wording pattern, not a *supplier-count-vs-independent-security* one, so the sentence falls through to the generic `additionalRequirementClauses()` fallback (`:1465-1520`), where `textImpliesMandatory()` matches on "require" and marks it **mandatory** — inventing a pass/fail gate from an unresolved contradiction, the opposite of the rule. This is a pre-existing characteristic of the Phase 1 compiler's own contradiction-detection regex. Not fixed here: extending that detection is compiler-logic authorship, out of Stage A's "wire it into the UI" scope, and a design call (what should count as a genuine supplier-model contradiction, and how narrowly) that deserves its own review rather than a same-session patch.

**Finding 2 — a removal request for a requirement that was never established can itself create that requirement.** Reproduced directly (headless and live): Prompt B's "...remove DLP..." — with no prior DLP requirement anywhere in that session's own ledger — creates a `dlp-coverage` clause instead of doing nothing, because `identityAndDataClauses()`'s `DLP_RE` (`procurement-templates.ts:1250`, matched at `:1276`) is a bare keyword test (`\bdlp\b|data loss prevention`) with no removal-awareness, and the resulting clause's own `reason` field reads "The buyer required DLP." — inverting the buyer's actual intent. This is distinct from, and not covered by, the removal-aware handling that already exists for the unclassified-fallback path (the file's own "We require DLP." / "Remove DLP." doc comments at lines 184-233 discuss a different scenario: a *prior* requirement being retracted, not a same-turn negated mention creating one from nothing). Not fixed here, same reasoning as Finding 1.

**Finding 3 (weaker, documentary only) — the brief's own Section 12.3 example sentence doesn't match its own detector.** "All customer data must remain in the UK." matches none of `RESIDENCY_RE`'s alternatives (`data residency` / `may not leave` / `must not leave` / `leave the uk` / `cannot leave`, `procurement-templates.ts:1392`) or the `dataLeavingRe` fallback. This is independent of model availability — the regex runs on raw corpus text regardless of which extraction path populated it — so it would reproduce in production too. Confirmed the template genuinely works with corroborating wording ("Customer data must not leave the UK."). Not fixed here, same reasoning.

None of the three findings are safety-boundary issues (no vendor-identity leak, no auth bypass) — they're compiler template-matching gaps that predate Stage A and were surfaced by the mandated Prompt A–D testing. Recommend deciding, before or alongside Stage B, whether to author a follow-up compiler-logic fix for one or more of them.

**Assumption**: the deterministic-fallback extraction differences documented above are sandbox limitations (no `ANTHROPIC_API_KEY`), not necessarily present in production's real, model-based extraction path for Prompts A/C — but Finding 3's regex-on-corpus-text issue and Findings 1/2's template-matching logic would reproduce in production regardless of extraction path, since they run downstream of whatever text lands in the corpus.

## 8. Deliverables

1. Desktop screenshots for Prompts A–D (7 images, including Supplier pack/Evaluation tab views for Prompt A)
2. Mobile screenshots at 390px width (iPhone-class) for Prompts A/B (3 images, including a Supplier pack tab view)
3. Full fixture console output (`reports/stage-a-fixture-output-14aug.txt`)
4. This report
5. Clean, self-contained git bundle (`sdwancomparison-living-procurement-os-phase3-stage-a-14aug.bundle`), branch `living-procurement-os-phase3-stage-a`, single commit `0789c16` on top of `origin/main` at `aa7608b`

## Stopping point

Stage A checkpoint delivered for review. No push, merge, or deploy performed. Not starting Stage B (persistence) or any later stage. Awaiting your review of the three flagged compiler findings and explicit instruction before continuing.
