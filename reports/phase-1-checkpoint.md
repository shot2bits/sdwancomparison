# Living Procurement Canvas — Phase 1 Checkpoint

**Branch:** `living-procurement-canvas-phase-1-2` (created from `origin/main` at `c08cc538d67c9f90db60f4c537393f4f7052681c`, not amended, not pushed, not merged, not deployed)
**Status:** Phase 1 (pure procurement compiler) complete. Stopping here per instruction, pending your approval before any Phase 2 UI work begins.

---

## 1. Implementation plan (as executed)

Phase 1 is one pure function, `compileProcurementDocument()`, that takes the existing fact ledger's current state (`WorkspaceFact[]`, the derived `requirement`, the security verdict, the RFI/instrument ladder, and the buyer's retained verbatim `receipts`) and returns one typed `LivingProcurementDocument`. Nothing in the existing fact ledger, extraction, tombstone, source-ledger, save, ownership, or publishing code was touched — Phase 1 is purely additive, three new library files plus one new fixture script:

- Fact-driven clause templates read `WorkspaceFact[]`/`requirement` directly (compliance, timeline, operating model, MPLS coexistence, sector pack).
- Text-pattern clause templates read the buyer's own retained wording (`receipts` + fact quotes joined into a corpus) for concepts with no structured ledger path at all — voice continuity, application resilience, Entra ID + ZTNA, DLP, legacy-app + retained Ethernet circuit, UK data residency, SASE/SD-WAN architecture scope, and the fully-managed/retain-control contradiction.
- Every unmatched but concrete buyer requirement becomes a real, classified clause (in a named section, or in an automatically-created "Additional requirements" section as a last resort) — never left stranded only under "Your notes."
- Clause identity is split into a stable, content-derived `templateKey` (used to diff additions/updates/removals across recompiles) and a display-only `id` (`NET-01`, `SEC-02`, …) recomputed each compile from the current clause set only — so numbering is never a function of array position or discovery order.
- Evaluation categories always total exactly 100 via deterministic largest-remainder rounding, with alphabetical tie-breaking and a documented default split when the document is empty.
- A single shared section→category map (`CATEGORY_FOR_SECTION`) drives both the Supplier Pack response groups and the Evaluation categories, so there is one mapping, not two independently maintained ones.
- Sector-derived clauses (from `HEALTHCARE_PACK`) are always `origin: "sector"`, `mandatory: false` — recommended/scored, never asserted as a buyer fact, and droppable.
- A removal layer specific to this module (`resolveReceiptRemovals` / `isCurrentlyRemoved`) recognises "remove/drop/delete X" instructions against compiler-only requirements that never become `WorkspaceFact`s, and — mirroring the fact ledger's own resurrection law — brings a requirement back if the buyer later restates it.

---

## 2. Compiled outputs for every acceptance prompt

### Section 14.4 — Healthcare / Ethernet defect prompt (exact wording from the brief)

> "UK 20 site Healthcare business requires SD-WAN and full SASE. We have 200 remote users. We also have a legacy app that requires a point to point Ethernet private circuit."

- Healthcare is preserved as a **stated** sector fact, not inferred.
- UK, 20 sites, 200 remote users, and SD-WAN remain structured facts (unchanged from the existing extraction pipeline).
- The SASE/SD-WAN sentence becomes clause **NET-01** (`network-architecture-scope`), quoting the buyer's exact SASE wording verbatim.
- The legacy app + retained Ethernet circuit becomes clause **NET-02** (`legacy-circuit-coexistence`) — `mandatory: true` (buyer said "requires"), with supplier-response items asking for coexistence, migration sequencing, and rollback, without prescribing a supplier architecture.
- No unplaced clause is left unclassified — the "Your notes" fallback list is empty.

```
[SEC-01] security  mandatory=false  origin=sector   Cyber Essentials Plus expected of bidders
[NET-01] network   mandatory=true   origin=buyer    Network/security architecture scope stated by the buyer
                                                     (Healthcare & pharma, 20 sites): "UK 20 site Healthcare
                                                     business requires SD-WAN and full SASE."
[NET-02] network   mandatory=true   origin=buyer    The legacy application's retained point-to-point Ethernet
                                                     private circuit must coexist with the new architecture
                                                     through migration.

evaluation categories: network_resilience=71, security_identity_data=29, managed=0, commercial=0  (total 100)
gates: GATE-NET-01, GATE-NET-02
open decisions: 1 (delivery timeline not yet stated)
```

