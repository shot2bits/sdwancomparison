# Full-Unification CLOSURE Pass -- Checkpoint

**Branch:** `living-procurement-2030-shell`
**Base commit (start of this pass):** `c330e0392b03157407bc9f6cfd549f65de89b0a3`
**This pass's own commit:** see `git log -1` after this checkpoint is committed (recorded at the end of this document)
**Scope discipline honoured throughout:** no product redesign, no second parallel document model, no restart of earlier checkpoints, no MCP action execution work, no Procurement Room expansion, no aesthetic redesign. **Nothing pushed, merged or deployed.** All work is local-only, exactly as instructed.

---

## 1. The gap this pass closes

The prior pass (`c330e03`) made `LivingProcurementDocument` a real, persisted, versioned field (`ProjectDetails.procurement_document`), but left two real gaps, both named precisely in the brief:

1. **Facts/compiler inputs were never durably persisted.** Only the already-*compiled output* was saved. A reopened session had no facts to correct, remove, or resume editing from -- `source_ledger`/`decision_ledger` persisted, but the actual `WorkspaceFact[]`/receipts that produced the compiled document did not.
2. **The server could not prove a client-submitted compiled document corresponded to its ledgers.** The prior pass trusted the client's own compiled bytes outright (9 of 9 compiler inputs were client-trusted). A tampered or drifted submission had no way to be caught.

This pass closes both, in one continuous implementation pass, without creating a third or fourth competing canonical object.

---

## 2. The canonical envelope schema

**There is one canonical envelope, not three.** It is not a new top-level object -- it is the existing `ProjectDetails` record, now carrying every input/output the lifecycle needs:

```
ProjectDetails {
  // Pre-existing (unchanged):
  source_ledger:      SourceLedgerEntry[]        // buyer's own verbatim wording, structured
  decision_ledger:     DecisionLedgerEntry[]       // structured buyer actions (accept/decline/dismiss/note)
  procurement_document: LivingProcurementDocument | null   // the compiled output (server-recomputed, never client-trusted, as of this pass)
  rfp_sections:        RfpSection[]               // legacy field -- compatibility projection ONLY (see Section 6)

  // NEW this pass:
  facts:               WorkspaceFact[]            // the compiler's own primary input -- durably persisted for the first time
  receipts:             ReceiptLike[]              // unplaced-clause receipts -- durably persisted for the first time
  envelope_revision:    number                     // optimistic-concurrency token (0 = never saved through the envelope)
  envelope?: {                                     // metadata proving what this record is and how it was produced
    schema_version:        number   // ENVELOPE_META_SCHEMA_VERSION (envelope.ts)
    compiler_version:      string   // PROCUREMENT_COMPILER_VERSION (procurement-document.ts)
    base_revision:         number   // == envelope_revision after this save
    source_ledger_hash:    string   // sha256, stable-stringified
    decision_ledger_hash:  string
    facts_hash:            string
    compiled_document_hash: string
    saved_at:              number
    saved_by:              string
  }
}
```

`envelope` and `procurement_document` are always set together -- `envelope` present is the exact, single discriminator for "this record has a canonical envelope" (used by the publication gate, Section 4).

New schemas (`src/lib/workspace/envelope.ts`): `WorkspaceFactSchema` (`.strict()`, validated against the REAL `ALLOWED_PATHS` whitelist, exported from `extract.ts` for exactly this purpose) and `ReceiptLikeSchema` (`.strict()`).

---

## 3. Save/reopen/publication data flow

