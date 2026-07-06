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
  NdaAcceptanceSchema,
  type ProjectDetails,
  type RfpThread,
  type RfpResponse,
  type NdaAcceptance,
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

/* Public JSON/command helpers so sibling stores (buyer memory, agent store)
 * share one KV access path instead of re-implementing the REST plumbing. */
export async function kvGetJson<T>(key: string): Promise<T | null> {
  return getJson<T>(key);
}
export async function kvSetJson(key: string, value: unknown): Promise<void> {
  return setJson(key, value);
}
export async function kvRaw(command: (string | number)[]): Promise<unknown> {
  return kv(command);
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

/**
 * Project projection safe for open/unauthenticated reads: the manage_token is
 * the credential for push and mutation actions, so it must never be served to a
 * caller who has only the RFP id. It is returned only at creation time and from
 * the gated PUT (where the caller has already proven access). Everywhere else,
 * responses pass through this.
 */
export function publicProject(p: ProjectDetails): ProjectDetails {
  return { ...p, manage_token: "", owner_email: "" };
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

/* ---- NDA acceptances ---- */

export async function listNdaAcceptances(rfpId: string): Promise<NdaAcceptance[]> {
  return (await getJson<NdaAcceptance[]>(`rfp:${rfpId}:nda`)) ?? [];
}

/** Record (or overwrite) one organisation's NDA acceptance for an RFP. */
export async function saveNdaAcceptance(a: NdaAcceptance): Promise<NdaAcceptance> {
  const parsed = NdaAcceptanceSchema.parse(a);
  const all = await listNdaAcceptances(parsed.rfp_id);
  const idx = all.findIndex((x) => x.vendor.trim().toLowerCase() === parsed.vendor.trim().toLowerCase());
  if (idx >= 0) all[idx] = parsed;
  else all.push(parsed);
  await setJson(`rfp:${parsed.rfp_id}:nda`, all);
  return parsed;
}

export async function getNdaAcceptance(rfpId: string, vendor: string): Promise<NdaAcceptance | null> {
  const v = vendor.trim().toLowerCase();
  return (await listNdaAcceptances(rfpId)).find((x) => x.vendor.trim().toLowerCase() === v) ?? null;
}

/**
 * Whether a given organisation may see the full RFP and respond. True when the
 * RFP has no NDA requirement, or when the organisation has a recorded acceptance
 * of the current NDA version. A blank vendor is treated as not-yet-accepted.
 */
export async function hasAcceptedNda(project: ProjectDetails, vendor: string): Promise<boolean> {
  if (!project.nda?.required) return true;
  if (!vendor.trim()) return false;
  const accept = await getNdaAcceptance(project.id, vendor);
  return Boolean(accept && accept.nda_version >= project.nda.version);
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

import { OpportunitySchema, toPublicOpportunity, type Opportunity, type PublicOpportunity } from "@/lib/opportunity-types";

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
  if (!parsed.success) return null;
  const opp = parsed.data;
  // Lazy close: a timed auction past its deadline is closed on next read.
  if (opp.status === "open" && opp.engagement_type === "auction" && opp.auction_format === "timed" && opp.deadline && opp.deadline < Date.now()) {
    const closed = { ...opp, status: "closed" as const };
    await setJson(`opp:${id}`, { ...closed, updated: Date.now() });
    return closed;
  }
  return opp;
}

export async function listOpportunities(): Promise<Opportunity[]> {
  if (!kvConfigured()) return [];
  const ids = ((await kv(["SMEMBERS", "opps"])) as string[]) ?? [];
  const out: Opportunity[] = [];
  for (const id of ids) { const o = await getOpportunity(id); if (o) out.push(o); }
  return out.sort((a, b) => b.created - a.created);
}

/**
 * Public board: open, public opportunities as stripped projections (no pricing
 * amounts, no tokens), newest activity first. Safe for crawlers and agents.
 */
export async function listPublicOpportunities(): Promise<PublicOpportunity[]> {
  const all = await listOpportunities();
  return all
    .filter((o) => o.status === "open" && o.visibility === "public")
    .map(toPublicOpportunity)
    .sort((a, b) => b.last_activity - a.last_activity);
}

/**
 * Archive: recently closed and awarded public opportunities. Kept visible so
 * suppliers can gauge marketplace activity and outcome pages stay citable;
 * same public projection as the live board.
 */
export async function listArchivedPublicOpportunities(limit = 12): Promise<PublicOpportunity[]> {
  const all = await listOpportunities();
  return all
    .filter((o) => (o.status === "closed" || o.status === "awarded") && o.visibility === "public")
    .map(toPublicOpportunity)
    .sort((a, b) => b.updated - a.updated)
    .slice(0, limit);
}

/**
 * Admin removal of an opportunity (moderation: inappropriate or sensitive
 * content posted by mistake). Hard delete: the notice, its board membership,
 * its per-vendor room tokens and the vendor invite indexes all go, so the
 * public page 404s and no supplier token resurrects it. Any linked RFP is
 * untouched (rfp:{id}:board_opp map is cleared so a re-publish relists).
 */
export async function deleteOpportunity(id: string): Promise<boolean> {
  const opp = await getJson<Opportunity>(`opp:${id}`);
  if (!opp) return false;
  const parsed = OpportunitySchema.safeParse(opp);
  const invited = parsed.success ? parsed.data.invited : [];
  for (const slug of invited) {
    const vtokKey = `opp:vtok:${id}:${slug}`;
    const token = (await kv(["GET", vtokKey])) as string | null;
    if (token) await kv(["DEL", `opp:tok:${token}`]);
    await kv(["DEL", vtokKey]);
    await kv(["SREM", `vendor:opps:${slug}`, id]);
  }
  if (parsed.success && parsed.data.source_rfp_id) {
    await kv(["DEL", `rfp:${parsed.data.source_rfp_id}:board_opp`]);
  }
  await kv(["SREM", "opps", id]);
  await kv(["DEL", `opp:${id}`]);
  return true;
}

/** Per-supplier access token for an opportunity. Also indexes the invite by vendor. */
export async function inviteToOpportunity(oppId: string, vendorSlug: string): Promise<string> {
  const token = newId("otok");
  await kv(["SET", `opp:tok:${token}`, JSON.stringify({ opp_id: oppId, vendor_slug: vendorSlug })]);
  await kv(["SADD", `vendor:opps:${vendorSlug}`, oppId]);
  return token;
}

/** Opportunity ids a vendor has been invited to. */
export async function listInvitedOpportunityIds(vendorSlug: string): Promise<string[]> {
  if (!kvConfigured()) return [];
  return ((await kv(["SMEMBERS", `vendor:opps:${vendorSlug}`])) as string[]) ?? [];
}

/** Stable per-vendor room token for an opportunity (reused, not regenerated). */
export async function getOrCreateOpportunityToken(oppId: string, vendorSlug: string): Promise<string> {
  const key = `opp:vtok:${oppId}:${vendorSlug}`;
  const existing = (await kv(["GET", key])) as string | null;
  if (existing) return existing;
  const token = await inviteToOpportunity(oppId, vendorSlug);
  await kv(["SET", key, token]);
  return token;
}

export async function resolveOpportunityToken(token: string): Promise<{ opp_id: string; vendor_slug: string } | null> {
  return getJson<{ opp_id: string; vendor_slug: string }>(`opp:tok:${token}`);
}

/* ------------------------------------------------------------------ */
/* Auth: magic-link tokens and sessions                                */
/* ------------------------------------------------------------------ */

export type AuthSession = {
  token: string;
  role: "supplier" | "buyer" | "netify";
  email: string;
  vendor_slug: string | null; // set for supplier/netify-relay
  created: number;
  expires: number;
};

const MAGIC_TTL_MS = 60 * 60 * 1000;       // 60 minutes (tolerates slow email delivery)
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function createMagicToken(payload: { role: "supplier" | "buyer" | "netify"; email: string; vendor_slug: string | null }): Promise<string> {
  const token = newId("magic");
  await kv(["SET", `auth:magic:${token}`, JSON.stringify({ ...payload, created: Date.now(), expires: Date.now() + MAGIC_TTL_MS })]);
  await kv(["PEXPIRE", `auth:magic:${token}`, MAGIC_TTL_MS]);
  return token;
}

export async function consumeMagicToken(token: string): Promise<{ role: "supplier" | "buyer" | "netify"; email: string; vendor_slug: string | null } | null> {
  const data = await getJson<{ role: "supplier" | "buyer" | "netify"; email: string; vendor_slug: string | null; expires: number }>(`auth:magic:${token}`);
  if (!data || data.expires < Date.now()) return null;
  await kv(["DEL", `auth:magic:${token}`]);
  return { role: data.role, email: data.email, vendor_slug: data.vendor_slug };
}

export async function createSession(payload: { role: "supplier" | "buyer" | "netify"; email: string; vendor_slug: string | null }): Promise<AuthSession> {
  const token = newId("sess");
  const session: AuthSession = { token, ...payload, created: Date.now(), expires: Date.now() + SESSION_TTL_MS };
  await kv(["SET", `auth:sess:${token}`, JSON.stringify(session)]);
  await kv(["PEXPIRE", `auth:sess:${token}`, SESSION_TTL_MS]);
  await kv(["SADD", "auth:index:sessions", token]);
  return session;
}

export async function getSession(token: string | null | undefined): Promise<AuthSession | null> {
  if (!token) return null;
  const s = await getJson<AuthSession>(`auth:sess:${token}`);
  if (!s || s.expires < Date.now()) return null;
  return s;
}

export async function deleteSession(token: string): Promise<void> {
  await kv(["DEL", `auth:sess:${token}`]);
  await kv(["SREM", "auth:index:sessions", token]);
}

/**
 * All live sessions, newest first. Prunes index entries whose session has
 * expired or been deleted (TTL drops the value but not the set member).
 */
export async function listSessions(): Promise<AuthSession[]> {
  if (!kvConfigured()) return [];
  const tokens = ((await kv(["SMEMBERS", "auth:index:sessions"])) as string[]) ?? [];
  const out: AuthSession[] = [];
  for (const token of tokens) {
    const s = await getJson<AuthSession>(`auth:sess:${token}`);
    if (!s || s.expires < Date.now()) {
      await kv(["SREM", "auth:index:sessions", token]);
      continue;
    }
    out.push(s);
  }
  return out.sort((a, b) => b.created - a.created);
}

/* ------------------------------------------------------------------ */
/* Admin-editable config: vendor domain overrides and blocklist extras */
/* ------------------------------------------------------------------ */

export async function getVendorDomainOverrides(): Promise<Record<string, string[]>> {
  if (!kvConfigured()) return {};
  return (await getJson<Record<string, string[]>>("cfg:vendor_domains")) ?? {};
}

/** Set (or clear) the override for one vendor. Empty array removes the override. */
export async function setVendorDomainOverride(slug: string, domains: string[]): Promise<Record<string, string[]>> {
  const map = await getVendorDomainOverrides();
  const clean = Array.from(new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean)));
  if (clean.length === 0) delete map[slug];
  else map[slug] = clean;
  await setJson("cfg:vendor_domains", map);
  return map;
}

