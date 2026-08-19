# Fact Ledger Reliability Gate — Amended, 13 August 2026

Commit `c8fc3d1` was **amended in place** (`git commit --amend`, not a new commit, per your instruction) — it is now `1ef8bc6`, still the only commit on `fact-ledger-reliability-gate`, still on top of unmodified `origin/main` (`5e24698`). Nothing was pushed or merged. Canvas work was not started.

All six of Codex's blockers are fixed, each with the exact failing example added as a regression, each reproduced against the **pre-amendment** code first to prove the test is real, then verified fixed. `tsc --noEmit`, the reliability gate script (32/32), the existing `verify-correction-pass-2.ts` battery, `npm run validate` (now including the reliability gate — see item 6), and a full `next build` all pass clean.

## The six blockers, each with before/after evidence

For every case below I ran the exact text against the **pre-amendment** commit first (a small throwaway script importing `extractRequirement`, deleted afterward — not part of the diff) to confirm the bug reproduces byte-for-byte as you described it, then re-ran it post-fix.

### 1. Occurrence-aware coverage, not global substring matching

**"We need SASE and a point-to-point Ethernet circuit."**

- Before: `updates=[{path:"procurement.buying", value:"sase", quote:"SASE"}]`, `unplaced=[]` — the Ethernet circuit is gone. Not a fact, not bespoke, not a receipt. Nowhere.
- After: SASE still lands (`procurement.buying=sase`), **and** a `requirements.bespoke` entry appears: `"We need SASE and a point-to-point Ethernet circuit."` — nothing lost.

**"We use Azure today. We also require Azure ExpressRoute for connectivity."**

- Before: `updates=[{path:"estate.cloud", value:["azure"], quote:"Azure"}]`, `unplaced=[]` — the ExpressRoute sentence vanishes because the word "Azure" (from sentence 1) matched somewhere in the whole message text, which the old check treated as "this clause is covered" for *every* clause containing the same word, including sentence 2.
- After: `estate.cloud=["azure"]` still lands, **and** a `requirements.bespoke` entry captures `"We also require Azure ExpressRoute for connectivity."` in full.

