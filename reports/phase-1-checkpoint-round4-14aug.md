# Living Procurement Canvas — Phase 1 Checkpoint (Round 4)

**Branch:** `living-procurement-canvas-phase-1-2` (from `origin/main` at `c08cc538d67c9f90db60f4c537393f4f7052681c`, unchanged and un-amended)
**Amended commit:** `0e3e7ac3ccc0d97bc50c2e31d6259f3a619685f8` — "Living Procurement Canvas Phase 1: checkpoint corrections (stable clause IDs, durable source-ledger wording, real command-boundary fixture, RFI bank reuse, direction-aware corrections, event-truthful versioning)" (the SAME commit slot as `82e11aa` → `03250f5` → `98bfa75` → `0e3e7ac`, amended in place a fourth time per your explicit instruction — not a second commit)
**Git bundle:** `living-procurement-canvas-phase-1-2-0e3e7ac.bundle` (delivered alongside this report; contains the complete branch history, verified with `git bundle verify`)
**Status:** All three functional defects fixed and the versioning integration contract addressed. Still at the Phase 1 checkpoint. Nothing pushed, merged, rebased, or deployed. `c08cc53` not amended.

To load the bundle into a fresh clone:
```
git clone living-procurement-canvas-phase-1-2-0e3e7ac.bundle repo
cd repo && git checkout living-procurement-canvas-phase-1-2
```

---

## Summary of what changed since `98bfa75`

Your independent audit found three remaining functional defects and one unproven integration contract in the third correction. Every case was reproduced directly against `98bfa75`'s real production functions before any code was touched (raw before/after: `round4-reproduction-before.json` / `round4-reproduction-after.json`). All four are fixed below, each with a structural mechanism rather than fixture-specific sentence lists, and adversarial fixtures that fail before the fix and pass after it.

| # | Finding | Fix location | Fixture evidence |
|---|---|---|---|
| 1 | Real ProjectDesk noted taxonomy not translated; 24/7 selection invisible to the document | `procurement-templates.ts`: `procurementSectionForNoted()`, `managedServiceClause()`, `notedClauses()`, `sourceNotedIds` | Item 1 (round 4) |
| 2 | Support-hours polarity resolved by whole-occurrence branch order, not mention-local | `procurement-templates.ts`: `clauseBoundsAround()`, `resolveOccurrenceHours()` | Item 2 (round 4) |
| 3 | Operating-model negation applied occurrence-wide, not mention-scoped | `procurement-templates.ts`: `modelMentionPolarity()`, `resolveOccurrenceModel()` | Item 3 (round 4) |
| 4 | No production-shaped proof the revision contract covers every governed event kind | `procurement-document.ts`: `resolveGovernedRevision()`, `diffFacts()`/`factSnapshotOf()` exported | Item 4 (round 4) |

All four fixes are confined to the Living Procurement Canvas compiler module (`procurement-document.ts`, `procurement-templates.ts`) plus the fixture script. No extraction/tombstone/source-ledger/save/ownership/publishing code needed touching this round.

---

## 1. Real noted-item taxonomy translation, and the 24/7-support reproduction

**Your finding:** round 3's `notedClauses()` was proven against a fabricated `{section: "operations"}` fixture, not a real ProjectDesk noted item. A stable, real 24/7-support selection (`twin-support-247`, real section `"support"`) had no visible effect on the document at all: compiling `"We require a fully managed service."` with vs without that selection was byte-identical, because `supportHoursFromHistory()` never read `noted`, and the noted item itself was silently suppressed by a generic 50%-word-overlap duplicate check against the managed-service clause's own boilerplate (`"support"` + `"required"` hit exactly half the significant words).

**Fix (`procurement-templates.ts`):** `procurementSectionForNoted(n)` is a new two-tier, exhaustive translator built from the real vocabulary in `src/lib/workspace/taxonomy.ts` (13 sections) and `src/components/ProjectDesk.tsx`'s own `note()`-call ids (`twin-res-*`, `twin-change-*`, `twin-support-*`, `twin-services-*`, `twin-commercial-*`, `twin-success-*`, `twin-suppliers-*`, `chip-mid-band`, …) — not a single crude section cast. `NOTED_ITEM_SECTION_OVERRIDE` handles ids that need finer-than-group classification (estate-resilience ids → network; each success-criteria id individually across network/operations/project, per its own stable id, per your instruction to use stable noted ids as primary semantic identity); `NOTED_SECTION_GROUP_DEFAULT` then falls back to the taxonomy's own 13 section strings (support → operations, services → project, suppliers → supplier, commercial → commercial, …); a pre-round-4-compatible passthrough honours a caller already supplying a valid `ProcurementSectionKey`; `"additional"` is the last resort, never an invalid section.

