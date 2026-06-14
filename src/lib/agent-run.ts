/**
 * Slice 2: the conservative time-driven run loop.
 *
 * Fired on a schedule (or by an admin), it walks the small set of live RFPs that
 * have an active goal and, for each, runs deterministic checks (deadline,
 * missing bids, pending gaps, weak answers, stale approvals), writes a
 * buyer-only digest of recommended next actions, and ensures any supplier-facing
 * action is a pending approval. It NEVER sends, chases or contacts a supplier.
 * Locks, budgets and dedup are code-enforced, not prompt-based.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getProject, listResponses, newId } from "@/lib/rfp-store";
import {
  listActiveGoalRfpIds, getGoal, listReviews, listApprovals, proposeApproval,
  saveDigest, lastDigestAt, recordAudit, acquireLock, releaseLock, saveRun,
} from "@/lib/agent-store";
import {
  RUN_MAX_RFPS, RUN_MAX_PROPOSALS_PER_RFP, RUN_MAX_LLM_CALLS, RUN_SOFT_DEADLINE_MS,
  RUN_LOCK_TTL_MS, RFP_LOCK_TTL_MS, DIGEST_COOLDOWN_MS, STALE_APPROVAL_MS,
  DEADLINE_WINDOW_MS, MAX_OPEN_PROPOSALS_PER_SUPPLIER_PER_RFP,
  QUIET_START_HOUR, QUIET_END_HOUR,
  type AgentRun, type Digest, type DigestItem, type BidReview, type ApprovalItem,
} from "@/lib/agent-types";

const MODEL = "claude-haiku-4-5-20251001";
const RUN_LOCK = "agent:run:lock";

/** Europe/London hour (handles GMT/BST), for quiet-hours logic. */
export function londonHour(d = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(d).replace("24", "00"));
}
export function inQuietHours(d = new Date()): boolean {
  const h = londonHour(d);
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
}

type Budget = { llm: number };

function deterministicSummary(title: string, items: DigestItem[]): string {
  if (!items.length) return `No action needed on "${title}".`;
  const high = items.filter((i) => i.severity === "high").length;
  const lead = high ? `${high} item(s) need attention` : `${items.length} item(s) to review`;
  return `"${title}": ${lead}. ` + items.map((i) => i.message).join(" ");
}

async function llmSummary(title: string, items: DigestItem[], budget: Budget): Promise<{ text: string; used: boolean }> {
  const fallback = deterministicSummary(title, items);
  if (budget.llm <= 0 || !process.env.ANTHROPIC_API_KEY || !items.length) return { text: fallback, used: false };
  budget.llm -= 1;
  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL, max_tokens: 220,
      system: "You write a brief, factual procurement digest for a buyer. 2-3 sentences, UK English, no em dashes, no marketing. Summarise what needs attention and the recommended next step. Do not invent facts beyond the items given.",
      messages: [{ role: "user", content: `RFP: ${title}\nItems:\n${items.map((i) => `- [${i.severity}] ${i.message} Recommended: ${i.recommendation}`).join("\n")}` }],
    });
    const text = res.content.filter((c): c is Anthropic.TextBlock => c.type === "text").map((c) => c.text).join(" ").trim();
    return { text: text || fallback, used: Boolean(text) };
  } catch {
    return { text: fallback, used: false };
  }
}

/** Gaps worth a clarification, from the latest reviews. */
function weakGapsByVendor(reviews: BidReview[]): Map<string, { vendor: string; slug: string; count: number }> {
  const m = new Map<string, { vendor: string; slug: string; count: number }>();
  for (const r of reviews) {
    const weak = r.gaps.filter((g) => g.kind === "weak" || g.kind === "non_committal" || g.kind === "overreach" || g.kind === "unanswered");
    if (!weak.length) continue;
    const key = r.vendor_slug || r.vendor;
    const prev = m.get(key);
    m.set(key, { vendor: r.vendor, slug: r.vendor_slug || "", count: (prev?.count ?? 0) + weak.length });
  }
  return m;
}

type ProcessResult = { skipped?: string; digest?: Digest; proposals: number };

