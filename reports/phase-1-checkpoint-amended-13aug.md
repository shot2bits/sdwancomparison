# Living Procurement Canvas — Phase 1 Checkpoint (Amended)

**Branch:** `living-procurement-canvas-phase-1-2` (from `origin/main` at `c08cc538d67c9f90db60f4c537393f4f7052681c`)
**New commit:** `82e11aa7a7494446ad5f119007f80bbe6c817d1a` — "Living Procurement Canvas Phase 1: checkpoint corrections (stable clause IDs, durable source-ledger wording, real command-boundary fixture, RFI bank reuse)"
**Git bundle:** `living-procurement-canvas-phase-1-2-82e11aa.bundle` (delivered alongside this report; contains the complete branch history, verified with `git bundle verify`)
**Status:** All four checkpoint findings resolved and independently reviewable. Still at the Phase 1 checkpoint. Nothing pushed, merged, rebased, or deployed. `c08cc53` not amended.

To load the bundle into a fresh clone:
```
git clone living-procurement-canvas-phase-1-2-82e11aa.bundle repo
cd repo && git checkout living-procurement-canvas-phase-1-2
```

---

## 1. Stable clause identity

**Problem:** the original `numberClauses()` recomputed `NET-01`/`SEC-01`-style ids from the current clause set on every compile, sorted by section then position. Removing an earlier clause could shift every clause after it down a slot, and a brand-new clause could land on an id a removed clause used to hold.

**Fix (`src/lib/workspace/procurement-document.ts`):** `numberClauses()` now takes a `previousRegistry: Record<string, string>` (templateKey → id) and returns an updated one. A templateKey already in the registry reuses its exact id, unconditionally — this is the single mechanism for both "a surviving clause keeps its id" and "a resurrected clause gets its old id back," because both are the same case: this templateKey has been seen before. A new templateKey gets the next never-used ordinal for its section, computed by `nextOrdinalFor()` by scanning **every** value ever written into the registry (not just the current clause set), so a retired id is never handed to a different clause. The registry is threaded forward via `LivingProcurementDocument.idRegistry` and is never pruned.

One latent fragility had to be fixed as a prerequisite (`src/lib/workspace/procurement-templates.ts`): `additionalRequirementClauses`'s `templateKey` was derived from the requirement's ordinal position (`` `additional:${r.id}` ``), which would have produced a different templateKey — and therefore a fresh id — for the same semantic requirement the moment ordering churned under the new sourceTurns-merge mechanism (finding 2). It is now content-derived (`` `additional:${normTarget(r.text)}` ``).

**Evidence — `scripts/validate-procurement-canvas-corrections.ts`, Item 1** (full output in `corrections-fixture-output-13aug.txt`), a single five-turn scenario in one section so ordinal churn is genuinely exercised:

```
PASS  Item 1/insertion-before: DLP alone is SEC-01 on its first compile  ->  id=SEC-01
PASS  Item 1/insertion-before: adding an alphabetically-earlier clause does NOT renumber the surviving DLP clause  ->  dlp id before=SEC-01 after=SEC-01
PASS  Item 1/insertion-before: the new, alphabetically-earlier residency clause gets the NEXT fresh ordinal, not SEC-01  ->  id=SEC-02
PASS  Item 1/removal-before: DLP is gone after "Remove DLP."
PASS  Item 1/removal-before: the surviving residency clause retains EXACTLY the same id after an unrelated removal  ->  before=SEC-02 after=SEC-02
PASS  Item 1/removed-id-not-reassigned: the new ISO 27001 clause does NOT inherit DLP's vacated SEC-01 (or residency's id)  ->  iso id=SEC-03 vacated=SEC-01 residency=SEC-02
PASS  Item 1/resurrection: DLP resurrects with EXACTLY its original id, not a new one and not a collision  ->  original=SEC-01 resurrected=SEC-01 residency=SEC-02 iso=SEC-03
PASS  Item 1: all three surviving security-section clauses carry three DISTINCT ids  ->  ids=["SEC-01","SEC-02","SEC-03"]
PASS  Item 1/correction: a content correction (fully managed -> co-managed) preserves the EXACT same public clause id  ->  before=OPS-01 after=OPS-01
PASS  Item 1: the mandatory gate referencing this clause carries the SAME id across the correction  ->  before=GATE-OPS-01 after=GATE-OPS-01
PASS  Item 1: the architecture's voice node cites the SAME stable clause id as the voice-continuity clause itself  ->  clauseId=APP-01 node.sourceClauseIds=["APP-01"]
```

