/**
 * Tool-backed BT Business reseller assistant (Slice R1) and the manual digest
 * generator.
 *
 * The assistant produces INTERNAL artefacts freely (sales plans, scripts,
 * objection handling, checklists, tasks, simulator runs, next-action lists).
 * Anything that would reach a customer, an account manager or BT is DRAFTED ONLY
 * and queued for the partner's approval. The agent never sends anything. Every
 * artefact, task and proposal is audited.
 */

import Anthropic from "@anthropic-ai/sdk";
import { newId } from "@/lib/rfp-store";
import { runSimulator } from "@/lib/reseller-simulator";
import {
  getOrInitPartnerMemory, learnPartnerMemory, partnerMemoryBrief,
  getPartnerGoal, upsertPartnerGoal,
  saveArtefact, saveTask, proposePartnerApproval, recordPartnerAudit,
  listTasks, listPartnerApprovals, listArtefacts, savePartnerDigest,
} from "@/lib/partner-store";
import { GOAL_KINDS, type Artefact, type PartnerDigest, type PartnerDigestItem } from "@/lib/partner-types";

const MODEL = "claude-haiku-4-5-20251001";

function tools(): Anthropic.Tool[] {
  const cast = (s: object) => s as unknown as Anthropic.Tool.InputSchema;
  const contentTool = (name: string, description: string) => ({
    name, description,
    input_schema: cast({ type: "object", properties: { title: { type: "string" }, content: { type: "string", description: "The full artefact text, in markdown. You author this." } }, required: ["title", "content"] }),
  });
  return [
    {
      name: "remember",
      description: "Save a durable fact about THIS partner to memory (company, ORCA status, target customer types, preferred sectors, broadband focus, add-ons, monthly opportunity target, sales capacity, commission goal, blockers, notes). Additive and conflict-safe: if a value conflicts with one already saved, the tool returns the conflict and you must raise it rather than overwrite.",
      input_schema: cast({ type: "object", properties: {
        company_name: { type: "string" }, orca_status: { type: "string", enum: ["not_applied", "applied", "in_onboarding", "live"] },
        target_customer_type: { type: "array", items: { type: "string" } }, preferred_sectors: { type: "array", items: { type: "string" } },
        broadband_focus: { type: "array", items: { type: "string" } }, preferred_addons: { type: "array", items: { type: "string" } },
        monthly_opportunity_target: { type: "integer" }, sales_capacity: { type: "string" }, margin_or_commission_goal: { type: "string" },
        blockers: { type: "array", items: { type: "string" } }, notes: { type: "array", items: { type: "string" } },
      } }),
    },
    {
      name: "set_goal",
      description: "Set the partner's commercial goal for the period, for example 'generate 10 BT Business broadband opportunities this month' or 'complete ORCA onboarding and start quoting'.",
      input_schema: cast({ type: "object", properties: {
        outcome: { type: "string" }, kind: { type: "string", enum: [...GOAL_KINDS] },
        opportunity_count: { type: "integer" }, window_end_ts: { type: "integer", description: "Unix ms for the end of the goal window, or omit." }, segment: { type: "string" },
      }, required: ["outcome"] }),
    },
    {
      name: "run_simulator",
      description: "Model the commission on a BT broadband deal and pipeline using the live calculator. Use this for any figures; never guess commission amounts.",
      input_schema: cast({ type: "object", properties: {
        product: { type: "string", enum: ["fttp", "sogea", "sogea76"] }, dealType: { type: "string", enum: ["new", "resign", "upgrade"] },
        bundle: { type: "string", enum: ["solus", "bundled"] }, contractLengthMonths: { type: "integer", enum: [36, 60] },
        threatProtectionDevicesPerOrder: { type: "integer" }, dealsPerMonth: { type: "integer" },
      } }),
    },
    contentTool("generate_sales_plan", "Author a month sales plan to hit the partner's goal (segments, target list size, channel mix, weekly cadence, milestones). Internal artefact."),
    contentTool("generate_call_script", "Author a call script for a segment or product. Internal artefact."),
    contentTool("generate_objection_handling", "Author objection-handling guidance (price, switching, contract length, versus going direct). Internal artefact."),
    contentTool("create_checklist", "Author a partner checklist (for example onboarding steps to a live ORCA code, or a per-deal qualification checklist). Internal artefact."),
    contentTool("recommend_next_actions", "Author a short, ranked list of the partner's recommended next actions given their memory and goal. Internal artefact."),
    {
      name: "create_task",
      description: "Create an internal follow-up task for the partner. Internal only.",
      input_schema: cast({ type: "object", properties: { title: { type: "string" }, detail: { type: "string" }, due_days: { type: "integer", description: "Days from now the task is due, or omit." } }, required: ["title"] }),
    },
    {
      name: "draft_email",
      description: "Draft an email to a customer, the partner's account manager, or BT. The draft is saved and QUEUED FOR THE PARTNER'S APPROVAL. It is NOT sent. Use this whenever outreach is appropriate; the partner approves before anything leaves.",
      input_schema: cast({ type: "object", properties: {
        recipient_type: { type: "string", enum: ["customer", "account_manager", "bt"] },
        subject: { type: "string" }, body: { type: "string" }, rationale: { type: "string", description: "Why this outreach is recommended now." },
      }, required: ["recipient_type", "subject", "body"] }),
    },
  ];
}

