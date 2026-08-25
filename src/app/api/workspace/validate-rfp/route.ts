import { corsHeaders, preflight } from "@/lib/cors";
import { validateRfpText } from "@/lib/workspace/rfp-validator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 200_000;

export async function OPTIONS(req: Request) { return preflight(req); }

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  let body: { text?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: "Send the RFP text as JSON." }, { status: 400, headers: cors }); }
  if (typeof body.text !== "string" || !body.text.trim()) return Response.json({ error: "Paste or upload an RFP to check." }, { status: 400, headers: cors });
  if (body.text.length > MAX_CHARS) return Response.json({ error: "That RFP is too large to check here (200,000 character limit)." }, { status: 413, headers: cors });
  return Response.json({ report: validateRfpText(body.text) }, { headers: cors });
}
