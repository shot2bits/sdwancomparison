# Living Procurement UK Decision-Maker Blueprint — correction pass

**Date:** 15 August 2026
**Branch:** `living-procurement-uk-decision-maker`
**Commit:** `3d2c711` (new commit on top of the rejected checkpoint `d5fbb43`, per "prefer a new commit over amending"). Not pushed, merged, or deployed.

This is a **contained correction pass on the rejected checkpoint**, not new scope. Your rejection named six defects; all six are addressed below, each reproduced against the real production pipeline before it was fixed, each covered by a non-vacuous behavioural fixture (not source-string inspection), each cross-checked against a real, rendered Playwright run of the exact A/B/C/D prompt sequence. The approved visual design is unchanged except where a fix required it (the NextQuestion card badge/reason line, defect 6).

---

## 0. The most important thing this pass found

Building the defect-5 readiness fixtures against a real, rendered live run (not just the pure-function harness) surfaced a genuine gap in the *test harness itself*, not the product: the fixture's own readiness computation, when first written, used a narrower "corpus" and a hardcoded empty `notedIds` than `ProjectDesk.tsx` actually uses. Comparing the fixture's own pinned readiness score against `reports/screenshots/mfg-02-desktop-after-fixturesBCD.png` (a real render of the exact prompt sequence) found the fixture read 24 where the live app genuinely reads 25.

