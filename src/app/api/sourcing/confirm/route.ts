import { getAllVendors } from "@/lib/vendors";
import { issueSourcingAccess } from "@/lib/sourcing-access";
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
function recovery(id: string) {
  return json({
    status: "desk_review",
    already_confirmed: true,
    message: "Already confirmed. Sign in with the same work email.",
    sign_in_url: "/sase/account/",
    project_url: `/sase/rfp-builder/${id}/`,
  });
}
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
    if (raw.length > 2000)
      return json({ error: "Confirmation too large." }, 413);
    const input = Input.parse(JSON.parse(raw));
    const initial = await readSourcingRequest(input.id, input.token);
    if (!input.confirm && initial.status === "desk_review")
      return recovery(initial.project_id);
    if (input.confirm) {
      const receipt = await confirmSourcingRequest(input.id, input.token);
      const record = await readSourcingRequest(input.id, input.token);
      if (receipt.already_confirmed) return recovery(record.project_id);
      return Response.json(
        { ...receipt, project_url: `/sase/rfp-builder/${record.project_id}/` },
        {
          headers: {
            ...privateHeaders,
            "Set-Cookie": await issueSourcingAccess(record),
          },
        },
      );
    }
    const r = await readSourcingRequest(input.id, input.token);
    if (r.status === "desk_review") return recovery(r.project_id);
    return json({
      id: r.id,
      status: r.status,
      brief: r.request.brief.supplier_brief,
      recipients: r.request.recipients.map((recipient) => ({
        ...recipient,
        name:
          getAllVendors().find((v) => v.slug === recipient.slug)?.name ??
          recipient.slug,
      })),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Confirmation is already")
    )
      return json({ error: error.message }, 409);
    return json(
      { error: "This confirmation is invalid, expired or unavailable." },
      403,
    );
  }
}