export async function getBlocklistExtra(): Promise<string[]> {
  if (!kvConfigured()) return [];
  return (await getJson<string[]>("cfg:blocklist")) ?? [];
}

export async function addBlocklistDomain(domain: string): Promise<string[]> {
  const list = await getBlocklistExtra();
  const d = domain.trim().toLowerCase();
  if (d && !list.includes(d)) list.push(d);
  await setJson("cfg:blocklist", list);
  return list;
}

export async function removeBlocklistDomain(domain: string): Promise<string[]> {
  const d = domain.trim().toLowerCase();
  const list = (await getBlocklistExtra()).filter((x) => x !== d);
  await setJson("cfg:blocklist", list);
  return list;
}

/* ------------------------------------------------------------------ */
/* Pending supplier access requests                                    */
/* ------------------------------------------------------------------ */

export type PendingRequest = { domain: string; email: string; created: number; count: number };

/** Record (or bump) a pending request, keyed by domain so it cannot flood. */
export async function recordPendingRequest(email: string, domain: string): Promise<void> {
  const d = domain.toLowerCase();
  const existing = await getJson<PendingRequest>(`auth:pending:${d}`);
  const entry: PendingRequest = existing
    ? { ...existing, email, count: existing.count + 1 }
    : { domain: d, email: email.toLowerCase(), created: Date.now(), count: 1 };
  await setJson(`auth:pending:${d}`, entry);
  await kv(["SADD", "auth:index:pending", d]);
}

