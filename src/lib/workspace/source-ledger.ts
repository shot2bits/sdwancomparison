/**
 * The source ledger (Fact Ledger Reliability Gate, FOURTH amendment, 13 Aug
 * 2026 — Robert's "three connected gaps" correction to the third
 * amendment's SourceTurn design).
 *
 * The third amendment introduced `SourceTurn[]`: an immutable, per-message
 * log of the buyer's own verbatim wording, kept independent of whatever
 * extraction managed to place. Robert's review of that amendment found it
 * incomplete in three connected ways, all fixed by the same underlying
 * change — promoting the ledger from transient React state into canonical,
 * structured, persisted Project data:
 *
 *   1. Paste/drop stored the CHUNK the extractor read (already trimmed and
 *      capped by chunkForIngest's honest, disclosed extraction budget), not
 *      the buyer's original entry — so a paste past roughly 10,500
 *      characters silently lost its tail from the ledger too, the very
 *      thing the ledger exists to prevent. Fixed at the call site
 *      (ProjectDesk.tsx's ingestText): the full raw entry is now kept as
 *      ONE ledger entry BEFORE chunking; chunkForIngest's cap governs only
 *      what extraction reads, never what the ledger remembers.
 *   2. Only the FIRST save (project creation) ever sent source turns to the
 *      server. Every later Save or Publish, for a Security Sourcing
 *      project, goes through the re-scope route — which never accepted
 *      source turns at all — so wording typed after the first save was
 *      never reaching the persisted record. Fixed by threading the ledger
 *      through creation, re-scope, the wizard's create/update routes and
 *      the pre-publish refresh path, all merging into ONE persisted field.
 *   3. `SourceTurn[]` existed only in a React component's state, flattened
 *      at save time into `buyer.notes` as a single `" | "`-joined string —
 *      losing each turn's id, timestamp and boundary the moment it left
 *      the browser. Not durable, and not a shape a future compiler (Canvas)
 *      could safely walk. Fixed by this module: a real, structured,
 *      canonical field on `ProjectDetails` (see rfp-types.ts's
 *      `source_ledger`), each entry keeping its own stable id, timestamp,
 *      exact text and input channel. `buyer.notes` may still carry a
 *      human-readable projection of it (extract.ts's notesWithSourceTurns
 *      already does this, unchanged), but the projection is never the
 *      canonical store again.
 *
 * This module holds the one shape both the client (ProjectDesk.tsx) and
 * every server write path (create-project.ts, rescope-project.ts, the
 * wizard's /api/rfp routes) share, plus the two pure operations every one
 * of those paths needs: turning untrusted request-body JSON into validated
 * entries, and merging a batch of entries into an existing ledger without
 * ever duplicating or discarding one.
 */

import { z } from "zod";
import type { SecurityRequirementInput } from "@/lib/security/rulebook";

/** How the buyer's words arrived. Mirrors ProjectDesk.tsx's own three
 *  non-command entry points (send()'s typed box, and ingestText()'s two
 *  callers for a pasted or dropped block) — never a fourth value invented
 *  here that the client doesn't actually have. */
export const SOURCE_LEDGER_VIA = ["typed", "paste", "drop"] as const;
export type SourceLedgerVia = (typeof SOURCE_LEDGER_VIA)[number];

/**
 * One immutable turn. `id` is the merge key (gap 2/3): generated once, on
 * the client, the moment the turn is captured (ProjectDesk.tsx's
 * newSourceTurnId()), and sent unchanged on every subsequent save — so
 * "save this project three times without changing the chat" and "save it
 * once, close the tab, reopen and save again" both converge on the exact
 * same ledger, never a duplicate. `text` is never trimmed of internal
 * content, only of the same outer whitespace chunkForIngest() already
 * normalises away (CRLF -> LF, leading/trailing blank) — the source ledger
 * and the extractor read the identical normalised text, so "what the
 * ledger kept" and "what extraction saw" never quietly diverge.
 */
export const SourceLedgerEntrySchema = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1),
    at: z.number(),
    via: z.enum(SOURCE_LEDGER_VIA).default("typed"),
  })
  .strict();
export type SourceLedgerEntry = z.infer<typeof SourceLedgerEntrySchema>;

