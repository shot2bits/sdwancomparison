import { recordSourcingMetric } from "./sourcing-metrics";
import { circuitLock } from "./circuit-store";
import { notifyConfirmedSourcing } from "./sourcing-notifications";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  SOURCING_ACTION_LABELS,
  SourcingRequestSchema,
  validateRecipients,
  type SourcingRequest,
} from "./sourcing-contract";
import {
  kvRaw,
  kvGetJson,
  kvConfigured,
  saveProject,
  getProject,
} from "./rfp-store";
import {
  activityMailFetch,
  activityMailKey,
  previewMailCaptureEnabled,
} from "./activity-mail";
import { isBlockedDomainLive, emailDomain } from "./access-control";
import { getLiveShortlistDataset } from "./live-shortlist";
import {
  shortlistEntrance,
  entranceToProjectDetails,
} from "./project-entrance";
import { ShortlistInputSchema } from "./shortlist-core";
import { SITE_URL } from "./structured-data";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
export type SourcingRecord = {
  id: string;
  project_id: string;
  request: SourcingRequest;
  payload_hash: string;
  token_hash: string;
  expires_at: number;
  created_at: number;
  status: "pending_confirmation" | "desk_review";
  confirmed_at: number | null;
  mail_sent?: boolean; // Legacy records only; delivery receipt is stored separately.
};
export function assertRequestConfirmation(
  r: SourcingRecord,
  token: string,
  now = Date.now(),
) {
  if (
    r.token_hash !== digest(token) ||
    (r.status !== "desk_review" && r.expires_at <= now)
  )
    throw new Error("Confirmation expired or invalid. Request a new link.");
  if (r.payload_hash !== digest(JSON.stringify(r.request)))
    throw new Error(
      "The approved request has changed. Please review it again.",
    );
  if (r.request.consent !== true)
    throw new Error("Request approval is required.");
}
async function limit(key: string, max: number) {
  const hash = digest(key);
  const count = Number(await kvRaw(["INCR", `sourcing:limit:${hash}`]));
  if (count === 1) await kvRaw(["EXPIRE", `sourcing:limit:${hash}`, 3600]);
  if (count > max)
    throw new Error("Too many requests. Please try again later.");
}
// Persist the exact transport payload so ambiguous failures reuse both body and key.
async function deliverConfirmation(record: SourcingRecord) {
  try {
    await circuitLock(`sourcing-mail:${record.id}`, async () => {
      if (await kvGetJson(`sourcing:mail:${record.id}`)) return;
      const payload = await kvGetJson<{ body: string }>(
        `sourcing:mail-payload:${record.id}`,
      );
      if (!payload) throw new Error("Confirmation payload is unavailable");
      const response = await activityMailFetch(
        "https://api.resend.com/emails",
        {
          method: "POST",
          signal: AbortSignal.timeout(10_000),
          headers: {
            authorization: `Bearer ${activityMailKey()}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `sourcing-${record.id}`,
          },
          body: payload.body,
        },
      );
      if (!response.ok)
        throw new Error("Confirmation transport was not accepted");
      await kvRaw([
        "SET",
        `sourcing:mail:${record.id}`,
        JSON.stringify({ accepted: true }),
        "EX",
        86400,
      ]);
    });
  } catch {
    throw new Error(
      "Confirmation delivery is not yet confirmed. Please retry this same request shortly.",
    );
  }
}
export async function requestSourcing(raw: unknown, requestKey: string) {
  const input = SourcingRequestSchema.parse(raw);
  const live = await getLiveShortlistDataset();
  validateRecipients(
    input,
    live.vendors.map((v) => v.slug),
  );
  if (!kvConfigured() || !activityMailKey())
    throw new Error(
      "Request delivery is not enabled in this preview. Research and draft plans remain available.",
    );
  if (await isBlockedDomainLive(emailDomain(input.email) ?? ""))
    throw new Error("Use a work email for this request.");
  const lock = `sourcing:idem:${digest(input.email + input.idempotency_key)}`;
  const existing = await kvGetJson<{ id: string; hash: string }>(lock);
  const payloadHash = digest(JSON.stringify(input));
  if (existing) {
    if (existing.hash !== payloadHash)
      throw new Error(
        "This request key was already used for different requirements.",
      );
    const saved = await kvGetJson<SourcingRecord>(
      `sourcing:request:${existing.id}`,
    );
    if (!saved)
      throw new Error(
        "This request is already being prepared. Please retry shortly.",
      );
    if (
      saved.status === "pending_confirmation" &&
      saved.expires_at <= Date.now()
    )
      throw new Error(
        "This request has expired. Prepare a new request for confirmation.",
      );
    if (
      saved.status === "pending_confirmation" &&
      !saved.mail_sent &&
      !(await kvGetJson(`sourcing:mail:${saved.id}`))
    )
      await deliverConfirmation(saved);
    return {
      request_id: existing.id,
      status: saved.status,
      delivery: previewMailCaptureEnabled() ? "captured_not_sent" : "accepted",
    };
  }
  const token = randomBytes(32).toString("base64url");
  const record: SourcingRecord = {
    id: randomUUID(),
    project_id: `rfp_${randomUUID().replaceAll("-", "")}`,
    request: input,
    payload_hash: payloadHash,
    token_hash: digest(token),
    created_at: Date.now(),
    expires_at: Date.now() + 3600000,
    status: "pending_confirmation",
    confirmed_at: null,
    mail_sent: false,
  };
  // Reserve idempotency before mail. Concurrent retries cannot send duplicate messages.
  if (
    (await kvRaw([
      "SET",
      lock,
      JSON.stringify({ id: record.id, hash: payloadHash }),
      "NX",
      "EX",
      60,
    ])) !== "OK"
  )
    throw new Error("This request is already being prepared.");
  try {
    await limit(`ip:${requestKey}`, 10);
    await limit(`email:${input.email}`, 3);
  } catch (error) {
    await kvRaw(["DEL", lock]);
    throw error;
  }
  const link = `${SITE_URL}/shortlist/confirm/#request=${record.id}&token=${token}`;
  const recipients =
    input.recipients
      .map(
        (r) =>
          `${live.vendors.find((v) => v.slug === r.slug)?.name}: ${r.actions.map((action) => SOURCING_ACTION_LABELS[action]).join(", ")}`,
      )
      .join("\n") ||
    "No suppliers approved yet; prepare a sourcing plan for my review.";
  const mailBody = JSON.stringify({
    from: process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk",
    to: input.email,
    subject: "Confirm your Netify sourcing request",
    text: `Review and confirm the exact request below. No account is created. Netify checks it before any supplier receives it.\n\n${recipients}\n\nAnonymous supplier brief:\n${input.brief.supplier_brief}\n\n${link}\n\nExpires in one hour. If you did not request this, ignore the email.`,
  });
  const prepared = await kvRaw([
    "EVAL", `-- sourcing-prepare-commit
if redis.call('get', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('set', KEYS[2], ARGV[2], 'EX', 86400)
redis.call('set', KEYS[3], ARGV[3], 'EX', 3600)
redis.call('expire', KEYS[1], 86400)
return 1`, 3, lock, `sourcing:request:${record.id}`, `sourcing:mail-payload:${record.id}`,
    JSON.stringify({id:record.id,hash:payloadHash}), JSON.stringify(record), JSON.stringify({body:mailBody}),
  ]);
  if(Number(prepared)!==1)throw new Error("This request is already being prepared. Please retry shortly.");
  await recordSourcingMetric("request", input.acquisition, record.id);
  await deliverConfirmation(record);
  return {
    request_id: record.id,
    status: "pending_confirmation",
    delivery: previewMailCaptureEnabled() ? "captured_not_sent" : "accepted",
  };
}
export async function readSourcingRequest(id: string, token: string) {
  const r = await kvGetJson<SourcingRecord>(`sourcing:request:${id}`);
  if (!r) throw new Error("Request not found.");
  assertRequestConfirmation(r, token);
  return r;
}
export async function confirmSourcingRequest(id: string, token: string) {
  const lock = `sourcing:confirm-lock:${id}`,
    owner = randomUUID();
  if ((await kvRaw(["SET", lock, owner, "NX", "EX", 30])) !== "OK") {
    for (let attempt = 0; attempt < 20; attempt++) {
      const current = await readSourcingRequest(id, token);
      if (current.status === "desk_review")
        return {
          request_id: current.id,
          status: current.status,
          already_confirmed: true,
        };
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Confirmation is already being processed. Retry shortly.");
  }
  try {
    const r = await readSourcingRequest(id, token);
    if (r.status === "desk_review") {
      // Repair an interrupted queue write without recreating the project or changing credentials.
      await kvRaw([
        "ZADD",
        "sourcing:desk-review",
        r.confirmed_at ?? r.created_at,
        id,
      ]);
      await recordSourcingConfirmation(r);
      await notifyConfirmedSourcing(r);
      return { request_id: r.id, status: r.status, already_confirmed: true };
    }
    const b = r.request.brief;
    const entrance = shortlistEntrance({
      shortlist: ShortlistInputSchema.parse({
        sector: b.sector,
        required_regions: [b.region],
        uk_provider_only: b.uk_provider_only ?? false,
        shortlist_size: 30,
      }),
      rankedVendorSlugs: r.request.recipients.map((p) => p.slug),
      requirementText: `${b.supplier_brief}\nRemote users: ${b.remote_users}. Timing: ${b.when}.`,
      sourceUrl: `${SITE_URL}/shortlist/`,
    });
    entrance.buyer_input = {
      ...entrance.buyer_input,
      site_count: b.sites,
      product_scope:
        b.need === "sdwan"
          ? "sdwan_only"
          : b.need === "sase"
            ? "full_sase"
            : b.need === "secure_access"
              ? "sse_only"
              : "not_stated",
    };
    entrance.raw_input = {
      ...entrance.raw_input,
      sourcing_request_id: r.id,
      sourcing_brief: b,
      sourcing_acquisition: r.request.acquisition,
    };
    const project = entranceToProjectDetails({
      entrance,
      ids: {
        id: r.project_id,
        shareToken: randomBytes(32).toString("base64url"),
        manageToken: randomBytes(32).toString("base64url"),
      },
      ownerEmail: r.request.email,
      title: "Netify sourcing requirement",
    });
    if (!(await getProject(r.project_id))) await saveProject(project);
    r.status = "desk_review";
    r.confirmed_at = Date.now();
    // Commit confirmation and queue membership together, fenced by the lock owner.
    const committed = await kvRaw([
      "EVAL",
      "-- sourcing-confirm-commit\nif redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end redis.call('SET',KEYS[2],ARGV[2]) redis.call('ZADD',KEYS[3],ARGV[3],ARGV[4]) return 1",
      3,
      lock,
      `sourcing:request:${id}`,
      "sourcing:desk-review",
      owner,
      JSON.stringify(r),
      r.confirmed_at,
      id,
    ]);
    if (committed !== 1)
      throw new Error("Confirmation is already being processed. Please retry.");
    await recordSourcingConfirmation(r);
    await notifyConfirmedSourcing(r);
    // No supplier mail here. Identity confirmation never bypasses desk review.
    return { request_id: id, status: "desk_review" };
  } finally {
    await kvRaw([
      "EVAL",
      "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",
      1,
      lock,
      owner,
    ]);
  }
}

async function recordSourcingConfirmation(r: SourcingRecord) {
  await recordSourcingMetric("confirmed", r.request.acquisition, r.id);
  try {
    const { recordMarketplaceFunnelEvent } = await import(
      "./marketplace-funnel"
    );
    await recordMarketplaceFunnelEvent({
      event: "sourcing_confirmed",
      project_id: r.project_id,
      source: r.request.acquisition === "mcp" ? "mcp" : "shortlist",
      channel: r.request.acquisition === "mcp" ? "mcp" : "web",
      detail: { acquisition: r.request.acquisition },
    });
  } catch {
    /* The confirmed request remains authoritative. */
  }
}
