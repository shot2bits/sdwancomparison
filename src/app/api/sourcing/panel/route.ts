import { requestOriginAllowed } from "@/lib/request-origin";
import { sessionFromRequest } from "@/lib/auth";
import { getResponsePanel, saveResponsePanel } from "@/lib/response-panel";
import { ResponsePanelRowSchema } from "@/lib/response-panel-contract";
import { getLiveShortlistDataset } from "@/lib/live-shortlist";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: Request) {
  if ((await sessionFromRequest(req))?.role !== "netify")
    return Response.json(
      { error: "Netify desk access required." },
      { status: 403, headers },
    );
  try {
    const [rows, live] = await Promise.all([
      getResponsePanel(),
      getLiveShortlistDataset(),
    ]);
    return Response.json(
      {
        rows,
        providers: live.vendors.map((v) => ({ slug: v.slug, name: v.name })),
      },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Unable to load response panel." },
      { status: 503, headers },
    );
  }
}
export async function POST(req: Request) {
  if ((await sessionFromRequest(req))?.role !== "netify")
    return Response.json(
      { error: "Netify desk access required." },
      { status: 403, headers },
    );
  if (
    !requestOriginAllowed(req)
  )
    return Response.json(
      { error: "Origin not allowed." },
      { status: 403, headers },
    );
  if (Number(req.headers.get("content-length") ?? 0) > 5000)
    return Response.json(
      { error: "Request too large." },
      { status: 413, headers },
    );
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > 5000)
      return Response.json(
        { error: "Request too large." },
        { status: 413, headers },
      );
    raw = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 422, headers });
  }
  const parsed = ResponsePanelRowSchema.safeParse(raw);
  if (
    !parsed.success ||
    Date.parse(parsed.data.introduction_terms_acknowledged_at) > Date.now()
  )
    return Response.json(
      {
        error:
          "Every field is required, including a valid domain and past acknowledgement date.",
      },
      { status: 422, headers },
    );
  try {
    const live = await getLiveShortlistDataset();
    if (!live.vendors.some((v) => v.slug === parsed.data.slug))
      return Response.json(
        { error: "Choose a researched provider." },
        { status: 422, headers },
      );
    const row = await saveResponsePanel(parsed.data);
    return Response.json({ row }, { headers });
  } catch {
    return Response.json(
      { error: "Unable to save response panel." },
      { status: 503, headers },
    );
  }
}
