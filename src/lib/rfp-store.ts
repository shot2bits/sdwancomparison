/**
 * RFP persistence on Vercel KV (Upstash REST). Edge and Node safe.
 * Degrades with a clear error when KV is not configured so builds and
 * unconfigured previews fail loudly rather than silently losing data.
 *
 * Key scheme:
 *   rfp:{id}            -> ProjectDetails JSON
 *   rfp:token:{token}   -> rfp id (supplier share lookup)
 *   rfp:{id}:threads    -> JSON array of RfpThread
 *   rfp:{id}:responses  -> JSON array of RfpResponse
 */

import {
  ProjectDetailsSchema,
  RfpThreadSchema,
  RfpResponseSchema,
  type ProjectDetails,
  type RfpThread,
  type RfpResponse,
} from "@/lib/rfp-types";

const URL_ENV = process.env.KV_REST_API_URL;
const TOKEN_ENV = process.env.KV_REST_API_TOKEN;

export class KvNotConfiguredError extends Error {
  constructor() {
    super("KV storage is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN in Vercel.");
    this.name = "KvNotConfiguredError";
  }
}

export function kvConfigured(): boolean {
  return Boolean(URL_ENV && TOKEN_ENV);
}

async function kv(command: (string | number)[]): Promise<unknown> {
  if (!URL_ENV || !TOKEN_ENV) throw new KvNotConfiguredError();
  const res = await fetch(URL_ENV, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN_ENV}`, "content-type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV command failed: ${res.status}`);
  const data = (await res.json()) as { result?: unknown };
  return data.result;
}

