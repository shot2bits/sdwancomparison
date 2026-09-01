import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { ProjectEntranceContextSchema } from "@/lib/project-entrance-contract";
import { entranceToProjectDetails } from "@/lib/project-entrance";
import { ProjectDetailsSchema, SectorProfileStateSchema } from "@/lib/rfp-types";
import { getProject, kvGetJson, kvRaw, newId, saveProject } from "@/lib/rfp-store";
import { loadProviderMatchRecords } from "@/lib/provider-match-source";
import { matchProviders, ProviderMatchInputSchema, publicProviderMatchPreview } from "@/lib/provider-matching";

const SESSION_TTL_SECONDS = 60 * 60 * 8;
const SessionSchema = z.object({ project_id: z.string(), token_hash: z.string(), revision: z.number().int().min(0), created_at: z.number(), expires_at: z.number() }).strict();
const UpdateSchema = z.object({ base_revision: z.number().int().min(0), idempotency_key: z.string().min(8).max(160), buyer_patch: z.record(z.string(), z.unknown()).default({}), raw_input: z.record(z.string(), z.unknown()).default({}), sector_profile: SectorProfileStateSchema.optional() }).strict();
type MarketplaceSession = z.infer<typeof SessionSchema>;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const sessionKey = (token: string) => `marketplace:project_session:${hash(token)}`;
const idempotencyKey = (projectId: string, key: string) => `marketplace:project_update:${projectId}:${hash(key)}`;

export class MarketplaceProjectConflict extends Error { status = 409 as const; }
export class MarketplaceProjectUnauthorised extends Error { status = 404 as const; }

async function persistSession(token: string, session: MarketplaceSession) {
  await kvRaw(["SET", sessionKey(token), JSON.stringify(session), "EX", SESSION_TTL_SECONDS]);
}
export async function authenticateMarketplaceProject(projectId: string, token: string) {
  const raw = await kvGetJson<MarketplaceSession>(sessionKey(token));
  const parsed = SessionSchema.safeParse(raw);
  if (!parsed.success || parsed.data.project_id !== projectId || parsed.data.token_hash !== hash(token) || parsed.data.expires_at <= Date.now()) throw new MarketplaceProjectUnauthorised("Project not found.");
  return parsed.data;
}

export async function startMarketplaceProject(input: { entrance_context: unknown; mode: "quick_list" | "find_providers" | "build_rfp" | "validate_rfp"; sector_profile?: unknown; now?: number }) {
  const entrance = ProjectEntranceContextSchema.parse(input.entrance_context);
  const sectorProfile = input.sector_profile ? SectorProfileStateSchema.parse(input.sector_profile) : undefined;
  const now = input.now ?? Date.now();
  const scope = typeof entrance.raw_input.solution_scope === "string" ? entrance.raw_input.solution_scope.toUpperCase() : "SASE / SD-WAN";
  const title = input.mode === "quick_list" || input.mode === "find_providers" ? `${scope} opportunity${entrance.sector ? ` for ${entrance.sector}` : ""}` : undefined;
  const project = entranceToProjectDetails({ entrance, ids: { id: newId("rfp"), shareToken: newId("tok"), manageToken: newId("mtok") }, now, title });
  const saved = await saveProject(ProjectDetailsSchema.parse({ ...project, journey: { contract_version: "project-journey/1.0.0", source: entrance.source, mode: input.mode, source_url: entrance.source_url, started_at: now }, sector_profile: sectorProfile, marketplace_revision: 0, marketplace_state: { contract_version: "project-marketplace-state/1.0.0", publication_status: "draft", board_opportunity_id: null, market_unlock_status: "locked", server_updated_at: now } }));
  const token = randomBytes(32).toString("base64url");
  const session = SessionSchema.parse({ project_id: saved.id, token_hash: hash(token), revision: 0, created_at: now, expires_at: now + SESSION_TTL_SECONDS * 1000 });
  await persistSession(token, session);
  return { project_reference: saved.id, project_session_token: token, revision: 0, expires_at: session.expires_at };
}

export async function updateMarketplaceProject(projectId: string, token: string, raw: unknown) {
  const input = UpdateSchema.parse(raw);
  const session = await authenticateMarketplaceProject(projectId, token);
  const prior = await kvGetJson<{ project_reference: string; revision: number; saved_at: number }>(idempotencyKey(projectId, input.idempotency_key));
  if (prior) return prior;
  if (session.revision !== input.base_revision) throw new MarketplaceProjectConflict(`Revision conflict: expected ${session.revision}.`);
  const project = await getProject(projectId);
  if (!project) throw new MarketplaceProjectUnauthorised("Project not found.");
  const nextRevision = session.revision + 1;
  const saved = await saveProject(ProjectDetailsSchema.parse({ ...project, buyer: { ...project.buyer, ...input.buyer_patch }, entrance_context: project.entrance_context ? { ...project.entrance_context, buyer_input: { ...project.entrance_context.buyer_input, ...input.buyer_patch }, raw_input: { ...project.entrance_context.raw_input, ...input.raw_input } } : project.entrance_context, sector_profile: input.sector_profile ?? project.sector_profile, marketplace_revision: nextRevision }));
  const receipt = { project_reference: saved.id, revision: nextRevision, saved_at: saved.updated };
  await kvRaw(["SET", idempotencyKey(projectId, input.idempotency_key), JSON.stringify(receipt), "EX", SESSION_TTL_SECONDS]);
  await persistSession(token, { ...session, revision: nextRevision, expires_at: Date.now() + SESSION_TTL_SECONDS * 1000 });
  return receipt;
}

const PreviewRequestSchema = z.object({ base_revision: z.number().int().min(0), input: ProviderMatchInputSchema }).strict();

export async function previewMarketplaceProject(projectId: string, token: string, rawInput: unknown) {
  const session = await authenticateMarketplaceProject(projectId, token);
  const request = PreviewRequestSchema.parse(rawInput);
  if (session.revision !== request.base_revision) throw new MarketplaceProjectConflict(`Revision conflict: expected ${session.revision}.`);
  const input = request.input;
  const project = await getProject(projectId);
  if (!project) throw new MarketplaceProjectUnauthorised("Project not found.");
  const records = await loadProviderMatchRecords();
  const preview = publicProviderMatchPreview(matchProviders(input, records));
  const nextRevision = session.revision + 1;
  const saved = await saveProject(ProjectDetailsSchema.parse({ ...project, match_preview: preview, marketplace_revision: nextRevision }));
  await persistSession(token, { ...session, revision: nextRevision, expires_at: Date.now() + SESSION_TTL_SECONDS * 1000 });
  return { project_reference: saved.id, revision: nextRevision, preview };
}