/**
 * Untrusted request-body JSON -> validated entries. Best-effort per entry
 * (Robert's own "duplication is safer than disappearance" principle,
 * carried over from the extractor to its own persistence layer): one
 * malformed item in a batch drops only that item, never the whole save —
 * losing every turn in a request because one had a missing field would be
 * exactly the kind of silent loss this module exists to close.
 */
export function parseIncomingSourceTurns(raw: unknown): SourceLedgerEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: SourceLedgerEntry[] = [];
  for (const item of raw) {
    const parsed = SourceLedgerEntrySchema.safeParse(item);
    if (parsed.success && parsed.data.text.trim()) out.push(parsed.data);
  }
  return out;
}

/**
 * The one merge every write path (creation, re-scope, the wizard's create
 * and update routes) shares: append every incoming entry whose id is not
 * already present, in the order given, and change nothing else. Never
 * removes, reorders or edits an existing entry — accretes, exactly like
 * every other part of a Project record already does (rescope-project.ts's
 * own words: "the record accretes, never rewrites"). Calling this with the
 * SAME batch twice (a buyer who saves repeatedly without adding anything
 * new) is a no-op the second time: idempotent by construction, which is
 * what makes "repeated save operations do not duplicate turns" true
 * without any separate de-duplication pass anywhere else.
 */
export function mergeSourceLedger(existing: SourceLedgerEntry[], incoming: SourceLedgerEntry[]): SourceLedgerEntry[] {
  const seen = new Set(existing.map((e) => e.id));
  const merged = existing.slice();
  for (const entry of incoming) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    merged.push(entry);
  }
  return merged;
}

/**
 * Fifth amendment (13 Aug 2026), Robert's gap 1: "paste/drop is still not
 * retained exactly." The fourth amendment moved source-turn capture out of
 * chunkForIngest's per-chunk loop (fixing the TRUNCATION half of the bug),
 * but ProjectDesk.tsx's ingestText() still ran the buyer's raw entry
 * through `.replace(/\r\n/g, "\n").trim()` before keeping it — the exact
 * normalisation chunkForIngest() applies to ITS OWN internal copy for
 * extraction. Applying that same normalisation to the LEDGER'S copy too
 * meant CRLF line endings were silently rewritten and leading/trailing
 * content was silently dropped, even though the ledger's whole purpose is
 * to hold the buyer's words exactly as given.
 *
 * This function is the fix: the ONE operation between a raw clipboard/
 * dropped-file string and what the source ledger keeps for it. It is
 * identity on the string's content — the only transformation is coercing
 * a non-string (null/undefined) to "", the same defensive coercion
 * chunkForIngest() itself does before IT normalises. No trim, no CRLF
 * rewrite, no whitespace collapse: whatever the buyer pasted or dropped is
 * exactly what this returns.
 *
 * chunkForIngest() is untouched and still receives the SAME untouched raw
 * string directly (ProjectDesk.tsx calls chunkForIngest(raw), not
 * chunkForIngest(captureRawSourceEntry(raw))) — it derives its own
 * normalised copy internally, for extraction only, exactly as it always
 * has. The two copies (ledger's exact original, extraction's normalised
 * working copy) are independent from this point on: extraction's
 * normalisation can never again leak into what the ledger remembers.
 *
 * Exported and called directly by ProjectDesk.tsx's ingestText() — not
 * duplicated inline — specifically so a fixture can exercise this exact
 * function (then the real request parsing and persistence layers behind
 * it) rather than a hand-rolled stand-in that could silently drift from
 * what production actually calls. That drift is precisely what let this
 * bug pass the fourth amendment's own fixture undetected: the fixture
 * applied the identical normalisation itself before calling
 * buildSecurityProject(), so it never touched the real capture path at
 * all.
 */
export function captureRawSourceEntry(raw: unknown): string {
  return String(raw ?? "");
}

