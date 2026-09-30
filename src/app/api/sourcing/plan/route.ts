import { sourcingPlanAllowed } from "@/lib/sourcing-plan-limit";
import { SOURCING_ACQUISITIONS } from "@/lib/sourcing-acquisition";
import { callSourcingTool } from "@/lib/mcp-sourcing-tools";
export async function POST(req: Request) {
  if (
    req.headers.get("origin") &&
    req.headers.get("origin") !== new URL(req.url).origin
  )
    return Response.json({ error: "Origin not allowed" }, { status: 403 });
  try {
    if (
      !(await sourcingPlanAllowed(
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unavailable",
      ))
    )
      return Response.json(
        { error: "Too many requests. Retry shortly." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
  } catch {
    return Response.json(
      { error: "Plan preparation is temporarily unavailable" },
      { status: 503 },
    );
  }
  const raw = await req.text();
  if (raw.length > 40000)
    return Response.json({ error: "Brief too large." }, { status: 413 });
  try {
    const body = JSON.parse(raw);
    return Response.json(
      await callSourcingTool(
        "prepare_sourcing_plan",
        body,
        "web-read-only",
        SOURCING_ACQUISITIONS.includes(body.acquisition) &&
          body.acquisition !== "mcp"
          ? body.acquisition
          : "web",
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        error:
          "Unable to prepare evidence matches. Check the brief and try again.",
      },
      { status: 422 },
    );
  }
}
