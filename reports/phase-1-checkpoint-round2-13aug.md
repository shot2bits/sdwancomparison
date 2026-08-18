# Living Procurement Canvas — Phase 1 Checkpoint (Round 2)

**Branch:** `living-procurement-canvas-phase-1-2` (from `origin/main` at `c08cc538d67c9f90db60f4c537393f4f7052681c`, unchanged and un-amended)
**Amended commit:** `03250f53a3fb659c3b3308955f2d882fffa065b5` — "Living Procurement Canvas Phase 1: checkpoint corrections (stable clause IDs, durable source-ledger wording, real command-boundary fixture, RFI bank reuse)" (this is the SAME commit slot as `82e11aa7a7494446ad5f119007f80bbe6c817d1a`, amended in place per your explicit instruction — not a new commit)
**Git bundle:** `living-procurement-canvas-phase-1-2-03250f5.bundle` (delivered alongside this report; contains the complete branch history, verified with `git bundle verify`)
**Status:** All four round-2 findings resolved and independently reviewable. Still at the Phase 1 checkpoint. Nothing pushed, merged, rebased, or deployed. `c08cc53` not amended.

To load the bundle into a fresh clone:
```
git clone living-procurement-canvas-phase-1-2-03250f5.bundle repo
cd repo && git checkout living-procurement-canvas-phase-1-2
```

---

## Summary of what changed since `82e11aa`

Your independent production-code probes found four remaining defects in the first correction. All four are fixed, each with fixtures that reproduce the failure mode you described before the fix (encoded directly as assertions against the real, unmodified production functions) and pass after it. One further, related bug surfaced while writing the round-2 fixtures for finding 3 (see below) — also fixed.

| # | Finding | Fix location | Fixture evidence |
|---|---|---|---|
| 1 | Clause identities changed after a real reload | `procurement-document.ts`: `stableClauseId()`/`assignStableIds()` | Item 1 (rewritten) |
| 2 | Source-ledger history not reduced chronologically | `procurement-templates.ts`: `chronologicalHistory()`/`operatingModelFromHistory()`/`supportHoursFromHistory()` | Item 2 (new) |
| 3 | Distinct source-turn occurrences deduplicated by text | `procurement-templates.ts`: `mergeReceiptsWithSourceLedger()`, `dedupeSourceTurnsById()` | Item 3 (new) |
| 4 | Change set and version not truthful | `procurement-document.ts`: `factSnapshotOf()`/`diffFacts()`, version-increment gate | Item 4 (new) |

All four fixes are confined to the Living Procurement Canvas compiler module itself (`procurement-document.ts`, `procurement-templates.ts`, `procurement-readiness.ts`) plus the fixture script and one new public field (`ProcurementClause.sourceTurnIds`). No extraction/tombstone/source-ledger/save/ownership/publishing code needed touching this round.

---

## 1. Clause identities still changed after a real reload

**Your finding:** the round-1 fix's `idRegistry` mechanism required `previousDocument` to be threaded from compile to compile. A real browser reload cannot supply that object, and your independent reproduction (compile DLP → add residency → remove DLP → recompile with `previousDocument=null`) showed residency's id changing from `SEC-02` to `SEC-01`.

**Fix (`procurement-document.ts`):** clause identity is now immutable and history-free. `stableClauseId(section, templateKey)` computes `` `${SECTION_CODES[section]}-${sha256(templateKey).slice(0,8)}` `` — a pure function of the clause's own `templateKey`, nothing else. `assignStableIds(drafts)` handles the astronomically-unlikely case of two different templateKeys hashing to the same base id within one compile via deterministic sorted-templateKey tie-breaking (never silent, never discovery-order-dependent). There is no separate "display code" field: per your own stated alternative ("treat them explicitly as display labels — not identity"), the immutable hash-based `id` **is** the id, and it is safe to show to a person. `LivingProcurementDocument.idRegistry` is removed entirely; nothing is persisted a second time to make identity work.

**Evidence — Item 1 (rewritten), `scripts/validate-procurement-canvas-corrections.ts`** (full output in `corrections-fixture-output-13aug-round2.txt`):

