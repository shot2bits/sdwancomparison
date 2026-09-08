import { recordMarketplaceFunnelEvent } from "@/lib/marketplace-funnel-safe";
import { randomBytes, createHash } from "node:crypto";
import { kvRaw, kvGetJson, kvSetJson, saveOpportunity, newId } from "./rfp-store";
import { OpportunitySchema } from "./opportunity-types";
import {
  CircuitInputSchema,
  CircuitSignupIntentSchema,
  CircuitQuoteSchema,
  CIRCUIT_CONSENT,
  circuitPublicSummary,
  type CircuitRecord,
} from "./circuit-schema";
import { isAdminEmail, isBlockedDomainLive, emailDomain } from "./access-control";
import type { AuthSession } from "./rfp-store";
const index = (email: string) =>
  "circuits:owner:" + createHash("sha256").update(email.toLowerCase()).digest("hex");
export class CircuitError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function circuitLock<T>(id: string, fn: () => Promise<T>) {
  const key = "circuits:lock:" + id,
    owner = randomBytes(20).toString("hex");
  if ((await kvRaw(["SET", key, owner, "NX", "EX", 60])) !== "OK")
    throw new CircuitError("Request is being updated. Retry shortly.", 409);
  try {
    return await fn();
  } finally {
    await kvRaw([
      "EVAL",
      "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",
      1,
      key,
      owner,
    ]);
  }
}
export async function circuitGet(id: string, session: AuthSession) {
  const r = await kvGetJson<CircuitRecord>("circuits:record:" + id);
  if (
    !r ||
    (!isAdminEmail(session.email) && r.owner_email.toLowerCase() !== session.email.toLowerCase())
  )
    throw new CircuitError("Request not found.", 404);
  return r;
}
export async function circuitList(session: AuthSession, admin = false) {
  if (admin && !isAdminEmail(session.email)) throw new CircuitError("Admin access only.", 403);
  const ids = (await kvRaw([
    "ZRANGE",
    admin ? "circuits:all" : index(session.email),
    0,
    -1,
  ])) as string[];
  const rs = await Promise.all(
    ids.slice(-500).map((id) => kvGetJson<CircuitRecord>("circuits:record:" + id)),
  );
  return rs.filter((r): r is CircuitRecord => !!r).sort((a, b) => b.updated - a.updated);
}
async function persist(r: CircuitRecord) {
  await kvSetJson("circuits:record:" + r.id, r);
  await kvRaw(["ZADD", index(r.owner_email), r.created, r.id]);
  await kvRaw(["ZADD", "circuits:all", r.created, r.id]);
  return r;
}
/** Save only the explicitly approved private draft before email verification.
 * This does not create a session, publish a notice or modify an existing request. */
export async function prepareCircuitBuyer(raw: unknown, email: string) {
  const intent = CircuitSignupIntentSchema.parse(raw);
  return circuitLock(intent.id, async () => {
    const existing = await kvGetJson<CircuitRecord>("circuits:record:" + intent.id);
    if (existing) {
      const sameInput = (Object.keys(intent.input) as Array<keyof typeof intent.input>)
        .every(key => JSON.stringify(existing[key]) === JSON.stringify(intent.input[key]));
      if (existing.owner_email !== email || existing.status !== "draft" || !sameInput)
        throw new CircuitError("This request already exists. Sign in with its original work email to reopen it.", 409);
      return persist(existing);
    }
    const now = Date.now();
    return persist({...intent.input, id:intent.id, owner_email:email, created:now, updated:now,
      status:"draft", revision:1, opportunity_id:null, quotes:[], consent:{text:intent.consent,at:now}});
  });
}

export async function circuitBuyerCanSignIn(email: string): Promise<boolean> {
  const ids = await kvRaw(["ZRANGE", index(email), 0, -1]) as string[];
  for (const id of ids.slice(-500)) {
    const record = await kvGetJson<CircuitRecord>("circuits:record:" + id);
    if (record?.owner_email === email && (record.status !== "draft" || record.consent?.text === CIRCUIT_CONSENT)) return true;
  }
  return false;
}

