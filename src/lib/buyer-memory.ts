/**
 * Persistent buyer memory. Survives across RFP projects, keyed to the
 * authenticated buyer email. This is what turns the assistant into an agent
 * that remembers you: preferences, vendors to favour or avoid, the compliance
 * baseline, region footprint, risk tolerance, budget bands, and the outcomes
 * of past RFPs feed straight into the agent's system prompt next time.
 *
 * Identity is required by design. Anonymous buyers stay fully ungated for
 * creation and research; memory is a benefit of signing in, consistent with
 * the pull (anonymous) versus push (identified) model used elsewhere.
 *
 * Key scheme:
 *   buyer:{email}:memory -> BuyerMemory JSON
 */

import { z } from "zod";
import { kvConfigured, kvRaw } from "@/lib/rfp-store";

export const RISK_TOLERANCE = ["low", "medium", "high", "unknown"] as const;
export type RiskTolerance = (typeof RISK_TOLERANCE)[number];

/** A compact record of a finished (or abandoned) RFP, for recall and learning. */
export const PastOutcomeSchema = z.object({
  rfp_id: z.string(),
  title: z.string().default(""),
  sector: z.string().nullable().default(null),
  product_scope: z.string().default(""),
  awarded_vendor_slug: z.string().nullable().default(null),
  shortlisted_vendor_slugs: z.array(z.string()).default([]),
  outcome: z.enum(["awarded", "no_award", "abandoned", "in_progress"]).default("in_progress"),
  note: z.string().default(""),
  recorded: z.number(),
}).strict();
export type PastOutcome = z.infer<typeof PastOutcomeSchema>;

export const MemoryFactSchema = z.object({
  id: z.string().uuid(),
  text: z.string().trim().min(3).max(1000),
  source: z.string().trim().min(1).max(200),
  confirmed_at: z.number().nullable(),
  expires_at: z.number().nullable(),
}).strict();
export type MemoryFact = z.infer<typeof MemoryFactSchema>;

export const BuyerMemorySchema = z.object({
  email: z.string(),
  revision: z.number().int().nonnegative().default(0),
  facts: z.array(MemoryFactSchema).max(50).default([]),
  organisation: z.string().default(""),
  // Durable preferences the agent should carry between projects.
  preferred_vendor_slugs: z.array(z.string()).default([]),
  avoided_vendor_slugs: z.array(z.string()).default([]),
  compliance_baseline: z.array(z.string()).default([]), // methodology compliance keys always in scope
  regions: z.array(z.string()).default([]),
  organisation_size: z.string().default("any"),
  operating_model: z.string().default("any"),
  risk_tolerance: z.enum(RISK_TOLERANCE).default("unknown"),
  budget_notes: z.string().default(""), // free text: typical bands, cost sensitivity
  // Free-form durable facts the agent chooses to keep ("prefers UK-sovereign data", etc.)
  notes: z.array(z.string()).default([]),
  past_outcomes: z.array(PastOutcomeSchema).default([]),
  created: z.number(),
  updated: z.number(),
}).strict();
export type BuyerMemory = z.infer<typeof BuyerMemorySchema>;

function memKey(email: string): string {
  return `buyer:${email.toLowerCase()}:memory`;
}

export function emptyMemory(email: string): BuyerMemory {
  const now = Date.now();
  return BuyerMemorySchema.parse({ email: email.toLowerCase(), created: now, updated: now });
}

export class MemoryRevisionError extends Error {
  constructor() { super("Your memories changed in another session. Reload them before saving or running this skill."); }
}

async function readMemory(email: string) {
  const raw = await kvRaw(["GET", memKey(email)]) as string | null;
  // Fail closed on corrupt records; never replace an unreadable record with an empty one.
  return { raw, memory: raw ? BuyerMemorySchema.parse(JSON.parse(raw)) : emptyMemory(email) };
}

export async function getBuyerMemory(email: string): Promise<BuyerMemory | null> {
  if (!kvConfigured() || !email) return null;
  const { raw, memory } = await readMemory(email);
  return raw ? memory : null;
}

const CAS_MEMORY = `local current = redis.call('GET', KEYS[1])
if (not current and ARGV[1] == '') or current == ARGV[1] then
 redis.call('SET', KEYS[1], ARGV[2]); return 1
end
return 0`;

async function mutateMemory(email: string, update: (memory: BuyerMemory) => BuyerMemory, expectedRevision?: number): Promise<BuyerMemory> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { raw, memory } = await readMemory(email);
    if (expectedRevision !== undefined && expectedRevision !== memory.revision) throw new MemoryRevisionError();
    const next = BuyerMemorySchema.parse({ ...update(memory), email: memory.email, created: memory.created, updated: Date.now(), revision: memory.revision + 1 });
    const saved = await kvRaw(["EVAL", CAS_MEMORY, 1, memKey(email), raw ?? "", JSON.stringify(next)]);
    if (saved === 1) return next;
    if (expectedRevision !== undefined) throw new MemoryRevisionError();
  }
  throw new MemoryRevisionError();
}

export async function getOrInitBuyerMemory(email: string): Promise<BuyerMemory> {
  return (await getBuyerMemory(email)) ?? emptyMemory(email);
}

export type MemoryConflict = { field: string; current: string; proposed: string };