`managedServiceClause()` now also accepts `noted` and treats an explicit `twin-support-247`/`s-247` selection as an `hours247` signal alongside the existing text-derived one — a clicked selection now visibly changes the clause to "including 24/7 support" even with no supporting sentence, and still produces its own Operations-section noted clause when no operating model exists at all (never silently dropped). A new `sourceNotedIds: string[]` field on both `ClauseDraft` and `ProcurementClause` gives every clause a machine-readable citation of which stable noted id(s) it traces to — the explicit template coverage your finding required. `notedClauses()`'s duplicate suppression now checks this citation FIRST (`notedIdExplicitlyCovered()`) before falling back, **unchanged**, to the old generic-word-overlap check for concepts with no wired producer — fixing the false-positive suppression without weakening genuine duplicate suppression elsewhere (the pre-existing DLP-duplication fixture is untouched and still green). `NotedItem` gained `own?: boolean` (true only for a clicked multi-select landing, ProjectDesk's own tag); `notedClauses()`'s `reason` wording is now honest about provenance — a clicked selection is worded as a selection, never described as typed wording.

### Before / after — the real taxonomy translation

```
twin-res-all (estate resilience)        before=additional (BUG)   after=network
twin-change-cab (change/CAB)            before=additional (BUG)   after=operations
twin-support-uk (support desk)          before=additional (BUG)   after=operations
twin-services-mig (migration services)  before=additional (BUG)   after=project
sc-availability (success criterion)     before=additional (BUG)   after=network
twin-suppliers-ref (supplier refs)      before=additional (BUG)   after=supplier
```
(raw JSON: `round4-reproduction-before.json` / `round4-reproduction-after.json`, keys `item1_*_section`)

### Before / after — THE CRITICAL REPRODUCTION

```
"We require a fully managed service." compiled with noted=[] vs noted=[twin-support-247]:
  clause arrays byte-identical?   before=true (BUG)   after=false
  statement WITHOUT the selection:  "...with an agreed support model."               (unchanged, correct)
  statement WITH the selection:     before="...with an agreed support model." (BUG — selection invisible)
                                     after ="...including 24/7 support."      (fixed)
no-operating-model case: noted clause present=true both before/after; section  before=additional (BUG)  after=operations
```
(raw JSON: keys `item1_critical_byteIdentical`, `item1_critical_statementWithout`, `item1_critical_statementWith`, `item1_noModel_notedClausePresent`, `item1_noModel_notedSection`)

### Fixture evidence (`corrections-fixture-output-14aug-round4.txt`)

```
PASS  Item 1 (round 4)/real taxonomy: twin-res-all (estate resilience) lands in network, not additional  ->  section=network
PASS  Item 1 (round 4)/real taxonomy: twin-change-cab (change/CAB) lands in operations, not additional  ->  section=operations
PASS  Item 1 (round 4)/real taxonomy: twin-support-uk (support desk) lands in operations, not additional  ->  section=operations
PASS  Item 1 (round 4)/real taxonomy: twin-services-mig (migration services) lands in project, not additional  ->  section=project
PASS  Item 1 (round 4)/real taxonomy: sc-availability (a success criterion) lands in network by its own stable id  ->  section=network
PASS  Item 1 (round 4)/real taxonomy: twin-suppliers-ref (supplier references) lands in supplier, not additional  ->  section=supplier
PASS  Item 1 (round 4)/reason wording: a clicked (own:true) selection is worded as a selection, not typed wording
PASS  Item 1 (round 4)/reason wording: typed/extracted provenance (no own flag) is worded as stated wording
PASS  Item 1 (round 4)/THE CRITICAL REPRODUCTION: compiling with vs without the twin-support-247 selection is no longer byte-identical
PASS  Item 1 (round 4)/THE CRITICAL REPRODUCTION: without the selection, the managed-service clause reads the generic "with an agreed support model"
PASS  Item 1 (round 4)/THE CRITICAL REPRODUCTION: with the selection, the managed-service clause reads "including 24/7 support"
PASS  Item 1 (round 4)/THE CRITICAL REPRODUCTION: sourceNotedIds on the managed-service clause cites twin-support-247
PASS  Item 1 (round 4)/THE CRITICAL REPRODUCTION: no duplicate noted:twin-support-247 clause is created alongside the managed-service clause
PASS  Item 1 (round 4)/no operating model: the 24/7 selection still creates its own Operations-section requirement
```

