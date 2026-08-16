/**
 * Market-unlock correction round (16 Aug 2026), Robert's ruling on the
 * row-8 checkpoint: `hasPublished(project.status)` is an internal
 * lifecycle predicate (has this project's STATE MACHINE crossed the
 * publication phase), not a market-facing disclosure boundary. The two
 * were conflated in the row-8 hotfix, and the conflation is itself a real
 * defect: `executePublish()` could move a project's status to "published"
 * and invite real, named suppliers to a real, persisted `SupplierConnection`
 * even when the Opportunities Board listing that same publish attempted
 * had already failed (a quality-gate refusal, or any other board-write
 * failure) -- so a caller reading `project.status` (or the row-8 hotfix's
 * `hasPublished()` gate built on it) saw "published" and a real invited
 * vendor's name, while the board itself still read "Not on the public
 * board yet". Two different, genuinely independent facts were being
 * treated as one.
 *
 * THE CANONICAL BOUNDARY this module defines instead: a project's market
 * is unlocked only once ALL of the following are simultaneously true, and
 * ONLY this module's own persisted record is ever consulted to answer that
 * question -- never inferred from `status`, `phase`, or any other broad
 * lifecycle value:
 *
 *   1. a frozen Living Procurement Document revision exists for this
 *      publish (today: the PublishedSnapshot minted for it -- see
 *      published-snapshot.ts; Stage B's fuller versioned envelope will
 *      replace this reference without changing this module's contract);
 *   2. an Opportunities Board listing (an `Opportunity` record -- see
 *      opportunity-types.ts) was created successfully for this project,
 *      bound to that exact frozen revision;
 *   3. the unlock was committed at a recorded server timestamp.
 *
 * "The Opportunities Board" here means the board's own record-keeping
 * system creating a real, addressable `Opportunity`, NOT necessarily
 * public/crawlable visibility -- a buyer who chooses "matched suppliers
 * only" (list_on_board: false) still gets a real Opportunity record, only
 * with `visibility: "unlisted"` (a value opportunity-types.ts already
 * defined for exactly this distinction, previously unused because
 * `listRfpOnBoard()` hardcoded `"public"`). This keeps that legitimate,
 * pre-existing product choice intact while giving the whole system exactly
 * ONE boundary rather than a public-board path and a separate, ungated
 * private-invite path. See the row-8 correction-round checkpoint report
 * for the reasoning and the alternative this module deliberately did not
 * take (never unlocking at all under list_on_board: false).
 */

import { z } from "zod";
import { kvGetJson, kvSetJson, newId } from "@/lib/rfp-store";

export const MarketUnlockSchema = z
  .object({
    id: z.string(),
    project_id: z.string(),
    /** The frozen revision this unlock is bound to -- today, a
     *  PublishedSnapshot id (see published-snapshot.ts), minted BEFORE the
     *  board listing attempt and BEFORE any matching/invitation
     *  computation, so its identity is fixed independent of whether either
     *  of those later steps ever runs. */
    published_revision_id: z.string(),
    /** The Opportunities Board record this unlock is bound to. Required:
     *  a MarketUnlock can only ever be constructed once this exists. */
    board_opportunity_id: z.string(),
    board_visibility: z.enum(["public", "unlisted"]),
    /** content_hash of the frozen revision's content (published-snapshot.ts
     *  contentHash(rfpContentSnapshot(...))) -- what matching was/will be
     *  run against, independently recomputable. */
    matching_basis_hash: z.string(),
    /** The PublishedSnapshot id that carries the frozen invited/matched
     *  vendor lists for this unlock. Today this is always the SAME id as
     *  published_revision_id (one snapshot carries both the frozen document
     *  and, once step 5 of the publish sequence completes, the frozen
     *  invite list) -- kept as its own named field because Stage B's
     *  envelope may separate "document revision" from "invitation record"
     *  identity, and every reader of this field should already be asking
     *  the right question rather than assuming the two are always equal. */
    invitation_snapshot_id: z.string(),
    /** Server timestamp this MarketUnlock was first committed. Immutable
     *  once set -- see commitMarketUnlock(): a later call for the SAME
     *  project+revision+opportunity never moves this. */
    unlocked_at: z.number(),
  })
  .strict();
export type MarketUnlock = z.infer<typeof MarketUnlockSchema>;

function key(projectId: string): string {
  return `rfp:${projectId}:market_unlock`;
}

export async function getMarketUnlock(projectId: string): Promise<MarketUnlock | null> {
  const raw = await kvGetJson<MarketUnlock>(key(projectId));
  if (!raw) return null;
  const parsed = MarketUnlockSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Commit the market-unlock record. Called exactly once per genuine publish
 * sequence, strictly AFTER the board opportunity has been created
 * successfully (see rfp-publish.ts's establishMarketUnlockAndInvite) --
 * never speculatively, never before the board step, never on a board
 * failure.
 *
 * Idempotent by (project_id, published_revision_id, board_opportunity_id):
 * a retried call describing the exact same triple returns the existing
 * record unchanged (unlocked_at never moves backward or forward on a
 * replay) rather than minting a second one. A call for a genuinely NEW
 * revision or opportunity (a fresh publish attempt after an earlier one
 * failed before this point) always creates a new record -- the prior,
 * never-committed attempt left nothing durable to collide with.
 */
export async function commitMarketUnlock(input: {
  project_id: string;
  published_revision_id: string;
  board_opportunity_id: string;
  board_visibility: "public" | "unlisted";
  matching_basis_hash: string;
  invitation_snapshot_id: string;
}): Promise<MarketUnlock> {
  const existing = await getMarketUnlock(input.project_id);
  if (
    existing &&
    existing.published_revision_id === input.published_revision_id &&
    existing.board_opportunity_id === input.board_opportunity_id
  ) {
    return existing;
  }
  const record = MarketUnlockSchema.parse({
    id: newId("mktu"),
    unlocked_at: Date.now(),
    ...input,
  });
  await kvSetJson(key(input.project_id), record);
  return record;
}

/**
 * THE canonical, server-derived predicate. Every route and UI surface
 * governed by the "post-publication capabilities" rule (RfpBuilder's vendor
 * panel, supplier suggestion calls, the connect routes, the share-token
 * project read, the market-report/matching route, the Word/PDF/JSON export
 * route, and the adjacent NDA/thread/evidence-draft/supplier-capability
 * routes) must call this instead of `hasPublished(project.status)`. It
 * answers ONE question -- does a committed MarketUnlock record exist for
 * this project -- never inferred from status/phase.
 */
export async function isMarketUnlocked(projectId: string): Promise<boolean> {
  return (await getMarketUnlock(projectId)) !== null;
}
