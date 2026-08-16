# Stage B — amended design: the canonical procurement envelope

**Date:** 16 August 2026. **Amended 16 August 2026** (same day, market-unlock correction round — see §3.5 and the revised §5; the amendment is marked inline rather than as a separate document, per Robert's instruction to amend this design directly). **Amended again 16 August 2026** (market-unlock correction round 2, a same-day focused correction: §3.5 and §5's own first amendment asserted that an *unlisted* Opportunities Board listing satisfies the board prerequisite just as a public one does. Robert's explicit review rejected that reading outright: "Do not reinterpret 'not listed on the board' as 'listed privately.'" §3.5 and §5 below are corrected a second time to remove that claim; see each section's own round-2 marker for exactly what changed and why.)
**Status:** design for review only. Nothing in this document has been implemented. No code has been written against it. It is not to be implemented until the row-8 checkpoint (as amended by both market-unlock correction rounds) has been reviewed and merged, and this design has been separately reviewed and authorised.
**Governs:** the persistence model underlying publishing, board listing, the supplier room, matching, and exports — replacing "persist the compiled document" with "persist the whole record."

**What actually changed in this amendment:** the row-8 checkpoint's own correction round (see the amended row-8 checkpoint report) found that `hasPublished(project.status)` is not the canonical market-facing boundary — a project's internal status could read "published" while its Opportunities Board listing, and therefore its market unlock, had failed. The fix introduced a new, separate, server-derived record (`market-unlock.ts`'s `MarketUnlock`) binding a frozen document revision to a successfully-created board listing at a recorded timestamp. This design document's original text implicitly treated "a frozen `published_revision_id` exists" as equivalent to "the market is live" (see the original §3's "From that point on, `published_revision_id` points at it" and the original §5's "Publishing freezes the current draft into the published revision — this is the one place a frozen revision is created"). That equivalence is exactly the conflation the correction round closed. §3.5 (new) and §5 (revised) below correct it; §§1–4 and §§6–7 are otherwise unchanged and still hold.

**What changed in the round-2 amendment (same day):** the first amendment above additionally treated an *unlisted* Opportunity as a second, equally-valid way to satisfy the board prerequisite (mirroring that round's implementation, which gave `list_on_board: false` a real `Opportunity` record with `visibility: "unlisted"` and still committed a `MarketUnlock` against it). Robert's non-negotiable product rule, stated in full at the top of the round-2 correction: *"A project unlocks vendor identities, project-specific matching, invitations, supplier-room access, messages, responses and exports only after it has been successfully published as a PUBLIC opportunity on the Opportunities Board. An unlisted/private Opportunity does not satisfy this rule... Do not reinterpret 'not listed on the board' as 'listed privately.' If a future private-market workflow is desired, that requires a separately named lifecycle and explicit product approval. It is not part of this change."* §3.5 and §5 are corrected accordingly: only a PUBLIC Opportunity, bound to the exact frozen revision, may ever cause `market_unlock` to be set. `list_on_board: false` now means the market never unlocks at all — no Opportunity of any visibility is created, and no `MarketUnlock` is ever committed for that publish attempt.

This design is the direct answer to the instruction added alongside the row-8 decision: *persisting only the compiled document is not sufficient. On reopen, the buyer should initially see the exact saved snapshot. Recompilation should be an explicit migration or validation operation — never a silent replacement caused by newer compiler code.* It does not redesign the existing ledger or correction semantics (source ledger, fact ledger, decision ledger, suggestion states) — it wraps them in a versioned, durable envelope and changes how and when compilation runs against them.

---

## 1. The problem this closes

R0 established that Netify runs two structurally independent systems: the newer `ProjectDesk.tsx` / `compileProcurementDocument()` / sector-pack system, which compiles a Living Procurement Document client-side, on demand, from in-memory facts — and never persists or publishes it — and the older `RfpBuilder.tsx` / `rfp_sections` / `executePublish()` system, which is what is actually saved, published, matched against, and exported. R0 also flagged the "save/reopen weakness": there is no guarantee that reopening a saved project reproduces what the buyer last saw, because nothing prevents a newer compiler build from silently recompiling and replacing it.

This is not a hypothetical drift risk. It is two concrete failure modes, both real today:

1. **Cross-system drift.** The new compiler and the old `rfp_sections` pipeline can diverge — different clause wording, different question logic, different readiness scoring — for the same underlying facts, because nothing ties one system's output to a frozen, addressable, versioned record the other can point at. R0's correction (per Robert's terminology instruction) is precise here: the two systems are *structurally independent and already capable of divergence*, not "guaranteed to drift" — but nothing today prevents that divergence from reaching a published document.
2. **Silent recompilation on reopen.** If and when the newer compiler-backed system is wired into persistence, the naive approach — store facts, recompile on every reopen — means a buyer who published a document under compiler version N, then reopens it after Netify ships compiler version N+1, could silently see different clause wording, different pricing framing, or a different readiness score than what they actually published. For a document that may be shared with vendors, referenced in a live procurement, or archived for audit, that is a correctness and trust failure, not just a UX inconsistency.

The fix is structural: stop treating "the compiled document" as the durable record. The durable record is the whole envelope — inputs, decisions, compiler identity, and the frozen output — with the compiled document as one addressable, versioned artifact inside it, never the sole thing persisted.

---

## 2. The canonical procurement envelope

One versioned record per project, superset of what either system persists today. Conceptually:

```
ProcurementEnvelope {
  project_id
  envelope_version            // schema version of this envelope shape itself

  source_ledger                // buyer-authored raw inputs, as today
  fact_ledger                  // extracted/derived WorkspaceFacts, as today
  decision_ledger              // open/resolved material decisions, as today
  suggestion_states             // sector-suggestion accept/decline/reversal state, as today

  compiler_identity {
    compiler_version            // the compiler/rulebook build that ran
    rulebook_version             // if versioned separately from the compiler build
  }

  revisions: [
    DocumentRevision {
      revision_id
      kind: "draft" | "frozen"    // frozen = published; see §4
      compiled_document           // the full Living Procurement Document snapshot
      compiled_document_hash       // content hash of the snapshot above
      compiler_identity_at_compile // pinned to the compiler that produced THIS revision
      derived_from_ledger_state    // pointer/hash into source+fact+decision+suggestion state at compile time
      created_at
      created_by
      superseded_by                // set once a newer draft revision replaces this one
    },
    ...
  ]

  current_draft_revision_id     // latest draft revision, mutable lineage
  published_revision_id         // the one frozen revision currently live, if any — null pre-publish
}
```

Points worth making explicit:

- **The four ledgers are not touched.** Source ledger, fact ledger, decision ledger, and suggestion states keep exactly the semantics R0 confirmed are already correct and are not being redesigned. They move from "whatever the current persistence layer happens to store" into named, addressable fields of one envelope, alongside everything else — a packaging change, not a semantic one.
- **`compiled_document` is now one revision among many, not the only thing saved.** Every time a document is compiled — draft-editing recompiles, or the one that becomes frozen at publish — it produces a new immutable `DocumentRevision`, never an in-place overwrite of a prior one.
- **`compiled_document_hash`** exists so "is this the exact thing that was last shown" is a cheap equality check, not a deep structural diff — used by the reopen-integrity check in §4 and by any future audit tooling.
- **`compiler_identity_at_compile` is pinned per revision, not read from "whatever the app is running now."** This is what makes drift auditable instead of invisible: a stored revision always carries the exact compiler/rulebook build that produced it, regardless of what version is deployed later.
- **`derived_from_ledger_state`** ties a compiled revision back to the exact ledger state it was compiled from, so a later "why does this revision say X" question is answerable without guessing.

---

## 3. Draft vs. frozen revisions

Two kinds of `DocumentRevision`, matching the buyer-facing lifecycle rather than inventing a new one:

- **Draft revisions** — the working lineage before publish. Editing facts/decisions and recompiling produces a new draft revision; the previous draft revision is marked `superseded_by` the new one but is retained, not deleted (cheap, and gives "what did this look like an hour ago" for free without a separate audit log). `current_draft_revision_id` always points at the latest.
- **The frozen published revision** — created exactly once, at the moment of publish, by taking whatever the current draft revision is and marking a `DocumentRevision` with `kind: "frozen"`. From that point on, `published_revision_id` points at it and it is immutable: no future recompilation, of any kind, may alter it in place. Draft editing can continue after publish (matching today's product behaviour, where a project keeps moving through `qa`/`evaluation`), but every subsequent draft revision is a new, separate entry in `revisions` — it never touches the frozen one.

This is the direct mechanism for "reopening must display the exact saved document": reopening a published project reads `published_revision_id` → that exact `DocumentRevision.compiled_document`. Reopening a draft project reads `current_draft_revision_id`. Neither path ever recompiles as a side effect of being viewed.

---

## 3.5. A frozen revision is necessary, but never sufficient, for market unlock (amendment, market-unlock correction round, 16 Aug 2026)

§3 above describes when a `DocumentRevision` is marked `kind: "frozen"` and becomes `published_revision_id`. It deliberately does **not** say that this moment is when suppliers, matching, or exports become available — conflating those two facts is precisely the defect the market-unlock correction round found and fixed in the current (pre-Stage-B) implementation, and this envelope design must not reintroduce it once implemented.

**The rule, stated as an invariant this envelope must preserve:** freezing a revision (§3) and unlocking the market are two distinct, independently-observable events, and the second must never be inferred from the first. A `MarketUnlock` record (today, `src/lib/market-unlock.ts`; under this envelope, a field the envelope itself should carry — see below) is the only thing that means "suppliers, invitations, matching output and exports may now be shown." It exists if and only if, in order:

1. a `DocumentRevision` with `kind: "frozen"` exists (§3) — necessary, not sufficient;
2. **(corrected, round-2 amendment)** a PUBLIC Opportunities Board listing (an `Opportunity` record with `visibility: "public"` — never `"unlisted"`, and never any other visibility) was created successfully, **bound to that exact frozen revision's id** — never to "whichever revision happens to be current by the time the listing succeeds," which matters once draft edits can continue after publish (§3's own point: "Draft editing can continue after publish... every subsequent draft revision is a new, separate entry — it never touches the frozen one"). Robert's non-negotiable rule is explicit that "not listed on the board" must never be reinterpreted as "listed privately": an unlisted Opportunity is not a lesser, still-valid path to unlock — it is not a path to unlock at all. A buyer who declines board listing (`list_on_board: false`) gets no Opportunity of any visibility and no market unlock; a genuinely private/invite-only market-unlock workflow, if ever wanted, is a separately named, separately approved product feature, not a variant reading of this rule;
3. the unlock was committed at a recorded server timestamp, itself immutable once set (a retried commit for the exact same revision+listing pair returns the original timestamp, never a later one — see the current implementation's idempotency contract, which this envelope's eventual `MarketUnlock` field should preserve verbatim).

**Why this belongs in the envelope's shape, not just in a sibling module.** Under this design, `ProcurementEnvelope.published_revision_id` on its own answers "does a frozen document exist" — it does not and must not answer "has the market unlocked." A future implementation of this envelope should therefore carry the unlock as its own named, optional field alongside `published_revision_id`, e.g.:

```
market_unlock: {
  published_revision_id       // MUST equal the envelope's own published_revision_id
  board_opportunity_id
  board_visibility: "public"   // corrected, round-2 amendment: a literal, the ONLY value
                                 // that ever satisfies the board prerequisite -- never "unlisted"
  matching_basis_hash          // content hash of the ledger state the frozen revision was compiled from
  invitation_snapshot_id       // the revision carrying the frozen invited/matched vendor lists
  unlocked_at
} | null   // null until a PUBLIC Opportunities Board listing for THIS published_revision_id succeeds
```

A `published_revision_id` with `market_unlock: null` is a real, legitimate, and non-transient state under this design — not an error — matching one of the fixture scenarios the row-8 correction round now proves: a project whose internal status has crossed publication but whose board listing failed, was never attempted, or was explicitly declined (`list_on_board: false`) and has not yet been retried as a genuine public listing.

**Every downstream projection must check `market_unlock`, never `published_revision_id`'s mere presence.** See the revised §5 below.

---

## 4. Reopen semantics: read the snapshot, never silently recompile

The core behavioural rule, stated as an invariant: **loading a project for display is a read of a stored revision, never a trigger for compilation.**

Concretely:

- Opening a published project always renders `revisions[published_revision_id].compiled_document` — the exact HTML/structure/wording the buyer last saw at publish time — regardless of what compiler version is currently deployed.
- Opening a draft project renders `revisions[current_draft_revision_id].compiled_document` — the last-compiled draft snapshot, not a fresh recompile on load.
- An **integrity check** runs on load, comparing `compiled_document_hash` (or, cheaper, `compiler_identity_at_compile` against the currently-deployed compiler/rulebook version) to detect staleness. If they differ, the buyer sees a small, honest, non-blocking notice — e.g. *"This document was compiled with an earlier version of Netify's rulebook. It is shown exactly as published/last saved. Review for an updated version."* — with an explicit action to trigger recompilation. The notice is informational; it never changes what is rendered by default.
- **Recompilation is only ever triggered by one of two explicit, named operations**, both logged as their own event with an actor, a timestamp, and the resulting new revision id — never as an implicit consequence of a page load, a deploy, or a background job:
  - **Migration** — an operator- or system-initiated batch recompile against a newer compiler/rulebook version, used e.g. when a rulebook fix must be rolled out to existing documents. Produces a new revision (draft or, if explicitly authorised per-project, a new frozen revision superseding the old one) but never overwrites history — the prior revision remains in `revisions` with its own hash and compiler identity intact.
  - **Validation** — a buyer- or reviewer-initiated "check this against the current rulebook" action, surfaced by the staleness notice above. Produces a new *draft* revision for review; it never silently becomes the published one. Promoting it to frozen/published is a separate, explicit publish-style action, not a side effect of validation.

This is the concrete meaning of "recompilation must be explicit, version-aware and auditable": every recompile is a named operation, tied to an actor, producing a new dated revision with its own pinned compiler identity — never an unattributed overwrite.

---

## 5. One frozen revision, every downstream projection (amended, market-unlock correction round, 16 Aug 2026; corrected again, round 2, same day)

R0's core structural finding was that publish, board listing, the supplier room, matching, and exports currently draw from different, independently-derived views rather than one shared source of truth. Stage B's second purpose, beyond persistence integrity, is to make `published_revision_id`'s `compiled_document` the single upstream source every downstream surface reads from — **and, per §3.5, to gate every one of those surfaces on `market_unlock` being non-null for that exact revision, never on `published_revision_id` merely existing.** The original version of this section said "publishing freezes the current draft into the published revision — this is the one place a frozen revision is created," which is still true as a statement about §3, but is not itself the market-unlock boundary; that framing is corrected below.

- **Publishing** freezes the current draft into the published revision (§3) — necessary, but per §3.5 not sufficient on its own for anything supplier-facing to follow.
- **Board listing** is what §3.5 requires before `market_unlock` may ever be set, and — round-2 correction — it must be a PUBLIC listing specifically; an unlisted one is not a degraded-but-acceptable substitute, it simply never satisfies this step. Under this design, board-listing creation is a prerequisite step gating the `market_unlock` commit, not an afterthought that reads a summary projection once publish has already "happened." A board-listing failure, or an explicit `list_on_board: false`, must leave `market_unlock: null` and no supplier-facing surface open, exactly mirroring the current implementation's recoverable publication saga (validate eligibility → persist an immutable frozen revision → create the PUBLIC board listing bound to that revision, or stop here entirely if declined or refused → only on success, atomically commit `market_unlock` → only then transition the project to published and create invitations idempotently).
- **The supplier room** (the vendor-facing view, subject to the row-8 boundary — see the checkpoint report, as amended) renders from the published revision **only once `market_unlock` is non-null for that revision** — `hasPublished()` alone, the original wording here, is exactly the insufficient check the correction round replaced; never from a draft revision, never from live ledger state directly.
- **Matching** reads the facts/decisions that back the published revision's `derived_from_ledger_state`, and its output may only be shown once `market_unlock` is non-null — `matching_basis_hash` in §3.5's `market_unlock` shape exists precisely so a later audit can confirm which ledger state a shown match was actually computed against, independent of whatever the live ledger has since become.
- **Exports** (Word-compatible HTML, print-to-PDF — per the terminology correction, neither is a native `.docx` or a generated PDF today) render the published revision's `compiled_document` directly, gated the same way — an export is one of the capabilities `market_unlock` governs, not a lesser-gated sibling of the supplier room.

**The shared invariant across all five surfaces, restated plainly:** none of them may independently decide "the market is unlocked" from its own local signal (a status field, a route's own boolean, an opportunity's mere existence). All five read the SAME `market_unlock` record for the SAME `published_revision_id`, and none of them may recompile or re-derive their own view of "is this live" — exactly the "no newer compiler version may silently alter the live opportunity" requirement, extended from compilation (§4) to unlock state itself: no downstream surface may independently decide the market has unlocked any more than it may independently decide to recompile the document.

This does not require redesigning any of these five surfaces' own logic — it requires each of them to source their document content from one addressable revision pointer, gated by one shared unlock record, instead of from independently maintained copies, live recompiles, or independently-inferred lifecycle checks. That refactor is explicitly out of scope for this design document; it is named here so the envelope's shape is judged against all five consumers, not just the buyer's own reopen path.

---

## 6. What this design deliberately does not do

- It does not change the source ledger, fact ledger, decision ledger, or suggestion-state semantics — R0 found these correct; this design packages them, it does not touch their logic.
- It does not merge the two structurally independent systems (`ProjectDesk`/compiler vs. `RfpBuilder`/`rfp_sections`) into one. R0 flagged that as a larger architectural question; the envelope is designed to be the shared persistence shape either system's document output could eventually be written into, but which system authors a given revision is unchanged by this design.
- It does not expand MCP or agent functionality. (Amendment: the market-unlock correction round DID add a market-unlock precondition check to the NDA/thread/evidence-draft/respond routes' supplier-facing branches — see the amended checkpoint report §2 — closing a real, independently-discovered gap in `supplier-capability-access.ts`'s lazy-issuance path. That change is the minimum necessary to establish the canonical lifecycle boundary this round's instruction required; it did not touch `resolveSupplierPrincipal()`'s own vendor-principal resolution logic, and this design document's own scope — the envelope shape itself — remains unchanged by it.)
- It is not an implementation plan with file-by-file changes, migration scripts, or a rollout sequence — those follow once this shape is reviewed and authorised.

---

## 7. Open questions for review

- **Retention of superseded draft revisions.** Keeping every draft revision indefinitely is cheap per-project but unbounded over a project's lifetime; whether to cap/prune old drafts (and on what schedule) is a product decision, not an architecture one, and is left open here.
- **Migration authorisation scope.** Whether a rulebook migration may ever be applied to a project's frozen published revision (as opposed to only ever creating a new draft) needs an explicit policy decision — this design defaults to "never automatically," but an operator-authorised, per-project, logged exception may be a legitimate future need.
- **Hash algorithm and canonicalisation** for `compiled_document_hash` (e.g. how whitespace/ordering-insensitive the hash should be) is an implementation detail deferred to the eventual implementation plan.