---

## 2. Mention-local support-hours polarity

**Your finding:** round 3's fix only reordered which of two whole-occurrence regexes ran first; it never scoped either to the mention it governed. All four of your exact reproductions still resolved `hours247=true`: `"We don't need 24/7 support."`, `"24/7 support is not required."`, `"Remove 24/7 support."`, `"We require support, but not on a 24/7 basis."`.

**Fix (`procurement-templates.ts`):** `clauseBoundsAround(text, pos)` splits occurrence text on `.`/`;`/`,`/the word "but"` and returns the clause span containing a given character position — shared by this fix and item 3 below. `resolveOccurrenceHours(text)` finds every 24/7-style mention via a new global `MENTION_247_RE`, and for each mention's own clause only checks `HOURS_NEGATION_RE` (widened to include won't/will not) and `HOURS_REMOVAL_RE`; the last clause containing a mention decides the occurrence's polarity. Negation is honoured whether it precedes or follows the mention **within the same clause**, and a bare "24/7" token elsewhere in the occurrence can never override an explicit negative/removal clause. `supportHoursFromHistory()` keeps its exact exported signature. A standalone "business hours only" mention (no 24/7 token) remains an occurrence-wide negative signal, matching round 3's existing behaviour.

### Before / after — your exact reproduction text

```
"We don't need 24/7 support."                            expected=false   before=true (BUG)   after=false
"24/7 support is not required."                           expected=false   before=true (BUG)   after=false
"Remove 24/7 support."                                    expected=false   before=true (BUG)   after=false
"We require support, but not on a 24/7 basis."            expected=false   before=true (BUG)   after=false
```
(raw JSON: keys `item2_dont_need`, `item2_not_required`, `item2_remove`, `item2_but_not`)

### Fixture evidence

```
PASS  Item 2 (round 4)/THE REPRODUCTION: "We don't need 24/7 support." -> false  ->  got=false
PASS  Item 2 (round 4)/THE REPRODUCTION: "24/7 support is not required." -> false  ->  got=false
PASS  Item 2 (round 4)/THE REPRODUCTION: "Remove 24/7 support." -> false  ->  got=false
PASS  Item 2 (round 4)/THE REPRODUCTION: negation AFTER the mention, separated by a comma/but -> false  ->  got=false
PASS  Item 2 (round 4)/positive: "24/7 support required." stays true
PASS  Item 2 (round 4)/positive: "24/7 support is required." stays true
PASS  Item 2 (round 4)/positive: "24/7 incident support" (round 1-3 required fixture) stays true
PASS  Item 2 (round 4)/negation after: "not available 24/7"
PASS  Item 2 (round 4)/negation after: "never required"
PASS  Item 2 (round 4)/negation before: "won't require 24/7"
PASS  Item 2 (round 4)/removal before: "cancel the 24/7 support requirement"
PASS  Item 2 (round 4)/clause scoping: an unrelated earlier clause with no negation cue does not suppress a later positive mention
PASS  Item 2 (round 4)/clause scoping: a "not" in an EARLIER, unrelated clause does not falsely negate a later, plainly positive mention
PASS  Item 2 (round 4)/correction order: 24/7 asserted, then LATER negated -> false
PASS  Item 2 (round 4)/correction order: negated, then LATER asserted -> true
PASS  Item 2 (round 4)/save-reopen: create with the mention-local negation turn succeeds through the real route  ->  status=200 error=undefined
PASS  Item 2 (round 4)/save-reopen: after a REAL save+reopen+recompile with previousDocument=null, the mention-local negation survives ("with an agreed support model", not 24/7)
```

---

## 3. Mention-scoped operating-model negation

**Your finding:** round 3's `MODEL_REMOVAL_RE` still applied occurrence-wide — any removal-like phrase anywhere in the occurrence could negate the only model mention, even when the phrase was itself negated or applied to another object. All three of your exact reproductions resolved to `null` instead of `managed`: `"Do not remove the fully managed service."`, `"We do not want suppliers without a fully managed service."`, `"We no longer require co-managed; fully managed is required."`.

**Fix (`procurement-templates.ts`):** `modelMentionPolarity(id, clauseText)` is a new ordered, clause-scoped structural resolver run per model mention's own clause: an outer negation of the removal verb itself ("do not remove", "never cancel", within 20 chars) or of a want/accept verb before "without X" (within 40 chars) is a double negative and resolves to asserted/retained; a bare remove/drop/cancel, "no longer want/need/require", "don't/do not want/need/require", or "not `<this model's own phrase>`" resolves to negated; anything else resolves to asserted. `resolveOccurrenceModel()`'s existing instead-of/rather-than/from-to structural checks (round 3) still run **first, unchanged**, for the two-mention case — preserving every round-3 fixture byte-for-byte — and only when neither matches does a new polarity-pair fallback apply: if exactly one of two mentions is negated and the other asserted (either order), the asserted mention is the target model, never an unresolved removal. A genuine contradiction (both mentions asserted, or both negated, with no directional or polarity-pair structure) remains an honest `OpenDecision`, never guessed.

