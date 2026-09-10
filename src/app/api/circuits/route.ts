import { z } from "zod";
import { sessionFromRequest } from "@/lib/auth";
import { isAdminEmail } from "@/lib/access-control";
import {
  circuitList,
  circuitGet,
  circuitSave,
  circuitPublish,
  circuitAddQuote,
  circuitNotify,
  circuitNotifyTeam,
  CircuitError,
} from "@/lib/circuit-store";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
const Id = z.string().uuid();
export async function GET(req: Request) {
  try {
    const session = await sessionFromRequest(req);
    if (!session)
      return Response.json(
        { error: "Verify your work email to open saved pricing requests." },
        { status: 401, headers },
      );
    const u = new URL(req.url),
      id = u.searchParams.get("id");
    return Response.json(
      id
        ? { request: await circuitGet(Id.parse(id), session) }
        : {
            requests: await circuitList(session, u.searchParams.get("admin") === "1"),
            admin: isAdminEmail(session.email),
          },
      { headers },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request) {
  try {
    const origin = req.headers.get("origin");
    if (
      origin &&
      origin !== new URL(req.url).origin &&
      ![
        "https://netify.co.uk",
        "https://www.netify.co.uk",
        "https://app.netify.co.uk",
        "https://sase.netify.co.uk",
      ].includes(origin)
    )
      throw new CircuitError("Origin not allowed.", 403);
    if (!req.headers.get("content-type")?.includes("application/json"))
      throw new CircuitError("JSON required.", 415);
    const session = await sessionFromRequest(req);
    if (!session || !["buyer", "netify"].includes(session.role))
      throw new CircuitError("Verify a buyer work email before saving or publishing.", 401);
    const text = await req.text();
    if (text.length > 1500000) throw new CircuitError("Request too large.", 413);
    const body = z
      .object({
        id: Id,
        action: z.enum(["save", "publish", "quote", "notify"]),
        revision: z.number().int().min(0).optional(),
        input: z.unknown().optional(),
        consent: z.string().optional(),
        quote_id: Id.optional(),
      })
      .strict()
      .parse(JSON.parse(text));
    let result;
    if (body.action === "save")
      result = await circuitSave(body.id, body.input, body.revision ?? 0, session);
    else if (body.action === "publish") {
      result = await circuitPublish(body.id, body.revision ?? 0, body.consent ?? "", session);
      result = await circuitNotifyTeam(body.id,session);
    }
    else if (body.action === "quote") {
      result = await circuitAddQuote(body.id, body.input, session);
      const quoteId = z.object({ id: Id }).parse(body.input).id;
      result = await circuitNotify(body.id, quoteId, session);
    } else result = await circuitNotify(body.id, Id.parse(body.quote_id), session);
    return Response.json({ request: result }, { headers });
  } catch (e) {
    return fail(e);
  }
}
function fail(e: unknown) {
  if (e instanceof CircuitError)
    return Response.json({ error: e.message }, { status: e.status, headers });
  if (e instanceof z.ZodError)
    return Response.json(
      { error: e.issues.map((i) => i.message).join(" ") },
      { status: 422, headers },
    );
  console.error("Circuit request failed", e instanceof Error ? e.name : "Unknown");
  return Response.json(
    {
      error:
        "The request could not be completed. Your last saved version is unchanged; refresh before retrying.",
    },
    { status: 503, headers },
  );
}
