/**
 * Persistence for the reseller partner workspace (Slice R1). Built on the shared
 * KV helpers, keyed by the authenticated partner email. Mirrors the SASE store
 * patterns: additive/conflict-safe memory, deduped pending approvals, audit.
 *
 * Keys: partner:{email}:{memory|goal|artefacts|tasks|approvals|audit|digests}
 */

import { kvConfigured, kvGetJson, kvSetJson, newId } from "@/lib/rfp-store";
import {
  PartnerMemorySchema, ResellerGoalSchema, ArtefactSchema, TaskSchema,
  PartnerApprovalSchema, PartnerAuditSchema, PartnerDigestSchema,
  PARTNER_APPROVAL_TTL_MS, ORCA_STATUSES,
  type PartnerMemory, type ResellerGoal, type Artefact, type PartnerTask,
  type PartnerApproval, type PartnerAuditEntry, type PartnerDigest, type PartnerAuditAction,
} from "@/lib/partner-types";

const key = (email: string, suffix: string) => `partner:${email.toLowerCase()}:${suffix}`;

/* ---------------- Memory ---------------- */

export function emptyPartnerMemory(email: string): PartnerMemory {
  const now = Date.now();
  return PartnerMemorySchema.parse({ email: email.toLowerCase(), created: now, updated: now });
}