### Before / after — your exact reproduction text

```
"Do not remove the fully managed service."                        expected=managed   before=null (BUG)        after=managed
"We do not want suppliers without a fully managed service."       expected=managed   before=null (BUG)        after=managed
"We no longer require co-managed; fully managed is required."     expected=managed   before=null (BUG)        after=managed
```
(raw JSON: keys `item3_do_not_remove`, `item3_without`, `item3_no_longer_then_required`)

### Fixture evidence

```
PASS  Item 3 (round 4)/THE REPRODUCTION: "Do not remove the fully managed service." resolves to managed, never a removal  ->  got=managed
PASS  Item 3 (round 4)/THE REPRODUCTION: a double negative via "without" resolves to managed, never null  ->  got=managed
PASS  Item 3 (round 4)/THE REPRODUCTION: a negated old model followed by an asserted new model resolves to the new model, not ambiguous and not stale co_managed  ->  got=managed
PASS  Item 3 (round 4): the SAME structure in the OPPOSITE order (asserted new model first, negated old model second) also resolves to the new model  ->  got=managed
PASS  Item 3 (round 4)/regression: "co-managed instead of fully managed" still resolves to co_managed
PASS  Item 3 (round 4)/regression: "fully managed instead of co-managed" still resolves to managed
PASS  Item 3 (round 4)/regression: "change from co-managed to fully managed" still resolves to managed
PASS  Item 3 (round 4)/regression: a genuine two-model contradiction with no structural marker stays an unresolved OpenDecision (never guessed by the new polarity check)
PASS  Item 3 (round 4)/double negative: "will not drop" also retains the model  ->  got=co_managed
PASS  Item 3 (round 4)/double negative: "never cancel" also retains the model  ->  got=managed
PASS  Item 3 (round 4)/regression: a genuine, unnegated removal still unsets the model
PASS  Item 3 (round 4)/regression: "no longer want" (no outer negation) still unsets the model
PASS  Item 3 (round 4): a double-negated removal of one model, alongside an asserted second model, is a genuine contradiction -- correctly left unresolved, never silently guessed  ->  got=null
PASS  Item 3 (round 4)/end-to-end: the compiled managed-service clause states fully managed, not co-managed, from the single negated-then-asserted occurrence
```

---

## 4. A production-shaped governed-revision adapter

**Your finding:** the explicit revision contract (round 3, item 4) exists only in `procurement-document.ts` and manually-constructed fixtures; no production `compileProcurementDocument()` caller exists yet (acceptable at this compiler-only checkpoint), and the claim that the existing prompt-cycle counter covers all governed edits was wrong — `cycleRef` advances through `applyMerge()`, but noted selections/removals, direct requirement edits, and direct fact/list removals don't necessarily pass through it.