### Section 16.1 — Prompt A

> "Teams Phone and the patient booking platform cannot go down. Fail over automatically without dropping calls. We use Entra ID and Azure; require ZTNA and DLP. Fully managed with 24/7 support, live by April 2027."

Six testable clauses compiled, one per stated requirement (dated transition plan, managed-service boundary, application resilience, voice continuity, identity-aware ZTNA, DLP coverage) — each carries required evidence and an explicit mandatory/scored classification. Architecture includes an Azure node, an identity node (Entra ID), a voice node (Teams Phone), and an application node, with a traceable identity→application edge. 14 supplier questions, 6 mandatory gates, categories total 100. Summary: *"azure, Teams Phone, patient-facing application, Entra ID. 6 testable requirements compiled from the buyer's own words."*

### Section 16.2 — Prompt B (correction of Prompt A)

> "Remove DLP. Make the service co-managed instead of fully managed, but keep 24/7 incident support."

- DLP clause removed; `changeSet.clauses.removed = ["SEC-01"]`.
- Operating model becomes co-managed; the managed-service clause updates in place (`changeSet.clauses.updated = ["OPS-01"]`) rather than being replaced, and its text now reads "...for a co-managed service, including 24/7 incident support."
- The three unrelated clauses (voice continuity, application resilience, identity-aware ZTNA) survive unchanged.
- Document version increments from 1 to 2, exactly once.
- No spurious duplicate "Additional requirements" clause is produced by the correction sentence.

### Section 16.3 — Prompt C (verbatim constraint, no invented statute)

> "No patient-identifiable data may leave the UK."

Produces one clause (`uk-data-residency`), `origin: "buyer"`, quoting the sentence verbatim, requesting a data-flow diagram and sub-processor list as evidence. No GDPR/DPA 2018/any statute or certification name is invented anywhere in the clause text. The legal interpretation is recorded as an **open decision** (`OD-data-residency-legal-basis`), not asserted as fact.

### Section 16.4 — Prompt D (operating-model contradiction)

> "The service must be fully managed, but our team must retain sole operational control over all policy changes."

Zero mandatory gates are generated while the contradiction stands. The managed-service clause is downgraded to `mandatory: false` with no acceptance test, and a visible conflict open decision (`OD-operating-model-conflict`) is generated naming the exact conflicting sentence as its reason — never silently resolved to one side.

