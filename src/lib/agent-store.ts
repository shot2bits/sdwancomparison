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

import { kvConfigured, kvGetJson, kvSetJson, newId } from "@/lib/rfp-store";
import {
  ProcurementGoalSchema, ApprovalItemSchema, AuditEntrySchema, BidReviewSchema,
  APPROVAL_TTL_MS,
  type ProcurementGoal, type ApprovalItem, type AuditEntry, type BidReview, type AuditAction,
} from "@/lib/agent-types";

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
  return parsed;
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
