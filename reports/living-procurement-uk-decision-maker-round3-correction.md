# Living Procurement UK Decision-Maker Blueprint — correction pass round 3

**Branch:** `living-procurement-uk-decision-maker`
**New commit (not an amend):** `e7cc25f` — on top of `e9c16c5`, on top of `3d2c711`
**Status: STOPPED AT CHECKPOINT. Nothing in this chain has been pushed, merged or deployed.**

This round fixes the two release blockers your audit of round 2's own evidence found. Both were genuine bugs your review correctly caught fixtures reporting green while exhibiting the symptom in their own logged output — that failure mode is now closed, not just the two underlying bugs.

## Release blocker 1 — accepted → declined still left the requirement active

**Root cause.** `replayDecisionLedger()`'s own header comment already promised last-write-wins in both directions, but the implementation only ever handled one: an `accept` entry later than a `decline` correctly deleted the earlier decline, but a `decline` entry later than an `accept` never deleted the earlier accepted `ps-<suggestionId>` noted item. Since `compileProcurementDocument` only ever checks for that noted tag — never `declinedSuggestionIds` — a suggestion the buyer accepted and then changed their mind about kept compiling into the governed document indefinitely.

**Why the fixtures missed it.** The existing `acceptThenDecline` fixture in `verify-fact-ledger-reliability-gate.ts` asserted only `declinedSuggestionIds.includes(...)`, never checking that the earlier `noted` entry was actually gone — its own logged `result=` value already showed the stale accepted note present, and it still reported PASS. Separately, `validate-living-procurement-os-stage-a.ts`'s Fixture N never actually exercised `replayDecisionLedger()` at all for its accepted/declined sub-cases — it hand-built the `noted`/declined arrays directly, so it could never have caught a bug in the replay function itself.

**Fix.**
- `decision-ledger.ts`'s `decline_suggestion` branch now also removes the matching `ps-<suggestionId>` item from `noted` — last-write-wins holds in both directions.
- The `acceptThenDecline` fixture now asserts both halves: `declinedSuggestionIds` gains the id **and** the noted item is genuinely gone.
- New Fixture N2 (`validate-living-procurement-os-stage-a.ts`) drives the **real** `mergeDecisionLedger → replayDecisionLedger → compile` path this time (not a hand-built state), plus a full save (fake persisted project) → `resumeDecisionsFromProject` → reload → compile round trip, proving no governed clause remains. The opposite case — decline → accept — is preserved as the explicit counter-example, and does compile the clause.

## Release blocker 2 — readiness contradicted its own definition

**Root cause.** `materialDecisionCount()` deliberately excludes sector-suggestion-sourced candidates — they're optional, buyer-may-accept-or-ignore Netify recommendations, never a decision blocking consistent pricing. `buildReadiness()` contradicted that on both counts: it subtracted a `sectorPenalty` from the score for every pending suggestion (so declining one — pure queue-clearing, no requirement improved — raised the score), and its own reason text claimed the material-decision count "included" the pending suggestions it never actually counted.

**Fix.**
- No score contribution from `pendingSectorSuggestions` in either direction.
- The two concepts are now reported as two separate, honest sentences: `"3 material decisions remain (open decisions and unresolved earned questions)."` and, only when suggestions are actually pending, `"Separately, 2 optional Netify suggestions are available to review — these do not block consistent pricing and do not affect this score."`
- New Fixture O calls `buildReadiness()` directly with identical material-decision/section inputs and only `pendingSectorSuggestions` varied (0 vs 2) — proving the score is now unaffected either way, and that the phantom "including N pending sector suggestions" wording is gone.

## Readiness recalculated again

Removing the sector-suggestion penalty raises every pinned score by the amount it used to subtract (2, at Prompts A–D, since 2 suggestions are pending throughout this sequence):

| Prompt | Round 2 score | Round 3 score |
|---|---|---|
| A | 22 | **24** |
| B | 28 | **30** |
| C | 31 | **33** |
| D | 28 | **30** |

Confirmed against a fresh, live Playwright run of the identical A/B/C/D prompts (screenshots below) — not re-derived from round 2's stale numbers.

## Evidence delivered

1. New commit `e7cc25f`, on top of `e9c16c5`/`3d2c711`. Nothing pushed, merged or deployed.
2. Full-history git bundle `sdwan-round3.bundle` (verified, clean-room cloned, `npm install` → `tsc --noEmit` → `npm run validate` → `npm run build` all pass independently, clone deleted afterward).
3. Full validation output: `round3-full-validate-output.txt` (0 failures).
4. Stage A fixture-only output: `round3-full-fixture-output.txt`.
5. Decision-ledger fixture output: `round3-decision-ledger-fixture-output.txt` (Round 10, including the now-corrected `acceptThenDecline` assertion).
6. Machine-readable evidence: `living-procurement-uk-decision-maker-round3-evidence.json` — the corrected A/B/C/D state, the full accept→decline reversal lifecycle (ledger, replay, compile, save, reload — proving no governed clause survives), the preserved decline→accept counter-example, and the readiness-formula isolation proof (identical inputs, 0 vs 2 pending suggestions, identical score).
7. Updated screenshots: `mfg-01-desktop-after-fixtureA-round3.png` (readiness 24), `mfg-02-desktop-after-fixturesBCD-round3.png` (readiness 30), `mfg-03-mobile-390-round3.png` (390px, readiness 30).
8. Independent re-verification: `tsc --noEmit` clean; `npm run validate` 0 failures (238/238 in the Stage A fixture file, including the two new fixtures); `npm run validate:ui` 30/30 (existing UI suite, no regression); `npm run lint` 118 pre-existing problems, byte-identical to baseline; `npm run build` clean (sandbox font workaround applied then fully reverted).

Stopped here, at the checkpoint, for your review.
