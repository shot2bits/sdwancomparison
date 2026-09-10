import { kvConfigured, kvRaw } from "@/lib/rfp-store";

export const runtime = "edge";

const COUNT_KEY = "metrics:provider_comparisons:2026-09-01";
const STARTED_AT = "2026-09-01";

async function readCount(): Promise<number> {
  if (!kvConfigured()) return 0;
  const value = await kvRaw(["GET", COUNT_KEY]);
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

export async function GET() {
  try {
    return Response.json({ count: await readCount(), started_at: STARTED_AT });
  } catch {
    return Response.json({ count: 0, started_at: STARTED_AT }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let body: { completion_id?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const completionId = body.completion_id?.trim() ?? "";
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(completionId)) {
    return Response.json({ error: "invalid_completion_id" }, { status: 422 });
  }

  try {
    if (!kvConfigured()) return Response.json({ count: 0, started_at: STARTED_AT });
    const accepted = await kvRaw([
      "SET",
      `${COUNT_KEY}:completion:${completionId}`,
      "1",
      "NX",
      "EX",
      31536000,
    ]);
    const count = accepted === "OK"
      ? Number(await kvRaw(["INCR", COUNT_KEY]))
      : await readCount();
    return Response.json({ count, started_at: STARTED_AT });
  } catch {
    return Response.json({ count: 0, started_at: STARTED_AT }, { status: 503 });
  }
}
