import { isShortProject, shortProjectReadiness, shortProjectNotice } from "@/lib/short-project";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { ProjectEntranceContextSchema } from "@/lib/project-entrance-contract";
import { entranceToProjectDetails } from "@/lib/project-entrance";
import { ProjectDetailsSchema, SectorProfileStateSchema, PROJECT_JOURNEY_MODES } from "@/lib/rfp-types";
import { MARKETPLACE_PUBLICATION_CONSENT_TEXT, MARKETPLACE_PUBLICATION_CONSENT_VERSION } from "@/lib/publication-policy";
import { getProject, kvGetJson, kvRaw, newId, saveProject } from "@/lib/rfp-store";
import { ProviderMatchInputSchema, PROVIDER_MATCH_METHODOLOGY_VERSION } from "@/lib/provider-matching";
import { recordMarketplaceFunnelEvent } from "@/lib/marketplace-funnel";
import { getStrictLiveShortlistDataset, shortlistInputFromProviderMatchInput } from "@/lib/live-shortlist";
import { buildShortlist } from "@/lib/shortlist-core";
import { FEATURE_NAMES } from "@/lib/vendors";

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

/** Serialize updates, preparation and publication so simultaneous requests cannot overwrite consent or revisions. */
export async function withMarketplaceMutation<T>(projectId: string, token: string, work: () => Promise<T>): Promise<T> {
  await authenticateMarketplaceProject(projectId, token);
  const key = `marketplace:mutation:${projectId}`;
  const owner = randomBytes(24).toString("hex");
  if (await kvRaw(["SET", key, owner, "NX", "EX", 120]) !== "OK") throw new MarketplaceProjectConflict("This project is being saved. Please retry shortly.");
  try { return await work(); }
  finally { await kvRaw(["EVAL", "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end", 1, key, owner]); }
}

export async function startMarketplaceProject(input: { entrance_context: unknown; mode: "quick_list" | "find_providers" | "build_rfp" | "validate_rfp"; sector_profile?: unknown; now?: number }) {
  z.enum(PROJECT_JOURNEY_MODES).parse(input.mode);
  const suppliedEntrance = ProjectEntranceContextSchema.parse(input.entrance_context);
  const entrance = ProjectEntranceContextSchema.parse({ ...suppliedEntrance, raw_input: { ...suppliedEntrance.raw_input, publication_contract: "short-project/1" } });
  const sectorProfile = input.sector_profile ? SectorProfileStateSchema.parse(input.sector_profile) : undefined;
  const now = input.now ?? Date.now();
  const scope = typeof entrance.raw_input.solution_scope === "string" ? entrance.raw_input.solution_scope.toUpperCase() : "SASE / SD-WAN";
  const title = input.mode === "quick_list" || input.mode === "find_providers" ? `${scope} opportunity${entrance.sector ? ` for ${entrance.sector}` : ""}` : undefined;
  const project = entranceToProjectDetails({ entrance, ids: { id: newId("rfp"), shareToken: newId("tok"), manageToken: newId("mtok") }, now, title });
  const saved = await saveProject(ProjectDetailsSchema.parse({ ...project, journey: { contract_version: "project-journey/1.0.0", source: entrance.source, mode: input.mode, source_url: entrance.source_url, started_at: now }, sector_profile: sectorProfile, marketplace_revision: 0, marketplace_state: { contract_version: "project-marketplace-state/1.0.0", publication_status: "draft", board_opportunity_id: null, market_unlock_status: "locked", server_updated_at: now } }));
  const token = randomBytes(32).toString("base64url");
  const session = SessionSchema.parse({ project_id: saved.id, token_hash: hash(token), revision: 0, created_at: now, expires_at: now + SESSION_TTL_SECONDS * 1000 });
  await persistSession(token, session);
  await recordMarketplaceFunnelEvent({ event: "project_started", project_id: saved.id, source: entrance.source, mode: input.mode, channel: entrance.source === "mcp" ? "mcp" : "web" });
  return { project_reference: saved.id, project_session_token: token, revision: 0, expires_at: session.expires_at, resume_url: `https://netify.co.uk/sase-sd-wan-rfp-builder/?journey=${input.mode}&project=${encodeURIComponent(saved.id)}#project_session=${encodeURIComponent(token)}` };
}

