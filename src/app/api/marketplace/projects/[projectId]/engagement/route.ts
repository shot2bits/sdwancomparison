import { z } from "zod";
import { sessionFromRequest } from "@/lib/auth";
import { requestOriginAllowed } from "@/lib/request-origin";
import {
  StudioAccessError,
  readBuyerEngagement,
  readSupplierEngagement,
  requestStudioBid,
  decideStudioBid,
  messageStudioBid,
  issueStudioSupplierAgent,
  revokeStudioSupplierAgent,
} from "@/lib/studio-engagement";
export const runtime = "nodejs";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};
const Body = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("request"),
      reason: z.string().min(20).max(4000),
    })
    .strict(),
  z
    .object({
      action: z.literal("decide"),
      vendor_slug: z.string().min(1),
      decision: z.enum(["approved", "declined"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("message"),
      vendor_slug: z.string().min(1),
      body: z.string().min(1).max(10000),
      idempotency_key: z.string().uuid(),
    })
    .strict(),
  z.object({ action: z.literal("assistant") }).strict(),
  z.object({ action: z.literal("disconnect_assistant") }).strict(),
]);
function failure(e: unknown) {
  return Response.json(
    {
      error:
        e instanceof StudioAccessError || e instanceof z.ZodError
          ? e.message
          : "Project service is unavailable. Your saved work has not been deleted.",
    },
    {
      status:
        e instanceof StudioAccessError
          ? e.status
          : e instanceof z.ZodError
            ? 422
            : 503,
      headers,
    },
  );
}
export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params,
      s = await sessionFromRequest(req);
    return Response.json(
      await (new URL(req.url).searchParams.get("role") === "supplier"
        ? readSupplierEngagement(projectId, s)
        : readBuyerEngagement(projectId, s)),
      { headers },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  if (!requestOriginAllowed(req))
    return Response.json(
      { error: "Request origin not allowed." },
      { status: 403, headers },
    );
  try {
    const { projectId } = await params,
      s = await sessionFromRequest(req),
      b = Body.parse(await req.json());
    const result =
      b.action === "request"
        ? await requestStudioBid(projectId, s, b.reason)
        : b.action === "decide"
          ? await decideStudioBid(projectId, s, b.vendor_slug, b.decision)
          : b.action === "disconnect_assistant"
            ? await revokeStudioSupplierAgent(projectId, s)
            : b.action === "assistant"
              ? await issueStudioSupplierAgent(projectId, s)
              : await messageStudioBid(
                  projectId,
                  s,
                  b.vendor_slug,
                  b.body,
                  b.idempotency_key,
                );
    return Response.json(result, { headers });
  } catch (e) {
    return failure(e);
  }
}