const SCALAR_DEFAULTS: Record<string, string> = {
  organisation: "",
  organisation_size: "any",
  operating_model: "any",
  risk_tolerance: "unknown",
  budget_notes: "",
};

/**
 * Agent-side learning. Additive and non-destructive by design (the guardrail):
 * arrays union, and a scalar is only written when it is currently empty or at
 * its default. If the agent proposes a scalar that differs from an existing,
 * non-default value, we do NOT overwrite it; we return it as a conflict for the
 * agent to raise with the buyer. Explicit buyer edits use setBuyerMemoryFields.
 */
export async function learnBuyerMemory(
  email: string,
  patch: Partial<Omit<BuyerMemory, "email" | "created" | "updated" | "past_outcomes" | "revision" | "facts">>,
): Promise<{ memory: BuyerMemory; conflicts: MemoryConflict[] }> {
  let conflicts: MemoryConflict[] = [];
  const memory = await mutateMemory(email, (current) => {
    conflicts = [];
    const union = (a: string[], b: string[] | undefined) => Array.from(new Set([...a, ...(b ?? [])].map((s) => s.trim()).filter(Boolean)));

    const scalar = (field: keyof typeof SCALAR_DEFAULTS, proposed: string | undefined): string => {
      const cur = String(current[field as keyof BuyerMemory] ?? "");
      if (proposed === undefined || proposed === "") return cur;
      const isDefault = cur === "" || cur === SCALAR_DEFAULTS[field];
      if (isDefault) return proposed;
      if (cur !== proposed) conflicts.push({ field, current: cur, proposed });
      return cur; // keep existing, surface the conflict instead of overwriting
    };

    const next: BuyerMemory = {
      ...current,
      organisation: scalar("organisation", patch.organisation),
      preferred_vendor_slugs: union(current.preferred_vendor_slugs, patch.preferred_vendor_slugs),
      avoided_vendor_slugs: union(current.avoided_vendor_slugs, patch.avoided_vendor_slugs),
      compliance_baseline: union(current.compliance_baseline, patch.compliance_baseline),
      regions: union(current.regions, patch.regions),
      organisation_size: scalar("organisation_size", patch.organisation_size),
      operating_model: scalar("operating_model", patch.operating_model),
      risk_tolerance: scalar("risk_tolerance", patch.risk_tolerance) as RiskTolerance,
      budget_notes: scalar("budget_notes", patch.budget_notes),
      notes: union(current.notes, patch.notes),
      updated: Date.now(),
    };
    return next;
  });
  return { memory, conflicts };
}

/**
 * Explicit buyer edit. The buyer is editing their own data in the UI, so this
 * DOES overwrite the provided fields (that is the point of the transparency and
 * editability guardrail). Fields not provided are left untouched.
 */
export async function setBuyerMemoryFields(
  email: string,
  fields: Partial<Omit<BuyerMemory, "email" | "created" | "updated" | "revision">>,
  expectedRevision?: number,
): Promise<BuyerMemory> {
  return mutateMemory(email, current => ({ ...current, ...fields }), expectedRevision);
}

/** Record (or update) the outcome of one RFP without losing concurrent edits. */
export async function recordPastOutcome(email: string, outcome: PastOutcome): Promise<BuyerMemory> {
  return mutateMemory(email, current => ({
    ...current,
    past_outcomes: [PastOutcomeSchema.parse(outcome), ...current.past_outcomes.filter(o => o.rfp_id !== outcome.rfp_id)].slice(0, 50),
  }));
}

/** A short, prompt-ready summary of what we remember about this buyer. */
export function memoryBrief(m: BuyerMemory | null): string {
  if (!m) return "No saved buyer memory (anonymous or first session).";
  const parts: string[] = [];
  if (m.organisation) parts.push(`Organisation: ${m.organisation}.`);
  if (m.organisation_size && m.organisation_size !== "any") parts.push(`Size: ${m.organisation_size}.`);
  if (m.regions.length) parts.push(`Regions: ${m.regions.join(", ")}.`);
  if (m.compliance_baseline.length) parts.push(`Compliance baseline (always in scope): ${m.compliance_baseline.join(", ")}.`);
  if (m.operating_model && m.operating_model !== "any") parts.push(`Operating model: ${m.operating_model}.`);
  if (m.risk_tolerance !== "unknown") parts.push(`Risk tolerance: ${m.risk_tolerance}.`);
  if (m.budget_notes) parts.push(`Budget: ${m.budget_notes}.`);
  if (m.preferred_vendor_slugs.length) parts.push(`Prefers vendors: ${m.preferred_vendor_slugs.join(", ")}.`);
  if (m.avoided_vendor_slugs.length) parts.push(`Avoid vendors: ${m.avoided_vendor_slugs.join(", ")}.`);
  if (m.notes.length) parts.push(`Notes: ${m.notes.join(" ")}`);
  if (m.past_outcomes.length) {
    const recent = m.past_outcomes.slice(0, 5).map((o) => `${o.title || o.rfp_id} (${o.outcome}${o.awarded_vendor_slug ? `, awarded ${o.awarded_vendor_slug}` : ""})`);
    parts.push(`Past RFPs: ${recent.join("; ")}.`);
  }
  return parts.length ? parts.join(" ") : "Buyer memory exists but is empty.";
}
