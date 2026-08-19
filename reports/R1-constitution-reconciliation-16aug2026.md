# R1 — Programme Constitution Reconciliation

**Date:** 16 August 2026
**Trigger:** "Netify Living Procurement OS — Programme Constitution & Claude Control Brief" v1.0 (16 Aug 2026), uploaded and declared the controlling authority for this programme.
**Scope of this report:** read-only investigation only. No code has been edited. This is the mandatory pre-code reconciliation the Constitution and the user's instruction both require.

Status labels used throughout, exactly as specified: **LIVE / MERGED**, **NOT DEPLOYED / IMPLEMENTED**, **NOT MERGED / DESIGNED ONLY**, **MISSING**, **BLOCKED**.

---

## 1. Current branch and commit SHA

- Working directory: `/tmp/sdwan_reliability_gate`
- Branch: `fix/row8-pre-publish-supplier-disclosure`
- HEAD: `777bf9fc3cc24168497d433682320f4e80d2c56c` — "Market-unlock correction round 2: only a PUBLIC board publication may ever unlock the market"
- `origin/main` (freshly fetched): `f14a956a3a2dc7eacb661dc3562d8a3d57d291e6`
- Branch position: 3 commits ahead of `origin/main`, 0 behind (`60c70e5`, `7608a09`, `777bf9f`); merge-base = `origin/main` HEAD exactly, so there is zero drift from main at the point this branch was cut.
- Working tree: clean under `src/` (no uncommitted source changes). Numerous untracked report/bundle/screenshot artefacts exist under `reports/` from this and prior rounds — evidence files only, not source.
- This branch exists **only locally**. `git ls-remote origin | grep row8` returns nothing; `git branch -r --contains 777bf9f` returns nothing. It has not been pushed.

**Status: NOT MERGED / DESIGNED ONLY** is not quite right for this — the code is fully implemented and evidenced, just not merged. Using the label set as given, the closest fit is **NOT DEPLOYED / IMPLEMENTED**, and I flag explicitly below where "implemented-but-unmerged" and "designed-only" diverge, since the Constitution's own table conflates them in places.

---

## 2. What is genuinely merged into `main`

Verified directly against `origin/main` tree contents (`git ls-tree`, `git show main:<path>`), not assumed:

| Capability | Status |
|---|---|
| Living Canvas UI, deterministic compiler, source/fact/decision ledgers (`ProjectDesk.tsx`, `procurement-document.ts`, workspace ledger modules) | **LIVE / MERGED** |
| MCP JSON-RPC transport and tool catalogue (`src/app/api/mcp/route.ts`, `mcp-server-metadata.json` route) | **LIVE / MERGED** |
| Agent mission scaffolding — cron routes, `agent-run.ts` | **LIVE / MERGED** |
| All prior topic branches except the two below (`fix/sector-suggestion-decline-reversal`, `living-procurement-canvas-phase-1-2`, `living-procurement-canvas-phase-2-hotfix-rfpbuilder-disclosure`, `living-procurement-os-phase3-stage-a`, `living-procurement-uk-decision-maker`) | **LIVE / MERGED** |
| `fact-ledger-reliability-gate` | **LIVE / MERGED** — confirmed by `git merge-base --is-ancestor fact-ledger-reliability-gate main` (true). This branch predates a large amount of subsequent `main` work (the diff against current `main` shows ~15,000 lines removed relative to that old branch tip, i.e. `main` has since replaced/expanded that code) — it is fully absorbed and stale, not a live loose end. No action needed. |
| `fix/row8-pre-publish-supplier-disclosure` (current branch, 3 commits incl. `777bf9f`) | **NOT MERGED** |

Only one branch is outstanding: the current one.

---

## 3. What is deployed on the canonical production URL

Canonical URL used throughout, per instruction: **https://netify.co.uk/**. `app.netify.co.uk` and `sase.netify.co.uk` are legacy hosts; `main`'s `next.config.ts` 301-redirects both to the canonical host, and this app is mounted under it at `basePath: "/sase"`. Verified live via WebFetch (not curl):

