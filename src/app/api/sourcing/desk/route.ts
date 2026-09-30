import { z } from "zod";
import {
  notificationStatus,
  notifyConfirmedSourcing,
  queueAge,
} from "@/lib/sourcing-notifications";
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
      requests: await Promise.all(
        records
          .filter((r): r is SourcingRecord => !!r && r.status === "desk_review")
          .map(async (r) => ({
            id: r.id,
            project_id: r.project_id,
            status: r.status,
            confirmed_at: r.confirmed_at,
            brief: r.request.brief,
            recipients: r.request.recipients,
            buyer_email: r.request.email,
            acquisition: r.request.acquisition,
            notifications: await notificationStatus(r.id),
            age: queueAge(r.confirmed_at ?? r.created_at),
          })),
      ),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(req: Request) {
  if ((await sessionFromRequest(req))?.role !== "netify")
    return Response.json(
      { error: "Netify desk access required." },
      { status: 403 },
    );
  if (
    req.headers.get("origin") &&
    req.headers.get("origin") !== new URL(req.url).origin
  )
    return Response.json({ error: "Origin not allowed." }, { status: 403 });
  try {
    const raw = await req.text();
    if (raw.length > 1000)
      return Response.json({ error: "Request too large." }, { status: 413 });
    const b = z
      .object({ id: z.string().uuid() })
      .strict()
      .parse(JSON.parse(raw));
    const r = await kvGetJson<SourcingRecord>(`sourcing:request:${b.id}`);
    if (!r || r.status !== "desk_review")
      return Response.json(
        { error: "Confirmed request required." },
        { status: 404 },
      );
    await notifyConfirmedSourcing(r);
    return Response.json(
      { notifications: await notificationStatus(r.id) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Unable to retry notifications." },
      { status: 503 },
    );
  }
}
