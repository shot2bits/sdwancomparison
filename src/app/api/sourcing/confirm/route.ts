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
export async function POST(req: Request) {
  if (
    req.headers.get("origin") &&
    req.headers.get("origin") !== new URL(req.url).origin
  )
    return Response.json({ error: "Origin not allowed." }, { status: 403 });
  try {
    const input = Input.parse(await req.json());
    if (input.confirm)
      return Response.json(await confirmSourcingRequest(input.id, input.token));
    const r = await readSourcingRequest(input.id, input.token);
    return Response.json({
      id: r.id,
      status: r.status,
      brief: r.request.brief.supplier_brief,
      recipients: r.request.recipients,
    });
  } catch {
    return Response.json(
      { error: "This confirmation is invalid, expired or unavailable." },
      { status: 403 },
    );
  }
}
