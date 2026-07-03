import Anthropic from "@anthropic-ai/sdk";
import { corsHeaders, preflight } from "@/lib/cors";
import { getProject, kvConfigured } from "@/lib/rfp-store";
import { buildMethodology, METHODOLOGY_VERSION } from "@/lib/rfp-methodology";
import { REGULATIONS } from "@/lib/rfp-compliance";
import { FEATURE_CATEGORIES, getShortlistDataset } from "@/lib/vendors";
import { requireRfpOwner, ownerRequired } from "@/lib/rfp-access";

export const runtime = "nodejs";
const MODEL = "claude-sonnet-4-6";
type Ctx = { params: Promise<{ id: string }> };

export async function OPTIONS(req: Request) {
  return preflight(req);
}

/**
 * AI expert research tool. Given a topic, it returns a themed SET of
 * bespoke, evidence-bound questions, each grounded in three knowledge
 * bases a generic LLM does not have: the Netify methodology, the live
 * vendor capability matrix, and the buyer's selected regulations. It also
 * surfaces which vendors in the matrix are weakest on the topic, so the
 * questions probe the real differentiators.
 */
export async function POST(req: Request, ctx: Ctx) {
  const cors = corsHeaders(req);
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "AI research tool not configured." }, { status: 503, headers: cors });
  }
  const { id } = await ctx.params;
  const project = kvConfigured() ? await getProject(id) : null;

  let body: { topic?: string; count?: number; manage_token?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors }); }

  // When the id resolves to a real RFP, this tool tailors output with the
  // buyer's private context (and burns AI budget), so it is owner-only.
  if (project) {
    const access = await requireRfpOwner(req, project, body as Record<string, unknown>);
    if (!access.ok) return ownerRequired("The AI research tool", cors);
  }
  const topic = (body.topic ?? "").toString().slice(0, 600);
  if (!topic.trim()) return Response.json({ error: "Give a topic to research." }, { status: 400, headers: cors });
  const count = Math.max(2, Math.min(8, Number(body.count ?? 4)));

  const features = buildMethodology().features.map((f) => `${f.feature_id} (${f.category}): ${f.feature_name}`).join("\n");
  const regs = REGULATIONS.map((r) => `${r.key}: ${r.label}`).join("; ");

  // Live matrix signal: spread of grades per feature tells us where vendors differ.
  const ds = getShortlistDataset();
  const variation = buildMethodology().features.map((f) => {
    const grades = ds.map((v) => v.capabilities[f.feature_id]).filter(Boolean);
    const yes = grades.filter((g) => g === "yes").length;
    return { fid: f.feature_id, name: f.feature_name, yes_share: Math.round((yes / (grades.length || 1)) * 100) };
  });
  const differentiators = variation.filter((v) => v.yes_share >= 25 && v.yes_share <= 80).slice(0, 20)
    .map((v) => `${v.fid}: ${v.name} (${v.yes_share}% of vendors graded yes)`).join("\n");

  const tool: Anthropic.Tool = {
    name: "propose_question_set",
    description: "Return a themed set of RFP questions on the topic.",
    input_schema: {
      type: "object",
      properties: {
        questions: {
          type: "array", minItems: 2, maxItems: 8,
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              evidence_requested: { type: "string" },
              category: { type: "string", enum: [...FEATURE_CATEGORIES] },
              feature_id: { type: "string", description: "Nearest feature id or empty string." },
              rationale: { type: "string", description: "Cite the methodology, the matrix signal, or the regulation." },
            },
            required: ["text", "evidence_requested", "category", "rationale"],
          },
        },
        analysis: { type: "string", description: "One short paragraph on why this topic separates strong from weak vendors." },
      },
      required: ["questions", "analysis"],
    } as unknown as Anthropic.Tool.InputSchema,
  };

  const client = new Anthropic();
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1600,
      tool_choice: { type: "tool", name: "propose_question_set" },
      tools: [tool],
      system: `You are a SASE, SSE and SD-WAN procurement expert authoring a themed set of ${count} RFP questions on a topic for a buyer. Ground every question in the Netify SASE Methodology v${METHODOLOGY_VERSION}, choosing the nearest feature id and category. Where the matrix shows vendors genuinely differ on a capability, write questions that expose that difference rather than ones every vendor can answer yes to. Where a selected regulation applies, tie the question to it. Questions must be neutral and answerable by any vendor, with the evidence to request. UK English, no em or en dashes, no marketing language.

Methodology features:
${features}

Capabilities where vendors most differ (use these to write discriminating questions):
${differentiators}

Regulations available: ${regs}.
${project ? `Buyer context: sector ${project.buyer.sector}, scope ${project.buyer.product_scope}, delivery ${project.buyer.operating_model}, compliance ${JSON.stringify(project.buyer.compliance)}.` : ""}`,
      messages: [{ role: "user", content: `Topic: ${topic}. Produce ${count} questions.` }],
    });
    const tu = res.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
    if (!tu) return Response.json({ error: "Could not research that topic." }, { status: 502, headers: cors });
    const input = tu.input as { questions: Record<string, string>[]; analysis: string };
    const questions = (input.questions ?? []).map((q) => {
      const fid = (q.feature_id ?? "").trim();
      return {
        id: fid ? `q_${fid}` : `q_custom_${Math.random().toString(36).slice(2, 8)}`,
        feature_id: fid || "custom",
        text: q.text, evidence_requested: q.evidence_requested, rationale: q.rationale,
        category: q.category, priority: "recommended", source: fid ? "methodology" : "custom", mandatory: false, weight: 3,
      };
    });
    return Response.json({ analysis: input.analysis, questions }, { headers: cors });
  } catch (err) {
    console.error("research error:", err);
    return Response.json({ error: "Research request failed." }, { status: 502, headers: cors });
  }
}
