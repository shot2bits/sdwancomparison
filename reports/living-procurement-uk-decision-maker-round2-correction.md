# Living Procurement UK Decision-Maker Blueprint — correction pass round 2

**Branch:** `living-procurement-uk-decision-maker`
**New commit (not an amend):** `e9c16c5` — on top of `3d2c711`
**Status: STOPPED AT CHECKPOINT. Neither `3d2c711` nor `e9c16c5` has been pushed, merged or deployed.**

This round is a narrowly contained correction on top of the previous checkpoint (`3d2c711`), which you rejected. Both defects you named — read from `3d2c711`'s own machine-readable evidence and screenshots, not from a fresh guess — are fixed, fixture-covered, and re-verified end to end (types, full validate suite, lint parity, a real UI Playwright pass, a clean-room bundle clone/build). Nothing outside the two named defects was touched.

## Defect 1 — q-resilience not resolved by the canonical resilience clause

**Root cause.** `q-resilience` (`src/lib/workspace/questions.ts`) is earned purely from site count and buying type. It had no notion of the compiled `site-resilience-scope` clause, so it kept reappearing in the ranked NextQuestion list, the visible top three, and `materialDecisionsRemaining` even after the buyer's exact answer ("Yes, dual circuits at our five production-critical sites. Single circuits are acceptable elsewhere.") had already compiled into the governed document.

**Fix.**
- New shared, non-circular helper `siteResilienceClauseExists(clauses)` (`src/lib/workspace/procurement-outline.ts`), which `deriveResilienceOutlineState()` now uses internally (no behaviour change to that function).
- `procurement-next-questions.ts`'s `Ctx` gets a new optional `resilienceClauseResolved?: boolean` field; `rankNextQuestions()` drops `q-resilience` from its candidate loop when true. `materialDecisionCount()` inherits the same fix (it calls `rankNextQuestions()` internally).
- `ProjectDesk.tsx` computes `resilienceClauseResolved = siteResilienceClauseExists(compiledDocument.clauses)` and threads it into both `rankNextQuestions()`/`materialDecisionCount()` calls — the same signal the outline row already used, so the two surfaces can no longer drift apart.
- **Resolution is driven by the governed clause, never by a card being clicked or dismissed** — the exact instruction. The fixture proves the counter-example too: with the identical earned/open-decision state but no clause, `q-resilience` correctly stays open.

