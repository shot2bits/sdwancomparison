# Fact Ledger Reliability Gate — Second Amendment, 13 August 2026

Commit `1ef8bc6` was **amended in place again** (`git commit --amend`, not a new commit, per your instruction) — it is now `8612832`, still the only commit on `fact-ledger-reliability-gate`, still on top of unmodified `origin/main` (`5e24698`). Nothing was pushed or merged. Canvas work was not started.

All five of Codex's second-pass blockers are fixed, each reproduced against **pre-amendment `1ef8bc6`** first (a throwaway probe script run from a detached worktree at that exact commit, deleted afterward — not part of the diff) to prove the failure is real and matches your report byte-for-byte, then re-verified fixed. `tsc --noEmit`, the amended reliability gate script (now 44/44), the existing `verify-correction-pass-2.ts` battery, `npm run validate`, and a full `next build` all pass clean.

## The five blockers, each with before/after evidence

### 1. Atomic, occurrence-aware residual coverage — conjunctions, semicolons, repeated predicates

Your four exact examples, run against `1ef8bc6` first:

| Buyer text | Before (`1ef8bc6`) | After (`8612832`) |
|---|---|---|
| "SASE plus Ethernet private circuit" | `unplaced=[]`, no bespoke — the circuit vanishes | `unplaced=["Ethernet private circuit."]` — a visible receipt, not silence |
| "SASE and require an Ethernet circuit" | `unplaced=[]`, no bespoke — vanishes | `requirements.bespoke=["require an Ethernet circuit."]` |
| "SASE but also require an Ethernet circuit" | `unplaced=[]`, no bespoke — vanishes | `requirements.bespoke=["also require an Ethernet circuit."]` |
| "SASE; we also require an Ethernet circuit" | `unplaced=[]`, no bespoke — vanishes | `requirements.bespoke=["we also require an Ethernet circuit."]` |

In every "before" case, SASE lands correctly but the second requirement is gone with no trace anywhere in the response — the exact silent loss you reported.

**Mechanism.** The narrow "and + article" whole-clause heuristic is replaced by `splitAtomicSpans()`: each declarative clause is first split into atomic sub-spans at coordinator/punctuation boundaries (`;`, `and`, `but`, `plus`, `as well as`), each keeping its own absolute character range in the original text. `coverDeclarativeClauses()` now checks coverage **per atomic unit**, not per whole clause: a unit is covered only if a real anchor's position falls inside its own span. An uncovered unit that reads as a genuinely new ask (its own verb — require/need/must/want — or, when the clause was actually split, a leading article) is filed as `requirements.bespoke` using only that unit's own text; anything else uncovered is conservatively kept as an unplaced review receipt, per your instruction 2, rather than guessed at or dropped.

I additionally added a direct unit test against the exported `coverDeclarativeClauses()` itself, with synthetic updates (no model, no rail), for the semicolon case — proving the mechanism itself, independent of which upstream path produced the anchor.

### 2. No whole-sentence duplication in `requirements.bespoke`

**"We need SASE and an Ethernet private circuit."**

- Before (`1ef8bc6`): `procurement.buying="sase"` **and** `requirements.bespoke=["We need SASE and an Ethernet private circuit."]` — the bespoke value is the entire sentence, including the word "SASE" a second time. Exactly the duplication you flagged.
- After (`8612832`): `procurement.buying="sase"` **and** `requirements.bespoke=["an Ethernet private circuit."]` — only the atomic unit's own uncovered text, no bespoke value contains "SASE".

This falls directly out of item 1's rewrite: because the SASE-covered atomic unit ("We need SASE") is now excluded before any escalation happens, only the residual unit's own text ever reaches `validate("requirements.bespoke", ...)`. A whole clause is never filed as bespoke when part of it is already structured.

I checked this doesn't reopen the "SD-WAN and full SASE" combined-ask case from the first amendment (where SD-WAN and SASE are the same buying intent, not two separate purchases): that regression guard still passes — exactly one bespoke entry (the genuine Ethernet-circuit clause), never a second one duplicating the combined ask. The one behavioural change there: the bare "full SASE" fragment (which, on inspection, was never separately captured as its own fact even before this round — only `estate.existingNetwork=["sdwan"]` was) now surfaces as an unplaced receipt rather than being silently declared "covered" by the SD-WAN anchor sitting earlier in the same clause. That's a more honest signal, not a regression — it satisfies "nothing lost" (a receipt, not silence) and instruction 2 explicitly allows exactly this outcome.

### 3. No more silent truncation of long captured clauses

**Your exact reported case, reproduced against `1ef8bc6` first:** a 5,021-character clause → `chunkCount=2`, `reconstructedLength=4000` — confirmed byte-for-byte: the old code preserved one additional 2,000-character segment on top of the first, and nothing past that.

- After (`8612832`): the same 5,021-character clause → `chunkCount=3`, `reconstructedLength=5021`, exact match.
- Additionally tested a 30,500-character clause requiring 16 chunks (past the old `.slice(0, 12)` list cap) → `chunkCount=16`, exact reconstruction, no truncation.