**Mechanism.** `FieldUpdate` gained an optional `matchStart` (the character offset in the buyer's *original* text where the real matched span sits). `splitDeclarativeClauseSpans()` (new, replaces the position-blind `splitDeclarativeClauses()` string splitter — the string-only version is kept as a thin wrapper for existing callers) gives each clause its own `[start, end)` range in that same coordinate space. Coverage now asks "does this specific occurrence's position fall inside this clause's range", not "does this word appear anywhere in the message". The Azure anchor from sentence 1 sits at position 7; sentence 2 starts at position ~21; 7 is not inside `[21, ...)`, so sentence 2 is correctly un-covered.

For the same-sentence case (SASE + Ethernet), a clause *with* a covering anchor is additionally checked for a coordinated second requirement: a coordinating word ("and"/"as well as"/"plus") followed by its own article ("a"/"an"/"the"/"another"/"additional") reads as a genuinely new noun phrase. This is deliberately structural, not a circuit/technology noun list — matching your standing instruction from the first build. I stress-tested this specifically against the risk of it firing on your own Doc 1 message, which pairs "SD-WAN and full SASE" in one clause where the file's own `procurement.buying` priority chain already treats the two as one unified ask, not two purchases — a bare second product name with no article after "and" does **not** trigger the new check, so that existing, deliberate design is undisturbed (see Regression 1 and the dedicated "SD-WAN/SASE regression guard" case in the script — both still pass, one bespoke entry, not two).

### 2. Paste/drop ingestion now retains `unplacedClauses`

`ProjectDesk.tsx`'s `ingestText()` (the paste/drop path) called `runCycle()` per chunk and discarded the result. `send()` (typed input) already kept every `unplaced` clause via `keepReceipt()` — `ingestText()` never did, so a clause an ingested paste couldn't place still disappeared even after last round's fix, purely because it arrived through a different code path.

Fixed: `ingestText()`'s chunk loop now reads `runCycle()`'s return value and calls `keepReceipt()` for every clause in `r.unplaced`, mirroring `send()` line for line.

This one is a source-review fix, not a script assertion — `ingestText`/`runCycle`/`keepReceipt` are inline React callbacks inside the component (same honestly-flagged limitation as the drop/remove command testing gap from the first round), so there's no pure function to hand a synthetic paste to. The reliability gate script's `coverDeclarativeClauses()` unit test proves the underlying extraction primitive is correct; this fix wires that primitive's output into the one remaining path that wasn't reading it.

### 3. Canonical display labels no longer stand in as coverage evidence

Three of your exact examples, before/after:

| Buyer text | Before | After |
|---|---|---|
| "We need SDWAN." | `procurement.buying=sdwan` **plus** a duplicate `requirements.bespoke: ["We need SDWAN."]` | `procurement.buying=sdwan` only, `matchedText:"need sdwan"` |
| "We use M365." | `estate.cloud=["m365"]` correct, **plus** `unplaced:["We use M365."]` | `estate.cloud=["m365"]` only, `matchedText:"m365"` |
| "We suffered a breach." | `drivers=["incident"]` correct, **plus** `unplaced:["We suffered a breach."]` | `drivers=["incident"]` only, `matchedText:"breach"` |

The mechanism: `quote` on these calls is a fixed, buyer-facing display label ("SD-WAN", "Microsoft", "incident") that is not guaranteed to be the buyer's own literal words — "SDWAN" (no hyphen) doesn't contain "SD-WAN" (hyphenated), "breach" doesn't contain "incident". Coverage checking now anchors on `matchedText` (the real matched span) whenever it's present, and only falls back to `quote` when it isn't. I audited every `say()`/`infer()` call in `deterministicExtract()` and threaded a genuine `matchedText` through every one whose display quote could diverge from the actual trigger word: regions (UK/US), cloud (Microsoft/Google Workspace), existing-network (SD-WAN), drivers (incident/renewal/growth), compliance (ISO 27001/NHS DSPT/NIS2), SOC capacity (24/7, and the "none" branch, which was previously a bare `.test()` with a quote that matched *none* of its own trigger phrases), `procurement.buying` (SASE/SSE/SD-WAN), and `operatingModel` (co-managed/self-managed). Calls where the quote already content-equals the trigger (Azure, AWS, PCI, GDPR, FCA, audit, ransomware...) were left as literal quotes — no `matchedText` needed there, verified case by case.

### 4. Direct sector matching requires organisational context

- "We are a Government organisation." → `organisation.sector = "Government & public sector"`, `provenance: "stated"` — unchanged, still correct.
- "We require Government security classifications." → **before**: same sector wrongly set, `stated`, off the bare word "Government". **After**: no `organisation.sector` update at all; the clause instead lands as a `requirements.bespoke` entry (`"We require Government security classifications."`), since nothing else claims it.

Mechanism: the direct sector map now requires either self-identifying language immediately before the match ("we are", "we're", "operating as"...) or an organisational noun immediately after (organisation, business, company, trust, council...), and explicitly excludes a match followed (within two filler words) by a requirement-object noun — classification, compliance, standard, certification, clearance, regulation, requirement, policy, law, framework, grade, rating, level, contract, or **security** itself, which is what catches "Government **security** classifications". The *inferred* sector map (hospital/GP/dental/etc.) gets the same negative half of the guard — without it, "government" would still fire through the inference map even after the direct map correctly refused it, reopening the exact hole the direct-map fix just closed. The inferred map does **not** require the positive self-identification test, since almost none of its own trigger words ("hospital", "GP practice"...) were ever meant to require that phrasing — only the "this describes a requirement, not the buyer" exclusion applies there.

### 5. No more silent truncation of automatically captured clauses

`estate.locationCriticality`, `estate.siteResilience` and `requirements.bespoke` shared a `clean(x, 200)` call that silently sliced anything longer than 200 characters — fine for a short hand-typed label, wrong for a whole captured sentence (which this gate now captures routinely). Fixed narrowly (the shared `clean()` helper's other ~15 call sites are untouched): the cap is raised to 2000 characters — generous enough that a single buyer sentence essentially never hits it — and in the rare case it still does, the remainder is kept as a **second value in the same list**, with a note making the split visible, rather than being cut and discarded. Tested both the ordinary case (a 393-character clause, previously would have been sliced to 200 and the last third silently lost; now kept in full) and the genuine-overrun case (a 2397-character clause: split into two list values, `393 + 2004` characters reconstructing to the original length, plus a note: *"A captured clause was too long to keep in one piece and was split; the remainder was kept, not discarded: ..."*).

### 6. Hermetic model tests + the reliability gate wired into the build

`ANTHROPIC_API_KEY` is still unset in this sandbox, so every case up to this point exercises the deterministic-only path — genuinely (a real "model unavailable" regression by construction), but not the same as testing what happens when the model actually speaks, times out, or errors mid-call. Added, with `global.fetch` mocked (no real network call, same discipline `verify-correction-pass-2.ts` already uses for `vetModelProposals()`):

- **Success**: a mocked model reply is parsed and vetted through the real `vetModelProposals()`, and lands via `extractRequirement()` (`engine: "model"`) — proven with `constraints.budgetBand`, a path the deterministic rail has no pattern for at all, so the landed fact can only have come from the model path genuinely running.
- **Timeout**: `fetch` rejects with the same `AbortError` shape the real `AbortController` produces once `TIMEOUT_MS` elapses — exercised directly rather than waiting the real 9 seconds. Falls back to the deterministic rail with the note *"Model extraction timed out; deterministic parsing used."*
- **Non-timeout failure**: a plain rejected `fetch` — falls back with *"Model extraction failed; deterministic parsing used."*
- **Non-OK response** (e.g. a 503): falls back with *"Model extraction unavailable (503); deterministic parsing used."*

`scripts/verify-fact-ledger-reliability-gate.ts` is now the last step in `package.json`'s `"validate"` script, which `"build"` already runs first — so a regression in any of the above (or any of the other 28 assertions) now fails `npm run build`, not just a standalone script invocation.

## Full verification, this round

```
tsc --noEmit                                    clean
verify-fact-ledger-reliability-gate.ts           32/32 PASS
verify-correction-pass-2.ts                      ALL PASS (unaffected)
npm run validate (now includes the gate above)   ALL PASS
next build --webpack                             Compiled successfully
```

The `next build` run needed the same sandbox-only workaround as last time (this container has no route to `fonts.googleapis.com`, which `next/font/google`'s `Inter()` call fetches at build time): I temporarily stubbed the font import, ran the build, confirmed success, then reverted the stub immediately — `git diff` against `src/app/layout.tsx` shows zero changes; it was never part of the amended commit.

## What did not change

Everything from the first report that wasn't one of the six blockers is untouched: the sector direct-map's `originalSpan()` casing fix, the negated-requirement guard, the drop/remove command's known non-adjacent-phrase limitation, the proposed `ProcurementCompilerInput` shape for Canvas Phase 1. No Canvas file was touched. No file outside `package.json`, `scripts/verify-fact-ledger-reliability-gate.ts`, `src/components/ProjectDesk.tsx` and `src/lib/workspace/extract.ts` changed.

## Delivery

Branch `fact-ledger-reliability-gate`, one commit (`1ef8bc6`, amended from `c8fc3d1`) on top of `origin/main` (`5e24698`), bundled as `sdwan-reliability-gate-amended-13aug.bundle`:

```
cd ~/Downloads
git clone sdwan-reliability-gate-amended-13aug.bundle review-reliability-gate-amended
cd review-reliability-gate-amended
git push https://github.com/shot2bits/sdwancomparison.git fact-ledger-reliability-gate --force
```

`--force` is needed on the push because the commit hash changed under an amend (the branch tip moved, not history you'd already shared elsewhere) — your existing dirty `main` checkout is still never touched by any of this. Say the word when you want it merged.
