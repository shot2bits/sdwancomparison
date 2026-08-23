import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 20;

const MODEL = "claude-haiku-4-5-20251001";

const SECTION_BOUNDARIES: Record<string, string> = {
  "Organisation and scale": "Supplier capacity, relevant delivery experience and ability to support the stated organisational footprint. Do not ask the buyer for missing estate facts.",
  "Solution scope": "How the supplier's proposed service covers the buyer's stated SASE, SD-WAN or SSE scope and clearly identifies exclusions.",
  "Current estate": "Discovery, coexistence, interoperability and transition from the buyer's current network, cloud and security estate. Do not turn organisation-wide counts into per-site counts.",
  "Resilience and availability": "Availability commitments, diversity, failover behaviour, recovery objectives, monitoring and evidence.",
  "Security, identity and data": "Security controls, identity integration, data handling, policy enforcement, assurance and compliance evidence.",
  "Operating model and support": "Service ownership, RACI, support coverage, escalation, reporting and operational handover.",
  "Migration and implementation": "Discovery, design, pilot, rollout, dependencies, risk controls, acceptance and the stated timeline.",
  "Commercial and contractual": "Pricing transparency, term, exit, indexation, service credits and contractual dependencies.",
  "Success and evaluation": "Measurable outcomes, acceptance evidence, ongoing KPIs and how suppliers demonstrate them.",
};

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "AI suggestions are unavailable right now." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const section = String(body.section ?? "").trim().slice(0, 120);
  const context = String(body.context ?? "").trim().slice(0, 3500);
  const existing = Array.isArray(body.existing)
    ? (body.existing as unknown[]).map(String).map((s) => s.trim()).filter(Boolean).slice(0, 30)
    : [];
  if (!section) return Response.json({ error: "Choose a section first." }, { status: 400 });
  const boundary = SECTION_BOUNDARIES[section] ?? `Only matters that directly belong in the ${section} section.`;

  const tool = {
    name: "suggest_supplier_questions",
    description: "Suggest concise, non-duplicative questions for suppliers responding to a SASE or SD-WAN RFP.",
    input_schema: {
      type: "object" as const,
      properties: {
        questions: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: { type: "string", description: "One testable supplier question, ending with a question mark." },
        },
      },
      required: ["questions"],
    },
  };

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 650,
      tools: [tool],
      tool_choice: { type: "tool", name: "suggest_supplier_questions" },
      messages: [{
        role: "user",
        content: [
          `Section: ${section}`,
          `Strict section boundary: ${boundary}`,
          `Current requirement: ${context || "No additional context supplied."}`,
          `Questions already present: ${existing.length ? existing.join(" | ") : "None"}`,
          "Suggest up to four useful questions that the SUPPLIER must answer, strictly within the named section boundary. Do not ask the buyer for information. Do not invent or reinterpret buyer facts, standards, locations, budgets, dates, totals or per-site values. Never transform an organisation-wide number into a per-site or per-location number. Avoid duplicates and questions belonging to another section. Make each supplier response independently assessable and ask for evidence only where appropriate.",
        ].join("\n"),
      }],
    });
    const block = message.content.find((item) => item.type === "tool_use");
    if (!block || block.type !== "tool_use") throw new Error("No suggestions returned");
    const input = block.input as { questions?: unknown };
    const questions = Array.isArray(input.questions)
      ? input.questions.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 4)
      : [];
    return Response.json({ questions });
  } catch {
    return Response.json({ error: "Netify could not generate suggestions. Try again shortly." }, { status: 502 });
  }
}
