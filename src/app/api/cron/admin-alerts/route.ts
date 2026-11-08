import { retryAdminAlerts } from "@/lib/admin-alerts";
import { kvConfigured } from "@/lib/rfp-store";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ error: "Unauthorised." }, { status: 401 });
  if (!kvConfigured()) return Response.json({ error: "Storage unavailable." }, { status: 503 });
  return Response.json({ ok: true, ...await retryAdminAlerts() }, { headers: { "Cache-Control": "private, no-store" } });
}
