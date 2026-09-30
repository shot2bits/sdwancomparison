import { sessionFromRequest } from "@/lib/auth";
import { kvRaw, kvGetJson } from "@/lib/rfp-store";
import type { SourcingRecord } from "@/lib/sourcing-store";
export async function GET(req: Request) {
  const session = await sessionFromRequest(req);
  if (session?.role !== "netify")
    return Response.json(
      { error: "Netify desk access required." },
      { status: 403 },
    );
  const ids = (await kvRaw([
    "ZREVRANGE",
    "sourcing:desk-review",
    0,
    99,
  ])) as string[];
  const records = await Promise.all(
    ids.map((id) => kvGetJson<SourcingRecord>(`sourcing:request:${id}`)),
  );
  return Response.json(
    {
      requests: records
        .filter((r): r is SourcingRecord => !!r && r.status === "desk_review")
        .map((r) => ({
          id: r.id,
          project_id: r.project_id,
          status: r.status,
          confirmed_at: r.confirmed_at,
          brief: r.request.brief,
          recipients: r.request.recipients,
          buyer_email: r.request.email,
          acquisition: r.request.acquisition,
        })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
