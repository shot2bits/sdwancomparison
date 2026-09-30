import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
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
import { activityMailFetch } from "./activity-mail";
import { activityEnvironment } from "./activity-provenance";
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
  if (r.token_hash !== digest(token) || r.expires_at <= now)
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
export async function requestSourcing(raw: unknown, requestKey: string) {
  const input = SourcingRequestSchema.parse(raw);
  const live = await getLiveShortlistDataset();
  validateRecipients(
    input,
    live.vendors.map((v) => v.slug),
  );
  if (
    !kvConfigured() ||
    !process.env.RESEND_API_KEY ||
    activityEnvironment() !== "production"
  )
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
    const saved = await kvGetJson<SourcingRecord>(`sourcing:request:${existing.id}`);
    if (!saved || (saved.status === "pending_confirmation" && saved.expires_at <= Date.now()))
      throw new Error("This request has expired. Prepare a new request for confirmation.");
    if (saved.status === "pending_confirmation" && !saved.mail_sent && !(await kvGetJson(`sourcing:mail:${saved.id}`)))
      throw new Error("Confirmation delivery is not yet confirmed. Check your email before preparing a new request.");
    return { request_id: existing.id, status: saved.status };
  }
  await limit(`ip:${requestKey}`, 10);
  await limit(`email:${input.email}`, 3);
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
      86400,
    ])) !== "OK"
  )
    throw new Error("This request is already being prepared.");
  await kvRaw([
    "SET",
    `sourcing:request:${record.id}`,
    JSON.stringify(record),
    "EX",
    86400,
  ]);
  const link = `${SITE_URL}/shortlist/confirm/#request=${record.id}&token=${token}`;
  const recipients =
    input.recipients
      .map(
        (r) =>
          `${live.vendors.find((v) => v.slug === r.slug)?.name}: ${r.actions.join(", ")}`,
      )
      .join("\n") ||
    "No suppliers approved yet; prepare a sourcing plan for my review.";
  const response = await activityMailFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `sourcing-${record.id}`,
    },
    body: JSON.stringify({
      from: process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk",
      to: input.email,
      subject: "Confirm your Netify sourcing request",
      text: `Review and confirm the exact request below. No account is created. Netify checks it before any supplier receives it.\n\n${recipients}\n\nAnonymous supplier brief:\n${input.brief.supplier_brief}\n\n${link}\n\nExpires in one hour. If you did not request this, ignore the email.`,
    }),
  });
  if (!response.ok) {
    await kvRaw(["DEL", lock]);
    await kvRaw(["DEL", `sourcing:request:${record.id}`]);
    throw new Error("We could not send the confirmation. Please try again.");
  }
  // Never rewrite a pending record after mail: a fast buyer may already have confirmed it.
  await kvRaw(["SET", `sourcing:mail:${record.id}`, JSON.stringify({ accepted: true }), "EX", 86400]);
  return { request_id: record.id, status: "pending_confirmation" };
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
  if ((await kvRaw(["SET", lock, owner, "NX", "EX", 30])) !== "OK")
    throw new Error("Confirmation is already being processed.");
  try {
    const r = await readSourcingRequest(id, token);
    if (r.status === "desk_review") {
      // Repair an interrupted queue write without recreating the project or changing credentials.
      await kvRaw(["ZADD", "sourcing:desk-review", r.confirmed_at ?? r.created_at, id]);
      await recordSourcingConfirmation(r);
      return { request_id: r.id, status: r.status };
    }
    const b = r.request.brief;
    const entrance = shortlistEntrance({
      shortlist: ShortlistInputSchema.parse({
        sector: b.sector,
        required_regions: [b.region],
        shortlist_size: 30,
      }),
      rankedVendorSlugs: r.request.recipients.map((p) => p.slug),
      requirementText: `${b.supplier_brief}\nRemote users: ${b.remote_users}. Timing: ${b.when}.`,
      sourceUrl: `${SITE_URL}/shortlist/`,
    });
    entrance.buyer_input = {...entrance.buyer_input, site_count:b.sites, product_scope:b.need==="sdwan"?"sdwan_only":b.need==="sase"?"full_sase":b.need==="secure_access"?"sse_only":"not_stated"};
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
      3, lock, `sourcing:request:${id}`, "sourcing:desk-review", owner,
      JSON.stringify(r), r.confirmed_at, id,
    ]);
    if (committed !== 1) throw new Error("Confirmation is already being processed. Please retry.");
    await recordSourcingConfirmation(r);
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
  const {recordMarketplaceFunnelEvent} = await import("./marketplace-funnel");
  await recordMarketplaceFunnelEvent({event:"sourcing_confirmed", project_id:r.project_id, source:r.request.acquisition==="mcp"?"mcp":"shortlist", channel:r.request.acquisition==="mcp"?"mcp":"web"});
}