async function getJson<T>(key: string): Promise<T | null> {
  const raw = (await kv(["GET", key])) as string | null;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function setJson(key: string, value: unknown): Promise<void> {
  await kv(["SET", key, JSON.stringify(value)]);
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/* ---- ProjectDetails ---- */

export async function saveProject(p: ProjectDetails): Promise<ProjectDetails> {
  const parsed = ProjectDetailsSchema.parse({ ...p, updated: Date.now() });
  await setJson(`rfp:${parsed.id}`, parsed);
  await kv(["SET", `rfp:token:${parsed.share_token}`, parsed.id]);
  return parsed;
}

export async function getProject(id: string): Promise<ProjectDetails | null> {
  const data = await getJson<ProjectDetails>(`rfp:${id}`);
  if (!data) return null;
  const parsed = ProjectDetailsSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export async function getProjectByToken(token: string): Promise<ProjectDetails | null> {
  const id = (await kv(["GET", `rfp:token:${token}`])) as string | null;
  if (!id) return null;
  return getProject(id);
}

/* ---- Threads ---- */

export async function listThreads(rfpId: string): Promise<RfpThread[]> {
  return (await getJson<RfpThread[]>(`rfp:${rfpId}:threads`)) ?? [];
}

export async function saveThread(t: RfpThread): Promise<RfpThread> {
  const parsed = RfpThreadSchema.parse(t);
  const threads = await listThreads(parsed.rfp_id);
  const idx = threads.findIndex((x) => x.id === parsed.id);
  if (idx >= 0) threads[idx] = parsed;
  else threads.push(parsed);
  await setJson(`rfp:${parsed.rfp_id}:threads`, threads);
  return parsed;
}

/* ---- Responses ---- */

export async function listResponses(rfpId: string): Promise<RfpResponse[]> {
  return (await getJson<RfpResponse[]>(`rfp:${rfpId}:responses`)) ?? [];
}

export async function saveResponse(r: RfpResponse): Promise<RfpResponse> {
  const parsed = RfpResponseSchema.parse(r);
  const responses = await listResponses(parsed.rfp_id);
  const idx = responses.findIndex((x) => x.vendor === parsed.vendor);
  if (idx >= 0) responses[idx] = parsed;
  else responses.push(parsed);
  await setJson(`rfp:${parsed.rfp_id}:responses`, responses);
  return parsed;
}

/* ------------------------------------------------------------------ */
/* Benchmark flywheel: anonymised aggregates. Counts only, no identity. */
/* ------------------------------------------------------------------ */

type Benchmark = {
  rfps_by_sector: Record<string, number>;
  mandatory_by_feature: Record<string, number>; // feature_id -> times marked mandatory
  mandatory_by_sector_feature: Record<string, Record<string, number>>;
  response_completeness_samples: number[]; // capped ring of recent ratios
  updated: number;
};

const EMPTY_BENCHMARK: Benchmark = {
  rfps_by_sector: {},
  mandatory_by_feature: {},
  mandatory_by_sector_feature: {},
  response_completeness_samples: [],
  updated: 0,
};

export async function getBenchmark(): Promise<Benchmark> {
  if (!kvConfigured()) return EMPTY_BENCHMARK;
  return (await getJson<Benchmark>("rfp:benchmark")) ?? EMPTY_BENCHMARK;
}

/** Record an RFP's shape into the benchmark. Idempotency is not required:
 *  we recompute mandatory counts from the current RFP each publish. */
export async function recordRfpBenchmark(sector: string | null, mandatoryFeatureIds: string[]): Promise<void> {
  if (!kvConfigured()) return;
  const b = await getBenchmark();
  const sec = sector ?? "unspecified";
  b.rfps_by_sector[sec] = (b.rfps_by_sector[sec] ?? 0) + 1;
  b.mandatory_by_sector_feature[sec] ??= {};
  for (const fid of mandatoryFeatureIds) {
    b.mandatory_by_feature[fid] = (b.mandatory_by_feature[fid] ?? 0) + 1;
    b.mandatory_by_sector_feature[sec][fid] = (b.mandatory_by_sector_feature[sec][fid] ?? 0) + 1;
  }
  b.updated = Date.now();
  await setJson("rfp:benchmark", b);
}

export async function recordCompletenessSample(ratio: number): Promise<void> {
  if (!kvConfigured()) return;
  const b = await getBenchmark();
  b.response_completeness_samples = [...b.response_completeness_samples, Math.max(0, Math.min(1, ratio))].slice(-500);
  b.updated = Date.now();
  await setJson("rfp:benchmark", b);
}

/* ------------------------------------------------------------------ */
/* Supplier connections (two-sided marketplace)                        */
/* ------------------------------------------------------------------ */

import { SupplierConnectionSchema, type SupplierConnection } from "@/lib/rfp-types";

export async function listConnections(rfpId: string): Promise<SupplierConnection[]> {
  return (await getJson<SupplierConnection[]>(`rfp:${rfpId}:connections`)) ?? [];
}

export async function saveConnection(c: SupplierConnection): Promise<SupplierConnection> {
  const parsed = SupplierConnectionSchema.parse({ ...c, updated: Date.now() });
  const all = await listConnections(parsed.rfp_id);
  const idx = all.findIndex((x) => x.vendor_slug === parsed.vendor_slug);
  if (idx >= 0) all[idx] = parsed;
  else all.push(parsed);
  await setJson(`rfp:${parsed.rfp_id}:connections`, all);
  await kv(["SET", `rfp:conn:${parsed.token}`, JSON.stringify({ rfp_id: parsed.rfp_id, vendor_slug: parsed.vendor_slug })]);
  return parsed;
}

export async function getConnection(rfpId: string, vendorSlug: string): Promise<SupplierConnection | null> {
  return (await listConnections(rfpId)).find((c) => c.vendor_slug === vendorSlug) ?? null;
}

/** Supplier-side lookup by their per-connection token. */
export async function getConnectionByToken(token: string): Promise<SupplierConnection | null> {
  const ref = (await getJson<{ rfp_id: string; vendor_slug: string }>(`rfp:conn:${token}`));
  if (!ref) return null;
  return getConnection(ref.rfp_id, ref.vendor_slug);
}

/* ------------------------------------------------------------------ */
/* Opportunities (live tender rooms)                                   */
/* ------------------------------------------------------------------ */

import { OpportunitySchema, type Opportunity } from "@/lib/opportunity-types";

export async function saveOpportunity(o: Opportunity): Promise<Opportunity> {
  const parsed = OpportunitySchema.parse({ ...o, updated: Date.now() });
  await setJson(`opp:${parsed.id}`, parsed);
  await kv(["SADD", "opps", parsed.id]);
  return parsed;
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  const data = await getJson<Opportunity>(`opp:${id}`);
  if (!data) return null;
  const parsed = OpportunitySchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export async function listOpportunities(): Promise<Opportunity[]> {
  if (!kvConfigured()) return [];
  const ids = ((await kv(["SMEMBERS", "opps"])) as string[]) ?? [];
  const out: Opportunity[] = [];
  for (const id of ids) { const o = await getOpportunity(id); if (o) out.push(o); }
  return out.sort((a, b) => b.created - a.created);
}

/** Per-supplier access token for an opportunity. */
export async function inviteToOpportunity(oppId: string, vendorSlug: string): Promise<string> {
  const token = newId("otok");
  await kv(["SET", `opp:tok:${token}`, JSON.stringify({ opp_id: oppId, vendor_slug: vendorSlug })]);
  return token;
}

export async function resolveOpportunityToken(token: string): Promise<{ opp_id: string; vendor_slug: string } | null> {
  return getJson<{ opp_id: string; vendor_slug: string }>(`opp:tok:${token}`);
}