**Mechanism.** The one-remainder-chunk logic (plus its `.slice(0, 12)` list cap) is replaced with an unbounded `while` loop that walks the full string in `FREE_TEXT_CLAUSE_MAX` (2000-character) slices, pushing every slice into the value list with no cap on count. A note is still emitted when a clause is split, naming exactly how many parts it became, so the split stays visible rather than silent.

### 4. Tightened sector provenance

Four cases, each reproduced against `1ef8bc6` first:

| Buyer text | Before (`1ef8bc6`) | After (`8612832`) |
|---|---|---|
| "Healthcare" (exact, standalone) | `provenance: "inferred"` (fell through the direct map into the inference map) | `provenance: "stated"` |
| "Sector: Healthcare" | (not previously tested; now covered) | `provenance: "stated"` |
| "We are a Healthcare business." | `provenance: "stated"` (already correct) | `provenance: "stated"` — unchanged |
| "Our policy is Government approved." | `provenance: "stated"`, `value: "Government & public sector"` — **wrong**, off bare "is" | `organisation.sector` is **undefined** — neither stated nor inferred |

**Mechanism.** `SECTOR_SELF_ID_BEFORE` no longer accepts bare `is` as self-identifying language — "policy is", "response is", any "`<noun> is <Sector>`" no longer counts. It gains explicit sector-labelling recognition instead: "our sector is", "sector is", "sector:", "sector -". Separately, `sectorReadsAsBuyerIdentity()` gains a whole-message fallback: when the buyer's entire message (trimmed of surrounding punctuation) is nothing but the recognised sector word itself, that counts as a stated fact — there's no more literal way for a buyer to state their sector than typing only its name. Finally, `SECTOR_REQUIREMENT_OBJECT_AFTER` (the requirement-object exclusion list, shared by both the direct and inferred sector maps) gained approved/accredited/compliant/endorsed/assured, so "Government approved" is excluded from **both** maps — closing the hole where the inferred map would have quietly picked up what the direct map correctly refused.

### 5. The regression script is hermetic from its very first assertion

Previously, only the dedicated model-mocking block near the end of the script saved/cleared `ANTHROPIC_API_KEY` and stubbed `global.fetch` — every case above that point ran with no hermetic guard at all. If a real key were present in a build environment (Vercel), those earlier cases could have called the live model repeatedly.

**Fix.** `main()` now opens with a top-level hermetic wrap, before Regression 1's first assertion: the real `ANTHROPIC_API_KEY` (if any) is saved and deleted, and `global.fetch` is stubbed to throw on any call that isn't explicitly mocked, with a message naming the violation. The entire existing test body runs inside a `try`, with the real key and real `fetch` restored in an outer `finally` — guaranteed to run whether every case passes, a `record()` marks a failure, or an assertion throws outright. The script's own `process.exit(1)` on failure was moved outside this wrap, so the restore always happens before the process can exit.

I also added a dedicated proof that the save/restore is real, not decorative: the outer invocation seeds a fake `ANTHROPIC_API_KEY` (simulating what a real Vercel build key would look like from this script's point of view) **before** `main()` runs at all, then asserts it's back in place, unchanged, after the full suite completes.

## Full verification, this round

```
tsc --noEmit                                    clean
verify-fact-ledger-reliability-gate.ts           44/44 PASS (32 prior + 13 new, incl. the hermetic-wrap proof)
verify-correction-pass-2.ts                      ALL PASS (unaffected)
npm run validate (includes the gate above)       ALL PASS
next build --webpack                             Compiled successfully
```

The `next build` run needed the same sandbox-only workaround as both prior rounds (this container has no route to `fonts.googleapis.com`, which `next/font/google`'s `Inter()` call fetches at build time): I temporarily stubbed the font import, ran the build, confirmed success, then reverted the stub immediately — `git diff` against `src/app/layout.tsx` shows zero changes; it was never part of the amended commit.

## What did not change

Everything from the first two reports that wasn't one of this round's five blockers is untouched: paste/drop retention (`ProjectDesk.tsx`'s `ingestText()` fix), the canonical-display-label coverage fix, the hermetic model success/timeout/failure/unavailable tests, the drop/remove command's known non-adjacent-phrase limitation, the proposed `ProcurementCompilerInput` shape for Canvas Phase 1. No Canvas file was touched. No file outside `scripts/verify-fact-ledger-reliability-gate.ts` and `src/lib/workspace/extract.ts` changed this round.

## Delivery

Branch `fact-ledger-reliability-gate`, one commit (`8612832`, amended from `1ef8bc6`, itself amended from `c8fc3d1`) on top of `origin/main` (`5e24698`), bundled as `sdwan-reliability-gate-round3-13aug.bundle`:

```
cd ~/Downloads
git clone sdwan-reliability-gate-round3-13aug.bundle review-reliability-gate-round3
cd review-reliability-gate-round3
git push https://github.com/shot2bits/sdwancomparison.git fact-ledger-reliability-gate --force
```

`--force` is needed on the push because the commit hash changed under an amend (the branch tip moved, not history you'd already shared elsewhere) — your existing dirty `main` checkout is still never touched by any of this. Say the word when you want it merged.

Canvas work was not started, as instructed. Stopping here.