export async function circuitSave(
  id: string,
  input: unknown,
  revision: number,
  session: AuthSession,
) {
  return circuitLock(id, async () => {
    const parsed = CircuitInputSchema.parse(input);
    const existing = await kvGetJson<CircuitRecord>("circuits:record:" + id);
    if (existing) {
      await circuitGet(id, session);
      // Retry after a lost save response: preserve revision and repair indexes.
      if (existing.status === 'draft' && existing.revision === revision + 1 &&
          (Object.keys(parsed) as Array<keyof typeof parsed>).every(k => JSON.stringify(existing[k]) === JSON.stringify(parsed[k]))) return persist(existing);
      if (existing.revision !== revision)
        throw new CircuitError("This request changed. Reload it before saving.", 409);
      if (existing.status !== "draft")
        throw new CircuitError(
          "Published specifications are frozen. Create a new request for changed requirements.",
          409,
        );
    } else if (revision !== 0) throw new CircuitError("Request not found.", 404);
    const now = Date.now();
    const saved = await persist({
      ...parsed,
      id,
      owner_email: existing?.owner_email ?? session.email,
      created: existing?.created ?? now,
      updated: now,
      status: "draft",
      revision: revision + 1,
      opportunity_id: null,
      quotes: [],
    });
    await recordMarketplaceFunnelEvent({event:existing?"requirements_updated":"project_started",project_id:id,source:"circuit_pricing",mode:"circuit",channel:"web"});
    return saved;
  });
}
export async function circuitPublish(
  id: string,
  revision: number,
  consent: string,
  session: AuthSession,
) {
  return circuitLock(id, async () => {
    const r = await circuitGet(id, session);
    if (r.owner_email.toLowerCase() !== session.email.toLowerCase())
      throw new CircuitError("Only the buyer can publish.", 403);
    if (r.status !== "draft") return r;
    const domain = emailDomain(session.email);
    if (!domain || (!isAdminEmail(session.email) && (await isBlockedDomainLive(domain))))
      throw new CircuitError("A verified business email is required to publish.", 403);
    if (r.revision !== revision) throw new CircuitError("Request changed. Review again.", 409);
    if (consent !== CIRCUIT_CONSENT)
      throw new CircuitError("Review and accept the publication consent.");
    CircuitInputSchema.parse({
      company: r.company,
      sector: r.sector,
      timescale: r.timescale,
      scope: r.scope,
      lines: r.lines,
    });
    // Deterministic opportunity identity makes a retry after a partial storage failure safe.
    const oppId = "opp_circuit_" + r.id;
    await saveOpportunity(
      OpportunitySchema.parse({
        id: oppId,
        created: r.created,
        updated: Date.now(),
        buyer_org: r.company,
        buyer_visibility: "anonymous",
        buyer_sector: "",
        title: "Underlay circuit pricing request",
        scope:
          r.scope === "Underlay only"
            ? ["underlay_circuits"]
            : ["underlay_circuits", "sd_wan", "sase"],
        sites: r.lines.filter((l) => !l.remote).length,
        regions: [],
        summary: circuitPublicSummary(r),
        timeline_note: "Timescale shared privately with Netify.",
        owner_email: r.owner_email,
        buyer_token: newId("btok"),
        eligibility: "invited",
        visibility: "public",
        response_mode: "indicative_pricing",
      }),
    );
    const published = await persist({
      ...r,
      status: "sourcing",
      opportunity_id: oppId,
      consent: { text: consent, at: Date.now() },
      updated: Date.now(),
      revision: r.revision + 1,
    });
    for(const event of ["publication_prepared","identity_verified","publication_completed"] as const) await recordMarketplaceFunnelEvent({event,project_id:id,source:"circuit_pricing",mode:"circuit",channel:"web",detail:{board_created:true}});
    return published;
  });
}
export async function circuitAddQuote(id: string, input: unknown, session: AuthSession) {
  if (!isAdminEmail(session.email)) throw new CircuitError("Admin access only.", 403);
  const q = CircuitQuoteSchema.parse(input);
  return circuitLock(id, async () => {
    const r = await circuitGet(id, session);
    if (r.status === "draft")
      throw new CircuitError("Buyer must publish before quotes are added.", 409);
    const prior = r.quotes.find((x) => x.id === q.id);
    if (prior) return r;
    if (!r.lines.some((l) => l.id === q.line_id))
      throw new CircuitError("Select a location from this request.");
    if (Date.parse(q.valid_until + "T23:59:59Z") < Date.now())
      throw new CircuitError("Quote validity must not be in the past.");
    const saved = await persist({
      ...r,
      status: "quotes_available",
      revision: r.revision + 1,
      updated: Date.now(),
      quotes: [
        ...r.quotes,
        { ...q, created: Date.now(), created_by: session.email, notification: "pending" },
      ],
    });
    await recordMarketplaceFunnelEvent({event:"supplier_response",project_id:id,source:"circuit_pricing",mode:"circuit",channel:"system"});
    return saved;
  });
}
export async function circuitNotify(id: string, quoteId: string, session: AuthSession) {
  if (!isAdminEmail(session.email)) throw new CircuitError("Admin access only.", 403);
  return circuitLock(id, async () => {
    const r = await circuitGet(id, session),
      q = r.quotes.find((x) => x.id === quoteId);
    if (!q) throw new CircuitError("Quote not found.", 404);
    if (q.notification === "accepted") return r;
    let accepted = false;
    const key = process.env.RESEND_API_KEY;
    if (key)
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          signal: AbortSignal.timeout(12000),
          headers: {
            authorization: `Bearer ${key}`,
            "content-type": "application/json",
            "Idempotency-Key": `circuit-quote-${id}-${quoteId}`,
          },
          body: JSON.stringify({
            from: process.env.AUTH_FROM_EMAIL ?? "no-reply@mail.netify.co.uk",
            to: r.owner_email,
            subject: "Your circuit pricing is available in Netify",
            text: `Netify has added a market response to your circuit-pricing request. Sign in with your verified work email to view the private pricing and supporting details:\n\nhttps://netify.co.uk/sase/circuit-pricing/?request=${r.id}&view=quotes\n\nNo order has been placed.`,
          }),
        });
        accepted = res.ok;
      } catch {
        /* persisted failed state enables deliberate retry */
      }
    return persist({
      ...r,
      quotes: r.quotes.map((x) =>
        x.id === quoteId
          ? { ...x, notification: accepted ? "accepted" : "failed", notification_at: Date.now() }
          : x,
      ),
    });
  });
}

/** Internal sourcing alert; the durable queue remains available if email fails. */
export async function circuitNotifyTeam(id: string, session: AuthSession) {
  return circuitLock(id, async () => {
    const r = await circuitGet(id, session);
    if(r.status==='draft'||r.team_notification==='accepted') return r;
    let accepted=false;
    if(process.env.RESEND_API_KEY) try {
      const res=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(12000),headers:{authorization:`Bearer ${process.env.RESEND_API_KEY}`,'content-type':'application/json','Idempotency-Key':`circuit-published-${id}`},body:JSON.stringify({from:process.env.AUTH_FROM_EMAIL??'no-reply@mail.netify.co.uk',to:process.env.SIGNUP_NOTIFY_EMAIL??'support@netify.com',subject:'New circuit pricing request — Netify sourcing',text:`A verified buyer has published a circuit pricing request. Open the authenticated sourcing queue to review the private requirements and add quotes:\n\nhttps://netify.co.uk/sase/admin/circuit-pricing/?request=${id}\n\n${r.lines.length} requirement groups. No carrier order has been placed.`})});accepted=res.ok;
    }catch{/* queue is authoritative; failed transport is reported */}
    return persist({...r,team_notification:accepted?'accepted':'failed'});
  });
}