Root cause, once traced: Prompt C's own exact wording — "We prefer **a single platform**..." — matches `extract.ts`'s `statedObjectivesIn()`, a narrow, pre-existing, strict-phrase mechanism (Harry, 24 Jul 2026, unrelated to this pass's six defects) that folds a buyer's own near-verbatim phrase into a genuine stated objective, live, in the same cycle. This honestly resolves the SASE-shape decision from the buyer's own words — it is not a case of freeform prose silently counting as an answer (that general principle is real and is still proven, with genuinely neutral wording, in Fixture G below). The fixture harness simply hadn't modelled this pre-existing mechanism. Fixed by threading the real fold through the fixture (§5), and the corrected pinned progression (22 → 25 → 28 → 25) now matches the live screenshots exactly, confirmed by pixel crop.

---

## 1. Defect 1 — canonical buying scope preserved through A/B/C

"UK 20 site SD-WAN in the manufacturing sector, full SASE required, 50 remote users" → "Yes, dual circuits at our five production-critical sites..." → "We prefer a single platform, but identity must integrate with Entra ID and we will consider third-party SOC services."

**Reproduced first:** `extract.ts`'s `managedSecurityHit` trigger fired on hedged/tentative language ("will consider") with no "seeking verb" required, and `mergeUpdates()`'s generic "later stated value replaces the earlier one" scalar-correction rule then overwrote `procurement.buying` from `"sase"` to `"managed_security"` — destructively rescoping the whole project from a single hedged clause.

**Fixed:** added a tentative-language guard (`TENTATIVE_CONSIDERATION_RE`: "will/may/might/could/would consider", "considering", "possibly", "might/may/could explore") — `managedSecurityHit` now only fires `buying = managed_security` when the language is a firm statement, not a hedge; a tentative match falls through to the SASE/SSE/SD-WAN detectors instead. Third-party SOC interest still lands, but as its own additive, non-mandatory `third-party-security-consideration` clause (new `thirdPartySecurityConsiderationClauses()`), never as a rescope.

**Verified (real production pipeline, Fixture K2):** `procurement.buying` stays `"sase"` before and after Prompt C. The Solution scope outline row still reads "Buying: SASE." after Prompt C. The `network-architecture-scope` clause still represents the proposed SASE service. Entra ID identity integration remains its own separate clause. The third-party SOC clause exists, is advisory (`mandatory: false`), and does not appear when `buying === "managed_security"` (a genuine managed-security purchase should not also carry a redundant "consider a third party" note). Live UI confirmation: `reports/screenshots/mfg-02-desktop-after-fixturesBCD.png` — Solution scope row reads "Buying: SASE.", the testable-requirements list shows the SASE architecture clause, the Entra ID identity clause, and the third-party SOC clause (labelled SUGGESTED) side by side.

## 2. Defect 2 — resilience compiles into the governed section

"Yes, dual circuits at our five production-critical sites. Single circuits are acceptable elsewhere."

**Reproduced first:** the dual-circuit answer only ever landed as a generic Additional-Requirement catch-all; the Resilience and availability outline row read Confirmed purely because the `q-resilience` NextQuestion card had disappeared from the ranked list — card-disappearance, not a governed clause, was driving the row.

**Fixed:** a new `siteResilienceClauses()` template produces one canonical `site-resilience-scope` clause (network section, unconditionally mandatory) from the buyer's per-site resilience statement. A new `deriveResilienceOutlineState()` (procurement-outline.ts) gates the outline row on that clause's real presence, never on question disappearance.

**Verified (Fixture K1):** the `site-resilience-scope` clause exists and is mandatory after Prompt B. `deriveResilienceOutlineState()` reads Confirmed when the clause is present. A counter-example at the identical requirement (same site count, same buying type) but with the clause list emptied reads Needs decision — proving the row cannot be satisfied by mere absence of a question. Live UI: the outline row reads "Per-site resilience requirement stated and compiled into the document."

## 3 & 4. Defects 3 and 4 — durable, honest question-state persistence

**Reproduced first:** answered NextQuestion cards, dismissed questions, and accepted/declined sector suggestions lived only in React state — a reload discarded all of it, and a clicked answer had no durable receipt distinguishing it from ordinary typed buyer wording.

**Fixed:** a new `decision_ledger` module (`src/lib/workspace/decision-ledger.ts`) mirrors the existing `source_ledger` architecture exactly — same accretion-only merge, same id-deduplication, same replay-from-ordered-entries reconstruction. Every `answerNextQuestion` branch (items/note/dismiss/decline) now also records a `DecisionLedgerEntry`: question id, option id, the real user-facing selected label (never Netify's question text), timestamp/order, and the resulting governed fact paths / noted items. `ProjectDetailsSchema` carries `decision_ledger` alongside the existing `source_ledger`; all four routes that already thread `source_turns` (security-sourcing create/rescope, generic wizard create/update) now thread `decision_turns` identically. Resume replays the ledger through the same `resumeStateFromProject()`-scoped boundary (security_sourcing engine only — a deliberate, non-widened reuse, not a new gap).

**Verified:** 20 new fixtures in `verify-fact-ledger-reliability-gate.ts` ("Round 10") cover persisted structured receipts with honest option labels, replay reconstruction, later-save accretion and reversal semantics (order-driven, not action-kind-priority-driven — proven by two fixtures with entries in opposite order producing opposite verdicts), dismissed-item-stays-dismissed-after-unrelated-reversal, idempotent resave, a REAL route-level create → rescope → reload round trip via the fake-KV harness (dynamically importing the actual exported Next.js route handlers, not a simulation), engine-scope boundary parity with the existing source-ledger resume, and defensive parsing of malformed input.

## 5. Defect 5 — section-aware readiness, not relabelled bands

**Reproduced first:** the readiness score/label only ever reflected a fixed formula over raw counts (clauses, gates, open decisions) — resolving the operating model, SASE shape, resilience, or security scope produced no visible, explainable change beyond whatever those raw counts happened to do.

**Fixed:** `buildReadiness()` gained four optional, backward-compatible inputs (`materialDecisionsRemaining`, `pendingSectorSuggestions`, `sectionsConfirmed`, `sectionsTotal`); when supplied, the "requirements compiled" and "decision credit" scoring buckets become genuinely section- and decision-aware instead of their old flat fallback. `ProjectDesk.tsx` computes a downstream `sectionAwareReadiness` from the compiler's own already-derived section outline and NextQuestion state (not a second compile — see the file's own extensive comment on why this must be a downstream projection, not an input to `compileProcurementDocument` itself, to avoid a circular dependency), and hands that richer object to the canvas for display.

**Verified, against the real production functions AND a real rendered run:**

| Point | Score | Label | Sections confirmed | Material decisions remaining |
|---|---|---|---|---|
| After Prompt A | 22 | Starting shape | 2/10 | 4 |
| After Prompt B | 25 (+3) | Starting shape | 3/10 | 4 |
| After Prompt C | 28 (+3) | Starting shape | 3/10 | 3 |
| After Prompt D | 25 (−3) | Starting shape | 3/10 | 4 |

- A → B: resolving Site resilience (defect 2's own clause) increases both section coverage and score — explainable, section-driven.
- B → C: Prompt C's own wording honestly resolves the SASE-shape decision (see §0) — an explainable increase, not a relabelled band.
- C → D: Prompt D's residency constraint opens a new material decision (confirming which UK data-protection framework governs it) — an explainable decrease, tied to a real, named open decision.
- Separately: resolving SASE shape via a genuine structured answer (simulating the "Single-vendor platform" button click) at the Prompt-B state, and resolving the operating model via an explicit override, each independently produce a score increase — proving the score responds to more than one governed section, not just resilience.

This progression is pinned exactly (not just directionally) in `scripts/validate-living-procurement-os-stage-a.ts`, and matches the real screenshots pixel-for-pixel: `mfg-01-desktop-after-fixtureA.png` reads 22; `mfg-02-desktop-after-fixturesBCD.png` reads 25.

## 6. Defect 6 — manufacturing suggestions tightened

**Reproduced first:** the `NextQuestion` projection computed each sector suggestion's own short `reason` (already present in `packs.ts`) but never carried it onto the object the UI card actually renders — the buyer saw a bare suggestion label with no stated reason why Netify was raising it. The badge read only "Netify suggests", with no explicit "optional" wording.

**Fixed:** `NextQuestion` gained a `reason: string | null` field, populated from the pack's own `PackSuggestion.reason` for every `sector_suggestion` candidate. The card component now renders it, and the badge reads "Netify suggests · optional". The two suggestions inferred from the manufacturing SECTOR alone (OT/ICS asset visibility, IEC 62443 segmentation) now say explicitly: "...but the sector alone does not confirm an OT/ICS environment exists here; accept only if it applies to your estate." The evidence-based flavour suggestion (triggered when the buyer's own words name OT/ICS/SCADA/PLC directly) correctly keeps its own reason, without that disclaimer, since it isn't inferred from sector alone.

**Verified:** both manufacturing suggestions are present as real NextQuestion candidates at Prompt A, marked `governedSuggestion`, carrying a non-empty reason with the disclaimer language. The SCADA/PLC-naming counter-example earns the flavour suggestion with its own reason and correctly *without* the disclaimer. Source-inspection fixtures confirm the card component actually reads `nq.reason` and renders the "optional" badge text (not just that the data exists unused).

---

## Verification chain

| Check | Result |
|---|---|
| Reproduce every defect against the pre-fix code path | All six reproduced first, each via the real extraction/compiler pipeline, before any fix was written |
| `npx tsc --noEmit` | Clean (exit 0) |
| `npm run validate` (full 14-script chain) | **ALL PASS** across every script, zero regressions to any pre-existing fixture — `reports/full-validate-output-15aug-correction-round.txt` |
| `scripts/validate-living-procurement-os-stage-a.ts` alone | 194 assertions, **194 PASS, 0 FAIL** — `reports/stage-a-fixture-output-15aug-correction-round.txt` |
| `eslint` on every touched file | Clean, 0 errors, 0 warnings |
| `eslint` full repo | 68 pre-existing errors, all in files this pass did not touch except `ProjectDesk.tsx`'s 4 pre-existing `react-hooks/set-state-in-effect` errors (confirmed, by diff, not part of this pass's changes) — `reports/lint-output-15aug-correction-round.txt` |
| `npm run build` | Succeeds (sandbox-only `next/font/google` network workaround applied to `src/app/layout.tsx` and reverted; `git diff --stat` on that file shows zero diff) |
| Clean-room bundle verification | See below |
| Real, rendered Playwright run (desktop 1440px + mobile 390px, exact A/B/C/D prompts) | `reports/screenshots/mfg-01…` through `mfg-05…` — captured against this checkpoint's own code, cross-checked pixel-for-pixel against the pinned fixture scores |
| Machine-readable compiled state after every prompt | `reports/manufacturing-decision-maker-correction-15aug-evidence.json` |

