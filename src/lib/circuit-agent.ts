import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { kvGetJson, kvRaw, type AuthSession } from "./rfp-store";
import { circuitGet, CircuitError } from "./circuit-store";
import { CircuitInputSchema, type CircuitRecord } from "./circuit-schema";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
export async function createCircuitAccess(id: string, session: AuthSession) {
  const r = await circuitGet(id, session);
  if (r.owner_email.toLowerCase() !== session.email.toLowerCase())
    throw new CircuitError("Only the buyer can create access.", 403);
  const token = randomBytes(32).toString("base64url");
  await kvRaw([
    "SET",
    "circuits:access:" + id,
    JSON.stringify({ hash: digest(token), expires: Date.now() + 3600000 }),
    "EX",
    3600,
  ]);
  return {
    token,
    expires_in: 3600,
    scope: "read private circuit request and quotes",
    request_id: id,
  };
}
export async function readCircuitAccess(id: string, token: string) {
  const access = await kvGetJson<{ hash: string; expires: number }>("circuits:access:" + id);
  if (!access || access.expires < Date.now() || access.hash !== digest(token))
    throw new CircuitError("Access expired or invalid.", 404);
  const r = await kvGetJson<CircuitRecord>("circuits:record:" + id);
  if (!r) throw new CircuitError("Request not found.", 404);
  return {
    request_id: r.id,
    status: r.status,
    requirements: { lines: r.lines, sector: r.sector, timescale: r.timescale, scope: r.scope },
    quotes: r.quotes.map((q) =>
      Object.fromEntries(
        Object.entries(q).filter(
          ([key]) => !["created_by", "notification", "notification_at"].includes(key),
        ),
      ),
    ),
    workspace_url: `https://netify.co.uk/sase/circuit-pricing/?request=${id}`,
    instructions:
      "Read-only access. Quotes are supplier offers, not orders. Publication, requirement edits and commercial acceptance require buyer review in the web workspace.",
  };
}
export const CIRCUIT_TOOL_DEFINITIONS = [
  {
    name: "netify_validate_circuit_request",
    description:
      "Validate UK/international Ethernet, broadband and remote SIM pricing requirements. No prices invented, no storage writes. Returns missing fields and a web handoff for buyer approval, verified email and publication. CrowdStrike optional UK remote devices at GBP4.99 plus VAT per device; billing period/package must be confirmed in quote.",
    inputSchema: z.toJSONSchema(z.object({ request: CircuitInputSchema })),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "netify_read_circuit_responses",
    description:
      "Read private circuit specifications and sourced market quotes using an owner-issued 1-hour read-only token. Includes private site contacts: use only with buyer authorization. Does not publish, order or write. Create or revoke by replacing the token in the authenticated circuit workspace.",
    inputSchema: {
      type: "object",
      properties: {
        request_id: { type: "string", format: "uuid" },
        access_token: { type: "string", minLength: 40, maxLength: 100 },
      },
      required: ["request_id", "access_token"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
] as const;
export async function callCircuitTool(name: string, args: Record<string, unknown>) {
  if (name === "netify_validate_circuit_request") {
    const parsed = CircuitInputSchema.safeParse(args.request);
    return {
      valid: parsed.success,
      issues: parsed.success
        ? []
        : parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      request: parsed.success ? parsed.data : args.request,
      workspace_url: "https://netify.co.uk/sase/circuit-pricing/",
      next_step:
        "Buyer reviews requirements in Circuit pricing, verifies a work email, then publishes to request real market quotes.",
    };
  }
  const a = z
    .object({ request_id: z.string().uuid(), access_token: z.string().min(40).max(100) })
    .strict()
    .parse(args);
  return readCircuitAccess(a.request_id, a.access_token);
}