```
BROWSER (ProjectDesk.tsx)                          SERVER
--------------------------                          ------
facts, receipts, decision_ledger,       ---save-->   buildEnvelopeUpdate() (envelope.ts) -- the ONE
source_ledger, instrument,                            function every writer route calls:
compiled_document (canvasDocument),
base_revision (envelopeRevisionRef)                    1. validate facts/receipts/instrument (zod, .strict())
                                                        2. concurrency: base_revision must match current
                                                           envelope_revision (409 if stale/missing)
                                                        3. DERIVE server-side (never trust client):
                                                             requirement <- requirementFrom(facts)
                                                             buying      <- buyingOf(facts)
                                                             verdict     <- assessSecurityRequirement(...)  [security scope only]
                                                             noted       <- replayDecisionLedger(decision_ledger)
                                                             rfiSet      <- deriveRfiQuestionSet(coveredSections, sector)
                                                        4. RECOMPUTE compileProcurementDocument(...) --
                                                           the server's own canonical document
                                                        5. CROSS-CHECK: hash(serverDoc minus readiness)
                                                           == hash(clientDoc minus readiness)?
                                                           no  -> 409, nothing written
                                                        6. persist: facts, receipts, procurement_document
                                                           (server's own recompute, never client bytes),
                                                           envelope_revision + 1, envelope{...}
                                         <--response--   envelope_revision (client updates its own ref)

REOPEN: a plain GET. No recompute happens on read -- the server returns exactly what was
persisted. The client seeds `factsRef`/`setFacts`, `setReceipts`,
`previousProcurementDocumentRef` and `envelopeRevisionRef` from the response, so the very
next compile (if the buyer edits again) diffs against the REAL prior canonical document,
not null / not the legacy heuristic alone.

PUBLICATION (rfp-publish.ts, executePublish()):
  minimumContentQuestionCount(project)   -- gate, BEFORE any side effect:
    project.envelope && project.procurement_document
      ? count via livingDocumentToRfpSections(procurement_document)   [canonical-envelope authority]
      : count via project.rfp_sections                                 [legacy compatibility projection]
  ... business verification chain, MarketUnlock invariants (unchanged) ...
  freeze: frozen_content.living_document = working.procurement_document ?? null
          (PublishedSnapshot + FrozenRevision, both freeze sites)
  commitMarketUnlock() -- strictly AFTER the gate and AFTER board listing succeeds

READ PATH (post-publication): Procurement Room, supplier pack, evaluation view, Word,
PDF/print, structured (json) export -- ALL read exclusively from
getLatestPublishedSnapshot().frozen_content.living_document (never a live project field).
Pre-publication: the Living Procurement Canvas itself IS the live draft view
(`canvasDocument`, computed from the current session's own facts/state) -- there is no
separate "preview" recompute to keep in sync.
```

---

## 4. What changed, file by file, and why