/**
 * The other half of "rehydrate the ledger when an existing project is
 * reopened" -- a pure, trivial shape map from the persisted canonical
 * `source_ledger` back into the working-copy shape a client keeps while
 * chatting. Relocated here (fifth amendment, 13 Aug 2026) from
 * ProjectDesk.tsx, where it was built in the fourth amendment but genuinely
 * unwired (no caller yet reopened an existing project). Robert's ruling on
 * the fourth amendment's flag was the MINIMAL resume: ProjectDesk.tsx's
 * arrival effect now calls this for real, for a Security Sourcing project
 * whose id and manage token arrive on the URL (the same `?manage=`
 * convention already used by /rfp-builder/{id}?manage= and every other
 * owner-gated link in this app). One real entry point exists: the project
 * dashboard's "Add more detail" link (project/[id]/page.tsx).
 *
 * Moved into this module -- not left as a client-only helper -- for the
 * same reason captureRawSourceEntry lives here rather than being
 * hand-rolled inline: so a fixture can call the EXACT function
 * ProjectDesk.tsx's resume effect calls, against real persisted
 * `source_ledger` data returned by the real routes, rather than trusting a
 * duplicate that could silently drift from what production actually runs.
 * `SourceTurn` (ProjectDesk.tsx's local working-copy type) is now a type
 * alias for `SourceLedgerEntry` -- the two shapes were already identical
 * field-for-field, so this relocation changes no data, only where the pure
 * mapping function lives.
 *
 * Still deliberately narrow, per Robert's "Minimal resume link" ruling:
 * facts and receipts are NOT restored, only source_ledger (and, as of the
 * sixth amendment below, the persisted requirement, as an immutable base
 * a resumed session's own new facts merge over -- see
 * resumeStateFromProject() and draft.ts's mergeRequirementBase() for why a
 * flattened requirement alone is not the same thing as a restored fact
 * ledger, and what that means for what's preserved).
 */
export function hydrateSourceTurns(ledger: SourceLedgerEntry[] | undefined): SourceLedgerEntry[] {
  return (ledger ?? []).map((e) => ({ id: e.id, text: e.text, at: e.at, via: e.via }));
}

/**
 * Sixth amendment (13 Aug 2026), Robert's finding on the fifth amendment's
 * resume: rehydrating only `source_ledger` left `facts` (and therefore
 * `requirementFrom(facts)`, and therefore every subsequent Save/Publish)
 * built from nothing but the resumed session's own new messages -- a
 * sufficiently detailed new message could clear the confidence gate on its
 * own, and rescope-project.ts's `requirement: input.requirement` REPLACES
 * the project's whole existing `engine_data.requirement` with it,
 * silently discarding the buyer's earlier sector, estate, drivers,
 * constraints and buying intent.
 *
 * This function is the single place that decides what a resume actually
 * restores from a fetched project -- the ONE function ProjectDesk.tsx's
 * arrival effect calls, and the same function a fixture calls directly
 * against a real project returned by the real GET route, so "what
 * ProjectDesk restores" and "what this fixture proves" can never quietly
 * drift apart. Scoped to Security Sourcing only (returns null otherwise --
 * a non-engine/wizard project's Save path is the wizard PUT route, which
 * this resume flow does not drive, so resuming into one here would
 * silently misroute the next save). Two things come back:
 *
 *   - sourceLedger: the buyer's verbatim words, reshaped via
 *     hydrateSourceTurns() above.
 *   - requirementBase: the project's persisted `engine_data.requirement`
 *     verbatim, or null if the project has never been scoped. This is NOT
 *     a fact ledger (it has no per-field quote/reason/provenance -- that
 *     was never persisted structurally), so it is never turned into fake
 *     WorkspaceFacts. It is kept as an immutable base and merged with
 *     whatever the resumed session's own facts derive, via
 *     draft.ts's mergeRequirementBase() -- see that function's doc
 *     comment for the full merge rule (a resumed session's own scalar
 *     answers win; every list field accretes; nothing already on the
 *     record is ever silently dropped).
 */
export function resumeStateFromProject(
  proj:
    | {
        engine?: string;
        source_ledger?: SourceLedgerEntry[];
        engine_data?: { requirement?: unknown } | null;
      }
    | null
    | undefined,
): { sourceLedger: SourceLedgerEntry[]; requirementBase: SecurityRequirementInput | null } | null {
  if (!proj || proj.engine !== "security_sourcing") return null;
  const req = proj.engine_data?.requirement;
  return {
    sourceLedger: hydrateSourceTurns(proj.source_ledger),
    requirementBase: req && typeof req === "object" ? (req as SecurityRequirementInput) : null,
  };
}
