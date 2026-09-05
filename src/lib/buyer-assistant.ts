import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getOrInitBuyerMemory, setBuyerMemoryFields, MemoryRevisionError, type BuyerMemory } from '@/lib/buyer-memory';
import { callWorkspaceTool } from '@/lib/mcp-workspace-tools';
import { DELIVERY_MODEL_COMPARISON } from '@/lib/cost-page-copy';

/** One service boundary for the authenticated browser and future delegated agents. */
export function buyerAssistantEnabled() { return process.env.NETIFY_BUYER_ASSISTANT_ENABLED !== 'false'; }
const Revision = z.number().int().nonnegative();
export const AssistantActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save_fact'), revision: Revision, id: z.string().uuid().optional(), text: z.string().trim().min(3).max(1000), source: z.string().trim().min(1).max(200), confirmed: z.boolean(), expires_at: z.number().int().positive().nullable() }).strict(),
  z.object({ action: z.literal('forget_fact'), revision: Revision, id: z.string().uuid() }).strict(),
  z.object({ action: z.literal('run_skill'), revision: Revision, skill: z.enum(['review_requirements', 'compare_options', 'prepare_project']), text: z.string().trim().max(3000), fact_ids: z.array(z.string().uuid()).max(20) }).strict(),
]);
export type AssistantAction = z.infer<typeof AssistantActionSchema>;
export type SkillResult = {
  skill: 'review_requirements' | 'compare_options' | 'prepare_project';
  input: string;
  memory_revision: number;
  fact_ids: string[];
  brief: string;
  questions: string[];
  notes: string[];
  engine: string;
  comparison: typeof DELIVERY_MODEL_COMPARISON;
};

export function selectedMemoryText(memory: BuyerMemory, ids: string[], now = Date.now()): string {
  return [...new Set(ids)].map(id => {
    const fact = memory.facts.find(f => f.id === id);
    if (!fact || !fact.confirmed_at || (fact.expires_at !== null && fact.expires_at <= now)) throw new Error('A selected memory is missing, unconfirmed or expired. Review your memories first.');
    return fact.text;
  }).join('\n');
}

export async function runBuyerAssistant(email: string, input: AssistantAction) {
  const memory = await getOrInitBuyerMemory(email);
  if (memory.revision !== input.revision) throw new MemoryRevisionError();
  if (input.action === 'save_fact') {
    if (input.id && !memory.facts.some(f => f.id === input.id)) throw new Error('Memory not found.');
    const fact = { id: input.id ?? randomUUID(), text: input.text, source: input.source, confirmed_at: input.confirmed ? Date.now() : null, expires_at: input.expires_at };
    return { memory: await setBuyerMemoryFields(email, { facts: [...memory.facts.filter(f => f.id !== fact.id), fact] }, input.revision) };
  }
  if (input.action === 'forget_fact') {
    if (!memory.facts.some(f => f.id === input.id)) throw new Error('Memory not found.');
    return { memory: await setBuyerMemoryFields(email, { facts: memory.facts.filter(f => f.id !== input.id) }, input.revision) };
  }
  const selected = selectedMemoryText(memory, input.fact_ids);
  const text = [input.text, selected].filter(Boolean).join('\n');
  if (text.length < 3 || text.length > 4000) throw new Error('Enter requirements and select memories totalling between 3 and 4,000 characters.');
  // Read/compute only. No project writes, invitations, approvals or publication here.
  const cycle = await callWorkspaceTool('workspace_cycle', { text, include_fit: false }) as {
    error?: string; brief: string; earned_questions?: { question: string }[]; notes?: string[]; engine: string;
  };
  if (cycle.error) throw new Error(cycle.error);
  // A memory edited during extraction invalidates this derived result too.
  const latest = await getOrInitBuyerMemory(email);
  if (latest.revision !== input.revision) throw new MemoryRevisionError();
  selectedMemoryText(latest, input.fact_ids);
  const result: SkillResult = {
    skill: input.skill, input: text, memory_revision: input.revision, fact_ids: input.fact_ids, brief: cycle.brief,
    questions: (cycle.earned_questions ?? []).map(q => q.question), notes: cycle.notes ?? [], engine: cycle.engine,
    comparison: input.skill === 'compare_options' ? DELIVERY_MODEL_COMPARISON : null,
  };
  return { result };
}