This proves insertion-before, removal-before, correction, and resurrection, plus that gates and architecture nodes (which reference clause ids by value) never drift underneath a stable id.

---

## 2. The durable source ledger, not transient receipts, as canonical wording input

**Problem:** `resumeStateFromProject()` (unmodified, `source_ledger.ts`) restores `source_ledger` and `requirementBase` on reopen, but never `facts` or `receipts`. Compiler-only requirements (legacy Ethernet, DLP, ZTNA, UK data residency) that had no structured fact path lived only in `receipts` — so they vanished on recompile after reopen.

**Fix (`src/lib/workspace/procurement-templates.ts`):** `deriveReceiptsFromSourceTurns(sourceTurns)` re-derives the exact same unplaced-clause spans a live session's `receipts` would hold, straight from the durable `SourceLedgerEntry[]`, by calling the same pure `deterministicExtract` + `coverDeclarativeClauses` functions the live extraction path itself uses internally (keeping the compiler synchronous). `mergeReceiptsWithSourceLedger(sourceTurns, receipts)` dedupes ledger-derived and any extra receipts-only entries by exact text and renumbers 1..N. `compileProcurementDocument()` (`procurement-document.ts`) now accepts an optional `sourceTurns` input and merges it in before building the clause corpus — no second, independent fact/document store is introduced.

A deeper, related gap surfaced while proving this against the real routes: `operatingModelOf(facts)` (`draft.ts`) reads **exclusively** from `WorkspaceFact[]`, and `SecurityRequirementInput` has no `procurement.operatingModel` field at all — so the fact-driven `managed-service-boundary` clause structurally could not survive reopen (post-reopen `facts` is always `[]`), unlike the four text-pattern clauses named in the finding. Fixed with a corpus-text fallback (`procurement-templates.ts`): `operatingModelFromCorpus(corpus)` matches the buyer's own retained wording (`co-managed` checked before `managed`, so "co-managed" is never misread as "managed"), used only when no `WorkspaceFact` resolved a model; `operatingModelPhraseIn()` supplies the matched phrase as the clause's `quote`/`origin: "buyer"` when no fact backs it. `compileProcurementDocument()`'s corpus was widened to include raw `sourceTurns` text (not just unplaced-clause receipts), because the extractor's own deterministic rules "structurally explain" a phrase like an operating-model statement during turn replay, so it never survives into `receipts` — it would otherwise be entirely absent from the corpus after reopen.

