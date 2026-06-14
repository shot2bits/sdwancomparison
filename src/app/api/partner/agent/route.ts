import Anthropic from "@anthropic-ai/sdk";
import { corsHeaders, preflight } from "@/lib/cors";
import { kvConfigured } from "@/lib/rfp-store";
import { partnerEmail } from "@/lib/partner-auth";
import { runPartnerAgent } from "@/lib/partner-agent";

export const runtime = "nodejs";
export const maxDuration = 120;
export async function OPTIONS(req: Request) { return preflight(req); }

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Assistant not configured (missing API key)." }, { status: 503, headers: cors });
  if (!kvConfigured()) return Response.json({ error: "Storage not configured." }, { status: 503, headers: cors });
  const email = await partnerEmail(req);
  if (!email) return Response.json({ error: "Sign in with your work email to use the partner assistant.", auth_required: true }, { status: 401, headers: cors });

  let body: { messages?: { role: "user" | "assistant"; content: string }[]; prompt?: string } = {};
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }

  const history: Anthropic.MessageParam[] = (body.messages ?? [])
    .filter((m) => m && typeof m.content === "string" && m.content.trim())
    .slice(-14)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (history.length === 0 && body.prompt) history.push({ role: "user", content: body.prompt.slice(0, 4000) });
  if (history.length === 0) return Response.json({ error: "No message." }, { status: 400, headers: cors });

  try {
    const { narrative } = await runPartnerAgent(email, history);
    return Response.json({ narrative }, { headers: cors });
  } catch (err) {
    console.error("partner agent error:", err);
    return Response.json({ error: "Assistant request failed." }, { status: 502, headers: cors });
  }
}