async function updateMarketplaceProjectUnlocked(projectId: string, token: string, raw: unknown) {
  const input = UpdateSchema.parse(raw);
  const session = await authenticateMarketplaceProject(projectId, token);
  const prior = await kvGetJson<{ project_reference: string; revision: number; saved_at: number }>(idempotencyKey(projectId, input.idempotency_key));
  if (prior) return prior;
  if (session.revision !== input.base_revision) throw new MarketplaceProjectConflict(`Revision conflict: expected ${session.revision}.`);
  const project = await getProject(projectId);
  if (!project) throw new MarketplaceProjectUnauthorised("Project not found.");
  if (project.marketplace_revision !== input.base_revision) throw new MarketplaceProjectConflict("This project has changed. Reload before editing.");
  if (project.marketplace_state?.publication_status === "published" || ["published", "qa", "evaluation"].includes(project.status)) throw new MarketplaceProjectConflict("Open the published project to change requirements.");
  const nextRevision = session.revision + 1;
  const saved = await saveProject(ProjectDetailsSchema.parse({ ...project, consent: undefined, pending_submit: undefined, buyer: { ...project.buyer, ...input.buyer_patch }, entrance_context: project.entrance_context ? { ...project.entrance_context, buyer_input: { ...project.entrance_context.buyer_input, ...input.buyer_patch }, raw_input: { ...project.entrance_context.raw_input, ...input.raw_input } } : project.entrance_context, sector_profile: input.sector_profile ?? project.sector_profile, marketplace_revision: nextRevision }));
  const receipt = { project_reference: saved.id, revision: nextRevision, saved_at: saved.updated };
  await kvRaw(["SET", idempotencyKey(projectId, input.idempotency_key), JSON.stringify(receipt), "EX", SESSION_TTL_SECONDS]);
  await persistSession(token, { ...session, revision: nextRevision, expires_at: Date.now() + SESSION_TTL_SECONDS * 1000 });
  await recordMarketplaceFunnelEvent({ event: "requirements_updated", project_id: saved.id, source: saved.journey?.source, mode: saved.journey?.mode, channel: saved.journey?.source === "mcp" ? "mcp" : "web", detail: { revision: nextRevision } });
  return receipt;
}

const PreviewRequestSchema = z.object({ base_revision: z.number().int().min(0), input: ProviderMatchInputSchema }).strict();

async function previewMarketplaceProjectUnlocked(projectId: string, token: string, rawInput: unknown) {
  const session = await authenticateMarketplaceProject(projectId, token);
  const request = PreviewRequestSchema.parse(rawInput);
  if (session.revision !== request.base_revision) throw new MarketplaceProjectConflict(`Revision conflict: expected ${session.revision}.`);
  const input = request.input;
  const project = await getProject(projectId);
  if (!project) throw new MarketplaceProjectUnauthorised("Project not found.");
  const live = await getStrictLiveShortlistDataset();
  const translated = shortlistInputFromProviderMatchInput(input);
  const scoped = live.vendors.filter((provider) => {
    if (input.provider_scope === "both") return true;
    const category = provider.category.toLowerCase();
    return input.provider_scope === "technology"
      ? category.includes("technology vendor")
      : /managed service provider|carrier network provider|integrator/.test(category);
  });
  const result = buildShortlist(scoped, translated.input, FEATURE_NAMES);
  const eligibleSlugs = new Set(result.shortlist.map((provider) => provider.slug));
  const eligible = scoped.filter((provider) => eligibleSlugs.has(provider.slug));
  const satisfies = new Set(["yes", "partial", "partner_integrated", "managed_service_dependent"]);
  const nextRevision = session.revision + 1;
  const preview = {
    methodology_version: PROVIDER_MATCH_METHODOLOGY_VERSION,
    dataset_versions: live.datasetVersions,
    considered_count: scoped.length,
    eligible_technology_count: eligible.filter((provider) => provider.category.toLowerCase().includes("technology vendor")).length,
    eligible_managed_provider_count: eligible.filter((provider) => /managed service provider|carrier network provider|integrator/.test(provider.category.toLowerCase())).length,
    meets_all_mandatory_count: eligible.length,
    capability_coverage: input.mandatory_capabilities.map((code) => {
      const featureId = translated.featureIdFor(code);
      return { code, supported_provider_count: featureId ? scoped.filter((provider) => satisfies.has(provider.capabilities[featureId])).length : 0 };
    }),
    unresolved_requirements: translated.unresolved,
    calculated_at: Date.now(),
    project_revision: nextRevision,
  };
  const saved = await saveProject(ProjectDetailsSchema.parse({ ...project, match_preview: preview, marketplace_revision: nextRevision }));
  await persistSession(token, { ...session, revision: nextRevision, expires_at: Date.now() + SESSION_TTL_SECONDS * 1000 });
  await recordMarketplaceFunnelEvent({ event: "match_previewed", project_id: saved.id, source: saved.journey?.source, mode: saved.journey?.mode, channel: saved.journey?.source === "mcp" ? "mcp" : "web", detail: { revision: nextRevision, considered_count: preview.considered_count } });
  return { project_reference: saved.id, revision: nextRevision, preview };
}