**Fix (`procurement-document.ts`):** `resolveGovernedRevision()` is a new, additive, **pure** reducer over `GovernedEvent -> GovernedRevisionState -> GovernedRevisionResult`, external to and non-breaking of the existing `CompilerRevision`/`resolveVersion()` contract (not replacing it — you asked not to wire the full Canvas UI this round). Identity model: `eventId` (stable and content-addressable — the same real action always produces the same id, used for replay detection) and `seq` (a per-session monotonic sequence, used only for staleness detection). `cycle` is never taken from the caller; it is the reducer's own internal count of *accepted* events, so a stale event has no cycle to assert in the first place. `changedFactIds` is always computed via a new exported `diffFacts(event.factsBefore, event.factsAfter)` — never a caller assertion; `GovernedEvent`'s own type carries no such field at all, so a caller cannot supply an untruthful claim even by accident. `event: null` represents a no-op render/reopen — not a sentinel object. `factSnapshotOf()`/`diffFacts()` are now exported so both the compiler and this adapter share the same snapshot/diff machinery.

The fixture drives all nine required event kinds sequentially through one reducer state, each fed into a real `compileProcurementDocument()` call:

### Fixture evidence

```
PASS  Item 4 (round 4): GovernedEvent's own type carries NO caller-asserted changedFactIds field at all -- the adapter always COMPUTES it from real factsBefore/factsAfter snapshots, so a caller cannot supply an untruthful claim even by accident
PASS  Item 4 (round 4)/baseline: before any governed event, a fresh compile is version 1  ->  version=1
PASS  Item 4 (round 4)/prompt cycle: a successful extraction event is accepted  ->  reason=applied
PASS  Item 4 (round 4)/prompt cycle: one accepted governed event increments exactly once  ->  before=1 after=2
PASS  Item 4 (round 4)/prompt cycle: changedFactIds is a REAL, non-empty diff, computed from the actual before/after fact snapshots  ->  ["estate.sites","organisation.sector","constraints.complianceRequirements:iso27001"]
PASS  Item 4 (round 4)/prompt cycle: the compiled document's own changeSet.facts genuinely reflects the addition
PASS  Item 4 (round 4)/click-selected fact: accepted  ->  reason=applied
PASS  Item 4 (round 4)/click-selected fact: exactly one increment  ->  before=2 after=3
PASS  Item 4 (round 4)/noted-item add: accepted even though NO WorkspaceFact changed -- a direct noted edit does not rely on a counter that only advances inside applyMerge()  ->  reason=applied
PASS  Item 4 (round 4)/noted-item add: exactly one increment  ->  before=3 after=4
PASS  Item 4 (round 4)/noted-item add: changedFactIds is honestly EMPTY (a real diff of two identical fact snapshots), never fabricated to look like a fact changed  ->  []
PASS  Item 4 (round 4)/noted-item remove: accepted  ->  reason=applied
PASS  Item 4 (round 4)/noted-item remove: exactly one increment  ->  before=4 after=5
PASS  Item 4 (round 4)/fact removal: accepted  ->  reason=applied
PASS  Item 4 (round 4)/fact removal: exactly one increment  ->  before=5 after=6
PASS  Item 4 (round 4)/fact removal: changedFactIds truthfully names the removed fact id  ->  ["constraints.complianceRequirements:iso27001"]
PASS  Item 4 (round 4)/fact removal: the compiled document's own changeSet.facts.removed genuinely reflects the removal
PASS  Item 4 (round 4)/direct requirement edit: accepted even though NO WorkspaceFact changed -- direct requirement edits cannot rely on a counter that only advances inside applyMerge()  ->  reason=applied
PASS  Item 4 (round 4)/direct requirement edit: exactly one increment  ->  before=6 after=7
PASS  Item 4 (round 4)/direct requirement edit: the document genuinely changed (title reflects the new sector)  ->  before=Healthcare & pharma procurement (20 sites) after=Financial services procurement (20 sites)
PASS  Item 4 (round 4)/no-op render/reopen: NOT applied, never increments  ->  reason=reopen
PASS  Item 4 (round 4)/no-op render/reopen: version unchanged  ->  before=7 after=7
PASS  Item 4 (round 4)/replay: the SAME event (identical eventId) replayed is NOT applied a second time  ->  reason=replay
PASS  Item 4 (round 4)/replay: version does not increment on replay  ->  before=7 after=7
PASS  Item 4 (round 4)/stale event: an older/out-of-order event (a lower seq than already applied) is REJECTED even though its eventId is distinct and would otherwise look like a new event  ->  reason=stale
PASS  Item 4 (round 4)/stale event: version does not increment for a stale event  ->  before=7 after=7
PASS  Item 4 (round 4)/stale event: the reducer's own monotonic cycle counter is untouched by a stale event -- cycle is derived internally from ACCEPTED events only, never taken from the event's own claim, so a stale event has no cycle to assert in the first place  ->  cycle=6
```

