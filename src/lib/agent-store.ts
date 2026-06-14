/**
 * Persistence for the autonomy layer (Slice 1): procurement goal, approval
 * queue, audit trail and bid reviews. Built on the shared KV helpers.
 *
 * Key scheme:
 *   rfp:{id}:goal        -> ProcurementGoal JSON
 *   rfp:{id}:approvals   -> ApprovalItem[]   (newest first)
 *   rfp:{id}:audit       -> AuditEntry[]     (capped ring, newest first)
 *   rfp:{id}:reviews     -> BidReview[]      (newest first)
 */

import { kvConfigured, kvGetJson, kvSetJson, kvRaw, newId } from "@/lib/rfp-store";
import {
  ProcurementGoalSchema, ApprovalItemSchema, AuditEntrySchema, BidReviewSchema,
  DigestSchema, AgentRunSchema,
  APPROVAL_TTL_MS,
  type ProcurementGoal, type ApprovalItem, type AuditEntry, type BidReview, type AuditAction,
  type Digest, type AgentRun,
} from "@/lib/agent-types";

const ACTIVE_GOALS_KEY = "agent:goals:active";

/* ---- Goal ---- */

export async function getGoal(rfpId: string): Promise<ProcurementGoal | null> {
  if (!kvConfigured()) return null;
  const data = await kvGetJson<ProcurementGoal>(`rfp:${rfpId}:goal`);
  if (!data) return null;
  const parsed = ProcurementGoalSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export async function saveGoal(goal: ProcurementGoal): Promise<ProcurementGoal> {
  const parsed = ProcurementGoalSchema.parse({ ...goal, updated: Date.now() });
  await kvSetJson(`rfp:${parsed.rfp_id}:goal`, parsed);
  // Maintain the active-goal index the run loop iterates. Only 'active' goals
  // are eligible; pausing/achieving/cancelling removes the RFP from the loop.
  if (parsed.status === "active") await kvRaw(["SADD", ACTIVE_GOALS_KEY, parsed.rfp_id]);
  else await kvRaw(["SREM", ACTIVE_GOALS_KEY, parsed.rfp_id]);
  return parsed;
}

/** RFP ids with an active procurement goal (the run loop's candidate set). */
export async function listActiveGoalRfpIds(): Promise<string[]> {
  if (!kvConfigured()) return [];
  return ((await kvRaw(["SMEMBERS", ACTIVE_GOALS_KEY])) as string[]) ?? [];
}

export async function upsertGoal(rfpId: string, patch: Partial<ProcurementGoal>): Promise<ProcurementGoal> {
  const now = Date.now();
  const current = (await getGoal(rfpId)) ?? ProcurementGoalSchema.parse({ rfp_id: rfpId, created: now, updated: now });
  return saveGoal({ ...current, ...patch, rfp_id: rfpId });
}

/* ---- Audit trail ---- */

export async function listAudit(rfpId: string): Promise<AuditEntry[]> {
  return (await kvGetJson<AuditEntry[]>(`rfp:${rfpId}:audit`)) ?? [];
}

export async function recordAudit(entry: {
  rfp_id: string; action: AuditAction; actor?: "agent" | "buyer" | "system";
  summary?: string; rationale?: string; ref?: string;
}): Promise<AuditEntry> {
  const parsed = AuditEntrySchema.parse({
    id: newId("aud"), rfp_id: entry.rfp_id, action: entry.action,
    actor: entry.actor ?? "agent", summary: entry.summary ?? "",
    rationale: entry.rationale ?? "", ref: entry.ref ?? "", ts: Date.now(),
  });
  const all = await listAudit(entry.rfp_id);
  all.unshift(parsed);
  await kvSetJson(`rfp:${entry.rfp_id}:audit`, all.slice(0, 500));
  return parsed;
}

/* ---- Approval queue ---- */

export async function listApprovals(rfpId: string): Promise<ApprovalItem[]> {
  const all = (await kvGetJson<ApprovalItem[]>(`rfp:${rfpId}:approvals`)) ?? [];
  // Lazy-expire stale pending proposals on read.
  const now = Date.now();
  let changed = false;
  const out = all.map((a) => {
    if (a.status === "pending" && a.expires < now) { changed = true; return { ...a, status: "expired" as const }; }
    return a;
  });
  if (changed) await kvSetJson(`rfp:${rfpId}:approvals`, out);
  return out;
}

async function writeApprovals(rfpId: string, items: ApprovalItem[]): Promise<void> {
  await kvSetJson(`rfp:${rfpId}:approvals`, items);
}

/** Create a pending proposal. Deduped by (kind, vendor_slug, payload.question) so
 *  the agent never queues the same clarification twice. */
export async function proposeApproval(input: {
  rfp_id: string; kind: ApprovalItem["kind"]; vendor_slug?: string; vendor_name?: string;
  summary: string; payload?: Record<string, string>; rationale: string; source_review_id?: string;
}): Promise<ApprovalItem | null> {
  const all = await listApprovals(input.rfp_id);
  const sig = `${input.kind}|${input.vendor_slug ?? ""}|${(input.payload?.question ?? "").trim().toLowerCase()}`;
  const dup = all.find((a) =>
    (a.status === "pending" || a.status === "approved" || a.status === "executed") &&
    `${a.kind}|${a.vendor_slug}|${(a.payload.question ?? "").trim().toLowerCase()}` === sig,
  );
  if (dup) return null; // idempotent: do not re-propose
  const now = Date.now();
  const item = ApprovalItemSchema.parse({
    id: newId("apr"), rfp_id: input.rfp_id, kind: input.kind,
    vendor_slug: input.vendor_slug ?? "", vendor_name: input.vendor_name ?? "",
    summary: input.summary, payload: input.payload ?? {}, rationale: input.rationale,
    source_review_id: input.source_review_id ?? "", status: "pending",
    created: now, expires: now + APPROVAL_TTL_MS, decided: null,
  });
  all.unshift(item);
  await writeApprovals(input.rfp_id, all);
  await recordAudit({ rfp_id: input.rfp_id, action: "propose_action", summary: input.summary, rationale: input.rationale, ref: item.id });
  return item;
}

export async function getApproval(rfpId: string, id: string): Promise<ApprovalItem | null> {
  return (await listApprovals(rfpId)).find((a) => a.id === id) ?? null;
}

export async function setApprovalStatus(rfpId: string, id: string, status: ApprovalItem["status"]): Promise<ApprovalItem | null> {
  const all = await listApprovals(rfpId);
  const idx = all.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], status, decided: Date.now() };
  await writeApprovals(rfpId, all);
  return all[idx];
}