export async function getPartnerMemory(email: string): Promise<PartnerMemory | null> {
  if (!kvConfigured() || !email) return null;
  const data = await kvGetJson<PartnerMemory>(key(email, "memory"));
  if (!data) return null;
  const parsed = PartnerMemorySchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export async function getOrInitPartnerMemory(email: string): Promise<PartnerMemory> {
  return (await getPartnerMemory(email)) ?? emptyPartnerMemory(email);
}

export type MemoryConflict = { field: string; current: string; proposed: string };

const SCALAR_DEFAULTS: Record<string, string> = { company_name: "", companies_house_no: "", orca_status: "not_applied", sales_capacity: "", margin_or_commission_goal: "" };

/** Agent-side learning: additive, conflict-safe. Arrays union; a scalar is only
 *  written when empty/default, else returned as a conflict (not overwritten). */
export async function learnPartnerMemory(
  email: string,
  patch: Partial<Omit<PartnerMemory, "email" | "created" | "updated">>,
): Promise<{ memory: PartnerMemory; conflicts: MemoryConflict[] }> {
  const current = await getOrInitPartnerMemory(email);
  const union = (a: string[], b: string[] | undefined) => Array.from(new Set([...a, ...(b ?? [])].map((s) => String(s).trim()).filter(Boolean)));
  const conflicts: MemoryConflict[] = [];
  const scalar = (field: keyof typeof SCALAR_DEFAULTS, proposed: string | undefined): string => {
    const cur = String((current as Record<string, unknown>)[field] ?? "");
    if (proposed === undefined || proposed === "") return cur;
    const isDefault = cur === "" || cur === SCALAR_DEFAULTS[field];
    if (isDefault) return proposed;
    if (cur !== proposed) conflicts.push({ field, current: cur, proposed });
    return cur;
  };

  // orca_status is a scalar enum: only write it when the agent proposes a valid
  // value, set it when the current value is the default, and surface a conflict
  // rather than overwrite a different existing value.
  let orcaStatus = current.orca_status;
  const proposedOrca = patch.orca_status;
  if (proposedOrca && ORCA_STATUSES.includes(proposedOrca)) {
    if (current.orca_status === "not_applied") orcaStatus = proposedOrca;
    else if (current.orca_status !== proposedOrca) conflicts.push({ field: "orca_status", current: current.orca_status, proposed: proposedOrca });
  }

  const next: PartnerMemory = {
    ...current,
    company_name: scalar("company_name", patch.company_name),
    companies_house_no: scalar("companies_house_no", patch.companies_house_no),
    orca_status: orcaStatus,
    orca_code_on_file: typeof patch.orca_code_on_file === "boolean" ? patch.orca_code_on_file || current.orca_code_on_file : current.orca_code_on_file,
    target_customer_type: union(current.target_customer_type, patch.target_customer_type),
    preferred_sectors: union(current.preferred_sectors, patch.preferred_sectors),
    broadband_focus: union(current.broadband_focus, patch.broadband_focus),
    preferred_addons: union(current.preferred_addons, patch.preferred_addons),
    monthly_opportunity_target: typeof patch.monthly_opportunity_target === "number" && current.monthly_opportunity_target === 0 ? patch.monthly_opportunity_target : current.monthly_opportunity_target,
    sales_capacity: scalar("sales_capacity", patch.sales_capacity),
    margin_or_commission_goal: scalar("margin_or_commission_goal", patch.margin_or_commission_goal),
    blockers: union(current.blockers, patch.blockers),
    notes: union(current.notes, patch.notes),
    updated: Date.now(),
  };
  const parsed = PartnerMemorySchema.parse(next);
  await kvSetJson(key(email, "memory"), parsed);
  return { memory: parsed, conflicts };
}

/** Explicit partner edit: overwrites provided fields (the partner owns this). */
export async function setPartnerMemoryFields(email: string, fields: Partial<Omit<PartnerMemory, "email" | "created" | "updated">>): Promise<PartnerMemory> {
  const current = await getOrInitPartnerMemory(email);
  const next = { ...current, ...fields, email: current.email, created: current.created, updated: Date.now() };
  const parsed = PartnerMemorySchema.parse(next);
  await kvSetJson(key(email, "memory"), parsed);
  return parsed;
}

export function partnerMemoryBrief(m: PartnerMemory | null): string {
  if (!m) return "No saved partner memory (not signed in or first session).";
  const p: string[] = [];
  if (m.company_name) p.push(`Company: ${m.company_name}.`);
  p.push(`ORCA status: ${m.orca_status}${m.orca_code_on_file ? " (code on file)" : ""}.`);
  if (m.target_customer_type.length) p.push(`Targets: ${m.target_customer_type.join(", ")}.`);
  if (m.preferred_sectors.length) p.push(`Sectors: ${m.preferred_sectors.join(", ")}.`);
  if (m.broadband_focus.length) p.push(`Broadband focus: ${m.broadband_focus.join(", ")}.`);
  if (m.preferred_addons.length) p.push(`Add-ons: ${m.preferred_addons.join(", ")}.`);
  if (m.monthly_opportunity_target) p.push(`Monthly opportunity target: ${m.monthly_opportunity_target}.`);
  if (m.sales_capacity) p.push(`Capacity: ${m.sales_capacity}.`);
  if (m.margin_or_commission_goal) p.push(`Commission goal: ${m.margin_or_commission_goal}.`);
  if (m.blockers.length) p.push(`Blockers: ${m.blockers.join(", ")}.`);
  if (m.notes.length) p.push(`Notes: ${m.notes.join(" ")}`);
  return p.join(" ");
}

/* ---------------- Goal ---------------- */

export async function getPartnerGoal(email: string): Promise<ResellerGoal | null> {
  if (!kvConfigured()) return null;
  const data = await kvGetJson<ResellerGoal>(key(email, "goal"));
  if (!data) return null;
  const parsed = ResellerGoalSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export async function upsertPartnerGoal(email: string, patch: Partial<ResellerGoal>): Promise<ResellerGoal> {
  const now = Date.now();
  const current = (await getPartnerGoal(email)) ?? ResellerGoalSchema.parse({ partner_email: email.toLowerCase(), created: now, updated: now });
  const parsed = ResellerGoalSchema.parse({ ...current, ...patch, partner_email: email.toLowerCase(), updated: now });
  await kvSetJson(key(email, "goal"), parsed);
  return parsed;
}

/* ---------------- Artefacts ---------------- */

export async function listArtefacts(email: string): Promise<Artefact[]> {
  return (await kvGetJson<Artefact[]>(key(email, "artefacts"))) ?? [];
}
export async function saveArtefact(a: Artefact): Promise<Artefact> {
  const parsed = ArtefactSchema.parse(a);
  const all = await listArtefacts(parsed.partner_email);
  all.unshift(parsed);
  await kvSetJson(key(parsed.partner_email, "artefacts"), all.slice(0, 100));
  return parsed;
}

/* ---------------- Tasks ---------------- */

export async function listTasks(email: string): Promise<PartnerTask[]> {
  return (await kvGetJson<PartnerTask[]>(key(email, "tasks"))) ?? [];
}
export async function saveTask(t: PartnerTask): Promise<PartnerTask> {
  const parsed = TaskSchema.parse(t);
  const all = await listTasks(parsed.partner_email);
  const idx = all.findIndex((x) => x.id === parsed.id);
  if (idx >= 0) all[idx] = parsed; else all.unshift(parsed);
  await kvSetJson(key(parsed.partner_email, "tasks"), all.slice(0, 200));
  return parsed;
}
export async function setTaskStatus(email: string, id: string, status: "open" | "done"): Promise<PartnerTask | null> {
  const all = await listTasks(email);
  const idx = all.findIndex((x) => x.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], status };
  await kvSetJson(key(email, "tasks"), all);
  return all[idx];
}

/* ---------------- External approvals (pending-only in R1) ---------------- */

export async function listPartnerApprovals(email: string): Promise<PartnerApproval[]> {
  const all = (await kvGetJson<PartnerApproval[]>(key(email, "approvals"))) ?? [];
  const now = Date.now();
  let changed = false;
  const out = all.map((a) => { if (a.status === "pending" && a.expires < now) { changed = true; return { ...a, status: "expired" as const }; } return a; });
  if (changed) await kvSetJson(key(email, "approvals"), out);
  return out;
}

export async function proposePartnerApproval(input: {
  partner_email: string; kind: PartnerApproval["kind"]; summary: string;
  payload?: Record<string, string>; rationale: string; artefact_id?: string;
}): Promise<PartnerApproval | null> {
  const all = await listPartnerApprovals(input.partner_email);
  const sig = `${input.kind}|${(input.payload?.subject ?? input.summary).trim().toLowerCase()}`;
  const dup = all.find((a) => (a.status === "pending" || a.status === "approved") && `${a.kind}|${(a.payload.subject ?? a.summary).trim().toLowerCase()}` === sig);
  if (dup) return null;
  const now = Date.now();
  const item = PartnerApprovalSchema.parse({
    id: newId("papr"), partner_email: input.partner_email.toLowerCase(), kind: input.kind,
    summary: input.summary, payload: input.payload ?? {}, rationale: input.rationale,
    artefact_id: input.artefact_id ?? "", status: "pending", created: now, expires: now + PARTNER_APPROVAL_TTL_MS, decided: null,
  });
  all.unshift(item);
  await kvSetJson(key(input.partner_email, "approvals"), all);
  return item;
}

export async function getPartnerApproval(email: string, id: string): Promise<PartnerApproval | null> {
  return (await listPartnerApprovals(email)).find((a) => a.id === id) ?? null;
}
export async function setPartnerApprovalStatus(email: string, id: string, status: PartnerApproval["status"]): Promise<PartnerApproval | null> {
  const all = await listPartnerApprovals(email);
  const idx = all.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], status, decided: Date.now() };
  await kvSetJson(key(email, "approvals"), all);
  return all[idx];
}