### Clean-room bundle verification

A full-history git bundle was created from commit `3d2c711` (`git bundle create`, then `git bundle verify` — "records a complete history"), cloned into a fresh temporary directory with no relationship to this working tree, `npm install`ed from scratch there, and re-verified independently:

- `npx tsc --noEmit` — clean.
- `npm run validate` — **ALL PASS**, every script — `reports/correction-pass-cleanroom-validate-output-15aug.txt`.
- `npm run build` (same sandbox font workaround, reverted after) — succeeds — `reports/correction-pass-cleanroom-build-output-15aug.txt`.

This proves the committed diff is self-contained and correct independent of this working directory's own state. The clean-room clone was deleted after verification; the bundle itself is `reports/living-procurement-uk-decision-maker-correction-3d2c711.bundle`.

---

## Deliverables

1. This checkpoint report.
2. `reports/full-validate-output-15aug-correction-round.txt`, `reports/stage-a-fixture-output-15aug-correction-round.txt`, `reports/lint-output-15aug-correction-round.txt` — full console output, this working tree.
3. `reports/correction-pass-cleanroom-validate-output-15aug.txt`, `reports/correction-pass-cleanroom-build-output-15aug.txt` — full console output, independent clean-room clone.
4. `reports/living-procurement-uk-decision-maker-correction-3d2c711.bundle` — full-history git bundle, `git bundle verify`-clean, independently clone-tested.
5. `reports/manufacturing-decision-maker-correction-15aug-evidence.json` — machine-readable compiled requirement/outline/readiness/next-decisions state after every one of Prompts A–D.
6. `reports/screenshots/mfg-01-desktop-after-fixtureA.png`, `mfg-02-desktop-after-fixturesBCD.png` (desktop, 1440px, after A and after B/C/D), `mfg-03-mobile-390-ordinary.png`, `mfg-04-mobile-390-fullpage.png`, `mfg-05-mobile-390-next-decisions.png` (mobile, 390px).

## Stopping point

All six defects are fixed and verified. Commit `3d2c711` on branch `living-procurement-uk-decision-maker`. **Not pushed, merged, or deployed.** Awaiting your review.
