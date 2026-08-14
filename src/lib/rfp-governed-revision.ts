/**
 * Living Procurement Canvas Phase 2 (14 Aug 2026): the server-authoritative
 * home for the Phase 1 governed-revision reducer (`resolveGovernedRevision`,
 * `procurement-document.ts`). Phase 1 proved the reducer's CONTRACT with
 * hand-driven fixtures; this file is what makes it a REAL, adopted part of
 * the RFP lifecycle rather than test-script-only machinery.
 *
 * WHY SEQ IS SERVER-DERIVED, NEVER CLIENT-SUPPLIED (Robert's brief:
 * "Browser-local sequence numbers cannot be the durable truth across
 * devices or collaborators"). `nextGovernedSeq()` mints each event's `seq`
 * from an atomic KV counter (`HINCRBY`) keyed by project id -- durable,
 * server-side, monotonic regardless of which device, tab or collaborator
 * made the call. A caller never asserts its own seq; it only ever receives
 * one. This also means the reducer's "stale" branch (`event.seq <=
 * state.lastAppliedSeq`) can never fire from THIS module's own call sites
 * (each call mints a strictly increasing seq before resolving) -- the
 * branch still exists and is still exercised directly against the pure
 * reducer in the fixtures (a client that COULD forge an old seq must still
 * be refused), but it is not reachable through this server-authoritative
 * path by construction, which is itself the point.
 *
 * WHY THIS IS SEPARATE FROM procurement-document.ts: that file is the pure,
 * environment-free compiler module (no KV, no Node `crypto`, importable by
 * a fixture with zero setup). This file is the impure, server-only adapter
 * -- the "real Phase 2 caller" the Phase 1 doc comments anticipated --
 * that gives the pure reducer a durable state store and an atomic sequence
 * source. Kept out of procurement-document.ts so that module's purity
 * (and every existing fixture's zero-setup import) is untouched.
 */

import { kvGetJson, kvSetJson, kvRaw } from "@/lib/rfp-store";
import {
  resolveGovernedRevision,
  INITIAL_GOVERNED_REVISION_STATE,
  type GovernedEvent,
  type GovernedEventKind,
  type GovernedRevisionState,
  type GovernedRevisionResult,
} from "@/lib/workspace/procurement-document";

function stateKey(rfpId: string): string {
  return `rfp:${rfpId}:governed_revision_state`;
}
function counterKey(rfpId: string): string {
  return `rfp:${rfpId}:governed_seq`;
}

export async function loadGovernedRevisionState(rfpId: string): Promise<GovernedRevisionState> {
  return (await kvGetJson<GovernedRevisionState>(stateKey(rfpId))) ?? INITIAL_GOVERNED_REVISION_STATE;
}

async function saveGovernedRevisionState(rfpId: string, state: GovernedRevisionState): Promise<void> {
  await kvSetJson(stateKey(rfpId), state);
}

/** An atomic, durable, per-project monotonic counter -- HINCRBY is a single
 *  atomic Redis/Upstash command, so two concurrent requests for the SAME
 *  project each get a distinct, strictly-increasing seq even if their reads
 *  of `governed_revision_state` race (see `applyGovernedEvent`'s own doc
 *  comment for the honest limit of what that read-modify-write DOES still
 *  leave racy in this checkpoint). */
export async function nextGovernedSeq(rfpId: string): Promise<number> {
  const n = await kvRaw(["HINCRBY", counterKey(rfpId), "seq", 1]);
  return Number(n);
}

/**
 * Resolve and, when applied, PERSIST one governed event for a project.
 * Mints a fresh server-side seq for every call (even one that turns out to
 * be a replay -- harmless, since the reducer's eventId check runs before
 * its seq check, so a genuine replay is still recognised as a replay
 * regardless of which seq this particular attempt received). State is
 * saved ONLY when `applied` is true, matching the pure reducer's own
 * contract that a reopen/replay/stale event never changes state.
 *
 * KNOWN LIMIT, stated plainly rather than left implicit: this is a
 * read-modify-write over two separate KV keys (the atomic seq counter, then
 * a non-atomic get/resolve/set of the state object). Two GENUINELY
 * concurrent requests for the same project (not a double-click/retry, but
 * true parallel writers) could each read the same prior state and one
 * update could be lost. HINCRBY alone prevents seq COLLISION; it does not
 * make the whole state transition a single atomic operation. Real
 * production concurrency safety here would want a KV compare-and-swap or a
 * Lua script; the double-click/retry-after-timeout idempotency this
 * checkpoint's acceptance tests target is a single caller, sequential
 * retries -- which this DOES make safe -- not true concurrent writers,
 * which is flagged here as a follow-on rather than silently assumed solved.
 */
export async function applyGovernedEvent(
  rfpId: string,
  kind: GovernedEventKind,
  eventId: string,
  factsBefore: Record<string, unknown>,
  factsAfter: Record<string, unknown>,
): Promise<GovernedRevisionResult> {
  const seq = await nextGovernedSeq(rfpId);
  const state = await loadGovernedRevisionState(rfpId);
  const event: GovernedEvent = { eventId, kind, seq, factsBefore, factsAfter };
  const result = resolveGovernedRevision(state, event);
  if (result.applied) await saveGovernedRevisionState(rfpId, result.state);
  return result;
}
