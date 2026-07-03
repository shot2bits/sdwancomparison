import Anthropic from "@anthropic-ai/sdk";
import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, kvConfigured } from "@/lib/rfp-store";
import { buildMethodology, METHODOLOGY_VERSION } from "@/lib/rfp-methodology";
import { FEATURE_CATEGORIES } from "@/lib/vendors";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";

export const runtime = "nodejs";
const MODEL = "claude-sonnet-4-6";
type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(req: Request) {
  return preflight(req);
}

/**
 * AI question helper. The buyer types a plain-language intent ("I want to
 * know how they handle TLS inspection for unmanaged devices") and gets back
 * a well-formed RFP question, the evidence to request, a suggested category,
 * and a mapping to the nearest methodology feature (or marked custom).
 * Does not mutate the RFP; the UI lets the buyer review then add it.
 */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "AI helper not configured." }, { status: 503, headers: cors });
  }
  const { id } = await ctx.params;
  // Project is optional context; helper works without KV too.
  const project = kvConfigured() ? await getProject(id) : null;

  let body: { intent?: string; manage_token?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors });
  }

  // When the id resolves to a real RFP, the helper tailors output with the
  // buyer's private context (and burns AI budget), so it is owner-only.
  if (project) {
    const access = await requireRfpOwner(req, project, body as Record<string, unknown>);
    if (!access.ok) return ownerRequired("The AI question helper", cors);
  }
  const intent = (body.intent ?? "").toString().slice(0, 1000);
  if (!intent.trim()) return Response.json({ error: "Describe what you want to ask." }, { status: 400, headers: cors });

  const features = buildMethodology().features.map((f) => `${f.feature_id}: ${f.feature_name}`).join("\n");

  const tool: Anthropic.Tool = {
    name: "propose_question",
    description: "Return a well-formed RFP question with evidence, category and methodology mapping.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The RFP question, neutral and answerable by any vendor." },
        evidence_requested: { type: "string", description: "What evidence the vendor should provide." },
        category: { type: "string", enum: [...FEATURE_CATEGORIES] },
        feature_id: { type: "string", description: "Nearest methodology feature id, or empty string if genuinely custom." },
        rationale: { type: "string", description: "One sentence citing why, referencing the methodology where mapped." },
      },
      required: ["text", "evidence_requested", "category", "rationale"],
    } as unknown as Anthropic.Tool.InputSchema,
  };

  const client = new Anthropic();
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      tool_choice: { type: "tool", name: "propose_question" },
      tools: [tool],
      system: `You help a buyer add a question to a SASE, SSE and SD-WAN RFP. Map their intent to the Netify SASE Methodology v${METHODOLOGY_VERSION} where possible, choosing the nearest feature id and category. If nothing fits, set feature_id to an empty string and still pick the best category. Write the question neutrally so any vendor can answer it, and state the evidence to request. UK English, no em or en dashes, no marketing language.

Methodology features:
${features}

Categories: ${FEATURE_CATEGORIES.join("; ")}.
${project ? `Buyer context: ${JSON.stringify(project.buyer)}.` : ""}`,
      messages: [{ role: "user", content: intent }],
    });
    const tu = res.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
    if (!tu) return Response.json({ error: "Could not draft a question." }, { status: 502, headers: cors });
    const input = tu.input as Record<string, string>;
    const fid = (input.feature_id ?? "").trim();
    return Response.json({
      question: {
        id: fid ? `q_${fid}` : `q_custom_${Date.now().toString(36)}`,
        feature_id: fid || "custom",
        text: input.text,
        evidence_requested: input.evidence_requested,
        rationale: input.rationale,
        category: input.category,
        priority: "recommended",
        source: fid ? "methodology" : "custom",
        mandatory: false,
        weight: 3,
      },
    }, { headers: cors });
  } catch (err) {
    console.error("draft-question error:", err);
    return Response.json({ error: "Helper request failed." }, { status: 502, headers: cors });
  }
}