```
PASS  Item 1/insertion-before: DLP alone compiles with a well-formed immutable id (SECTION-<8 hex chars>, a hash of templateKey, no ordinal)  ->  id=SEC-693021ca
PASS  Item 1/history-free: a totally independent compile (no shared history whatsoever) of the SAME templateKey produces the IDENTICAL id  ->  chained=SEC-693021ca independent=SEC-693021ca
PASS  Item 1/insertion-before: adding an alphabetically-earlier clause does NOT change the surviving DLP clause's id
PASS  Item 1/insertion-before: the new residency clause gets its own well-formed, distinct id, independent of insertion order  ->  id=SEC-e83fb756
PASS  Item 1/removal-before: DLP is gone after "Remove DLP."
PASS  Item 1/removal-before: the surviving residency clause retains EXACTLY the same id after an unrelated removal
PASS  Item 1/THE ROBERT REPRODUCTION: recompiling the identical post-removal state with previousDocument=null (a genuine reload) does NOT renumber the surviving residency clause -- it keeps the exact same id an in-session recompile would  ->  mid-session id=SEC-e83fb756 previousDocument=null id=SEC-e83fb756
PASS  Item 1/THE ROBERT REPRODUCTION: DLP also stays correctly removed after the previousDocument=null recompile (not resurrected by the reload itself)
PASS  Item 1/removed-id-not-reassigned: the new ISO 27001 clause does NOT inherit DLP's old id (or residency's id)
PASS  Item 1/resurrection: DLP resurrects with EXACTLY its original id, not a new one and not a collision
PASS  Item 1: all three surviving security-section clauses carry three DISTINCT ids -- no collision anywhere in this scenario
PASS  Item 1+2/stable ids across reopen: network-architecture-scope / legacy-circuit-coexistence / uk-data-residency keep the SAME public id, WITH a previousDocument supplied
PASS  Item 1/THE ROBERT REPRODUCTION, applied to each: previousDocument=null and previousDocument=beforeDoc produce the IDENTICAL id -- previousDocument is now OPTIONAL for stability, not required
```

`Item 1/THE ROBERT REPRODUCTION` is your exact reproduction steps, encoded directly: compile DLP → add residency → remove DLP → recompile the same state a second time with `previousDocument: null`. The residency clause's id is identical in both compiles. Required fixtures all present: insertion before an existing clause, removal before a surviving clause, a brand-new clause after a removal, resurrection, a real recompile with `previousDocument=null`, same semantic clause same id in every case, a retired id never reassigned.

---

## 2. Source-ledger history must be reduced chronologically

**Your finding:** `operatingModelFromCorpus()` tested whether a phrase appeared anywhere in an unordered corpus string, so "We require a co-managed service." followed later by "We now require a fully managed service." incorrectly resolved to co-managed.

**Fix (`procurement-templates.ts`):** `chronologicalHistory(sourceTurns, receipts)` builds a `(at, original array position)`-ordered list of raw turn text, preferring the timestamped `sourceTurns` ledger and falling back to `receipts`' own order only when `sourceTurns` is empty (every existing Phase 1 fixture unaffected). `operatingModelFromHistory()` and `supportHoursFromHistory()` implement "the latest occurrence that states a signal wins" — never a bag-of-words presence test. A single occurrence naming two models is disambiguated by a correction-signal phrase ("instead of", "no longer", "now require", …); absent one, it is left genuinely unresolved and surfaced as a new `OD-operating-model-ambiguous-correction` open decision rather than guessed, per your instruction that "contradictions within the same unresolved instruction should still create an OpenDecision."

**Evidence — Item 2 (new)**:

```
PASS  Item 2/THE ROBERT REPRODUCTION: "co-managed" then, LATER, "fully managed" reduces to fully managed (managed), not co-managed  ->  model=managed
PASS  Item 2/THE ROBERT REPRODUCTION: the resolved state traces to the LATER turn's own id  ->  sourceTurnId=om_t2
PASS  Item 2/reverse direction: "fully managed" then, LATER, "co-managed instead" reduces to co-managed, not fully managed
PASS  Item 2/support-hours: 24/7 then, LATER, business-hours-only reduces to hours247=false
PASS  Item 2/support-hours (reverse): business-hours-only then, LATER, 24/7 incident support reduces to hours247=true, incidentSupport247=true
PASS  Item 2/unrelated intervening turn: an unrelated turn between the two operating-model statements does not disrupt the chronology -- fully managed still wins
PASS  Item 2/(at, position) ordering: array order is REVERSED from `at` order -- the reducer still resolves by `at`, not by array position
PASS  Item 2/(at, position) tie-break: two turns with the IDENTICAL `at` resolve by array position -- the later array entry wins
PASS  Item 2/same-turn contradiction: two model names in ONE occurrence with no correction signal is left unresolved (model stays null) and surfaced as ambiguousText, never guessed
PASS  Item 2/same-turn contradiction: the full compile surfaces OD-operating-model-ambiguous-correction as a real OpenDecision, not a silently dropped signal
PASS  Item 2/end-to-end: the compiled managed-service clause states fully managed (not co-managed) after the correction, with facts=[] so only the chronological reducer could have produced this
PASS  Item 2/save-reopen: create with the co-managed turn succeeds through the real route
PASS  Item 2/save-reopen: the fully-managed correction saves through the real rescope route
PASS  Item 2/save-reopen: both turns are durable in source_ledger after the real save
PASS  Item 2/save-reopen: after a REAL save+reopen+recompile with previousDocument=null, the managed-service clause reads fully managed (the correction survived and reduced chronologically, not co-managed)
PASS  Item 2/byte-equivalent recompilation: re-deriving the operating-model correction from the SAME source_ledger twice is byte-identical
```