/* ---------------- Audit ---------------- */

export async function listPartnerAudit(email: string): Promise<PartnerAuditEntry[]> {
  return (await kvGetJson<PartnerAuditEntry[]>(key(email, "audit"))) ?? [];
}
export async function recordPartnerAudit(entry: {
  partner_email: string; action: PartnerAuditAction; actor?: "agent" | "partner";
  summary?: string; rationale?: string; ref?: string;
}): Promise<PartnerAuditEntry> {
  const parsed = PartnerAuditSchema.parse({
    id: newId("paud"), partner_email: entry.partner_email.toLowerCase(), action: entry.action,
    actor: entry.actor ?? "agent", summary: entry.summary ?? "", rationale: entry.rationale ?? "", ref: entry.ref ?? "", ts: Date.now(),
  });
  const all = await listPartnerAudit(entry.partner_email);
  all.unshift(parsed);
  await kvSetJson(key(entry.partner_email, "audit"), all.slice(0, 500));
  return parsed;
}

/* ---------------- Digest ---------------- */

export async function listPartnerDigests(email: string): Promise<PartnerDigest[]> {
  return (await kvGetJson<PartnerDigest[]>(key(email, "digests"))) ?? [];
}
export async function savePartnerDigest(d: PartnerDigest): Promise<PartnerDigest> {
  const parsed = PartnerDigestSchema.parse(d);
  const all = await listPartnerDigests(parsed.partner_email);
  all.unshift(parsed);
  await kvSetJson(key(parsed.partner_email, "digests"), all.slice(0, 30));
  return parsed;
}