/**
 * Record that an email has completed sign-in for a role, and report whether this
 * is the first time. Backed by SADD, which returns 1 only when the member is new
 * to the set, so first-time detection is atomic and race-free. Keyed by
 * role+email so a person who later signs in under a different role is still seen
 * as a new sign-up for that role. Used to fire the one-off new-sign-up alert.
 */
export async function markSignupSeen(email: string, role: "supplier" | "buyer" | "netify"): Promise<boolean> {
  if (!kvConfigured()) return false;
  const member = `${role}:${email.toLowerCase()}`;
  const added = (await kv(["SADD", "auth:index:signups", member])) as number;
  return added === 1;
}

export async function listPendingRequests(): Promise<PendingRequest[]> {
  if (!kvConfigured()) return [];
  const domains = ((await kv(["SMEMBERS", "auth:index:pending"])) as string[]) ?? [];
  const out: PendingRequest[] = [];
  for (const d of domains) {
    const entry = await getJson<PendingRequest>(`auth:pending:${d}`);
    if (entry) out.push(entry);
    else await kv(["SREM", "auth:index:pending", d]);
  }
  return out.sort((a, b) => b.created - a.created);
}

export async function clearPendingRequest(domain: string): Promise<void> {
  const d = domain.toLowerCase();
  await kv(["DEL", `auth:pending:${d}`]);
  await kv(["SREM", "auth:index:pending", d]);
}