*(Full field-by-field dumps for all five scenarios — every clause, architecture node/edge, response group, gate, and open decision — are in the validation script's own assertions; happy to send the raw dump too if useful.)*

---

## 3. Every file changed, and why

| File | Change | Why |
|---|---|---|
| `src/lib/workspace/procurement-document.ts` | **New** (~526 lines) | Public types (`LivingProcurementDocument`, `ProcurementClause`, `SupplierQuestion`, `ArchitectureNode/Edge`, `ProcurementChangeSet`, …) and the `compileProcurementDocument()` orchestration function. |
| `src/lib/workspace/procurement-templates.ts` | **New** (~720 lines) | The deterministic clause template library: fact-driven templates, text-pattern templates, mandatory-language detection, removal/resurrection logic, and the "Additional requirements" fallback. |
| `src/lib/workspace/procurement-readiness.ts` | **New** (~210 lines) | Section→evaluation-category mapping, per-clause weighting, largest-remainder 100-point balancing, open-decision construction, and the readiness score. |
| `scripts/validate-procurement-document.ts` | **New** (~280 lines) | Deterministic fixture script driving the real extraction→compile pipeline through all five acceptance prompts plus compiler-invariant checks. |
| `package.json` | **1-line change** | Appended `&& tsx scripts/validate-procurement-document.ts` to the existing `"validate"` script chain, so it now runs automatically under both `npm run validate` and `npm run build`. |

No existing file was modified. The fact ledger, extraction, tombstone, source-ledger, ownership, save/reopen, and publishing code are untouched.

---

## 4. Fixture and invariant results

`npx tsx scripts/validate-procurement-document.ts` — **all checks pass** (86 assertions specific to this module), covering:

- Section 14.4 Healthcare/Ethernet (13 checks) — sector preserved as stated, structured facts unchanged, both prior unplaced clauses now correctly classified, verbatim quotes, mandatory classification, traceability, evidence, category total = 100.
- Section 16.1 Prompt A (26 checks) — all six clauses generated with evidence and classification, architecture nodes/edges, summary content, question/gate counts, category weights, first-compile changeSet correctness, traceability, acceptance tests.
- Section 16.2 Prompt B correction (10 checks) — removal and update both recorded distinctly in the same compile, unrelated clauses survive, version increments exactly once, category total = 100.
- Section 16.3 Prompt C verbatim (6 checks) — verbatim retention, buyer provenance, evidence requested, no invented statute, legal basis recorded as an open decision.
- Section 16.4 Prompt D contradiction (5 checks) — zero gates invented, conflict decision generated and named, conflicted clause not silently made mandatory.
- Compiler invariants (Section 14.5: Deterministic, Reversible/resurrection, Conservative, Balanced) and Section 14.3 (nothing renders for an empty document) — 9 checks, including a byte-identical double-compile and the full three-turn DLP state→remove→restate resurrection sequence.

## 5. TypeScript and validation results

```
npx tsc --noEmit                → exit 0, no errors
npm run validate                → exit 0, 185 PASS, 0 FAIL (includes every pre-existing
                                    validator plus the new procurement-document fixtures)
npm run lint                    → exit 1, but IDENTICAL to origin/main's baseline: 68 errors /
                                    50 warnings, all in files this work never touched
                                    (ShortlistBuilder.tsx, SupplierDashboard.tsx,
                                    SupplierPortal.tsx, estimator/engine.ts,
                                    draft.fixtures.ts, draft.ts, questions.ts, …).
                                    Verified by stashing this branch's changes and re-running
                                    lint against the untouched c08cc53 baseline: same 68 errors.
                                    This branch adds zero new lint errors.
npm run build                   → exit 0 (full production build succeeds, including the
                                    validate chain it runs internally). Built using the
                                    established sandbox-only workaround: next/font/google
                                    cannot reach fonts.googleapis.com from this offline
                                    verification environment, so layout.tsx's Inter() call
                                    was temporarily stubbed for the build, then reverted —
                                    git diff on layout.tsx is empty afterward.
npm ci                          → exit 0, 377 packages installed cleanly
```

## 6. Existing Fact Ledger Reliability Gate fixtures

Confirmed unchanged and passing. `npm run validate` runs `verify-fact-ledger-reliability-gate.ts` (and every other pre-existing validator) exactly as before, and every one of its checks — including the 9-round reliability-gate regressions, occurrence-aware coverage, negated-requirement handling, removal-command matching, and so on — passes with no modification to that file or any file it exercises.

## 7. Remaining risks and assumptions

- **`receipts` added to the compiler's input contract.** The brief's Section 6.1 signature is illustrative and doesn't list `receipts`; I added it because Section 15.2 requires retained-wording input and the Ethernet/DLP/ZTNA/data-residency acceptance prompts are otherwise unsatisfiable (none of those concepts have a structured ledger path in `extract.ts`). This is the one deliberate deviation from the brief's literal signature, documented in the file header.
- **`ProcurementSectionKey` has 9 values, not 8.** Section 6's illustrative list doesn't include "additional"; Section 14.3's requirement that unmatched concrete requirements become traceable clauses in an automatically-created "Additional requirements" section takes precedence, so a 9th section key was added.
- **50%-overlap duplicate-suppression heuristic** (`receiptIsExplainedByClauses`) is a judgement call, not a spec-mandated number — modelled on `extract.ts`'s own "binary judgement, never a splitting decision" philosophy, but a different overlap threshold could reclassify some edge-case receipts differently.
- **Weighting formula** (`clauseWeight`: base 3, +2 mandatory, +1 sector) is my own deterministic design satisfying "show the source of each weight," not a value specified in the brief — worth confirming it matches your intent before Phase 2 exposes it in a UI.
- **`deriveRfiQuestionSet`/`deriveInstrumentLadder`/`earnedInstrument`** are accepted as pass-through inputs per the brief's signature but not yet deeply used by clause generation — this is intentional scoping for Phase 1, flagged as a Phase 2 consideration.
- **Lint is pre-existing red** on `origin/main` itself (68 errors before this work began) — not something this branch can or should fix, since touching those unrelated files would violate the "smallest possible change" scope boundary.
- No Phase 2 UI work (Living Document, Supplier Pack preview, Evaluation preview, architecture rendering, change ribbon, ProjectDesk integration) has been started, per your explicit instruction to stop at this checkpoint.

---

**Stopping here for your review and approval before Phase 2 begins. Nothing has been pushed, merged, rebased, or deployed.**
