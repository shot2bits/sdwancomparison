import { requestSourcing } from "@/lib/sourcing-store";
export async function POST(req: Request) {
  if (
    req.headers.get("origin") &&
    req.headers.get("origin") !== new URL(req.url).origin
  )
    return Response.json({ error: "Origin not allowed." }, { status: 403 });
  if (Number(req.headers.get("content-length") || 0) > 40000)
    return Response.json({ error: "Brief too large." }, { status: 413 });
  try {
    const raw = await req.text();
    if (raw.length > 40000)
      return Response.json({ error: "Brief too large." }, { status: 413 });
    return Response.json(
      await requestSourcing(
        JSON.parse(raw),
        req.headers.get("x-forwarded-for")?.split(",")[0] || "unavailable",
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof Error &&
          /^(Request delivery|Use a work email|Too many requests|We could not send|This request key|This request is already|This request has expired|Confirmation delivery)/.test(
            e.message,
          )
            ? e.message
            : "Request unavailable. Check your approved brief, recipients and work email.",
      },
      { status: 422 },
    );
  }
}