/* ------------------------------------------------------------------ */
/* Vendor profile claims (supplier ownership, Netify-admin approved)   */
/* ------------------------------------------------------------------ */

export type VendorClaim = {
  slug: string;
  status: "pending" | "approved" | "rejected";
  email: string;
  domain: string;
  requested: number;
  decided?: number;
  decided_by?: string;
};

export async function getVendorClaim(slug: string): Promise<VendorClaim | null> {
  if (!kvConfigured() || !slug) return null;
  return getJson<VendorClaim>(`vendor:claim:${slug}`);
}

export async function listVendorClaims(): Promise<VendorClaim[]> {
  if (!kvConfigured()) return [];
  const slugs = ((await kv(["SMEMBERS", "vendor:claims:index"])) as string[]) ?? [];
  const out: VendorClaim[] = [];
  for (const s of slugs) {
    const c = await getJson<VendorClaim>(`vendor:claim:${s}`);
    if (c) out.push(c);
    else await kv(["SREM", "vendor:claims:index", s]);
  }
  return out.sort((a, b) => b.requested - a.requested);
}

/** A domain-verified supplier requests to claim their vendor profile. An
 *  already-approved claim is returned unchanged (idempotent); otherwise a
 *  fresh pending claim is recorded for an admin to approve. */
export async function requestVendorClaim(slug: string, email: string, domain: string): Promise<VendorClaim> {
  const existing = await getVendorClaim(slug);
  if (existing && existing.status === "approved") return existing;
  const claim: VendorClaim = {
    slug,
    status: "pending",
    email: email.toLowerCase(),
    domain: domain.toLowerCase(),
    requested: Date.now(),
  };
  await setJson(`vendor:claim:${slug}`, claim);
  await kv(["SADD", "vendor:claims:index", slug]);
  return claim;
}

/** Admin approves or rejects a pending claim. */
export async function decideVendorClaim(slug: string, approve: boolean, adminEmail: string): Promise<VendorClaim | null> {
  const existing = await getVendorClaim(slug);
  if (!existing) return null;
  const updated: VendorClaim = {
    ...existing,
    status: approve ? "approved" : "rejected",
    decided: Date.now(),
    decided_by: adminEmail.toLowerCase(),
  };
  await setJson(`vendor:claim:${slug}`, updated);
  await kv(["SADD", "vendor:claims:index", slug]);
  return updated;
}

