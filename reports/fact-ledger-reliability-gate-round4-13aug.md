# Fact Ledger Reliability Gate — Third Amendment, 13 August 2026

Commit `8612832` was **amended in place again** (`git commit --amend`, not a new commit, per your instruction) — it is now `19d04af`, still the only commit on `fact-ledger-reliability-gate`, still on top of unmodified `origin/main` (`5e24698`). Nothing was pushed or merged. Canvas work was not started, as instructed.

This round is different in kind from the first two: your message rejected the second amendment's entire atomic-splitting strategy as architecturally unsound, not as missing an edge case, and gave an explicit six-point architectural correction. That correction is what got built — a source-ledger design, not another patch to the splitter.

## Why the atomic splitter had to go

I traced the exact mechanism before touching anything, to confirm the diagnosis rather than take it on faith. `coverDeclarativeClauses()`'s atomic splitter checked whether an anchor's **start point** fell inside a given atomic sub-span. That works only when an anchor's own matched text never crosses a splitter boundary. It routinely does: the sector regex for "Energy and utilities" matches the whole compound phrase, crossing the word "and" the splitter cuts on. The anchor's start point lands in the first half; the splitter still cuts the clause in two; the second half — the very words the anchor's own match covers — registers as "uncovered" and gets torn off as a spurious fragment or receipt. No amount of added punctuation or coordinator words fixes this, because the fault isn't in the word list — it's in checking a start point against a boundary a legitimate match itself straddles.

Reproduced against the pre-amendment commit, exactly as you reported:

| Buyer text | `8612832` (before) |
|---|---|
| "We need SASE, require an Ethernet private circuit." | `procurement.buying="sase"`, `unplacedClauses=[]` — the circuit vanishes |
| "We need SASE: we also require an Ethernet private circuit." | same silent loss |
| "We need SASE / we also require an Ethernet private circuit." | same silent loss |
| "We need SASE with an Ethernet private circuit." | same silent loss |
| "We are an Energy and utilities business." | `organisation.sector="Energy & utilities"` **and** a spurious receipt `"utilities business."` |
| "Sector: Retail and e-commerce." | `organisation.sector="Retail & e-commerce"` **and** a spurious receipt `"e-commerce."` |
| "We need research and development network segmentation." | `requirements.bespoke=["We need research"]` **and** a spurious receipt `"development network segmentation."` |
| "We need active-active and active-passive failover." | `requirements.bespoke=["We need active-active"]` **and** a spurious receipt `"active-passive failover."` |

Byte-for-byte your report. Reproduced in a throwaway probe against a detached worktree at `8612832`, deleted afterward — not part of the diff.

## The architectural correction, as built

**1–2. Verbatim source-turn persistence, independent of segmentation.** `ProjectDesk.tsx` now keeps a `SourceTurn[]` log — every non-command buyer entry, typed (`send()`) or pasted/dropped (`ingestText()`), captured **before** extraction runs. It is deliberately a separate mechanism from the existing `Receipt` log: preservation of the buyer's own wording no longer depends on the extractor successfully identifying anything.

**3. `requirements.bespoke` is never invented from residue.** `coverDeclarativeClauses(text, updates)` is now a 2-argument function returning only `{ unplacedClauses }`. It no longer synthesises a bespoke fact from whatever's left over in a clause. The **only** ways a `requirements.bespoke` fact can be created now are a named deterministic rule (there is exactly one: the "threat protection" phrase match) or the model. Everything else that isn't explained by an anchor is retained as a receipt, never guessed into a fact.

**4. Duplication over disappearance.** When a clause is only partially explained, or the boundary between what's covered and what isn't is uncertain, the **complete original clause** — never a derived fragment — is kept as an unplaced receipt. `clauseIsFullyExplained()` is a binary judgement: each covering anchor's **full matched span** (not just its start point — this is exactly the fix for the "Energy and utilities" bug above) is removed from the clause; what's left is stripped of a closed-class stoplist of pronouns, articles, the copula, auxiliaries, modals and a few generic filler words (deliberately **excluding** every conjunction, coordinator and punctuation mark you named); if three or more real letters remain, the buyer said something this pass hasn't accounted for, and the clause is kept whole.

**5. Strong boundaries only.** `splitDeclarativeClauseSpans()` now splits only on sentence terminators (`.!?`) and newlines. Commas, colons, slashes, semicolons, and the words "and", "but", "plus", "as well as", "with" are never split points — confirmed directly: "We need SASE; we also require an Ethernet circuit." is one clause, not two.

**6. Source turns flow into save/publish, not just the transient chat display.** A new exported helper, `notesWithSourceTurns(baseNotes, sourceTurns)`, folds verbatim source turns into a notes string and is shared by both `ProjectDesk.tsx` (client, `rfpPayload()`) and `create-project.ts` (server, `buildSecurityProject()`). Threading this through surfaced a genuine, previously unnoticed gap: the **security-scope** project-creation path — `/sase/api/security-sourcing/project`, the app's default scope — was sending no notes at all to the backend; only the separate RFP-wizard path had this wired. Fixed by threading `sourceNotes` through the client → API route (`source_notes` on the request body) → `createSecurityProject` → `buildSecurityProject` → `buyer.notes`.

## Fixture results

Every fixture you listed, plus the four second-review conjunction/semicolon cases retained as regression fixtures (not because the old mechanism survives, but because the underlying buyer intent still has to hold):