Required fixtures all present: both correction directions, support-hours correction (both directions), an unrelated intervening turn, save/reopen, byte-equivalent recompilation — plus `(at, position)` ordering and same-turn-contradiction cases the finding's own wording implied.

---

## 3. Do not deduplicate distinct source-turn occurrences by text

**Your finding:** `mergeReceiptsWithSourceLedger`'s global exact-text `Set` discarded the final, byte-identical "We require DLP." restatement after "Remove DLP.", so DLP never resurrected.

**Fix (`procurement-templates.ts`):** `mergeReceiptsWithSourceLedger()` now dedupes only across the two *sources* (ledger-derived vs. the `receipts` compatibility input), never within the ledger-derived list itself. `dedupeSourceTurnsById()` collapses a genuine duplicate *delivery* of the same `SourceLedgerEntry.id` (a retried request), which is a different case from two different turn ids sharing text. `ProcurementClause` and `ClauseDraft` now carry `sourceTurnIds: string[]`, so provenance names the actual source-turn id(s), not just copied quote text.

**A related bug found while writing this fixture:** `additionalRequirementClauses()` checked whether a receipt was "already explained by clauses" *before* checking whether it was a repeat occurrence of a requirement the function had itself just accepted — so a second byte-identical occurrence was found "explained" by its own twin's freshly-created draft and discarded before the sourceTurnId-merge branch ever ran, silently narrowing provenance the fix was meant to widen. Fixed by reordering the checks: the repeat-occurrence merge now runs first.

**Evidence — Item 3 (new)**:

```
PASS  Item 3/THE ROBERT REPRODUCTION: "We require DLP." / "Remove DLP." / "We require DLP." -- the final, byte-identical restatement resurrects DLP (it is a genuinely distinct source-turn occurrence, not a duplicate to be discarded)
PASS  Item 3: the resurrected DLP clause's provenance names the actual restating source-turn id (dlp_t3), not just copied quote text
PASS  Item 3: replaying the identical three-turn ledger twice is byte-identical and idempotent
PASS  Item 3/identical repeat, no removal: the SAME requirement stated by two distinct source turns produces exactly ONE clause, not two duplicates
PASS  Item 3/identical repeat, no removal: the ONE emitted clause's provenance carries BOTH occurrences' source-turn ids
PASS  Item 3/duplicate delivery: the SAME source-turn id delivered twice collapses to ONE occurrence and ONE clause, with sourceTurnIds carrying the id only once
PASS  Item 3/save-reopen: the removal saves through the real rescope route
PASS  Item 3/save-reopen: the byte-identical restatement saves through the real rescope route as its own distinct turn
PASS  Item 3/save-reopen: all three turns (state, remove, byte-identical restate) are durable in source_ledger
PASS  Item 3/save-reopen: after a REAL save+reopen+recompile through three separate rescope calls, DLP is resurrected (the byte-identical restatement survived as its own occurrence, not discarded)
```

Required fixtures all present: identical restatement (your exact reproduction), identical repeated requirements without a removal, duplicate delivery of the same source-turn id, save/reopen/recompile.

---

## 4. Change set and versioning must be truthful

**Your finding:** `ProcurementChangeSet.facts` was hard-coded to `{added:[],updated:[],removed:[]}`, and the document version incremented on every call whenever `previousDocument` was supplied, regardless of whether anything changed.

**Fix (`procurement-document.ts`):** `factSnapshotOf(facts)` builds an `{factId: value}` snapshot of the standing facts, reusing `draft.ts`'s own `factId(path, value)` identity scheme. `diffFacts(prevSnapshot, nextSnapshot)` computes real added/updated/removed fact ids. `LivingProcurementDocument` carries `factSnapshot` and `receiptsSnapshot` on the already-returned document object — the same non-duplicate-persistence discipline the round-1 `idRegistry` field established, never a second persisted store. The version now increments only when `factsChanged || receiptsChanged` — a real fact-level or receipts-derived change — never merely because `previousDocument` was supplied. A document with no `previousDocument` always starts at version 1.

**Evidence — Item 4 (new)**:

