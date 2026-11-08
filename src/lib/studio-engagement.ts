import {recordMarketplaceFunnelEvent} from './marketplace-funnel-safe';
import { notifyBuyerOfSupplierActivity } from "./notify";
/** Durable bid requests and conversations. No contact release or supplier mail. */
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import {
  getOpportunity,
  getProject,
  getVendorClaim,
  kvRaw,
  kvGetJson,
  type AuthSession,
} from "./rfp-store";
import { isMarketUnlocked } from "./market-unlock";
import { getLatestPublishedSnapshot } from "./published-snapshot";
import { isStudioProject, studioDraftFromProject } from "./studio-project";
import { toPublicOpportunity } from "./opportunity-types";
import { vendorName } from "./opportunity";

export class StudioAccessError extends Error {
  constructor(
    message: string,
    public status = 403,
  ) {
    super(message);
  }
}
const MessageSchema = z.object({
  id: z.string(),
  from: z.enum(["buyer", "supplier"]),
  body: z.string().min(1).max(10000),
  created: z.number(),
});
export const BidRequestSchema = z.object({
  vendor_slug: z.string(),
  vendor_name: z.string(),
  reason: z.string().min(20).max(4000),
  status: z.enum(["requested", "approved", "declined"]),
  created: z.number(),
  decided: z.number().nullable(),
  messages: z.array(MessageSchema).default([]),
});
export type StudioBidRequest = z.infer<typeof BidRequestSchema>;
const key = (id: string) => `studio:${id}:bid_requests`;
async function publishedProject(id: string) {
  const p = await getProject(id);
  if (
    !p ||
    !isStudioProject(p) ||
    p.marketplace_state?.publication_status !== "published" ||
    !(await isMarketUnlocked(id))
  )
    throw new StudioAccessError("Published project not found.", 404);
  const oppId =
    p.marketplace_state?.board_opportunity_id ??
    (await kvGetJson<string>(`rfp:${id}:board_opp`));
  const opp = oppId ? await getOpportunity(oppId) : null;
  if (!opp || opp.source_rfp_id !== id)
    throw new StudioAccessError("Published project not found.", 404);
  return { p, opp };
}
export async function requireStudioSupplier(session: AuthSession | null) {
  if (!session || session.role !== "supplier" || !session.vendor_slug)
    throw new StudioAccessError(
      "Sign in with an approved supplier account.",
      401,
    );
  const claim = await getVendorClaim(session.vendor_slug);
  if (claim?.status !== "approved")
    throw new StudioAccessError(
      "Your supplier profile must be approved before viewing details or requesting to bid.",
    );
  return session.vendor_slug;
}
async function owner(id: string, session: AuthSession | null) {
  const result = await publishedProject(id);
  if (
    !session ||
    !["buyer", "netify"].includes(session.role) ||
    session.email.toLowerCase() !== result.p.owner_email.toLowerCase()
  )
    throw new StudioAccessError("Project not found.", 404);
  return result;
}
async function rows(id: string) {
  const r = await kvGetJson<unknown[]>(key(id));
  return z.array(BidRequestSchema).parse(r ?? []);
}
async function locked<T>(id: string, work: () => Promise<T>) {
  const lock = `studio:${id}:engagement_lock`,
    nonce = randomBytes(24).toString("hex");
  if ((await kvRaw(["SET", lock, nonce, "NX", "EX", 30])) !== "OK")
    throw new StudioAccessError(
      "Another change is being saved. Refresh and retry.",
      409,
    );
  try {
    return await work();
  } finally {
    await kvRaw([
      "EVAL",
      "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
      1,
      lock,
      nonce,
    ]);
  }
}
export async function readBuyerEngagement(
  id: string,
  session: AuthSession | null,
) {
  const { opp } = await owner(id, session);
  return { opportunity: toPublicOpportunity(opp), requests: await rows(id) };
}
export async function readSupplierEngagement(
  id: string,
  session: AuthSession | null,
) {
  const slug = await requireStudioSupplier(session);
  const { p, opp } = await publishedProject(id);
  if (opp.eligibility === "invited" && !opp.invited.includes(slug))
    throw new StudioAccessError("This project is invitation-only.");
  const snapshot = await getLatestPublishedSnapshot(id);
  if (!snapshot)
    throw new StudioAccessError(
      "The published requirement is unavailable. Try again later.",
      503,
    );
  const frozen = {
    ...p,
    buyer: snapshot.frozen_content.buyer,
    rfp_sections: snapshot.frozen_content.rfp_sections,
  };
  // Only anonymous requirement fields; never tokens, source ledgers, company or other suppliers.
  return {
    project_id: id,
    opportunity: toPublicOpportunity(opp),
    requirement: snapshot.frozen_content.studio_requirement ?? studioDraftFromProject(frozen),
    request: (await rows(id)).find((r) => r.vendor_slug === slug) ?? null,
    status: opp.status,
  };
}
export async function requestStudioBid(
  id: string,
  session: AuthSession | null,
  reason: unknown,
  channel:"web"|"mcp"="web",
) {
  const parsed = z.string().trim().min(20).max(4000).parse(reason);
  const supplier = await readSupplierEngagement(id, session);
  const slug = session!.vendor_slug!;
  if (supplier.status !== "open")
    throw new StudioAccessError("This opportunity is closed.", 409);
  return locked(id, async () => {
    const requests = await rows(id);
    const prior = requests.find((r) => r.vendor_slug === slug);
    if (prior) return prior;
    const row = BidRequestSchema.parse({
      vendor_slug: slug,
      vendor_name: vendorName(slug) ?? slug,
      reason: parsed,
      status: "requested",
      created: Date.now(),
      decided: null,
      messages: [],
    });
    await kvRaw(["SET", key(id), JSON.stringify([...requests, row])]);
    await recordMarketplaceFunnelEvent({event:"supplier_interest",project_id:id,channel});
    try {
      const { opp } = await publishedProject(id);
      await notifyBuyerOfSupplierActivity(opp, row.vendor_name, "interest");
    } catch {
      /* The durable request remains visible if email delivery is unavailable. */
    }
    return row;
  });
}
export async function decideStudioBid(
  id: string,
  session: AuthSession | null,
  slug: string,
  decision: "approved" | "declined",
) {
  const { opp } = await owner(id, session);
  if (opp.status !== "open")
    throw new StudioAccessError("This opportunity is closed.", 409);
  return locked(id, async () => {
    const requests = await rows(id),
      r = requests.find((r) => r.vendor_slug === slug);
    if (!r) throw new StudioAccessError("Bid request not found.", 404);
    if (r.status !== "requested") {
      if (r.status === decision) return r;
      throw new StudioAccessError("This request already has a decision.", 409);
    }
    r.status = decision;
    r.decided = Date.now();
    await kvRaw(["SET", key(id), JSON.stringify(requests)]);
    return r;
  });
}
export async function messageStudioBid(
  id: string,
  session: AuthSession | null,
  slug: string,
  body: unknown,
  idempotencyKey: unknown,
  channel:"web"|"mcp"="web",
) {
  const text = z.string().trim().min(1).max(10000).parse(body);
  const messageId = z.string().uuid().parse(idempotencyKey);
  const { p, opp } = await publishedProject(id);
  if (opp.status !== "open")
    throw new StudioAccessError("This opportunity is closed.", 409);
  const isOwner = Boolean(
    session &&
    ["buyer", "netify"].includes(session.role) &&
    session.email.toLowerCase() === p.owner_email.toLowerCase(),
  );
  if (!isOwner && (await requireStudioSupplier(session)) !== slug)
    throw new StudioAccessError("Project conversation not found.", 404);
  return locked(id, async () => {
    const requests = await rows(id),
      r = requests.find((r) => r.vendor_slug === slug);
    if (!r || r.status !== "approved")
      throw new StudioAccessError(
        "The buyer must approve this request before a conversation can open.",
      );
    const prior = r.messages.find((m) => m.id === messageId);
    if (prior) {
      if (
        prior.body !== text ||
        prior.from !== (isOwner ? "buyer" : "supplier")
      )
        throw new StudioAccessError(
          "This message reference has already been used.",
          409,
        );
      return r;
    }
    if (r.messages.length >= 200)
      throw new StudioAccessError(
        "Conversation limit reached. Contact Netify for help.",
        409,
      );
    r.messages.push({
      id: messageId,
      from: isOwner ? "buyer" : "supplier",
      body: text,
      created: Date.now(),
    });
    await kvRaw(["SET", key(id), JSON.stringify(requests)]);
    if(!isOwner)await recordMarketplaceFunnelEvent({event:"supplier_response",project_id:id,channel});
    return r;
  });
}
// Deliberately scoped to ONE approved supplier and ONE published project, one hour, hashed at rest.
export async function issueStudioSupplierAgent(
  id: string,
  session: AuthSession | null,
) {
  await readSupplierEngagement(id, session);
  const token = randomBytes(32).toString("base64url");
  await kvRaw([
    "SET",
    `studio:agent:${createHash("sha256").update(token).digest("hex")}`,
    JSON.stringify({
      project_id: id,
      session: { ...session, token: "", email: "" },
    }),
    "EX",
    3600,
  ]);
  await kvRaw([
    "SET",
    `studio:${id}:agent:${session!.vendor_slug}`,
    createHash("sha256").update(token).digest("hex"),
    "EX",
    3600,
  ]);
  return { token, expires_at: Date.now() + 3600000 };
}
export async function studioAgentSession(id: string, token: string) {
  const record = await kvGetJson<{ project_id: string; session: AuthSession }>(
    `studio:agent:${createHash("sha256").update(token).digest("hex")}`,
  );
  if (!record || record.project_id !== id)
    throw new StudioAccessError(
      "Assistant access has expired. Reconnect from the supplier workspace.",
      401,
    );
  await requireStudioSupplier(record.session);
  const active = await kvRaw([
    "GET",
    `studio:${id}:agent:${record.session.vendor_slug}`,
  ]);
  if (active !== createHash("sha256").update(token).digest("hex"))
    throw new StudioAccessError("Assistant access has been disconnected.", 401);
  return record.session;
}

export async function revokeStudioSupplierAgent(
  id: string,
  session: AuthSession | null,
) {
  await readSupplierEngagement(id, session);
  await kvRaw(["DEL", `studio:${id}:agent:${session!.vendor_slug}`]);
  return { ok: true };
}