**Fixture coverage** (`scripts/validate-living-procurement-os-stage-a.ts`, Fixture K3): after Prompt B —
- `site-resilience-scope` clause exists (already proven by the prior round's K1, re-confirmed here);
- the outline's Resilience row reads Confirmed;
- `q-resilience` is absent from the **full** ranked list, not just the top three;
- `materialDecisionsRemaining` decreases by exactly one (an apples-to-apples comparison against the identical state with the flag forced off);
- the readiness reason literally cites the corrected count (`"3 material decisions remain..."`, not the stale unfiltered `4`);
- the state survives a reload (`previousDocument: null`, recompiled fresh from facts);
- counter-example: with `resilienceClauseResolved` not supplied, `q-resilience` stays open.

## Defect 2 — an unaccepted sector suggestion was compiling into a governed clause

**Root cause.** `sectorClauses()` (`src/lib/workspace/procurement-templates.ts`) unconditionally compiled `pack.suggestions[0]` into a governed `sector-pack-suggestion` clause the instant a sector pack activated — before the buyer had ever seen or accepted it. It also only ever looked at index 0, so a second suggestion (e.g. manufacturing's own `mf-segmentation`) could never reach this path even once genuinely accepted.

**Fix.** Split the function in two:
- **New** `acceptedSectorSuggestionClauses(pack, flavours, noted)` compiles a suggestion **only** once its `ps-<suggestion.id>` tag is present in `noted` — the same signal `ProjectDesk.tsx`'s `answerNextQuestion` already writes on Accept, and the same one `sector/derive.ts`'s `visibleSuggestions()` already reads to drop an accepted suggestion from the pending list. One signal, not two independently-tracked copies. Origin is always `"sector"` (never `"buyer"`); the reason string states both halves honestly: *"...Netify suggested this; the buyer accepted it."*
- `sectorClauses()` is now scoped to only the flavour risk-note compiler (unaffected, unnamed by your report, deliberately left untouched).
- Wired into `buildCandidateClauses()`'s `factDriven` array, ahead of the (now risk-note-only) `sectorClauses()` call.

**Fixture coverage** (Fixture N, all four required states):
- **Pending** (Prompt A alone): no `sector-pack-suggestion` clause; Requirements count untouched; no supplier response-group question or evaluation-gate reference; Evaluation category weights still sum to 100; visible only as a governed, "Netify suggests / optional" NextQuestion card with reason and Accept/Not needed.
- **Accepted**: exactly one governed clause; `origin: "sector"`; honest reason; document version increments exactly once; removed from the pending-suggestion projection; a reload (`previousDocument: null`) from the same facts/noted state reproduces the identical clause with the identical stable id.
- **Declined**: no clause created; decline persists in the pending-suggestion projection (`visibleSuggestions` fed by `declinedSuggestionIds`); does not reappear after reload.
- **Resumed**: both the accepted and declined states are also driven through the real `decision_ledger` machinery (`mergeDecisionLedger` → `replayDecisionLedger` → `resumeDecisionsFromProject`) — see the machine-readable lifecycle evidence below.

## Readiness recalculated only after both fixes — not before

Per your instruction, the A→B→C→D readiness progression was **not** re-pinned until both defects were verified semantically correct. The corrected progression:

| Prompt | Score (was) | Score (now) | Material decisions | Sections confirmed |
|---|---|---|---|---|
| A | 22 | **22** | 4 | 2/10 |
| B | 25 | **28** | 3 | 3/10 |
| C | 28 | **31** | 2 | 3/10 |
| D | 25 | **28** | 3 | 3/10 |

The old progression (22 → 25 → 28 → 25) was an accurate measurement of the *buggy* behaviour, not a correct target — B and D were previously undercounted because `q-resilience` was still being counted as an unresolved material decision after it had already been answered. The new numbers were confirmed against a freshly rendered, real Playwright run of the identical A/B/C/D prompt sequence (screenshots below), not re-derived from the stale round-1 screenshot.

Every readiness reason now reconciles exactly with the outline and the ranked-question list — checked directly in Fixture K3 (`readinessB.materialDecisionsRemaining === materialDecisionCount(...)`, and the readiness reason string literally cites the same number).

## Evidence delivered

1. **New commit**, not an amend: `e9c16c5`, on top of `3d2c711`. Neither has been pushed, merged or deployed.
2. **Full-history git bundle**: `sdwan-round2.bundle` (verified with `git bundle verify`, cloned into a clean directory, `npm install` → `tsc --noEmit` → `npm run validate` → `npm run build` all pass independently of this working tree, which was then deleted).
3. **Full validation output**: `round2-full-validate-output.txt` (`npm run validate`, 0 failures across every script in the chain, including the pre-existing decision-ledger/resume suite).
4. **Decision-ledger/resume fixture output**: `round2-decision-ledger-fixture-output.txt` (Round 10's own real-route persistence/replay fixtures, re-confirmed unaffected by this round's changes).
5. **Machine-readable A/B/C/D state and sector-suggestion lifecycle**: `living-procurement-uk-decision-maker-round2-evidence.json` — compiled clauses, pending sector suggestions, ranked NextQuestions, materialDecisionsRemaining, section outline, readiness, and decision-ledger entries for every state, plus the pending → accepted → saved → reloaded and pending → declined → saved → reloaded lifecycle.
6. **Updated screenshots** (`reports/screenshots/*-round2.png`), captured via a fresh Playwright run against this round's own code:
   - `mfg-01-desktop-after-fixtureA-round2.png` — desktop, after Prompt A (readiness 22; sector row shows "2 sector suggestions to review", Requirements: 1 — the pending suggestion is not compiled).
   - `mfg-06-desktop-afterA-fullpage-round2.png` — same state, full page.
   - `mfg-02-desktop-after-fixturesBCD-round2.png` / `-fullpage-round2.png` — desktop, after B/C/D (readiness 28; Resilience row Confirmed; `q-resilience` absent from Best Next Decisions; Requirements: 5, still no `sector-pack-suggestion` clause).
   - `mfg-03-mobile-390-round2.png` / `mfg-04-mobile-390-fullpage-round2.png` — 390px mobile, after B/C/D (readiness 28, same state confirmed at mobile width).
7. **Independent re-verification**: `tsc --noEmit` (clean), `npm run validate` (0 failures, 223/223 pass in the Stage A fixture file alone), `npm run validate:ui` (existing Playwright UI suite, 30/30 pass — no regression from this round's changes), `npm run lint` (118 pre-existing problems, byte-identical before and after this round's changes — confirmed by stashing and re-running against `3d2c711` directly), `npm run build` (clean, sandbox font workaround applied then fully reverted — `git diff --stat src/app/layout.tsx` is empty).

## Deliberately out of scope

- The flavour risk-note compiler (`sectorClauses()`'s remaining half) — a materially different, already-evidence-gated case your report did not name, and one that never fires in the A–D prompt sequence as written.
- `earnedQuestions()`'s own signature (`questions.ts`) — used by several unrelated surfaces (QuickSorWorkspace.tsx, mcp-workspace-tools.ts, converse-project.ts, other validate scripts); the fix was deliberately kept at the narrower NextQuestion-projection layer specific to this blueprint.

Stopped here, at the checkpoint, for your review.