/* ---- Bid reviews ---- */

export async function listReviews(rfpId: string): Promise<BidReview[]> {
  return (await kvGetJson<BidReview[]>(`rfp:${rfpId}:reviews`)) ?? [];
}

export async function saveReview(review: BidReview): Promise<BidReview> {
  const parsed = BidReviewSchema.parse(review);
  const all = await listReviews(parsed.rfp_id);
  const idx = all.findIndex((r) => r.response_id === parsed.response_id);
  if (idx >= 0) all[idx] = parsed; else all.unshift(parsed);
  await kvSetJson(`rfp:${parsed.rfp_id}:reviews`, all.slice(0, 100));
  return parsed;
}

/* ------------------------------------------------------------------ */
/* Locks (code-enforced, TTL self-release)                             */
/* ------------------------------------------------------------------ */

/**
 * Acquire a lock with SET NX PX. Returns a token if acquired, null if held by
 * someone else. The PX TTL guarantees a crashed run never wedges the lock.
 */
export async function acquireLock(key: string, ttlMs: number): Promise<string | null> {
  if (!kvConfigured()) return null;
  const token = newId("lock");
  const res = await kvRaw(["SET", key, token, "NX", "PX", ttlMs]);
  return res === "OK" || res === "ok" ? token : null;
}

/** Release a lock only if we still own it (value match), so we never delete a
 *  lock that already expired and was re-acquired by another run. */
export async function releaseLock(key: string, token: string): Promise<void> {
  if (!kvConfigured()) return;
  const current = (await kvRaw(["GET", key])) as string | null;
  if (current === token) await kvRaw(["DEL", key]);
}

/** Force-clear a lock (admin escape hatch). */
export async function forceClearLock(key: string): Promise<void> {
  if (!kvConfigured()) return;
  await kvRaw(["DEL", key]);
}

/* ------------------------------------------------------------------ */
/* Digests (buyer-facing run output)                                   */
/* ------------------------------------------------------------------ */

export async function listDigests(rfpId: string): Promise<Digest[]> {
  return (await kvGetJson<Digest[]>(`rfp:${rfpId}:digests`)) ?? [];
}

export async function lastDigestAt(rfpId: string): Promise<number> {
  const all = await listDigests(rfpId);
  return all.length ? all[0].created : 0;
}

export async function saveDigest(digest: Digest): Promise<Digest> {
  const parsed = DigestSchema.parse(digest);
  const all = await listDigests(parsed.rfp_id);
  all.unshift(parsed);
  await kvSetJson(`rfp:${parsed.rfp_id}:digests`, all.slice(0, 30));
  return parsed;
}

/* ------------------------------------------------------------------ */
/* Run reports                                                         */
/* ------------------------------------------------------------------ */

export async function saveRun(run: AgentRun): Promise<AgentRun> {
  const parsed = AgentRunSchema.parse(run);
  await kvSetJson(`agent:run:${parsed.id}`, parsed);
  await kvRaw(["LPUSH", "agent:runs", parsed.id]);
  await kvRaw(["LTRIM", "agent:runs", 0, 199]);
  return parsed;
}

export async function listRuns(limit = 20): Promise<AgentRun[]> {
  if (!kvConfigured()) return [];
  const ids = ((await kvRaw(["LRANGE", "agent:runs", 0, limit - 1])) as string[]) ?? [];
  const out: AgentRun[] = [];
  for (const id of ids) { const r = await kvGetJson<AgentRun>(`agent:run:${id}`); if (r) out.push(r); }
  return out;
}