async function processRfp(id: string, runId: string, budget: Budget): Promise<ProcessResult> {
  const goal = await getGoal(id);
  if (!goal || goal.status !== "active") {
    await recordAudit({ rfp_id: id, action: "run_skip", actor: "agent", summary: "Skipped: no active procurement goal.", rationale: "The run loop only acts on RFPs with an active goal." });
    return { skipped: "no active goal", proposals: 0 };
  }
  const project = await getProject(id);
  if (!project) return { skipped: "missing project", proposals: 0 };
  if (project.status !== "published" && project.status !== "qa") {
    await recordAudit({ rfp_id: id, action: "run_skip", actor: "agent", summary: `Skipped: RFP is ${project.status}, not open for responses.`, rationale: "Only published/qa RFPs have supplier activity to inspect." });
    return { skipped: "not open", proposals: 0 };
  }
  // Per-RFP digest cooldown (also the source of re-run idempotency).
  const since = Date.now() - (await lastDigestAt(id));
  if (since < DIGEST_COOLDOWN_MS) {
    await recordAudit({ rfp_id: id, action: "run_skip", actor: "agent", summary: "Skipped: within the 12h digest cooldown.", rationale: "Avoids re-digesting the same RFP too often, and prevents duplicate work on re-run." });
    return { skipped: "cooldown", proposals: 0 };
  }

  const [responses, reviews, approvals] = await Promise.all([listResponses(id), listReviews(id), listApprovals(id)]);
  const submitted = responses.filter((r) => r.submitted != null);
  const pending = approvals.filter((a) => a.status === "pending");
  const now = Date.now();
  const items: DigestItem[] = [];

  // 1. Deadline risk
  const deadline = goal.targets.response_deadline_ts ?? goal.targets.deadline_ts;
  if (deadline && deadline > now && deadline - now <= DEADLINE_WINDOW_MS) {
    const hrs = Math.round((deadline - now) / 3_600_000);
    items.push({ kind: "deadline_risk", severity: hrs <= 24 ? "high" : "warn", message: `The response deadline is about ${hrs}h away.`, recommendation: "Review outstanding suppliers; chasing or extending the deadline can be queued for your approval.", ref: "" });
  }
  // 2. Missing bids
  if (submitted.length < goal.targets.min_bids) {
    items.push({ kind: "missing_bids", severity: submitted.length <= 1 ? "high" : "warn", message: `${submitted.length} of a target ${goal.targets.min_bids} bids received.`, recommendation: "Inviting additional matching suppliers can be queued for your approval.", ref: "" });
  }
  // 3. Weak answers
  const weak = weakGapsByVendor(reviews);
  for (const { vendor, count } of weak.values()) {
    items.push({ kind: "weak_answer", severity: "warn", message: `${vendor} has ${count} weak, missing or overreaching answer(s) on required items.`, recommendation: "Approve the drafted clarification(s) to request specific evidence.", ref: "" });
  }
  // 4. Pending gaps awaiting approval
  const pendingClar = pending.filter((a) => a.kind === "send_clarification");
  if (pendingClar.length) {
    items.push({ kind: "pending_gap", severity: "info", message: `${pendingClar.length} clarification(s) are drafted and awaiting your approval.`, recommendation: "Review and approve to send, or reject.", ref: "" });
  }
  // 5. Stale approvals
  const stale = pending.filter((a) => now - a.created >= STALE_APPROVAL_MS);
  if (stale.length) {
    items.push({ kind: "stale_approval", severity: "warn", message: `${stale.length} proposal(s) are over 5 days old and will expire soon.`, recommendation: "Approve or reject them before they lapse.", ref: stale[0].id });
  }

  // Ensure a clarification proposal exists for each vendor with weak gaps
  // (deduped, capped). This is the only thing the loop creates, and it is always
  // a PENDING approval. It never sends.
  let created = 0;
  for (const r of reviews) {
    if (created >= RUN_MAX_PROPOSALS_PER_RFP) break;
    const openForVendor = pending.filter((a) => a.vendor_slug === (r.vendor_slug || "")).length;
    if (openForVendor >= MAX_OPEN_PROPOSALS_PER_SUPPLIER_PER_RFP) continue;
    for (const g of r.gaps) {
      if (created >= RUN_MAX_PROPOSALS_PER_RFP) break;
      if (!g.drafted_clarification) continue;
      const made = await proposeApproval({
        rfp_id: id, kind: "send_clarification", vendor_slug: r.vendor_slug ?? "", vendor_name: r.vendor,
        summary: `Clarification for ${r.vendor}: ${g.kind.replace("_", " ")}${g.feature_id ? ` (${g.feature_id})` : ""}`,
        payload: { question: g.drafted_clarification, feature_id: g.feature_id, gap_kind: g.kind },
        rationale: `Run loop: ${g.detail}`, source_review_id: r.id,
      });
      if (made) created++;
    }
  }

  if (!items.length && !created) {
    await recordAudit({ rfp_id: id, action: "run_noop", actor: "agent", summary: "Inspected, nothing actionable. No digest created.", rationale: "Did not contact any supplier or send anything: outbound is disabled in Slice 2." });
    return { proposals: 0 };
  }

  const { text: summary, used } = await llmSummary(project.title, items, budget);
  const refreshed = await listApprovals(id);
  const proposalIds = refreshed.filter((a) => a.status === "pending" && a.kind === "send_clarification").map((a) => a.id);
  const digest = await saveDigest({
    id: newId("dig"), rfp_id: id, rfp_title: project.title, created: Date.now(), run_id: runId,
    summary, llm_used: used, items, proposal_ids: proposalIds,
  });

  await recordAudit({ rfp_id: id, action: "run_inspect", actor: "agent", summary: `Inspected: ${submitted.length}/${goal.targets.min_bids} bids, ${reviews.length} review(s), ${pending.length} pending approval(s), ${items.length} digest item(s).`, rationale: "Deterministic checks: deadline, missing bids, weak answers, pending gaps, stale approvals." });
  if (created) await recordAudit({ rfp_id: id, action: "run_propose", actor: "agent", summary: `Queued ${created} clarification proposal(s) as pending approval.`, rationale: "Supplier-facing actions are queued for buyer approval, never sent.", ref: digest.id });
  await recordAudit({ rfp_id: id, action: "run_noop", actor: "agent", summary: "Did not contact any supplier, send any message or chase anyone.", rationale: "Outbound and automatic chasing are disabled in Slice 2; all supplier-facing actions remain approval-only." });

  return { digest, proposals: created };
}