This is not wired into the Canvas UI — no production caller was added this round, per your instruction. It proves the contract is honestly implementable for every required event kind, ready for a real Phase 2 caller to adopt directly.

---

## Quality gate

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean, exit 0 |
| `validate-procurement-document.ts` | 81/81 PASS, unchanged from round 3 |
| `validate-procurement-canvas-corrections.ts` | **258/258 PASS**, up from 179 (79 new round-4 assertions) |
| `npm run validate` (full chain, every script) | Exit 0, 443 PASS lines, 0 FAIL |
| `npm run lint` vs round-4-isolated baseline (round 4's own diff stashed out) | **Byte-identical** — 118 problems (68 errors, 50 warnings) both with and without round 4's diff — zero new lint issues from round 4 |
| `npm run lint` vs true `c08cc53` baseline (via `git worktree`) | Same total (118 problems: 68 errors, 50 warnings); none of the three files round 4 touched appear in the lint output at all; the only content difference against `c08cc53` is the already-accepted round-1 `ProjectDesk.tsx` line-shift, not a round-4 regression |
| `npm run build` | Succeeds (sandbox-only `next/font/google` network workaround applied to `src/app/layout.tsx` and reverted; `git diff --stat` on that file shows zero diff both before commit and independently in the clean-room clone) |
| Clean-room verification | See below |

Raw output: `procurement-document-fixture-output-14aug-round4.txt`, `corrections-fixture-output-14aug-round4.txt`, `full-validate-output-14aug-round4.txt`, `build-output-14aug-round4.txt`, `lint-output-14aug-round4.txt`, `lint-baseline-c08cc53-round4.txt`, `round4-reproduction-before.json`, `round4-reproduction-after.json`, `cleanroom-validate-output-14aug-round4.txt`, `cleanroom-build-output-14aug-round4.txt`.

### Clean-room verification from the regenerated bundle

`git clone living-procurement-canvas-phase-1-2-0e3e7ac.bundle /tmp/cleanroom_r4`, checked out `living-procurement-canvas-phase-1-2` (landed on `0e3e7ac` — confirmed by `git log`), `npm ci` (clean install, no `node_modules` copied over from the working directory), then independently re-ran the full gate in that fresh clone:

- `npx tsc --noEmit`: clean.
- `npm run validate` (full chain, including both procurement fixture scripts): exit 0, 443 PASS, 0 FAIL — identical to the working-directory run.
- `npm run build`: succeeds (same sandbox-only font workaround applied and reverted in the clone; `git diff --stat` zero after revert).

This proves the regenerated bundle is self-contained and correct independent of the working directory's state. The clean-room clone was deleted after verification.

---

## Fixtures kept from Rounds 1–3

Every Round 1–3 fixture (179 assertions in `validate-procurement-canvas-corrections.ts`, 81 in `validate-procurement-document.ts`) passes unchanged this round. None of them encoded the defective behaviour this round's three fixes addressed, so none needed to change or be removed — this round is purely additive (81 + 258 = 339 total assertions across both fixture scripts, up from 81 + 179 = 260).

---

## Standing constraints (unchanged)

- Nothing pushed, merged, rebased, or deployed.
- `c08cc53` (the true original base) not amended — confirmed via `git cat-file -p c08cc53` and `git rev-parse HEAD~1` before and after this round's work; `HEAD~1` is still `c08cc53`.
- Only the Living Procurement Canvas compiler module was touched (`procurement-document.ts`, `procurement-templates.ts`) plus the fixture script; extraction/tombstone/source-ledger/save/ownership/publishing code was not touched (no reproducible regression required it this round either).
- Remains at the Phase 1 checkpoint pending your review. Awaiting your go-ahead before Phase 2.