| Surface | Status |
|---|---|
| `https://netify.co.uk/` marketing site (RFP Builder, Opportunities Board, MCP AI Assistant Connector referenced) | **LIVE / MERGED** |
| `https://netify.co.uk/sase/rfp-builder/new/` | **LIVE / MERGED** (route resolves at 200; exact client-rendered copy not independently confirmed by WebFetch since it can't execute the client bundle — see caveat below) |
| `https://netify.co.uk/sase/opportunities/board/` | **LIVE / MERGED** — real board, 15 genuinely open listings at time of check |
| Row-8 / market-unlock disclosure correction (any of `60c70e5`, `7608a09`, `777bf9f`) | **NOT DEPLOYED** — confirmed directly: `main`'s live `GET /api/rfp/[id]/connect` route has **no `hasPublished` gate at all today** (checked via `git show main:...connect/route.ts`), and `main`'s live `RfpBuilder.tsx` still ships the pre-correction copy ("Submit to your matched vendors" / "Submitting...") gated only on `hasPublished`, with no `marketUnlocked` / `publicationLocked` state anywhere in it. |
| Stage B canonical envelope (compiler-pinned hashed revisions, `FrozenRevision`, exact save/reopen) | **MISSING** — no such code exists on `main` or on any branch, including the current one. This is genuinely unbuilt, not merely unmerged. |

**Caveat on production checks:** verification used WebFetch only, per the operating rules (no curl/wget). WebFetch confirms server-rendered HTML/route resolution but cannot execute the client-side React bundle, so exact live button copy on the wizard route is inferred from the confirmed `main` source (§ above), not from rendering the live page. I treat that as sufficient corroboration since it's the same code path that serves the route.

---

## 4. What is only designed, locally implemented, bundled or tested

| Item | Status |
|---|---|
| Row-8 pre-publish supplier-disclosure gate + market-unlock correction (round 1–3), commit `777bf9f` | **NOT DEPLOYED / IMPLEMENTED** — fully implemented, fixture-tested (unit + live-demo network fixtures), clean-room bundle-verified, screenshot-evidenced. Not pushed, not merged, not deployed. This matches the Constitution's own table exactly, which independently names `777bf9f` under "PROVED/BUNDLED." |
| Stage B canonical versioned project envelope (compiler-pinned hashed revisions, revision history, frozen/draft states) | **NOT MERGED / DESIGNED ONLY** — a design document exists (`reports/stage-b-canonical-envelope-design-16aug2026.md`, produced in this engagement); no implementation code exists anywhere in the repository. |
| Exact save → close → reopen reproducing the stored revision | **MISSING** — dependent on Stage B; nothing to reopen exactly today since there is no revision-hashing/freeze mechanism at all. |
| Canonical published Living Procurement Document as the thing every screen projects from | **MISSING** — confirmed the old RFP pipeline (`rfp-publish.ts`, `RfpBuilder.tsx`) still owns publish, board listing, vendor room and current exports; `ProjectDesk.tsx`'s compiler output is not what's wired to `executePublish()`. |
| Procurement Room | **MISSING** — no `procurement-room`-named code anywhere on `main` (confirmed by tree search). |
| Canonical native exports (DOCX/PDF/JSON-CSV keyed to a named revision + hash) | **MISSING** — no matching export code found on `main`. |
| MCP tool authority/classification, revision binding, server-side least-privilege enforcement | **NOT MERGED / DESIGNED ONLY** — the transport and catalogue are live, but the Constitution's required tool-tier classification and server-side authority checks are not implemented anywhere; this is explicitly named "next" in the Constitution, not "done."|

---

## 5. Differences between the Constitution and repository reality

Two genuine differences worth flagging plainly, per "stop and report a contradiction rather than improvise around it." Neither blocks Stage B, so I am not treating either as a hard stop — reporting them as required, then proceeding.

**(a) The Constitution's own repository-truth table is materially accurate but under-states the live severity of one gap.** The Constitution lists "exact save/reopen" and "canonical published document" as MISSING, and lists the row-8 correction as bundled-not-deployed. All independently confirmed. What the Constitution's table does not spell out, and which I think is the single most important fact from this reconciliation: **`main`'s live `connect` route has zero pre-publication disclosure gating today** — not "old copy," not "softer wording," literally no `hasPublished` check of any kind currently guards vendor identity/matching data on that route in production. Invariant 5 ("Pre-publish means private") is being violated in production right now, and the fix for it (the row-8 branch) exists, is evidenced, and is sitting unmerged. I'm surfacing this as the clearest actionable instance of "repository reality" the Constitution should be read against — recommend treating the row-8 branch's merge (GATE 0 in the Constitution's own authorised sequence) as the most time-sensitive open item, ahead of or alongside starting Stage B, since it's a live product-law violation rather than a design gap. This is not a contradiction of the Constitution — the Constitution's own GATE 0 already asks for exactly this — it's a severity note.