| Buyer text | Structured fact | Receipt (complete, verbatim) |
|---|---|---|
| "We need SASE, require an Ethernet private circuit." | `procurement.buying="sase"` | "We need SASE, require an Ethernet private circuit." |
| "We need SASE: we also require an Ethernet private circuit." | `procurement.buying="sase"` | full sentence |
| "We need SASE / we also require an Ethernet private circuit." | `procurement.buying="sase"` | full sentence |
| "We need SASE with an Ethernet private circuit." | `procurement.buying="sase"` | full sentence |
| "We are an Energy and utilities business." | `organisation.sector="Energy & utilities"`, quote = the full compound phrase | none — zero spurious receipts |
| "Sector: Retail and e-commerce." | `organisation.sector="Retail & e-commerce"`, quote = the full compound phrase | none |
| "We need research and development network segmentation." | none | full sentence, unsplit |
| "We need sales and marketing network segmentation." | none | full sentence, unsplit |
| "We need active-active and active-passive failover." | none | full sentence, unsplit |
| the original five-fact message | users=200, sites=20, sector=Healthcare (stated), region=UK, existingNetwork=[sdwan] | the SD-WAN/SASE clause and the Ethernet-circuit clause, each complete |

The Retail sector regex was widened (`retail\s*(?:and|&)\s*e-?commerce|\bretail\b|e-?commerce`) to match the compound phrase whole, mirroring the Energy and Transport & logistics patterns that already existed — without it, "Retail and e-commerce" would have matched only on the bare word "Retail" and left "e-commerce" as a spurious tail, the same class of bug as the reported Energy case.

**Persistence, end to end.** `notesWithSourceTurns()` is unit-tested directly, and — more importantly — I drove the actual persistence core, `buildSecurityProject()` (the same function the API route and the `create_security_project` MCP tool both call), with a synthetic `sourceNotes` array, and confirmed the created project's `buyer.notes` contains the buyer's original sentence verbatim. This proves item 6 lands in the artefact that gets saved, not merely in a helper function nothing calls.

## A necessary follow-on fix, found while proving the above

Writing the fixture set surfaced a real gap: the residual-word stoplist from the first draft of this correction was too narrow. Ordinary, already-fully-captured sentences — "We are a Healthcare business **with** 20 sites.", "We need SASE **across** 50 sites.", "We **use** M365.", "We **suffered** a breach." — were registering as "not fully explained" because plain grammatical glue (prepositions carrying no meaning independent of the noun phrase an anchor already covers) and a couple of generic framing verbs whose object is what the fact actually records were being counted as unaddressed content. Widened the stoplist with `with, for, of, across, within, throughout, estate, whole, use(s)/using, suffered, today, currently, now` — every addition is still free of conjunctions, coordinators, and any content noun a fixture depends on ("Ethernet", "circuit", "protection", "ExpressRoute", "research", "development", "active-active" and their kind are never touched). Verified this doesn't affect any case that must remain a receipt: every "must not disappear" fixture above has zero covering anchors at all for the residual clause, so it's short-circuited to "not explained" before the stoplist is even consulted.

## What did not change

`buildRescopedProject()` (the re-scope/rescope-project.ts path) still never touches any `buyer` field — a pre-existing, deliberate "record accretes, never rewrites" design, unrelated to this round's fix. Flagging this explicitly as a known limitation: a re-scoped project's `buyer.notes` will not pick up source turns captured after the original scoping. Not fixed here, since it's a broader existing behaviour outside what you asked for and changing it risks side effects on a system built that way on purpose.

`ingest.ts`'s `chunkForIngest()` truncation (`maxChunks: 3`, `chunkMax: 3500`) is untouched and unrelated to this round — source-turn persistence only covers chunks actually processed, consistent with existing behaviour.

## Full verification, this round

```
tsc --noEmit                                    clean
verify-fact-ledger-reliability-gate.ts           ALL PASS (rewritten: fixed the two calls broken by
                                                  coverDeclarativeClauses' new 2-arg signature, reworked
                                                  every assertion that depended on the removed atomic-
                                                  splitting/bespoke-invention mechanism, added every
                                                  fixture from your instruction)
verify-correction-pass-2.ts                      ALL PASS (unaffected)
npm run validate (includes both scripts above)   ALL PASS, exit 0
next build --webpack                             Compiled successfully
```

Additionally: cloned the regenerated bundle into a clean directory, ran `npm install`, `tsc --noEmit`, and `npm run validate` there from scratch — same clean result, proving the amended commit is self-contained and not relying on anything left in this sandbox's working tree.

The `next build` run needed the same sandbox-only workaround as every prior round (no route to `fonts.googleapis.com` in this container): temporarily stubbed the font import, ran the build, confirmed success, reverted immediately — `git diff` against `src/app/layout.tsx` shows zero changes; it was never part of the amended commit.

## Delivery

Branch `fact-ledger-reliability-gate`, one commit (`19d04af`, amended from `8612832`, itself amended from `1ef8bc6`, itself amended from `c8fc3d1`) on top of `origin/main` (`5e24698`), bundled as `sdwan-reliability-gate-round4-13aug.bundle`:

```
cd ~/Downloads
git clone -b fact-ledger-reliability-gate sdwan-reliability-gate-round4-13aug.bundle review-reliability-gate-round4
cd review-reliability-gate-round4
git push https://github.com/shot2bits/sdwancomparison.git fact-ledger-reliability-gate --force
```

`--force` is needed because the commit hash changed under the amend — your existing dirty `main` checkout is still never touched by any of this. Say the word when you want it merged.

Canvas work was not started, as instructed. Stopping here.