/**
 * Run the loop. Whole-run lock prevents overlap; per-RFP locks prevent duplicate
 * work; a failed RFP never aborts the run; KV/LLM failures degrade safely.
 */
export async function runAgentLoop(trigger: "cron" | "manual"): Promise<AgentRun> {
  const runId = newId("run");
  const started = Date.now();
  const report: AgentRun = {
    id: runId, trigger, started, finished: 0, considered: 0, processed: 0, skipped: 0,
    deferred: 0, proposals_created: 0, digests_created: 0, llm_calls: 0, note: "", errors: [],
  };

  const runToken = await acquireLock(RUN_LOCK, RUN_LOCK_TTL_MS);
  if (!runToken) {
    report.note = "another run is already in progress";
    report.finished = Date.now();
    try { await saveRun(report); } catch { /* best effort */ }
    return report;
  }

  const budget: Budget = { llm: RUN_MAX_LLM_CALLS };
  try {
    const ids = await listActiveGoalRfpIds();
    report.considered = ids.length;
    // Fairness: process oldest-digest first so nothing starves under the cap.
    const withTs = await Promise.all(ids.map(async (id) => ({ id, ts: await lastDigestAt(id).catch(() => 0) })));
    withTs.sort((a, b) => a.ts - b.ts);

    for (const { id } of withTs) {
      if (report.processed + report.skipped >= RUN_MAX_RFPS) { report.deferred++; continue; }
      if (Date.now() - started > RUN_SOFT_DEADLINE_MS) { report.deferred++; continue; }

      const rfpToken = await acquireLock(`agent:lock:${id}`, RFP_LOCK_TTL_MS);
      if (!rfpToken) {
        report.skipped++;
        try { await recordAudit({ rfp_id: id, action: "run_skip", actor: "agent", summary: "Skipped: another run holds the RFP lock.", rationale: "Per-RFP lock prevents duplicate concurrent processing." }); } catch { /* ignore */ }
        continue;
      }
      try {
        const res = await processRfp(id, runId, budget);
        if (res.skipped) report.skipped++;
        else { report.processed++; if (res.digest) report.digests_created++; report.proposals_created += res.proposals; }
      } catch (e) {
        report.errors.push(`${id}: ${e instanceof Error ? e.message : "error"}`);
        try { await recordAudit({ rfp_id: id, action: "run_error", actor: "agent", summary: "Run error on this RFP; skipped.", rationale: e instanceof Error ? e.message : "unknown error" }); } catch { /* ignore */ }
      } finally {
        await releaseLock(`agent:lock:${id}`, rfpToken);
      }
    }
  } catch (e) {
    // KV or unexpected failure: degrade safely, report it, do not throw.
    report.errors.push(`run: ${e instanceof Error ? e.message : "error"}`);
  } finally {
    report.llm_calls = RUN_MAX_LLM_CALLS - budget.llm;
    report.finished = Date.now();
    // Emit a concise run summary so the outcome is observable in the runtime
    // logs (no admin auth needed to confirm a scheduled run processed or skipped
    // correctly). Supplier-facing sends are structurally impossible here, so a
    // zero-send run is implied by the loop having no outbound path.
    console.log(`[agent-run] ${trigger} ${report.id}: considered=${report.considered} processed=${report.processed} skipped=${report.skipped} deferred=${report.deferred} proposals=${report.proposals_created} digests=${report.digests_created} llm=${report.llm_calls} errors=${report.errors.length}${report.note ? ` note="${report.note}"` : ""}`);
    try { await saveRun(report); } catch { /* best effort */ }
    await releaseLock(RUN_LOCK, runToken);
  }
  return report;
}