**(b) A structural nuance in the publication saga, not a contradiction.** The Constitution's product-law saga names an explicit, separate step D — "Verify public visibility and identifier bindings" — sitting between "create the public Opportunity" (C) and "commit MarketUnlock" (E). My round-3 implementation (`market-unlock.ts` / `publication-attempt.ts`) performs that verification *inside* `commitMarketUnlock()` via `verifyMarketUnlockBinding()`, rather than as a preceding, independently-observable saga step. Functionally the same checks run before the unlock is durable and the same rollback guarantees hold (failure before commit leaves the project unpublished, no orphan unlock), so I don't believe this is a product-law violation. But it is a real structural difference from how the Constitution phrases the saga, and since Stage B's envelope work sits adjacent to this code, I'll treat "keep verification as its own explicit step, not folded into commit" as a design constraint going into Stage B and any future revisit of the publication saga, rather than silently reshaping it now (that would be scope expansion beyond Stage B, which is out of bounds per the instruction). Flagging it here rather than improvising a saga rewrite.

No other contradictions found. Everything else in the Constitution's stated product law (canonical domain, immutable lifecycle states, frozen/published definitions, three-state buyer-facing truth) is consistent with what exists in the repository and does not conflict with anything implemented or merged.

---

## Summary table

| # | Item | Status |
|---|---|---|
| 1 | Branch `fix/row8-pre-publish-supplier-disclosure` @ `777bf9f` | Local only, 3 commits ahead of `origin/main`, 0 behind |
| 2 | Everything except current branch | **LIVE / MERGED** into `main` |
| 3 | Marketing site, RFP Builder route, Opportunities Board, MCP transport | **LIVE / MERGED** on https://netify.co.uk/ |
| 3 | Row-8 disclosure gate on production `connect` route | **BLOCKED** — fix implemented, not deployed; live gap exists today |
| 4 | Row-8 / market-unlock correction (`777bf9f`) | **NOT DEPLOYED / IMPLEMENTED** |
| 4 | Stage B canonical envelope | **NOT MERGED / DESIGNED ONLY** |
| 4 | Exact save/reopen, canonical published document, Procurement Room, native exports | **MISSING** |
| 4 | MCP tool authority/classification | **NOT MERGED / DESIGNED ONLY** |
| 5 | Live disclosure gap on `connect` route not fully captured by Constitution's table severity | Reported, not a contradiction — GATE 0 already covers it |
| 5 | Saga step D (explicit verify) vs. round-3's folded verification | Reported as a design constraint for Stage B, not a contradiction |

---

## Next step

No contradiction blocks progress. Per the instruction ("investigate the repository, make evidence-based decisions within scope and proceed"), I'm proceeding to Stage B: the canonical versioned project envelope, on a new branch, preserving the existing source/fact/decision/removal ledgers, adding compiler-pinned hashed document revisions, fixture-first, with the eight required proofs. No push, merge, deploy, production data change, supplier invitation, or test-opportunity publication will occur without explicit permission. Stage C, Stage D, Procurement Room, MCP expansion and aesthetic rewrites remain out of scope.

Recommend, as a separate decision for you: whether to also authorise merging the already-evidenced row-8 branch (GATE 0) given the live disclosure gap noted in §5(a) — that is a merge/deploy action and stays gated on your explicit permission regardless.
