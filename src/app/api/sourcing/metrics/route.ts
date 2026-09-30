import { sessionFromRequest } from "@/lib/auth";
import { sourcingWeeklyMetrics } from "@/lib/sourcing-metrics";
export async function GET(req: Request) {
  if ((await sessionFromRequest(req))?.role !== "netify")
    return Response.json(
      { error: "Netify desk access required" },
      { status: 403 },
    );
  return Response.json(await sourcingWeeklyMetrics(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