**Evidence — Items 2+3 route-level block**, run against the real `POST /api/security-sourcing/project`, `POST /api/security-sourcing/project/[id]/rescope`, and `GET /api/rfp/[id]` route handlers via the existing `fake-kv-harness.ts` in-memory KV emulator (the same harness `verify-fact-ledger-reliability-gate.ts`'s own Round 7–9 fixtures use):

```
PASS  Items 2+3: create with the Healthcare/Ethernet/residency turn succeeds through the real route  ->  status=200
PASS  Items 2+3: resume recovers source_ledger and requirementBase via the real resumeStateFromProject()
PASS  Item 2: the reloaded source_ledger carries the buyer's exact original turn verbatim
PASS  Item 2/durability: network-architecture-scope survives reopen -- BYTE-EQUIVALENT statement, quote and mandatory classification, with receipts=[] (only source_ledger drove this)
PASS  Item 2/durability: legacy-circuit-coexistence survives reopen -- BYTE-EQUIVALENT statement, quote and mandatory classification
PASS  Item 2/durability: uk-data-residency survives reopen -- BYTE-EQUIVALENT statement, quote and mandatory classification
PASS  Item 2: exact source wording remains linked as clause provenance after a real reopen  ->  quote=We also have a legacy app that requires a point to point Ethernet private circuit.
PASS  Item 1+2/stable ids across reopen: network-architecture-scope / legacy-circuit-coexistence / uk-data-residency all keep the SAME public id after reopen
PASS  Item 2: network-architecture-scope / legacy-circuit-coexistence / uk-data-residency (from BEFORE reopen) survive a NEW turn typed AFTER reopen
PASS  Item 2: the NEW turn's own clauses (identity-aware-ztna, dlp-coverage) also compile
PASS  Item 2: re-deriving from the SAME source_ledger twice is byte-identical -- no second store, no hidden state, nothing to fall out of sync
PASS  Item 3/route: after reopen, the managed-service clause still reads co-managed with 24/7 incident support  ->  "Managed-service boundary, SLA, escalation and RACI for a co-managed service, including 24/7 incident support."
```

The last line is the corpus-fallback fix, proven end to end: the operating-model correction was made in Prompt B, saved through the real `rescope` route, reloaded through the real `GET` route, and recompiled from `sourceTurns` alone (`facts: []`, `receipts: []`) — and the clause still reads the corrected model.

---

## 3. The exact correction prompt through the real ProjectDesk command boundary

**Problem:** at `c08cc53`, `parseCommand()` matched any input beginning "remove …" as `dropName` before any multi-clause structure was considered, and `send()` returned before `keepSourceTurn()`/`runCycle()` ran for such inputs. The exact acceptance prompt — *"Remove DLP. Make the service co-managed instead of fully managed, but keep 24/7 incident support."* — begins with "Remove DLP", so it would have been swallowed as a bare drop command and never reached extraction/compilation.

**Fix:** `Command`/`parseCommand()` moved out of `ProjectDesk.tsx` into a new pure module, `src/lib/workspace/commands.ts` (the same precedent as `resolveDropTarget()` living in `draft.ts`, for fixture-testability without a DOM). A new guard, `isSingleCommandTarget()`, rejects a drop/remove/untick/keep candidate that contains internal `.!?` punctuation or more than 8 words, falling through to `null` (ordinary procurement content) instead of a single-target command. `ProjectDesk.tsx` now imports `parseCommand` from the new module; no other behavioural change to the component.

**Evidence — Item 3 (pure), calling the real `parseCommand()` directly:**

```
PASS  Item 3/pure: a real single-target command ("remove Azure") still classifies as dropName
PASS  Item 3/pure: "drop MPLS" still classifies as dropName
PASS  Item 3/pure: a longer but SINGLE-sentence target ("untick the DLP requirement") still classifies as dropName
PASS  Item 3/pure: "keep Azure" still classifies as keepName
PASS  Item 3/THE FIX: the exact Section 16.2 correction prompt is NOT classified as a drop command (falls through to ordinary procurement content)  ->  parsed=null
PASS  Item 3/pure: "Remove DLP" ALONE (no trailing correction) still classifies as dropName
```

**Evidence — Item 3 (route-level), the exact prompt through extraction, compilation, and a real save/reopen/recompile:**

```
PASS  Item 3/route: baseline managed-service clause states fully managed
PASS  Item 3/route: the exact correction, re-checked at THIS call site, is not a drop command
PASS  Item 3/route: DLP is removed by the correction, reached through the real command-boundary + extraction pipeline
PASS  Item 3/route: fully managed becomes co-managed  ->  "Managed-service boundary, SLA, escalation and RACI for a co-managed service, including 24/7 incident support."
PASS  Item 3/route: 24/7 incident support is kept
PASS  Item 3/route: the correction saves through the REAL rescope route  ->  rescoped=true
PASS  Item 3/route: both turns (original + correction) are durable in source_ledger after the real save
PASS  Item 3/route: after a REAL save+reopen+recompile, DLP is STILL removed (the correction survived)
PASS  Item 3/route: after reopen, the managed-service clause still reads co-managed with 24/7 incident support
```

**Round 1–9 preservation:** every existing Fact Ledger Reliability Gate fixture still passes unchanged — `scripts/verify-fact-ledger-reliability-gate.ts` was not modified and its own run (part of the same `npm run validate` chain below) reconfirms this. As an additional, direct check, this fixture re-imports the real `resolveDropTarget()` (the Round 9 drop-command matcher, itself unmodified) and confirms it still resolves a live fact:

```
PASS  Round 1-9 preservation: resolveDropTarget('Azure') (the real drop-command matcher, unmodified by this correction) still resolves a live fact
```

---

## 4. Reconciling existing RFI/instrument logic

**Problem:** the brief requires `deriveRfiQuestionSet`, `earnedQuestions`, and the instrument ladder to be reused, not shadowed by a second question taxonomy.

**Design:**
- **Reused directly:** the real 386-question bank via `deriveRfiQuestionSet()` (`instrument.ts`), once earned (instrument state `"rfi"`/`"rfp"`). `CLAUSE_BANK_CATEGORY` (`procurement-document.ts`) maps six compiler `templateId`s to the bank's own overlapping category names: `identity-aware-ztna`→"Identity / ZTNA", `dlp-coverage`→"SWG / CASB / DLP", `uk-data-residency`→"Data Residency", `managed-service-boundary`→"Service Model", `dated-transition-plan`→"Deployment", `network-architecture-scope`→"SD-WAN Integration".
- **Genuinely new:** every clause-specific `supplierResponse` question generated by a template with no bank-category mapping (e.g. `mpls-coexistence`, deliberately unmapped — its questions are about circuit/MPLS-specific coexistence detail the bank taxonomy doesn't cover) — these always stay generated.
- **Deterministic de-duplication:** structural, not similarity-based. `questionsForClause()`/`buildResponseGroups()` gate bank reuse on `instrument !== "sor"`; each bank category attaches to **at most one** clause, in ascending clause-id order, first match wins. A clause is exclusively bank-sourced or exclusively generated, never both — so no duplicate question text can arise by construction.
- **Clause id / provenance linkage:** each `SupplierQuestion` carries `clauseId` (the same stable id from finding 1) and `source: "bank" | "generated"` plus `bankQuestionId` when bank-sourced, so a reused bank question is traceable to both its origin clause and its bank id.
- **Instrument state → readiness:** `buildReadiness()` (`procurement-readiness.ts`) now takes `instrument`, `bankQuestionCount`, and `rfiBankVersion` and names the instrument state and how many questions were reused in its `reasons` (informational, not score-affecting — readiness is about this document's own testable-requirements state, a different notion from the instrument ladder's "ready to earn RFI/RFP").
- **Incompatibility, documented rather than silently parallel-tracked:** `earnedQuestions()` (`questions.ts`) and this document's `OD-timeline-unstated` open decision share a trigger (no stated timeline) but are structurally different taxonomies — an `EarnedQuestion` has no `clauseId`/`answerFormat`/`evidenceRequested` and answers into the fact ledger, never a `SupplierQuestion` shape. Proven directly below, not just asserted.

**Evidence — Item 4, against the real `deriveRfiQuestionSet()`:**

```
PASS  Item 4: a real RfiQuestionSet earns from deriveRfiQuestionSet() for this scenario  ->  canonicalCount=24
PASS  Item 4/instrument gate: at instrument=sor, every supplier question is generated, none reused from the bank yet
PASS  Item 4/instrument gate: readiness names the instrument state (SoR)
PASS  Item 4/reuse: once the RFI is earned, at least one supplier question is reused from the bank  ->  bank=16 total=20
PASS  Item 4/reuse: identity-aware-ztna reuses the correct bank category's own question id(s)  ->  ["Q-IZ-01","Q-IZ-02","Q-IZ-03"]
PASS  Item 4/reuse: dlp-coverage reuses the correct bank category's own question id(s)  ->  ["Q-SC-01","Q-SC-02","Q-SC-03","Q-SC-04"]
PASS  Item 4/reuse: uk-data-residency reuses the correct bank category's own question id(s)  ->  ["Q-DR-01","Q-DR-02"]
PASS  Item 4/reuse: managed-service-boundary reuses the correct bank category's own question id(s)  ->  ["Q-SM-01","Q-SM-02"]
PASS  Item 4/reuse: dated-transition-plan reuses the correct bank category's own question id(s)  ->  ["Q-DP-01","Q-DP-02"]
PASS  Item 4/reuse: network-architecture-scope reuses the correct bank category's own question id(s)  ->  ["Q-SD-01","Q-SD-02","Q-SD-03"]
PASS  Item 4/no duplication: no supplier question text appears twice anywhere in the compiled document  ->  []
NOTE  mpls-coexistence did not fire for this probe sentence -- the exclusivity rule for unmapped templates is still proven structurally by CLAUSE_BANK_CATEGORY's own construction (no entry exists for that templateId)
PASS  Item 4/documented incompatibility: the separate no-timeline scenario genuinely leaves the timeline unstated
PASS  Item 4/documented incompatibility: OD-timeline-unstated is shaped as an OpenDecision (no clauseId/answerFormat) -- structurally NOT a SupplierQuestion
PASS  Item 4 (instrument=rfi): evaluation categories still total exactly 100
PASS  Item 4 (instrument=sor): evaluation categories still total exactly 100
```

---

## 5. Quality gate results

**New fixture script:** `scripts/validate-procurement-canvas-corrections.ts` (63 assertions, all real-function/real-route, no hand-rolled approximations) — **ALL PASS**. Full raw output delivered alongside this report as `corrections-fixture-output-13aug.txt`.

**Existing Phase 1 script re-run unchanged:** `scripts/validate-procurement-document.ts` (81 assertions) — **ALL PASS**, byte-identical to its pre-correction run, confirming `sourceTurns` defaulting to `[]` degrades every existing call site to prior behaviour with zero regression. Full raw output delivered as `procurement-document-fixture-output-13aug.txt`.

**Full `npm run validate` chain** (now includes the new script, appended to `package.json`): `apply-vendor-overrides` → `validate-vendors` → `validate-continuations` → `validate-instruments` → `validate-notice-titles` → `validate-labels` → `verify-fact-ledger-reliability-gate` (185 checks, all existing Fact Ledger Reliability Gate fixtures, unmodified) → `validate-procurement-document` → `validate-procurement-canvas-corrections` — **exit code 0, zero FAIL/error/failure lines anywhere in the chain.**

**TypeScript:** `npx tsc --noEmit` — clean, no errors.

**Lint:** `npm run lint` — 118 problems (68 errors, 50 warnings), **identical count to the pre-correction baseline** (verified by `git stash`-comparing against the working tree before this segment's edits, mirroring the same method used for the original Phase 1 checkpoint). None of the errors are in any file touched or added by this correction (`procurement-document.ts`, `procurement-templates.ts`, `procurement-readiness.ts`, `commands.ts`, the two validate scripts) — every lint finding is pre-existing, unrelated code (`SupplierPortal.tsx` `Date.now()` purity, `estimator/engine.ts` `any`, fixture-file unused vars, etc.).

**Production build:** `npm run build` (which runs the full validate chain, then `next build --webpack`) — succeeds. Built with the established sandbox-only workaround (temporarily stubbing `layout.tsx`'s `Inter({...})` call to avoid a network font fetch inside this sandbox), then reverted to a byte-for-byte zero diff against the committed `layout.tsx` before committing (confirmed via `git diff --stat`).

---

## 6. Scope discipline

Per Section 13.2's boundary, only two Canvas-integration-regression carve-outs touched code outside the Phase 1 compiler module itself:

- `ProjectDesk.tsx`: `parseCommand`/`Command` extracted to `commands.ts` and re-imported — no other line changed. `npx tsc --noEmit` confirmed clean immediately after this edit, before any other change.
- `package.json`: one line, appending the new script to `validate`.

No extraction, tombstone, source-ledger, save, ownership, or publishing code was modified. `resumeStateFromProject()` (`source-ledger.ts`) is unmodified — it still restores only `source_ledger`/`requirementBase`, never `facts`/`receipts`; the durability fix works entirely within the compiler's own inputs. `draft.ts`, `extract.ts`, and both pre-existing validate scripts remain byte-for-byte unchanged.

**Named Phase 1 scope boundary, unchanged from the original checkpoint:** Phase 1 has no route that persists a compiled `LivingProcurementDocument` anywhere — only `source_ledger` and `requirement` are saved. Stable ids *across* a real reopen (finding 1 combined with finding 2) therefore require the caller to hold or re-supply the pre-reopen document as `previousDocument`, which is the same contract every other stable-id fixture already relies on and is exercised explicitly in the Item 1+2 fixture above. Persisting the compiled document itself is a named Phase 2/3 concern, not silently assumed.

---

## 7. Delivery contents

- This report (`phase-1-checkpoint-amended-13aug.md`)
- Git bundle: `living-procurement-canvas-phase-1-2-82e11aa.bundle`
- `corrections-fixture-output-13aug.txt` — full raw output of the new fixture script (63/63 pass)
- `procurement-document-fixture-output-13aug.txt` — full raw output of the existing Phase 1 fixture script, re-confirmed unchanged (81/81 pass)

Remaining at the Phase 1 checkpoint. No Phase 2 work has begun. Nothing has been pushed, merged, rebased, or deployed.
