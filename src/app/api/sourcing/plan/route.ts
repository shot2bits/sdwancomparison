import { callSourcingTool } from "@/lib/mcp-sourcing-tools";
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 40000)
    return Response.json({ error: "Brief too large." }, { status: 413 });
  try {
    return Response.json(
      await callSourcingTool(
        "prepare_sourcing_plan",
        JSON.parse(raw),
        "web-read-only",
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
