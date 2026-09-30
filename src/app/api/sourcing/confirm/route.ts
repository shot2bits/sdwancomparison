import { z } from "zod";
import {
  readSourcingRequest,
  confirmSourcingRequest,
} from "@/lib/sourcing-store";
const Input = z
  .object({
    id: z.string().uuid(),
    token: z.string().min(40).max(100),
    confirm: z.boolean().default(false),
  })
  .strict();
const privateHeaders = { "Cache-Control": "private, no-store" };
function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: privateHeaders });
}
export async function POST(req: Request) {
  if (
    req.headers.get("origin") &&
    req.headers.get("origin") !== new URL(req.url).origin
  )
    return json({ error: "Origin not allowed." }, 403);
  try {
    if (Number(req.headers.get("content-length") || 0) > 2000)
      return json({ error: "Confirmation too large." }, 413);
    const raw = await req.text();
    if (raw.length > 2000) return json({ error: "Confirmation too large." }, 413);
    const input = Input.parse(JSON.parse(raw));
    if (input.confirm)
      return json(await confirmSourcingRequest(input.id, input.token));
    const r = await readSourcingRequest(input.id, input.token);
    return json({
      id: r.id,
      status: r.status,
      brief: r.request.brief.supplier_brief,
      recipients: r.request.recipients,
    });
  } catch {
    return json(
      { error: "This confirmation is invalid, expired or unavailable." },
      403,
    );
  }
}