function systemPrompt(memBrief: string, goalLine: string): string {
  return `You are the Netify BT Business reseller assistant. You help a signed-in Netify partner build and run their BT Business broadband resale: economics, eligibility, onboarding, and a month of selling.

Partner memory: ${memBrief}
Current goal: ${goalLine}

Operating rules:
1. Use the partner's memory and goal. When you learn a durable preference (target customers, sectors, broadband focus, capacity, ORCA status, blockers), call remember so it persists. If remember reports a conflict, do not overwrite; tell the partner and ask which is correct.
2. Produce real artefacts with the tools, not just chat: sales plans, call scripts, objection handling, checklists, next-action lists, follow-up tasks, and simulator runs. You author the artefact content as the tool input.
3. Figures must come from run_simulator. Never invent commission numbers. The headline is 21% upfront on install across the contract sales-order-value for Solus FTTP/SOGEA new orders.
4. APPROVAL DISCIPLINE. You never contact anyone. Any email to a customer, the account manager or BT is created with draft_email, which saves the draft and queues it for the partner's approval. You do not send, chase or submit anything. Say so plainly when you draft outreach.
5. Be concise, UK English, no em dashes, no marketing filler. After using tools, tell the partner what you produced and what is waiting for their approval, then offer the next step.`;
}

async function persistArtefact(email: string, kind: Artefact["kind"], title: string, content: string, meta: Record<string, string> = {}, external = false): Promise<string> {
  const art = await saveArtefact({ id: newId("art"), partner_email: email, kind, title: title || kind, content, meta, external, created: Date.now() });
  await recordPartnerAudit({ partner_email: email, action: "artefact_created", summary: `Created ${kind}: ${art.title}`, rationale: "Internal artefact for the partner; nothing sent.", ref: art.id });
  return art.id;
}