const PreparePublicationSchema = z.object({ base_revision: z.number().int().min(0), consent_version: z.literal(MARKETPLACE_PUBLICATION_CONSENT_VERSION), consent_text: z.literal(MARKETPLACE_PUBLICATION_CONSENT_TEXT), marketing_opt_in: z.boolean().default(false) }).strict();

async function prepareMarketplacePublicationUnlocked(projectId: string, token: string, rawInput: unknown) {
  const session = await authenticateMarketplaceProject(projectId, token);
  const input = PreparePublicationSchema.parse(rawInput);
  if (session.revision !== input.base_revision) throw new MarketplaceProjectConflict(`Revision conflict: expected ${session.revision}.`);
  const project = await getProject(projectId);
  if (!project) throw new MarketplaceProjectUnauthorised("Project not found.");
  if (project.marketplace_revision !== input.base_revision) throw new MarketplaceProjectConflict("This project has changed. Reload before publishing.");
  if (project.buyer.organisation.trim().length < 2) throw new Error("Confirm your company name before publishing.");
  if (isShortProject(project)) {
    const readiness = shortProjectReadiness(project);
    if (!readiness.allowed) throw new Error(readiness.reasons.join("; "));
  }
  const nextRevision = session.revision + 1;
  const at = Date.now();
  const saved = await saveProject(ProjectDetailsSchema.parse({ ...project, consent: { version: input.consent_version, agreed_at: at, flow: "marketplace_project" }, pending_submit: { shortlist_size: 5, list_on_board: true, marketing_opt_in: input.marketing_opt_in, requested_at: at }, marketplace_revision: nextRevision }));
  await persistSession(token, { ...session, revision: nextRevision, expires_at: at + SESSION_TTL_SECONDS * 1000 });
  await recordMarketplaceFunnelEvent({ event: "publication_prepared", project_id: saved.id, source: saved.journey?.source, mode: saved.journey?.mode, channel: saved.journey?.source === "mcp" ? "mcp" : "web", detail: { revision: nextRevision } });
  return { project_reference: saved.id, revision: nextRevision, prepared_at: at };
}

/** Private draft projection for reloads and email verification returns. Never exposes credentials. */
export async function readMarketplaceProject(projectId: string, token: string) {
  const session = await authenticateMarketplaceProject(projectId, token);
  const project = await getProject(projectId);
  if (!project) throw new MarketplaceProjectUnauthorised("Project not found.");
  return {
    project_reference: project.id, revision: project.marketplace_revision,
    expires_at: session.expires_at, buyer: project.buyer, entrance_context: project.entrance_context,
    notice: isShortProject(project) ? shortProjectNotice(project) : null,
    mode: project.journey?.mode, prepared: project.consent?.version === MARKETPLACE_PUBLICATION_CONSENT_VERSION,
    marketplace_state: project.marketplace_state,
  };
}

export async function updateMarketplaceProject(projectId: string, token: string, input: unknown) {
  return withMarketplaceMutation(projectId, token, () => updateMarketplaceProjectUnlocked(projectId, token, input));
}

export async function previewMarketplaceProject(projectId: string, token: string, input: unknown) {
  return withMarketplaceMutation(projectId, token, () => previewMarketplaceProjectUnlocked(projectId, token, input));
}

export async function prepareMarketplacePublication(projectId: string, token: string, input: unknown) {
  return withMarketplaceMutation(projectId, token, () => prepareMarketplacePublicationUnlocked(projectId, token, input));
}