/* Buyer RFP ownership index (optional account) */
export async function indexRfpForBuyer(email: string, rfpId: string): Promise<void> {
  await kv(["SADD", `buyer:${email.toLowerCase()}:rfps`, rfpId]);
}
export async function listBuyerRfpIds(email: string): Promise<string[]> {
  if (!kvConfigured()) return [];
  return ((await kv(["SMEMBERS", `buyer:${email.toLowerCase()}:rfps`])) as string[]) ?? [];
}

/* ------------------------------------------------------------------ */
/* Admin account deletion (registered users) */
/* ------------------------------------------------------------------ */

export type SignupRecord = { email: string; roles: string[] };

/** Registered users, parsed from the signups index (members are "role:email"). */
export async function listSignups(): Promise<SignupRecord[]> {
  if (!kvConfigured()) return [];
  const members = ((await kv(["SMEMBERS", "auth:index:signups"])) as string[]) ?? [];
  const byEmail = new Map<string, Set<string>>();
  for (const member of members) {
    const sep = member.indexOf(":");
    if (sep <= 0) continue;
    const email = member.slice(sep + 1).toLowerCase();
    const roles = byEmail.get(email) ?? new Set<string>();
    roles.add(member.slice(0, sep));
    byEmail.set(email, roles);
  }
  return Array.from(byEmail.entries())
    .map(([email, roles]) => ({ email, roles: Array.from(roles).sort() }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

export type DeleteUserSummary = { sessions_deleted: number; rfps_deleted: number; opportunities_deleted: number };

/**
 * Admin deletion of a registered user, so an account can be erased on
 * request or reset for a fresh end-to-end test. Removes the sign-up record
 * for every role and revokes all live sessions for the email; the next
 * sign-in then behaves as a brand-new sign-up. With deleteRfps, also hard
 * deletes every RFP owned by the email - the record, share-token lookup,
 * threads, responses, NDA acceptances, supplier connections and their
 * token lookups - plus any board opportunity published from it (via
 * deleteOpportunity, which mirrors this cleanup for notices). Admin rights
 * come from the admin email list, not KV, so they are unaffected.
 */
export async function deleteUser(email: string, opts: { deleteRfps: boolean }): Promise<DeleteUserSummary> {
  const target = email.trim().toLowerCase();
  const summary: DeleteUserSummary = { sessions_deleted: 0, rfps_deleted: 0, opportunities_deleted: 0 };
  if (!target) return summary;

  // Sign-up records: one signups-index member per role.
  for (const role of ["supplier", "buyer", "netify"]) {
    await kv(["SREM", "auth:index:signups", `${role}:${target}`]);
  }

  // Every live session for the email.
  for (const s of await listSessions()) {
    if (s.email.toLowerCase() !== target) continue;
    await deleteSession(s.token);
    summary.sessions_deleted += 1;
  }

  // Optionally cascade into the RFPs owned by the email, found via the
  // buyer ownership index and checked against the stored owner_email.
  if (opts.deleteRfps) {
    const opportunities = await listOpportunities();
    for (const id of await listBuyerRfpIds(target)) {
      const project = await getJson<ProjectDetails>(`rfp:${id}`);
      if (!project) { await kv(["SREM", `buyer:${target}:rfps`, id]); continue; }
      if ((project.owner_email ?? "").toLowerCase() !== target) continue;
      for (const o of opportunities) {
        if (o.source_rfp_id !== id) continue;
        if (await deleteOpportunity(o.id)) summary.opportunities_deleted += 1;
      }
      for (const c of await listConnections(id)) {
        await kv(["DEL", `rfp:conn:${c.token}`]);
      }
      if (project.share_token) await kv(["DEL", `rfp:token:${project.share_token}`]);
      await kv(["DEL", `rfp:${id}:connections`]);
      await kv(["DEL", `rfp:${id}:threads`]);
      await kv(["DEL", `rfp:${id}:responses`]);
      await kv(["DEL", `rfp:${id}:nda`]);
      await kv(["DEL", `rfp:${id}:board_opp`]);
      await kv(["DEL", `rfp:${id}`]);
      await kv(["SREM", `buyer:${target}:rfps`, id]);
      summary.rfps_deleted += 1;
    }
  }

  return summary;
}