export async function runPartnerAgent(email: string, history: Anthropic.MessageParam[]): Promise<{ narrative: string }> {
  let memory = await getOrInitPartnerMemory(email);
  const goal = await getPartnerGoal(email);
  const goalLine = goal?.outcome ? `${goal.outcome} (kind ${goal.kind}, target ${goal.targets.opportunity_count || "n/a"}).` : "No goal set yet.";

  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [...history];
  let narrative = "";

  for (let turn = 0; turn < 5; turn++) {
    const res = await client.messages.create({
      model: MODEL, max_tokens: 1500, system: systemPrompt(partnerMemoryBrief(memory), goalLine), tools: tools(), messages,
    });
    const text = res.content.filter((c): c is Anthropic.TextBlock => c.type === "text").map((c) => c.text).join(" ").trim();
    if (text) narrative = text;
    const toolUses = res.content.filter((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
    if (toolUses.length === 0) break;
    messages.push({ role: "assistant", content: res.content });
    const results: Anthropic.ToolResultBlockParam[] = [];

    for (const tu of toolUses) {
      let out: unknown = { ok: true };
      const input = tu.input as Record<string, unknown>;
      try {
        if (tu.name === "remember") {
          const { memory: updated, conflicts } = await learnPartnerMemory(email, input);
          memory = updated;
          await recordPartnerAudit({ partner_email: email, action: conflicts.length ? "memory_conflict" : "memory_learn", summary: "Updated partner memory.", rationale: conflicts.length ? `Conflicts surfaced: ${conflicts.map((c) => c.field).join(", ")}` : "Additive learning." });
          out = conflicts.length ? { ok: true, saved: true, conflicts, note: "Conflicting values were NOT overwritten; raise them with the partner." } : { ok: true, saved: true };
        } else if (tu.name === "set_goal") {
          const g = await upsertPartnerGoal(email, {
            outcome: String(input.outcome ?? ""), kind: (GOAL_KINDS as readonly string[]).includes(String(input.kind)) ? (input.kind as typeof GOAL_KINDS[number]) : "generate_opportunities",
            targets: { opportunity_count: Number(input.opportunity_count ?? 0), window_end_ts: input.window_end_ts ? Number(input.window_end_ts) : null, segment: String(input.segment ?? "") },
            status: "active",
          });
          await recordPartnerAudit({ partner_email: email, action: "goal_set", summary: `Goal set: ${g.outcome.slice(0, 120)}`, rationale: "Partner commercial goal recorded." });
          out = { ok: true, goal: { outcome: g.outcome, kind: g.kind, target: g.targets.opportunity_count } };
        } else if (tu.name === "run_simulator") {
          const sim = await runSimulator(input);
          if (!sim) out = { ok: false, error: "Could not reach the commission calculator." };
          else {
            await persistArtefact(email, "simulator_run", `Commission scenario: ${input.product ?? "fttp"} ${input.bundle ?? "solus"} ${input.dealType ?? "new"}`, `Per-deal commission on install: £${sim.perDealCommission.toLocaleString("en-GB")}. Broadband £${sim.perDealBreakdown.broadband.toLocaleString("en-GB")}, CVE £${sim.perDealBreakdown.cve.toLocaleString("en-GB")}, Threat Protection £${sim.perDealBreakdown.threatProtection.toLocaleString("en-GB")}. Annual run-rate at the configured volume: £${sim.annualCommissionAtMonthlyRunRate.toLocaleString("en-GB")}.`, { input: JSON.stringify(input) });
            out = { ok: true, ...sim };
          }
        } else if (["generate_sales_plan", "generate_call_script", "generate_objection_handling", "create_checklist", "recommend_next_actions"].includes(tu.name)) {
          const kindMap: Record<string, Artefact["kind"]> = { generate_sales_plan: "sales_plan", generate_call_script: "call_script", generate_objection_handling: "objection_handling", create_checklist: "checklist", recommend_next_actions: "next_actions" };
          const id = await persistArtefact(email, kindMap[tu.name], String(input.title ?? ""), String(input.content ?? ""));
          out = { ok: true, artefact_id: id };
        } else if (tu.name === "create_task") {
          const due = input.due_days ? Date.now() + Number(input.due_days) * 86400000 : null;
          const t = await saveTask({ id: newId("ptask"), partner_email: email, title: String(input.title), detail: String(input.detail ?? ""), due_ts: due, status: "open", created: Date.now() });
          await recordPartnerAudit({ partner_email: email, action: "task_created", summary: `Task: ${t.title}`, rationale: "Internal follow-up task.", ref: t.id });
          out = { ok: true, task_id: t.id };
        } else if (tu.name === "draft_email") {
          const rt = String(input.recipient_type);
          const kind = rt === "customer" ? "customer_email" : rt === "bt" ? "bt_submission" : "account_manager_request";
          const subject = String(input.subject ?? ""); const body = String(input.body ?? "");
          const artId = await persistArtefact(email, "email_draft", `Email draft (${rt}): ${subject}`, `To: ${rt}\nSubject: ${subject}\n\n${body}`, {}, true);
          const appr = await proposePartnerApproval({ partner_email: email, kind, summary: `Email to ${rt}: ${subject}`.slice(0, 140), payload: { recipient_type: rt, subject, body }, rationale: String(input.rationale ?? "Outreach drafted by the assistant."), artefact_id: artId });
          await recordPartnerAudit({ partner_email: email, action: "propose_external", summary: `Drafted ${kind} (pending approval): ${subject}`.slice(0, 160), rationale: "External outreach is drafted only and queued for approval; nothing is sent.", ref: appr?.id ?? artId });
          out = { ok: true, drafted: true, queued_for_approval: true, approval_id: appr?.id ?? null, note: "Draft saved and queued for the partner's approval. Not sent." };
        }
      } catch (e) {
        out = { ok: false, error: e instanceof Error ? e.message : "tool error" };
      }
      results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out) });
    }
    messages.push({ role: "user", content: results });
  }

  return { narrative };
}

