import { z } from "zod";
import { sourcingAccess } from "@/lib/sourcing-access";
import { requireRfpOwner } from "@/lib/rfp-access";
import {
  circuitGet,
  circuitSave,
  circuitLock,
  CircuitError,
} from "@/lib/circuit-store";
import {
  getProject,
  kvGetJson,
  kvSetJson,
  type AuthSession,
} from "@/lib/rfp-store";
import type { CircuitRecord } from "@/lib/circuit-schema";
import { PRIVATE_CIRCUIT_CONSENT } from "@/lib/sourcing-contract";
const headers = { "Cache-Control": "private, no-store" };
type Ctx = { params: Promise<{ id: string }> };
async function identity(req: Request, id: string): Promise<AuthSession> {
  const g = await sourcingAccess(req, id);
  if (g)
    return {
      role: "buyer",
      email: g.email,
      vendor_slug: null,
      token: "",
      created: 0,
      expires: g.expires_at,
    };
  const p = await getProject(id);
  if (
    !p?.entrance_context?.raw_input.sourcing_request_id ||
    !p.owner_email ||
    !(await requireRfpOwner(req, p)).ok
  )
    throw new CircuitError(
      "Open this project using your confirmed request or sign in with its owning email.",
      401,
    );
  return {
    role: "buyer",
    email: p.owner_email,
    vendor_slug: null,
    token: "",
    created: 0,
    expires: Date.now() + 60000,
  };
}
export async function GET(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const session = await identity(req, id);
    const exists = await kvGetJson<CircuitRecord>("circuits:record:" + id);
    return Response.json(
      {
        request: exists ? await circuitGet(id, session) : null,
        project_id: id,
      },
      { headers },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request, ctx: Ctx) {
  try {
    const origin = req.headers.get("origin");
    if (origin && origin !== new URL(req.url).origin)
      throw new CircuitError("Origin not allowed.", 403);
    const { id } = await ctx.params;
    const session = await identity(req, id);
    const text = await req.text();
    if (text.length > 1500000)
      throw new CircuitError("Request too large.", 413);
    const b = z
      .object({
        id: z.literal(id),
        action: z.enum(["save", "request_review"]),
        revision: z.number().int().nonnegative(),
        input: z.unknown().optional(),
        consent: z.string().optional(),
      })
      .strict()
      .parse(JSON.parse(text));
    if (b.action === "save")
      return Response.json(
        { request: await circuitSave(id, b.input, b.revision, session) },
        { headers },
      );
    if (b.consent !== PRIVATE_CIRCUIT_CONSENT)
      throw new CircuitError("Approve private connectivity review.", 422);
    const record = await circuitLock(id, async () => {
      const r = await circuitGet(id, session);
      if (r.status !== "draft") return r;
      if (r.revision !== b.revision)
        throw new CircuitError(
          "Requirements changed. Reload before approving.",
          409,
        );
      const next: CircuitRecord = {
        ...r,
        status: "sourcing",
        revision: r.revision + 1,
        updated: Date.now(),
        consent: { text: PRIVATE_CIRCUIT_CONSENT, at: Date.now() },
      };
      await kvSetJson("circuits:record:" + id, next);
      return next;
    });
    return Response.json({ request: record }, { headers });
  } catch (e) {
    return fail(e);
  }
}
function fail(e: unknown) {
  return Response.json(
    {
      error:
        e instanceof CircuitError
          ? e.message
          : e instanceof z.ZodError
            ? "Check your connectivity requirements."
            : "Unable to save connectivity. Reload before retrying.",
    },
    {
      status:
        e instanceof CircuitError
          ? e.status
          : e instanceof z.ZodError
            ? 422
            : 503,
      headers,
    },
  );
}
