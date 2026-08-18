# Living Procurement Canvas — Phase 1 Checkpoint (Round 3)

**Branch:** `living-procurement-canvas-phase-1-2` (from `origin/main` at `c08cc538d67c9f90db60f4c537393f4f7052681c`, unchanged and un-amended)
**Amended commit:** `98bfa75ae0542aded5ad6f05e23d7470910405bc` — "Living Procurement Canvas Phase 1: checkpoint corrections (stable clause IDs, durable source-ledger wording, real command-boundary fixture, RFI bank reuse, direction-aware corrections, event-truthful versioning)" (this is the SAME commit slot as `03250f53a3fb659c3b3308955f2d882fffa065b5` → `82e11aa7a7494446ad5f119007f80bbe6c817d1a`, amended in place per your explicit instruction — not a second commit)
**Git bundle:** `living-procurement-canvas-phase-1-2-98bfa75.bundle` (delivered alongside this report; contains the complete branch history, verified with `git bundle verify`)
**Status:** All four round-3 findings resolved and independently reviewable. Still at the Phase 1 checkpoint. Nothing pushed, merged, rebased, or deployed. `c08cc53` not amended.

To load the bundle into a fresh clone:
```
git clone living-procurement-canvas-phase-1-2-98bfa75.bundle repo
cd repo && git checkout living-procurement-canvas-phase-1-2
```

---

## Summary of what changed since `03250f5`

Your independent reproduction against bundle `living-procurement-canvas-phase-1-2-03250f5.bundle` found four remaining defects in the second correction, all reproduced directly against the real production functions. All four are fixed below, each with a small deterministic mechanism (not fixture-specific sentence lists) and adversarial fixtures that fail before the fix and pass after it.

| # | Finding | Fix location | Fixture evidence |
|---|---|---|---|
| 1 | Fixed-priority array picked the wrong model on a two-model correction sentence | `procurement-templates.ts`: `findModelSignals()` / `resolveOccurrenceModel()` | Item 1 (new block) |
| 2 | `HOURS_247_RE` checked before `BUSINESS_HOURS_ONLY_RE` — negative language misclassified positive | `procurement-templates.ts`: `supportHoursFromHistory()` | Item 2 (new block) |
| 3 | `ProcurementCompilerInput.noted` accepted but never read | `procurement-templates.ts`: `notedClauses()`, wired into `buildCandidateClauses()` | Item 3 (new block) |
| 4 | Version gate checked only `facts`/`receipts`, missing direct document/requirement edits | `procurement-document.ts`: `CompilerRevision`, `resolveVersion()` | Item 4 (new block) |

All four fixes are confined to the Living Procurement Canvas compiler module (`procurement-document.ts`, `procurement-templates.ts`) plus the fixture script. No extraction/tombstone/source-ledger/save/ownership/publishing code needed touching this round.

---

## 1. Direction-aware operating-model corrections

**Your finding:** `operatingModelFromHistory()`'s chronological reducer (added in round 2) still resolved a *single occurrence naming two models* by `MANAGED_MODEL_PHRASE_RE`'s fixed array order (co_managed listed first) — so "We now require fully managed instead of co-managed." and "Change from co-managed to fully managed." both incorrectly resolved to `co_managed`, regardless of the sentence's actual direction.