/* ------------------------------------------------------------------ */
/* Manual digest generator (deterministic). R1: partner-triggered.     */
/* ------------------------------------------------------------------ */

export async function generatePartnerDigest(email: string, trigger: "manual" | "cron" = "manual"): Promise<PartnerDigest> {
  const [memory, goal, tasks, approvals, artefacts] = await Promise.all([
    getOrInitPartnerMemory(email), getPartnerGoal(email), listTasks(email), listPartnerApprovals(email), listArtefacts(email),
  ]);
  const now = Date.now();
  const items: PartnerDigestItem[] = [];
  const pending = approvals.filter((a) => a.status === "pending");

  // Goal progress (R1 cannot measure real opportunities without a log, so it
  // reports the target and what has been prepared toward it, honestly).
  if (goal && goal.status === "active" && goal.outcome) {
    const prepared = artefacts.filter((a) => a.kind === "sales_plan" || a.kind === "call_script" || a.kind === "objection_handling").length;
    items.push({ kind: "goal_progress", severity: "info", message: `Goal: ${goal.outcome}. Target ${goal.targets.opportunity_count || "n/a"} opportunities. ${prepared} planning artefact(s) prepared.`, recommendation: prepared ? "Work the plan; log opportunities as they land." : "Ask the assistant to build a sales plan and call script to start.", ref: "" });
  } else {
    items.push({ kind: "goal_progress", severity: "info", message: "No active goal set.", recommendation: "Set a goal, for example 10 BT broadband opportunities this month, so the assistant can plan toward it.", ref: "" });
  }
  // Onboarding stalled
  if (memory.orca_status === "applied" || memory.orca_status === "in_onboarding") {
    items.push({ kind: "onboarding_stalled", severity: "warn", message: `ORCA onboarding is at "${memory.orca_status}".`, recommendation: "A chase to your account manager can be drafted for your approval. Onboarding is typically 2 to 3 weeks.", ref: "" });
  }
  // Tasks due/overdue
  const dueTasks = tasks.filter((t) => t.status === "open" && t.due_ts != null && t.due_ts <= now + 2 * 86400000);
  if (dueTasks.length) items.push({ kind: "task_due", severity: "warn", message: `${dueTasks.length} task(s) due or overdue.`, recommendation: "Review your open tasks below.", ref: dueTasks[0].id });
  // Drafts awaiting approval
  if (pending.length) items.push({ kind: "draft_awaiting_approval", severity: "info", message: `${pending.length} outreach draft(s) awaiting your approval.`, recommendation: "Review and approve to send, or reject. Nothing leaves without your approval.", ref: pending[0].id });
  // Blockers
  if (memory.blockers.length) items.push({ kind: "blocker_unresolved", severity: "warn", message: `Blockers on file: ${memory.blockers.join(", ")}.`, recommendation: "Ask the assistant to suggest ways to clear these.", ref: "" });

  const high = items.filter((i) => i.severity !== "info").length;
  const summary = `Partner digest for ${memory.company_name || email}. ${high ? `${high} item(s) need attention. ` : ""}${items.map((i) => i.message).join(" ")}`;

  const digest = await savePartnerDigest({ id: newId("pdig"), partner_email: email, created: now, trigger, summary, items, pending_external: pending.length, sends: 0 });
  await recordPartnerAudit({ partner_email: email, action: "digest", summary: `Generated digest: ${items.length} item(s), ${pending.length} pending approval(s).`, rationale: "Deterministic review of goal, onboarding, tasks, drafts and blockers.", ref: digest.id });
  await recordPartnerAudit({ partner_email: email, action: "run_noop", summary: "Did not contact any customer, account manager or BT.", rationale: "All external actions are approval-only; the digest sends nothing (sends=0)." });
  return digest;
}
