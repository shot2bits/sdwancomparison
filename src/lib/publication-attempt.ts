/**
 * Market-unlock correction round 2 (16 Aug 2026), requirement 4: the
 * recoverable publication saga's own bookkeeping record.
 *
 * WHY THIS EXISTS, stated plainly: Robert's ruling requires that
 * `project.status` never move to "published" until board publication has
 * genuinely succeeded AND the market has unlocked (requirement 2), but the
 * project's `RfpStatus`/`ProjectPhase` state machine (project-machine.ts)
 * has no intermediate "publishing" phase, and adding one would mean
 * touching `STATUS_FOR_PHASE`, `PHASE_FOR_LEGACY_STATUS`,
 * `PROJECT_TRANSITIONS` and every consumer of those types -- a large,
 * risky change to a state machine that governs far more than publication.
 * Robert's own instruction offers the alternative taken here: "introduce an
 * explicit prepared/failed attempt record or a publishing state." This file
 * is that record -- entirely separate from `project.status`, which is only
 * ever written at step F of the saga (rfp-publish.ts's executePublish()),
 * strictly after MarketUnlock has been committed at step E.
 *
 * INTERNAL BOOKKEEPING ONLY. This record is never exposed to any
 * governed/supplier-facing route -- a share-token supplier read, a vendor
 * panel, an export -- and its contents (invitation_plan, invited_slugs) are
 * never surfaced except to the owner, for UI "publication incomplete /
 * retry" messaging. It carries no capability of its own: the ONLY thing
 * that unlocks the market is a verified MarketUnlock (market-unlock.ts).
 *
 * RESUME CONTRACT: `executePublish()` computes a content+options-addressed
 * `request_event_id` (the same `publishEventId()` already used for the
 * governed-revision idempotency ledger) for every call. If a stored attempt
 * for this project has the SAME `request_event_id`, the saga RESUMES it --
 * reusing `id`/`board_opportunity_id`/`invitation_plan` exactly as stored,
 * never re-minting or recomputing anything already durable. If the stored
 * attempt has a DIFFERENT `request_event_id` (the buyer edited the draft, or
 * changed publish options, since the last attempt), the saga starts FRESH --
 * a new id, a new FrozenRevision, overwriting this record. That is safe by
 * construction: a superseded attempt, by definition, never reached step E
 * (`unlocked: true`), so nothing external was ever exposed for it and
 * discarding it loses no durable guarantee.
 */

import { kvGetJson, kvSetJson } from "@/lib/rfp-store";
import type { ShortlistInput, ShortlistVendor } from "@/lib/shortlist-core";

export type PublicationAttempt = {
  id: string;
  project_id: string;
  request_event_id: string;
  frozen_content_hash: string;
  /** Set once the board Opportunity has been created/refreshed (saga step C). */
  board_opportunity_id: string | null;
  /** The deterministic invitation plan (saga step D), persisted so a resume
   *  after a crash mid-invite-loop replays the SAME list rather than
   *  recomputing against a shortlist engine/dataset that may have moved on. */
  invitation_plan: { slug: string; name: string }[] | null;
  /** Provider evidence sealed before any board write. Optional so attempts
   *  created before the Neon catalogue contract remain readable. */
  provider_evidence?: Array<{
    slug: string;
    name: string;
    provider_id: string | null;
    revision_id: string | null;
    dataset_version: string | null;
    record: ShortlistVendor;
  }>;
  provider_provenance?: {
    shortlist_contract_version: string;
    provider_contract_version: string;
    dataset_versions: string[];
    loaded_at: string;
  };
  matched_provider_slugs?: string[];
  match_input?: ShortlistInput;
  match_criteria?: string;
  /** Idempotent invite outbox: slugs actually invited so far (saga step G).
   *  Grows monotonically; a resume never re-invites an already-invited slug. */
  invited_slugs: string[];
  /** Mirrors "did step E (commitMarketUnlock) succeed" -- true once, never
   *  reverts. */
  unlocked: boolean;
  /** Mirrors "did step F (project.status -> published) succeed" -- true
   *  once, never reverts. */
  published: boolean;
  created_at: number;
  updated_at: number;
};

function key(projectId: string): string {
  return `rfp:${projectId}:publication_attempt`;
}

export async function getPublicationAttempt(projectId: string): Promise<PublicationAttempt | null> {
  return kvGetJson<PublicationAttempt>(key(projectId));
}

export async function savePublicationAttempt(attempt: PublicationAttempt): Promise<PublicationAttempt> {
  const stamped: PublicationAttempt = { ...attempt, updated_at: Date.now() };
  await kvSetJson(key(attempt.project_id), stamped);
  return stamped;
}

/**
 * Resume-or-start: the one entry point the saga calls at step B. Returns the
 * existing attempt untouched if it matches this exact request; otherwise
 * returns null so the caller mints a fresh one (new id, new FrozenRevision).
 */
export async function loadResumableAttempt(projectId: string, requestEventId: string): Promise<PublicationAttempt | null> {
  const existing = await getPublicationAttempt(projectId);
  if (existing && existing.request_event_id === requestEventId) return existing;
  return null;
}