**Fix (`procurement-templates.ts`):** not a list of fixture-specific sentences, but a small deterministic directional reducer. `findModelSignals(text)` locates every model mention with its character position, de-overlapping same-span matches (`MANAGED_MODEL_PHRASE_RE`'s array order now serves *only* this same-span overlap role, never cross-mention resolution). `resolveOccurrenceModel(text)` structurally parses one occurrence: a single mention with removal/negation language (`remove`/`drop`/`cancel`/`no longer want-need-require`/`not <model phrase>`) is an honest unset, never a positive assertion; two mentions joined by "instead of"/"rather than" resolve to the **first-named** model (works for either phrasing direction); two mentions joined by "from … to …" resolve to the **second-named** model; anything else is left `ambiguous` and surfaced, never guessed. `operatingModelFromHistory()` walks the chronological occurrence list applying this per-occurrence.

### Before / after — your exact reproduction text

```
"We now require fully managed instead of co-managed."   expected=managed   before=co_managed (BUG)   after=managed
"Change from co-managed to fully managed."               expected=managed   before=null (BUG)         after=managed
```
(raw JSON: `round3-reproduction-before.json` / `round3-reproduction-after.json`, keys `item1_t1a_expected_managed` / `item1_t1b_expected_managed`)

### Fixture evidence (`corrections-fixture-output-14aug-round3.txt`)

```
PASS  Item 1/THE ROBERT REPRODUCTION: "fully managed instead of co-managed" resolves to managed, not co_managed  ->  model=managed
PASS  Item 1/THE ROBERT REPRODUCTION: "change from co-managed to fully managed" resolves to managed  ->  model=managed
PASS  Item 1: "co-managed instead of fully managed" -> co_managed
PASS  Item 1: "fully managed instead of co-managed" -> managed
PASS  Item 1: "change from co-managed to fully managed" -> managed
PASS  Item 1: "change from fully managed to co-managed" -> co_managed
PASS  Item 1: "fully managed rather than co-managed" -> managed
PASS  Item 1: "co-managed rather than fully managed" -> co_managed
PASS  Item 1: an unrelated intervening turn between two directional corrections does not disrupt the LATER one winning
PASS  Item 1: two models with no directional correction language stays unresolved (model=null), surfaced as ambiguousText  ->  {"model":null,"sourceTurnId":null,"ambiguousText":"We might want fully managed or co-managed, no strong preference either way."}
PASS  Item 1: the full compile surfaces the ambiguous-correction OpenDecision for two models with no directional language
PASS  Item 1: assert co-managed, then "Remove co-managed." with no replacement, unsets the model (result.model=null)  ->  {"model":null,"sourceTurnId":null,"ambiguousText":null}
PASS  Item 1/removal without replacement, end to end: no managed-service clause is compiled once the model is unset (no stale assertion)
PASS  Item 1/removal without replacement, end to end: the honest OD-operating-model-unstated decision fires -- the existing document contract, not a new mechanism  ->  ["OD-operating-model-unstated","OD-timeline-unstated"]
```

Also covered, not shown above for brevity: both directions in separate chronological turns, identical-timestamp array-position tie-break (matching round 2's `(at, position)` scheme), and "no longer want co-managed" as a negative assertion (never positively asserts `co_managed`).

---

## 2. Support-hours polarity

**Your finding:** `supportHoursFromHistory()` checked `HOURS_247_RE` before `BUSINESS_HOURS_ONLY_RE`, so negative language containing the literal token "24/7" was classified positive: "We no longer need 24/7 support; business hours only." and "Support is not 24/7." both incorrectly resolved `hours247=true`.

**Fix (`procurement-templates.ts`):** pure branch-order fix, no new regex needed — `BUSINESS_HOURS_ONLY_RE` (already covering the negative/replacement phrasings) is now evaluated **before** `HOURS_247_RE`, so a negative match always wins over a co-occurring positive token.

### Before / after — your exact reproduction text

```
"We no longer need 24/7 support; business hours only."   expected=false   before=true (BUG)   after=false
"Support is not 24/7."                                    expected=false   before=true (BUG)   after=false
```
(raw JSON: `round3-reproduction-before.json` / `round3-reproduction-after.json`, keys `item2_t2a_expected_false` / `item2_t2b_expected_false`)

### Fixture evidence

```
PASS  Item 2: "24/7 support" -> true
PASS  Item 2: "24/7 incident support" -> hours247=true and incidentSupport247=true  ->  {"hours247":true,"incidentSupport247":true,"sourceTurnId":"t1"}
PASS  Item 2/THE ROBERT REPRODUCTION: "Support is not 24/7." -> false  ->  hours247=false
PASS  Item 2/THE ROBERT REPRODUCTION: "We no longer need 24/7 support; business hours only." -> false  ->  hours247=false
PASS  Item 2: "business hours only" -> false
PASS  Item 2: "not 24/7; business hours only" -> false
PASS  Item 2: 24/7 followed LATER by business-hours-only -> false
PASS  Item 2: business-hours-only followed LATER by 24/7 -> true
PASS  Item 2/save-reopen: the negation turn saves through the real rescope route
PASS  Item 2/save-reopen: after a REAL save+reopen+recompile with previousDocument=null, the managed-service clause reads "with an agreed support model" (the negation survived), not 24/7
```

---

## 3. Honour the compiler's `noted` input

**Your finding:** `ProcurementCompilerInput.noted` existed but was never read — compiling with a noted item present vs `noted: []` was byte-identical, contradicting the brief's own "facts, noted items and receipts remain sources of truth."

**Fix (`procurement-templates.ts`):** `notedClauses(noted, alreadyCovered)` converts the buyer's *current* noted-item selection (not an append-only ledger — removal is simply "absent from this compile's array") into `ClauseDraft`s keyed by the noted item's own stable id (`` `noted:${n.id}` ``, immune to reordering/relabeling), reusing the pre-existing `receiptIsExplainedByClauses()` helper to suppress a noted item already substantively covered by a standing-fact/deterministic-template clause or an earlier noted item in the same compile. No new fact store, no invented buyer facts. Wired into `buildCandidateClauses()`; flows through the existing `diffIds`-based change-set computation with zero extra change-set code.

### Before / after

```
noted=[{id:"s-247", label:"24/7 proactive monitoring of the WAN estate", section:"operations"}]
withNoted has a "noted:s-247" clause?   before=false (BUG — noted input silently ignored)   after=true
```
(raw JSON: keys `item3_withoutNoted_hasNotedClause` / `item3_withNoted_hasNotedClause`)

### Fixture evidence

```
PASS  Item 3/baseline: compiling with noted=[] produces no noted-selection clause -- THE BUG, confirmed present before the fix's own positive case
PASS  Item 3/THE FIX: adding one noted item changes the compiled document -- a real clause is now emitted for it (was byte-identical before)
PASS  Item 3: the noted clause's section is honoured and buyer provenance remains explicit  ->  {"section":"operations","origin":"buyer"}
PASS  Item 3: the clause's templateKey is keyed by the noted item's own STABLE id, not array position or copied label text alone  ->  templateKey=noted:s-247
PASS  Item 3: the change set reports the noted clause's addition  ->  {"added":["OPS-9ee3a489"],"updated":[],"removed":[]}
PASS  Item 3: removing the noted item reverses the output -- the clause is gone
PASS  Item 3: the change set reports the noted clause's removal  ->  {"added":[],"updated":[],"removed":["OPS-9ee3a489"]}
PASS  Item 3: an unchanged noted set is idempotent -- two independent compiles produce byte-identical output
PASS  Item 3: array reordering of the noted set does not change semantic identities -- the SAME two ids regardless of order  ->  {"idsAB":["OPS-11d58fca","OPS-9ee3a489"],"idsBA":["OPS-11d58fca","OPS-9ee3a489"]}
PASS  Item 3/no-duplication: a noted item substantively covered by the DLP template's own clause does NOT emit a second, redundant clause
```

---

## 4. Event-truthful versioning

**Your finding:** the version gate checked only `changeSet.facts` and `receiptsSnapshot`. Your exact reproduction: compile an empty requirement (title "Sourcing procurement", version 1), then recompile with the same facts/receipts but `requirement.organisation.sector = "Healthcare & pharma"` — a security clause is added and the title changes, but the version incorrectly remained 1.

**Fix (`procurement-document.ts`):** a pure compiler cannot reliably infer a successful prompt/edit event merely from facts and receipts, so a new explicit, typed `CompilerRevision` (`{cycle, changedFactIds}`) is threaded through `ProcurementCompilerInput.revision` — reusing the *same* prompt-cycle counter every existing caller already threads and the *same* `MergeResult.changed` array, not a new concept, just newly reported to the compiler. `resolveVersion()` increments exactly once per new cycle when `revision` is adopted, treats a replayed identical cycle as a no-op, and treats `revision: null` as an explicit no-authorised-event signal. Callers that omit `revision` entirely keep round 2's fact/receipts-only gate byte-for-byte unchanged — a deliberate, tested backward-compatible fallback.

### Before / after — your exact reproduction

```
doc0: title="Sourcing procurement", version=1
doc1 (same facts/receipts, organisation.sector="Healthcare & pharma" set directly, revision={cycle:1,...}):
  title="Healthcare & pharma procurement"  (changed correctly both before and after)
  version:  before=1 (BUG — title changed, version did not)   after=2 (fixed)
```
(raw JSON: keys `item4_doc0_version`, `item4_doc1_version`, `item4_titleChanged`, `item4_versionIncremented`)

### Fixture evidence

```
PASS  Item 4/THE ROBERT REPRODUCTION baseline: compiling an empty requirement gives title "Sourcing procurement", version 1  ->  title=Sourcing procurement version=1
PASS  Item 4/THE ROBERT REPRODUCTION: the title genuinely changes with the sector  ->  before=Sourcing procurement after=Healthcare & pharma procurement
PASS  Item 4/THE ROBERT REPRODUCTION, fixed: under the explicit revision contract, the version now advances even though facts/receipts alone were unchanged  ->  before=1 after=2
PASS  Item 4/documented boundary: the SAME reproduction through the LEGACY no-revision path (omitted entirely) still preserves round-2 behaviour for backward compatibility -- callers must adopt `revision` to get event-truthful versioning  ->  version=1
PASS  Item 4: an identical rerender with the SAME revision (cycle 1 again) does not increment  ->  version=2
PASS  Item 4: one successful prompt revision (a new cycle) increments exactly once  ->  before=2 after=3
PASS  Item 4: one direct noted-item edit (its own authorised revision) increments exactly once  ->  before=3 after=4
PASS  Item 4: one direct requirement/document edit increments exactly once  ->  before=4 after=5
PASS  Item 4/fact-only correction: exactly one increment  ->  before=1 after=2
PASS  Item 4/fact-only correction: truthful fact ids -- changeSet.facts.updated (the REAL diff) names the corrected fact  ->  {"added":[],"updated":["constraints.timeline"],"removed":[]}
PASS  Item 4/fact-only correction: the document's own lastRevision carries the caller-asserted changed fact ids for truthful audit  ->  {"cycle":2,"changedFactIds":["constraints.timeline"]}
PASS  Item 4/receipt-only change: a compiler-only clause addition (receipts changed, facts did not) still increments exactly once under an authorised revision  ->  before=1 after=2
PASS  Item 4/no-op recompile: revision=null (no authorised event) never increments, even with inputs identical to the previous compile  ->  version=2
PASS  Item 4/invariant: sector requirement edit -- a non-empty change set during an authorised revision coexists with the version advancing by EXACTLY one, never an unchanged version  ->  nonEmpty=false before=2 after=3
PASS  Item 4/invariant: noted-item edit -- a non-empty change set during an authorised revision coexists with the version advancing by EXACTLY one, never an unchanged version  ->  nonEmpty=true before=3 after=4
PASS  Item 4/invariant: requirement/timeline edit -- a non-empty change set during an authorised revision coexists with the version advancing by EXACTLY one, never an unchanged version  ->  nonEmpty=false before=4 after=5
PASS  Item 4/invariant: fact-only correction -- a non-empty change set during an authorised revision coexists with the version advancing by EXACTLY one, never an unchanged version  ->  nonEmpty=true before=1 after=2
PASS  Item 4/invariant: receipt-only change -- a non-empty change set during an authorised revision coexists with the version advancing by EXACTLY one, never an unchanged version  ->  nonEmpty=true before=1 after=2
PASS  Item 4/invariant: at least one authorised revision above produced a genuinely non-empty change set -- the invariant fixture is not vacuous
PASS  Item 4/save-reopen: the first reopen (previousDocument=null, a genuine reload) starts a fresh chain at version 1  ->  version=1
PASS  Item 4/save-reopen, no artificial increment: reopening the SAME saved project a second time and recompiling its identical state, WITH previousDocument supplied, does NOT bump the version -- previousDocument's mere presence is no longer sufficient to increment (THE bug Robert named)  ->  version=1
PASS  Item 4/save-reopen, no artificial increment: a THIRD reopen lands on the SAME version as the first and second -- version is a function of real change, not of reopen count or previousDocument availability  ->  version=1
PASS  Item 4/save-reopen: a genuine reload (previousDocument=null) starts a fresh in-memory chain at version 1  ->  version=1
PASS  Item 4/save-reopen: a SECOND independent reload also lands on version 1 -- no second persisted document was needed to preserve any counter across reloads  ->  version=1
```

Note the `documented boundary` line above is deliberate, not an oversight: it proves the *legacy* no-`revision` call path (every caller that predates this round) still behaves exactly as round 2 left it — callers must opt in to `revision` to get event-truthful versioning. No existing caller was silently changed.

---

## Quality gate

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean, exit 0 |
| `validate-procurement-document.ts` | 81/81 PASS, unchanged from round 2 |
| `validate-procurement-canvas-corrections.ts` | **179/179 PASS**, up from 117 |
| `npm run validate` (full chain, every script) | Exit 0, 0 FAIL lines |
| `npm run lint` vs round-3-isolated baseline (round 3's own diff stashed out) | **Byte-identical** — zero new lint issues from round 3 |
| `npm run lint` vs true `c08cc53` baseline (via `git worktree`) | Same total (118 problems: 68 errors, 50 warnings); the only file with any content difference is `ProjectDesk.tsx`, which is round 1's already-accepted line-shift, not a round-3 regression |
| `npm run build` | Succeeds (sandbox-only `next/font/google` network workaround applied to `src/app/layout.tsx` and reverted; `git diff --stat` on that file shows zero diff both before commit and independently in the clean-room clone) |
| Clean-room verification | See below |

Raw output: `procurement-document-fixture-output-14aug-round3.txt`, `corrections-fixture-output-14aug-round3.txt`, `full-validate-output-14aug-round3.txt`, `build-output-14aug-round3.txt`, `lint-output-14aug-round3.txt`, `lint-baseline-c08cc53.txt`, `round3-reproduction-before.json`, `round3-reproduction-after.json`.

### Clean-room verification from the regenerated bundle

New this round, per your instruction. `git clone living-procurement-canvas-phase-1-2-98bfa75.bundle /tmp/cleanroom_r3`, checked out `living-procurement-canvas-phase-1-2` (landed on `98bfa75` — confirmed by `git log`), `npm ci` (377 packages, clean install, no `node_modules` copied over from the working directory), then independently re-ran the full gate in that fresh clone:

- `npx tsc --noEmit`: clean.
- `validate-procurement-document.ts`: 81/81 PASS.
- `validate-procurement-canvas-corrections.ts`: 179/179 PASS.
- `npm run validate` (full chain): exit 0, 0 FAIL.
- `npm run build`: succeeds (same sandbox-only font workaround applied and reverted in the clone; `git diff --stat` zero after revert).

This proves the bundle is self-contained and correct independent of the working directory's state — nothing in the working directory (stray `node_modules`, uncommitted files, environment state) was propping up round 3's result. The clean-room clone was deleted after verification.

---

## Standing constraints (unchanged)

- Nothing pushed, merged, rebased, or deployed.
- `c08cc53` (the true original base) not amended — confirmed via `git cat-file -p c08cc53` before and after this round's work.
- Only the Living Procurement Canvas compiler module was touched (`procurement-document.ts`, `procurement-templates.ts`) plus the fixture script; extraction/tombstone/source-ledger/save/ownership/publishing code was not touched (no reproducible regression required it this round either).
- Remains at the Phase 1 checkpoint pending your review. Awaiting your go-ahead before Phase 2.
