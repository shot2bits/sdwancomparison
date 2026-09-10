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
 * MARKET-UNLOCK CORRECTION ROUND 2 (16 Aug 2026), Robert's non-negotiable
 * product rule -- REPLACING this module's first round entirely:
 *
 *   A project unlocks vendor identities, project-specific matching,
 *   invitations, supplier-room access, messages, responses and exports
 *   ONLY after it has been successfully published as a PUBLIC opportunity
 *   on the Opportunities Board. An unlisted/private Opportunity does NOT
 *   satisfy this rule.
 *
 * Round 1 of this correction (still visible in this file's git history)
 * took a different, and on Robert's explicit review, WRONG, reading:
 * that any real `Opportunity` record -- public OR unlisted -- was a
 * sufficient board prerequisite, since `list_on_board: false` still
 * produced a real, addressable Opportunity (only with `visibility:
 * "unlisted"`). Robert's review rejected this outright: "Do not
 * reinterpret 'not listed on the board' as 'listed privately.'" A private
 * market-unlock workflow may be a legitimate FUTURE product, but it is a
 * separately named lifecycle requiring its own explicit approval -- not a
 * silent side door opened by this module's own board-prerequisite check.
 *
 * THE CANONICAL BOUNDARY this module defines: a project's market is
 * unlocked only once ALL of the following are simultaneously true, and
 * ONLY this module's own persisted record -- ITSELF INTEGRITY-VERIFIED
 * against the records it claims to reference, every time it is read, never
 * trusted on its mere existence -- is ever consulted to answer that
 * question:
 *
 *   1. an immutable FrozenRevision exists for this publish
 *      (published-snapshot.ts), persisted BEFORE this unlock, referenced
 *      by id;
 *   2. a PUBLIC Opportunities Board listing (opportunity-types.ts) was
 *      created successfully for this project, bound to that EXACT frozen
 *      revision (`source_published_revision_id`) -- an unlisted
 *      Opportunity never satisfies this;
 *   3. both records belong to the same project;
 *   4. the matching-basis hash this unlock records agrees with the frozen
 *      revision's own `content_hash` -- never a caller-supplied value;
 *   5. the unlock was committed at a recorded server timestamp.
 *
 * `commitMarketUnlock()` refuses to commit unless all of the above verify.
 * `isMarketUnlocked()`/`getMarketUnlock()` re-verify all of the above on
 * EVERY READ via the same shared predicate (`verifyMarketUnlockBinding`)
 * -- a forged, dangling, or since-invalidated KV row (a referenced
 * FrozenRevision or Opportunity that does not exist, or an Opportunity
 * whose visibility is not "public", or a revision/hash mismatch) is
 * treated as LOCKED, exactly as if no MarketUnlock existed at all.
 */

import { z } from "zod";
import { kvGetJson, kvSetJson, newId } from "@/lib/rfp-store";
import { getFrozenRevision } from "@/lib/published-snapshot";
import { getOpportunity } from "@/lib/rfp-store";
import { marketUnlockBindingValid, supplierCapabilitiesAllowed } from "@/lib/publication-policy";

export const MarketUnlockSchema = z
  .object({
    id: z.string(),
    project_id: z.string(),
    /** The frozen revision this unlock is bound to -- a FrozenRevision id
     *  (published-snapshot.ts), persisted BEFORE this record is committed. */
    published_revision_id: z.string(),
    /** The PUBLIC Opportunities Board record this unlock is bound to.
     *  Required: a MarketUnlock can only ever be constructed once this
     *  exists, is public, and is bound to the exact same revision. */
    board_opportunity_id: z.string(),
    /** Round 2 correction: no longer a caller-supplied claim, and no
     *  longer accepts "unlisted" -- always "public", the literal, only
     *  value that satisfies Robert's non-negotiable rule. Kept as a named
     *  field (rather than removed) so every reader is honestly told what
     *  it means, rather than assuming; verifyMarketUnlockBinding() below
     *  re-derives and checks this against the live Opportunity on every
     *  read, never trusting the stored value alone. */
    board_visibility: z.literal("public"),
    /** content_hash of the FROZEN revision's content
     *  (published-snapshot.ts's FrozenRevision.content_hash) -- derived
     *  internally at commit time, never accepted from a caller. */
    matching_basis_hash: z.string(),
    /** The PublishedSnapshot id that carries the frozen invited/matched
     *  vendor lists for this unlock -- always the SAME id as
     *  published_revision_id (see published-snapshot.ts's FrozenRevision
     *  doc comment for why). */
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

/**
 * THE shared integrity check. Called by BOTH commitMarketUnlock() (refusing
 * to commit if it fails) and every read path (getMarketUnlock/
 * isMarketUnlocked), so a stored-but-invalid record is treated identically
 * to a missing one everywhere in the codebase -- never two different
 * answers depending on which function asked.
 *
 * Verifies, against the REAL persisted records (never the unlock row's own
 * claims alone):
 *   - the referenced FrozenRevision exists and belongs to this project;
 *   - the referenced Opportunity exists, belongs to this project
 *     (source_rfp_id), is PUBLIC (visibility === "public" -- an unlisted
 *     Opportunity fails this check, by Robert's non-negotiable rule), and
 *     is bound to this EXACT revision (source_published_revision_id
 *     matches);
 *   - the unlock's recorded matching_basis_hash agrees with the frozen
 *     revision's own content_hash.
 */
export async function verifyMarketUnlockBinding(candidate: {
  project_id: string;
  published_revision_id: string;
  board_opportunity_id: string;
  matching_basis_hash: string;
}): Promise<boolean> {
  const revision = await getFrozenRevision(candidate.published_revision_id);
  const opportunity = await getOpportunity(candidate.board_opportunity_id);
  return marketUnlockBindingValid({
    revisionExists: Boolean(revision),
    revisionProjectMatches: revision?.project_id === candidate.project_id,
    revisionHashMatches: revision?.content_hash === candidate.matching_basis_hash,
    opportunityExists: Boolean(opportunity),
    opportunityProjectMatches: opportunity?.source_rfp_id === candidate.project_id,
    opportunityIsPublic: opportunity?.visibility === "public",
    opportunityRevisionMatches: opportunity?.source_published_revision_id === candidate.published_revision_id,
  });
}

/**
 * Read a MarketUnlock, re-verifying its binding against the live records it
 * references. Returns null -- not the stored row -- when that verification
 * fails, so a forged/dangling/invalidated row is indistinguishable from "no
 * unlock exists" to every caller.
 */
export async function getMarketUnlock(projectId: string): Promise<MarketUnlock | null> {
  const raw = await kvGetJson<MarketUnlock>(key(projectId));
  if (!raw) return null;
  const parsed = MarketUnlockSchema.safeParse(raw);
  if (!parsed.success) return null;
  const verified = await verifyMarketUnlockBinding(parsed.data);
  if (!verified) return null;
  return parsed.data;
}

/**
 * Commit the market-unlock record. Called exactly once per genuine publish
 * sequence, strictly AFTER: (1) a FrozenRevision has been persisted, (2) a
 * PUBLIC board Opportunity has been created successfully and bound to that
 * exact revision. Never speculatively, never before either of those, never
 * on a board failure, never for an unlisted Opportunity.
 *
 * The caller-facing input is deliberately minimal -- just the three ids --
 * because everything else (visibility, matching_basis_hash) is DERIVED here
 * from the real persisted records, never accepted as a caller assertion.
 * Refuses (throws MarketUnlockBindingError) unless verifyMarketUnlockBinding
 * confirms every condition in this module's header comment.
 *
 * Idempotent by (project_id, published_revision_id, board_opportunity_id):
 * a retried call describing the exact same triple returns the existing
 * record unchanged (unlocked_at never moves backward or forward on a
 * replay -- see the first check below, which returns the existing record
 * completely untouched, never moving unlocked_at) rather than minting a
 * second one.
 *
 * A call naming a genuinely DIFFERENT revision or opportunity than what is
 * currently committed is NOT "an ordinary retry" of the same request -- by
 * construction (see rfp-publish.ts's saga step B / publication-attempt.ts's
 * resume contract), a new `published_revision_id` only ever exists because
 * the caller minted a fresh FrozenRevision for a genuinely NEW publish
 * request (the buyer edited content, or changed publish options) -- an
 * ordinary retry of the SAME request always resumes and reuses the SAME
 * attempt id, and therefore the SAME published_revision_id, which is
 * exactly the case handled (and short-circuited) below. A genuinely new,
 * independently-verified binding is a deliberate republish and is meant to
 * move the market's unlock forward to the newer revision -- refusing it
 * would leave the market unlocked against a stale, superseded snapshot.
 * The integrity check below (verifyMarketUnlockBinding's conditions,
 * inlined here) is what actually guards against a bad overwrite: a bogus or
 * unbound revision/opportunity never verifies, so it never displaces a
 * valid existing unlock.
 */
export class MarketUnlockBindingError extends Error {
  code = "market_unlock_binding_invalid" as const;
}

export async function commitMarketUnlock(input: {
  project_id: string;
  published_revision_id: string;
  board_opportunity_id: string;
}): Promise<MarketUnlock> {
  // Read the RAW stored row directly (not via getMarketUnlock, which would
  // itself re-verify and could mask a stale row we are about to either
  // reuse or correctly refuse to touch) to decide idempotency first.
  const rawExisting = await kvGetJson<MarketUnlock>(key(input.project_id));
  const existing = rawExisting && MarketUnlockSchema.safeParse(rawExisting).success ? (rawExisting as MarketUnlock) : null;
  if (
    existing &&
    existing.published_revision_id === input.published_revision_id &&
    existing.board_opportunity_id === input.board_opportunity_id
  ) {
    // Exact replay of an already-committed unlock (an ordinary retry of the
    // SAME request): never overwrite, never move unlocked_at. Still
    // re-verified below via getMarketUnlock's own path when read -- here we
    // just avoid a redundant write.
    if (await verifyMarketUnlockBinding(existing)) return existing;
    // A forged, stale or damaged exact-triple row is not an idempotent
    // success. Continue through the persisted-record checks below; they
    // either reconstruct the valid binding or refuse it.
  }

  const revision = await getFrozenRevision(input.published_revision_id);
  if (!revision || revision.project_id !== input.project_id) {
    throw new MarketUnlockBindingError("No persisted FrozenRevision found for this project/revision; cannot commit a MarketUnlock.");
  }
  const opportunity = await getOpportunity(input.board_opportunity_id);
  if (!opportunity || opportunity.source_rfp_id !== input.project_id) {
    throw new MarketUnlockBindingError("No persisted public board Opportunity found for this project; cannot commit a MarketUnlock.");
  }
  if (opportunity.visibility !== "public") {
    throw new MarketUnlockBindingError("The Opportunity is not public; an unlisted listing never satisfies the Opportunities Board prerequisite.");
  }
  if (opportunity.source_published_revision_id !== input.published_revision_id) {
    throw new MarketUnlockBindingError("The Opportunity is not bound to this exact frozen revision; cannot commit a MarketUnlock.");
  }

  const record = MarketUnlockSchema.parse({
    id: newId("mktu"),
    project_id: input.project_id,
    published_revision_id: input.published_revision_id,
    board_opportunity_id: input.board_opportunity_id,
    board_visibility: "public" as const,
    matching_basis_hash: revision.content_hash,
    invitation_snapshot_id: input.published_revision_id,
    unlocked_at: Date.now(),
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
 * answers ONE question -- does a committed, INTEGRITY-VERIFIED MarketUnlock
 * record exist for this project, bound to a genuinely PUBLIC board listing
 * -- never inferred from status/phase, and never satisfied by the mere
 * existence of a KV row.
 */
export async function isMarketUnlocked(projectId: string): Promise<boolean> {
  return supplierCapabilitiesAllowed((await getMarketUnlock(projectId)) !== null);
}