```
PASS  Item 4/version: a document with no previousDocument always starts at version 1
PASS  Item 4/fact addition: changeSet.facts.added names the newly-added fact id
PASS  Item 4/one prompt, one increment: the fact addition bumps the version by EXACTLY one
PASS  Item 4/scalar correction: changeSet.facts.updated names the corrected fact id (same path, new value)
PASS  Item 4/one prompt, one increment: the scalar correction bumps the version by EXACTLY one
PASS  Item 4/list-value addition: changeSet.facts.added names the new list-value fact id
PASS  Item 4/list-value removal: changeSet.facts.removed names the struck list-value fact id, via the REAL dropListFact() function
PASS  Item 4/compiler-only clause addition: changeSet.clauses.added names the new DLP clause id, on a receipts-only change with facts held constant
PASS  Item 4/compiler-only clause addition: changeSet.facts stays completely flat -- a clause-only change is never misreported as a fact change
PASS  Item 4/one prompt, one increment: the compiler-only clause addition (a receipts-only change) still bumps the version by EXACTLY one
PASS  Item 4/compiler-only clause removal: changeSet.clauses.removed names the retracted DLP clause's own stable id
PASS  Item 4/one prompt, one increment: the compiler-only clause removal also bumps the version by EXACTLY one
PASS  Item 4/identical recompilation: recompiling the IDENTICAL facts and receipts does NOT increment the version
PASS  Item 4/identical recompilation: the change set itself is entirely empty on an identical recompile, not merely the version
PASS  Item 4/save-reopen: the first reopen (previousDocument=null, a genuine reload) starts a fresh chain at version 1
PASS  Item 4/save-reopen, no artificial increment: reopening the SAME saved project a second time and recompiling its identical state, WITH previousDocument supplied, does NOT bump the version -- previousDocument's mere presence is no longer sufficient to increment (THE bug Robert named)
PASS  Item 4/save-reopen, no artificial increment: a THIRD reopen lands on the SAME version as the first and second -- version is a function of real change, not of reopen count or previousDocument availability
```

Required fixtures all present: fact addition, scalar correction, list-value removal (via the real `dropListFact()`, the same function ProjectDesk's own row-drop button and typed "remove X" command call), compiler-only clause addition/removal (distinct from facts), identical recompilation with no version increment, one prompt producing exactly one increment, save/reopen with no artificial increment.

---

## Real route save/reopen/recompile evidence with `previousDocument=null`

Every finding above includes at least one fixture that goes through the real `POST /api/security-sourcing/project`, `POST /api/security-sourcing/project/[id]/rescope`, and `GET /api/rfp/[id]` route handlers (via the existing `fake-kv-harness.ts` in-memory KV emulator), then recompiles with `previousDocument: null` — a genuine reload, not an in-session recompile with history threaded. This is the exact condition your Finding 1 reproduction used and the round-1 fix failed under; it now passes for identity (Item 1), chronological reduction (Item 2), occurrence identity (Item 3), and version truthfulness (Item 4) alike.

---

## Quality gate

```
npx tsc --noEmit                : clean, zero errors
npm run validate                 : ALL PASS (every existing script, plus both procurement
                                    fixture scripts — 117 assertions in
                                    validate-procurement-canvas-corrections.ts, up from 64;
                                    86 in validate-procurement-document.ts, unchanged)
npm run lint                     : 118 problems (68 errors, 50 warnings) — byte-identical
                                    to the pre-existing baseline (confirmed via git stash),
                                    zero delta from this round's changes
npm run build                    : succeeds (sandbox-only font-fetch workaround applied
                                    and reverted; git diff --stat on src/app/layout.tsx
                                    is empty afterward)
```

Full output: `full-validate-output-13aug-round2.txt`, `build-output-13aug-round2.txt`, `corrections-fixture-output-13aug-round2.txt`, `procurement-document-fixture-output-13aug-round2.txt`.

---

## Delivery

- Amended commit: `03250f53a3fb659c3b3308955f2d882fffa065b5` (same commit identity as `82e11aa`, amended per your instruction)
- Git bundle: `living-procurement-canvas-phase-1-2-03250f5.bundle`
- Raw fixture output: `corrections-fixture-output-13aug-round2.txt` (117 PASS, 0 FAIL), `procurement-document-fixture-output-13aug-round2.txt` (86 PASS, 0 FAIL, unaffected)
- The four independent reproduction cases above, each encoded directly against your stated repro steps and now passing
- Real route save/reopen/recompile evidence using `previousDocument=null`, for all four findings
- TypeScript, full validate, lint-delta, and production-build results, all above

**Remaining at the Phase 1 checkpoint.** No Phase 2, no push, no merge, no deploy, pending your review.
