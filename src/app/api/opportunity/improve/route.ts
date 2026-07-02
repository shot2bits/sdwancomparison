import Anthropic from "@anthropic-ai/sdk";
import { corsHeaders, preflight } from "@/lib/cors";
import { OPP_SCOPES } from "@/lib/opportunity-types";
import { EVIDENCE_OPTIONS } from "@/lib/notice-options";

export const runtime = "nodejs";
export const maxDuration = 30;

// Haiku: a single structured rewrite, fast enough for an in-wizard step.
const MODEL = "claude-haiku-4-5-20251001";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

/**
 * AI notice improvement. Takes a draft project notice and returns a clearer
 * public title and summary, a plain-English AI-readable summary, suggested
 * evidence requests, explicit assumptions, gap flags and a recommendation on
 * whether the buyer should build a full RFP instead.
 *
 * Guardrails (enforced in the prompt and by the tool schema):
 * - never invent facts the buyer did not provide;
 * - anything inferred is listed under assumptions, not stated as fact;
 * - missing critical information is listed under gaps;
 * - output is a suggestion the buyer reviews before publishing.
 *
 * Open endpoint: the draft builder is ungated. Returns 503 when the model is
 * not configured so the wizard can continue without the AI step.
 */
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "AI improvement is not available right now. You can continue to the preview." }, { status: 503, headers: cors });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors });
  }

  const draft = {
    title: String(body.title ?? "").slice(0, 200),
    summary: String(body.summary ?? "").slice(0, 4000),
    current_environment: String(body.current_environment ?? "").slice(0, 2000),
    desired_outcomes: String(body.desired_outcomes ?? "").slice(0, 2000),
    scope: Array.isArray(body.scope) ? (body.scope as string[]).filter((s) => (OPP_SCOPES as readonly string[]).includes(s)) : [],
    buyer_sector: String(body.buyer_sector ?? ""),
    buyer_size_band: String(body.buyer_size_band ?? ""),
    sites: typeof body.sites === "number" ? body.sites : null,
    users_band: String(body.users_band ?? ""),
    regions: Array.isArray(body.regions) ? (body.regions as string[]).slice(0, 10) : [],
    response_mode: String(body.response_mode ?? ""),
    timeline_note: String(body.timeline_note ?? "").slice(0, 1000),
    compliance_requirements: Array.isArray(body.compliance_requirements) ? (body.compliance_requirements as string[]).slice(0, 12) : [],
  };
  if (!draft.summary && !draft.title) {
    return Response.json({ error: "Describe your need first." }, { status: 400, headers: cors });
  }

  const evidenceKeys: string[] = EVIDENCE_OPTIONS.map((e) => e.key);
  const tool = {
    name: "improve_notice",
    description:
      "Return an improved project notice. Use ONLY facts present in the draft. Anything you infer goes in assumptions. Anything missing that suppliers would need goes in gaps. Never invent sites, budgets, technologies, compliance obligations or dates.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Clear public notice title, max 90 characters, no buyer name if the draft has none." },
        summary: { type: "string", description: "Improved public summary in the buyer's voice, 2-4 sentences, plain English, preserving every stated fact and adding none." },
        ai_summary: { type: "string", description: "One-paragraph third-person AI-readable summary: what the buyer needs, who should respond, what evidence is expected. Note that pricing responses stay private to the buyer." },
        suggested_evidence: { type: "array", items: { type: "string", enum: evidenceKeys }, description: "Evidence suppliers should be asked to provide, chosen from the catalogue keys only." },
        assumptions: { type: "array", items: { type: "string" }, description: "Explicit assumptions made while rewriting, each starting 'Assumed:'." },
        gaps: { type: "array", items: { type: "string" }, description: "Missing information suppliers would likely need before responding, most critical first." },
        recommend_full_rfp: { type: "boolean", description: "True only if the need is complex enough (multi-category scope, formal evaluation, compliance-heavy) that a structured RFP would serve the buyer better than a notice." },
        recommend_reason: { type: "string", description: "One sentence explaining the routing recommendation." },
      },
      required: ["title", "summary", "ai_summary", "suggested_evidence", "assumptions", "gaps", "recommend_full_rfp", "recommend_reason"],
    },
  };

  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      tools: [tool],
      tool_choice: { type: "tool", name: "improve_notice" },
      messages: [
        {
          role: "user",
          content: `Improve this draft SASE/SD-WAN marketplace project notice. Draft (JSON):\n${JSON.stringify(draft, null, 2)}`,
        },
      ],
    });
    const block = msg.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      return Response.json({ error: "No improvement produced." }, { status: 502, headers: cors });
    }
    const out = block.input as Record<string, unknown>;
    return Response.json(
      {
        title: String(out.title ?? draft.title).slice(0, 120),
        summary: String(out.summary ?? draft.summary),
        ai_summary: String(out.ai_summary ?? ""),
        suggested_evidence: Array.isArray(out.suggested_evidence) ? (out.suggested_evidence as string[]).filter((k) => evidenceKeys.includes(k)) : [],
        assumptions: Array.isArray(out.assumptions) ? (out.assumptions as string[]).slice(0, 10) : [],
        gaps: Array.isArray(out.gaps) ? (out.gaps as string[]).slice(0, 10) : [],
        recommend_full_rfp: Boolean(out.recommend_full_rfp),
        recommend_reason: String(out.recommend_reason ?? ""),
      },
      { headers: cors },
    );
  } catch {
    return Response.json({ error: "AI improvement failed. You can continue to the preview." }, { status: 502, headers: cors });
  }
}