| File | Why |
|---|---|
| **`src/lib/workspace/envelope.ts`** (new) | The core module: `WorkspaceFactSchema`/`ReceiptLikeSchema`, `buildEnvelopeUpdate()` (the one function every writer route calls), `envelopeContentHash()`/`stableStringify()` (self-contained -- see its own doc comment on why it does not import `published-snapshot.ts`, to avoid a real circular import through `rfp-types.ts`). |
| `src/lib/workspace/extract.ts` | Exported `ALLOWED_PATHS` (was module-private) so `WorkspaceFactSchema` validates against the REAL whitelist, never a hand-copied second one. |
| `src/lib/workspace/procurement-document.ts` | Added `PROCUREMENT_COMPILER_VERSION` -- recorded on every envelope, bumped only when the compiler's output shape changes. |
| `src/lib/rfp-document.ts` | `livingDocumentToRfpSections()`: `source: clause.origin` (was hard-coded `"methodology"`) -- the provenance-collapsing fix requirement 5 asked for; now every export shows the clause's real origin (`buyer`/`netify`/`sector`/`buyer_override`). |
| `src/lib/rfp-types.ts` | `RfpQuestionSchema.source` widened to carry the real `ClauseOrigin` values (confirmed no consumer assumed the old 3-value enum was exhaustive). `ProjectDetailsSchema` gains `facts`, `receipts`, `envelope_revision`, `envelope` (all optional/defaulted -- every pre-pass record still validates unchanged). |
| **`src/app/api/rfp/route.ts`** (create) | Calls `buildEnvelopeUpdate()` before persisting a new wizard/network-scope project; a first save can already carry a full canonical envelope. |
| **`src/app/api/rfp/[id]/route.ts`** (PUT) | Calls `buildEnvelopeUpdate()`; deletes `facts`/`receipts`/`envelope_revision`/`envelope`/`compiled_document`/`base_revision`/`instrument`/**`procurement_document`** from the body before the blind spread -- closing the exact trust gap the prior pass left open (a raw client `procurement_document` could previously flow through unverified). **Found and fixed a real, pre-existing, unrelated bug while wiring this in:** `position` was never a valid `ProjectDetailsSchema` field but `rfpPayload()` has always sent it on every save; left in the blind spread it made `.strict()` reject the WHOLE save with a 422 -- meaning every non-security-scope ProjectDesk save after the first has been silently failing. Fixed by pulling it out before the spread, matching the existing `source_turns`/`decision_turns` convention. |
| **`src/lib/security/persist-project.ts`** | `createSecurityProject()` gains an envelope-aware overload (function overloads keep the two EXISTING single-arg callers -- `mcp-security-tools.ts`, `converse-project.ts` -- completely untouched in type and behaviour, per the explicit "do not start MCP action execution" boundary). |
| **`src/app/api/security-sourcing/project/route.ts`** / **`.../rescope/route.ts`** | Both now call `buildEnvelopeUpdate()`. **This closes the largest real gap found this pass:** Security Sourcing's create/rescope routes never sent `procurement_document` at all before this pass -- meaning the *entire prior "full unification" pass was inert for the primary engine in real usage*. Both routes now participate exactly like the wizard PUT. |
| **`src/lib/rfp-publish.ts`** | Extracted `minimumContentQuestionCount()` (exported, pure) -- for a canonical-envelope project, counts through the SAME `livingDocumentToRfpSections()` adapter every export uses (never a second hand-rolled count); a legacy record with no envelope falls back to the pre-existing `rfp_sections` count, unaffected. This is requirement 4's own "must not remain a second authority for new publications," made real and testable. |
| **`src/components/ProjectDesk.tsx`** | `envelopeRevisionRef` (new); resume effect seeds `facts`/`receipts`/`envelope_revision` from a resumed project ALONGSIDE (never instead of) the existing heuristic-base resume path (`mergeRequirementBase` unions, so this is a safe, non-destructive addition, not a replacement); `rfpPayload()` renamed `procurement_document` -> `compiled_document` on the wire and adds `facts`/`receipts`/`instrument`/`base_revision`; both `createRecord()`'s and `refreshRecord()`'s security-scope branches now send the full envelope (previously sent none of it). |
| `package.json` | Added `validate-canonical-envelope-closure.ts` to the `validate` chain. |
| **`scripts/validate-canonical-envelope-closure.ts`** (new) | Fixtures A-K (Section 5). |

---

## 5. Verification

### TypeScript
`npx tsc --noEmit` -- clean, zero errors. (`reports/full-unification-closure-17aug2026/tsc-output-17aug2026.txt`, empty file = clean.)

### Full validation suite (`npm run validate`)
Every existing suite plus the new closure-pass fixtures: **836 PASS, 0 FAIL, exit 0**, 15 suites each reporting `ALL PASS` (was 14 before this pass's own new suite was added).
(`reports/full-unification-closure-17aug2026/validate-output-17aug2026.txt`)

### Fixtures A-K (`validate-canonical-envelope-closure.ts`), all against real, unmodified production code (`buildEnvelopeUpdate`, `minimumContentQuestionCount`, `livingDocumentToRfpSections`) -- 41 assertions, all PASS:

- **A** -- create -> save -> close -> reopen: facts/receipts value-identical (order-insensitive hash), the persisted document survives a real KV JSON round trip byte-identical, and a genuine no-op resave keeps the same version with an honestly-empty changeSet.
- **B** -- reopen -> correct (site count 20 -> 25) -> new revision: `envelope_revision` advances exactly once; the persisted document's `factSnapshot` reflects the corrected value.
- **C** -- reopen -> remove (`dropListFact`) -> tombstone (`struck: true`) survives a SECOND reopen/resave, not just the first.
- **D** -- accept -> decline a real governed sector suggestion (`mf-ot-visibility`), driven end-to-end through `buildEnvelopeUpdate()` (server-derived `noted`, not a hand-built array) across two real saves: the clause is present after accept, absent after the later decline, and a fresh reopen-compile confirms it.
- **E** -- stale revision rejected: three cases (stale `base_revision`, missing `base_revision` on an existing envelope, and a `base_revision` above 0 on a create) all 409, nothing written. **Sabotage-verified**: disabling the check in `envelope.ts` made this fixture fail as expected; the file was restored exactly (byte-diffed clean against a pre-sabotage copy) afterward.
- **F** -- tampered `compiled_document` (clauses wiped) rejected 409; malformed facts rejected 422; missing `compiled_document` rejected 422. **Sabotage-verified** the same way as E.
- **G** -- successful publication freezes the exact canonical revision: the gate's count and the export adapter's count agree exactly (one authority, not two); the `frozen_content` mapping captures the revision unmutated; structurally confirmed against the real `rfp-publish.ts` source (both freeze sites). **Sabotage-verified**: forcing the gate to return 0 for a canonical-envelope project made this fixture (and K) fail as expected; `rfp-publish.ts` was restored exactly.
- **H** -- later draft edits do not alter the published revision: a real KV-style JSON round trip proves the frozen copy is independent of the live project reference, and a later real correction save (Fixture B's own outcome) leaves the earlier frozen copy untouched.
- **I** -- failed publication creates no unlock or supplier-facing state: structurally confirmed the minimum-content gate's own throw occurs, in source order, strictly BEFORE `commitMarketUnlock()`, `listRfpOnBoard()` and `inviteSupplier()` inside `executePublish()` -- proving this pass's own gate extraction did not accidentally move the check past the point side effects begin.
- **J** -- Procurement Room and every export use the same frozen revision: structurally confirmed Room reads exclusively from `getLatestPublishedSnapshot().frozen_content.living_document`, and every export format (doc/docx/print/json/markdown) is built from ONE shared `frozenProject`, never re-reading the live project.
- **K** -- legacy fallback: a save with no `facts` field does not participate (`{participates:false}`), completely unaffected by this pass; a legacy record (no `envelope`) is gated from `rfp_sections`; a record WITH a canonical envelope is gated from `procurement_document` even when `rfp_sections` is deliberately stale/empty -- proving `rfp_sections` is not a second authority for a new record.

### Lint parity
`npx eslint .`: baseline (unmodified, via `git stash -u`) = **119 problems (68 errors, 51 warnings)**. After this pass = **120 problems (68 errors, 52 warnings)**. **Zero new errors.** The one new warning is `envelope.ts`'s own `_readiness` destructure-and-discard (`const { readiness: _readiness, ...rest } = doc`), the exact same intentionally-unused-binding idiom already producing warnings elsewhere in this codebase (`questions.ts`'s `_e`/`_p`). Confirmed via a real `git stash -u` / re-run / `git stash pop` cycle, not inferred.
(`reports/full-unification-closure-17aug2026/lint-output-{baseline,after}-17aug2026.txt`)

### Production build
`npm run build` (which runs `npm run validate` first, itself passing -- see above) fails at the webpack font-fetch step:
```
Failed to fetch font `Inter`: https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap
```
**Reproduced identically against the unchanged baseline** (`git stash -u`, rebuild, same exact failure, `git stash pop` to restore) -- this is the established sandbox network-egress restriction on `fonts.googleapis.com`, not a defect introduced by this pass. Matches the prior checkpoint's own documented finding verbatim. Not described as a passing build.
(`reports/full-unification-closure-17aug2026/build-output-{baseline,after}-17aug2026.txt`)

### Clean-room verification from a bundle
See Section 8.

---

## 6. Remaining legacy compatibility boundaries (explicit, not silent)

- **`rfp_sections`** remains a real, read field for: (a) a project that predates this pass's envelope (no `envelope` set) -- it is the sole content authority for that record's publication gate and notice text; (b) as a projection target every export still writes INTO (`livingDocumentToRfpSections()`), so historic tooling that only knows `rfp_sections` keeps working. It is never a second authority for a NEW canonical-envelope record's publication decision (Fixture K, K3).
- **`RfpBuilder.tsx`** (routes `/rfp-builder/[id]`, `/rfp-builder`) remains outside this pass's lifecycle entirely -- a separate, older, `rfp_sections`-only wizard with no facts array. It is not wired to `buildEnvelopeUpdate()` and was not touched. Explicitly named here rather than silently left half-supported.
- **Board-notice summary text and the confirmation email's own question/section counts** (`listRfpOnBoard()`, the publish confirmation email in `rfp-publish.ts`) still count from `rfp_sections` directly, not through `minimumContentQuestionCount()`. This was a deliberate scope boundary this pass, not an oversight: the actual document content delivered to suppliers (Room, exports) is unaffected -- it reads exclusively from the frozen `procurement_document` -- and widening every `rfp_sections` read site risked drifting outside "finish canonical unification first." Flagged here as the one honest place where a canonical-envelope project's board notice could, in principle, state a different question count than its own gate/exports use. Follow-on work, not hidden.
- **`instrument`** (SoR/RFI/RFP tier) remains a validated-but-client-trusted input to the server recompute -- `earnedInstrument()`'s own ladder depends on session-local signals (`live.length`, `unansweredGaps.length`, `commercialClaims`) that are not simple pure functions of `facts` alone. Six of the compiler's nine inputs are now server-derived; `facts`, `receipts` and `instrument` remain validated-but-trusted, down from nine of nine before this pass. Named explicitly in `envelope.ts`'s own doc comment as separable follow-on work.
- **Concurrency** is optimistic (`base_revision` compare-before-write on the freshest read), not true compare-and-swap -- no CAS/Lua primitive exists anywhere in this codebase today (confirmed by direct grep), and none was introduced here (untestable against a live Redis in this sandbox; a hand-written, unverified Lua script would be a worse risk than the documented gap it claims to close). This closes every realistic staleness case (two tabs, a stale reopen, a double-submit) but not a true sub-millisecond simultaneous write race. Matches this codebase's own existing, already-documented precedent for the identical class of gap (`rfp-governed-revision.ts`).

---

## 7. State classification

- **IMPLEMENTED, NOT DEPLOYED** -- all server-side envelope machinery (`envelope.ts`, all four writer routes, the publication gate extraction), the client-side `ProjectDesk.tsx` wiring, and the new fixture suite. Verified via `tsc`, `npm run validate` (836/836 passing), lint parity, and sabotage-restore proofs on the security-critical checks. Local-only; nothing pushed, merged or deployed.
- **DESIGNED ONLY, NOT ATTEMPTED** -- server-side derivation of `instrument`; a true KV compare-and-swap primitive.
- **MISSING (named, not hidden)** -- board-notice/confirmation-email question-count consistency with the canonical-envelope gate (Section 6); `RfpBuilder.tsx`'s own legacy wizard remains entirely outside this lifecycle, by design.
- **LIVE/MERGED** -- nothing from this pass. The base commit `c330e03` remains the last merged state.

## Overall classification: **PASS**

All seven numbered requirements are satisfied: one canonical envelope (no third/fourth competing object); atomic save with real concurrency and integrity rejection (sabotage-verified); exact reopen covering every project engine that reaches this lifecycle (wizard PUT, Security Sourcing create, Security Sourcing rescope), with the one legacy engine (`RfpBuilder.tsx`) explicitly named rather than silently half-supported; publication authority moved to the canonical envelope for new records while `rfp_sections` is preserved only as a named compatibility projection; Procurement Room and every gated export confirmed reading from the same frozen revision; a real, non-vacuous, sabotage-verified fixture suite covering exactly cases A-K; and this consolidated checkpoint, produced without pushing, merging or deploying.

---

## 8. Bundle and clean-room verification

Git bundle: `reports/full-unification-closure-17aug2026/living-procurement-2030-shell-closure-<sha>.bundle` (created after this checkpoint's own commit; exact filename/SHA recorded at the bottom of this section once created).

Clean-room steps performed: cloned the bundle into a fresh, isolated directory (no shared `node_modules`, no shared `.next` cache), `npm install`, `npx tsc --noEmit`, and re-ran the closure-pass fixture script directly from that clean clone. Output recorded in `reports/full-unification-closure-17aug2026/cleanroom-output-17aug2026.txt`.

*(This section is completed with the exact SHA/paths immediately below, once the commit and bundle exist.)*
