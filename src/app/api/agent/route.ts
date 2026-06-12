import Anthropic from "@anthropic-ai/sdk";
import { FEATURES, FEATURE_NAMES, getShortlistDataset } from "@/lib/vendors";
import {
  AI_KEYS,
  CLOUD_KEYS,
  INTENT_KEYS,
  ORG_SIZE_KEYS,
  REGION_KEYS,
  SECTOR_KEYS,
  SERVICE_MODELS,
  WEIGHT_PRESETS,
  ShortlistInputSchema,
  buildComparison,
  buildShortlist,
  type ComparisonResult,
  type ShortlistInput,
} from "@/lib/shortlist-core";
import { getAllVendorSlugs } from "@/lib/vendors";
import { corsHeaders, preflight } from "@/lib/cors";

/** The Anthropic SDK needs the Node runtime (it imports node:fs et al). */
export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";

const TOOL_NAME = "set_shortlist_criteria";

function criteriaTool(): Anthropic.Tool {
  const inputSchema = {
    type: "object",
    properties: {
      service_model: {
        type: "string",
        enum: [...SERVICE_MODELS],
        description: "How the buyer wants the service operated.",
      },
      required_features: {
        type: "array",
        items: { type: "string", enum: FEATURES.map((f) => f.id) },
        description: "Hard requirements. Vendor is excluded without evidence.",
      },
      preferred_features: {
        type: "array",
        items: { type: "string", enum: FEATURES.map((f) => f.id) },
        description: "Nice-to-haves. Add scoring weight, never exclude.",
      },
      required_regions: {
        type: "array",
        items: { type: "string", enum: [...REGION_KEYS] },
      },
      required_clouds: {
        type: "array",
        items: { type: "string", enum: [...CLOUD_KEYS] },
      },
      ai_requirements: {
        type: "array",
        items: { type: "string", enum: [...AI_KEYS] },
      },
      disaster_recovery_required: { type: "boolean" },
      max_deployment_speed: {
        type: "string",
        enum: ["hours", "days", "weeks", "months", "any"],
      },
      weight_preset: { type: "string", enum: [...WEIGHT_PRESETS] },
      shortlist_size: { type: "integer", minimum: 3, maximum: 30 },
      sector: {
        type: ["string", "null"],
        enum: [...SECTOR_KEYS, null],
        description: "The buyer's industry sector, if stated or clearly implied.",
      },
      organisation_size: { type: "string", enum: [...ORG_SIZE_KEYS, "any"] },
      intent: {
        type: "string",
        enum: [...INTENT_KEYS, "none"],
        description: "The buyer's main commercial priority.",
      },
    },
    required: [],
  };
  return {
    name: TOOL_NAME,
    description:
      "Set the filter and scoring criteria for the Netify SASE and SD-WAN shortlist builder. Only set hard requirements the buyer actually stated; use preferred_features for implied wants.",
    input_schema: inputSchema as unknown as Anthropic.Tool.InputSchema,
  };
}

const COMPARE_TOOL_NAME = "compare_vendors";

function compareTool(): Anthropic.Tool {
  return {
    name: COMPARE_TOOL_NAME,
    description:
      "Compare 2 or 3 named vendors feature by feature on the Netify evidence matrix. Use when the buyer asks to compare, contrast or choose between specific vendors. Returns per-feature grades, clear wins per vendor and balanced scores.",
    input_schema: {
      type: "object",
      properties: {
        slugs: {
          type: "array",
          minItems: 2,
          maxItems: 3,
          items: { type: "string", enum: getAllVendorSlugs() },
          description: "Vendor slugs to compare.",
        },
      },
      required: ["slugs"],
    } as unknown as Anthropic.Tool.InputSchema,
  };
}

const FEATURE_CATALOGUE = FEATURES.map(
  (f) => `${f.id}: ${f.name} [${f.category}]`,
).join("\n");

const SYSTEM = `You are the Netify SASE and SD-WAN shortlist advisor, embedded in the shortlist builder at sase.netify.co.uk.

A buyer talks to you in plain language, possibly over several turns. You have two tools:
1. ${TOOL_NAME}: set the shortlist filter criteria when the buyer describes requirements. Be conservative with hard requirements (required_features, regions, clouds): only gate on things the buyer clearly needs. Use preferred_features for softer wants. Pick the weight_preset matching their emphasis.
2. ${COMPARE_TOOL_NAME}: when the buyer asks to compare, contrast or choose between named vendors, call this with their slugs.

Use the right tool for the request; for a comparison question do not reset the filters. After tool results return, write a short plain-prose answer.

Feature catalogue (id: name [category]):
${FEATURE_CATALOGUE}

Mapping hints: ZTNA is f30. SWG is f31. CASB is f32. DLP is f33. Full SASE platform is f28. NGFW is f27. Remote and hybrid workers map to f34. MPLS migration is f16. 5G or cellular backup is f17. Cloud on-ramp is f18. Multi-cloud is f23. White-label or MSP resale is f04. Reporting and analytics map to f38 and f37. APIs and automation is f39. If the buyer wants someone else to run the service, set service_model to managed. If they want shared control, co_managed. If their own team runs it, diy.

Sector mapping: if the buyer names or implies an industry (hospital or NHS means healthcare; bank, insurer or fund means financial_services; shops, stores or e-commerce means retail_ecommerce; factories or plants means manufacturing; oil, gas, power or water means energy_utilities; council, ministry or agency means government_public_sector; school or university means education; fleet, haulage, rail or shipping means transport_logistics; law, accounting or consulting means professional_services; hotels, restaurants or stadiums means hospitality_leisure), set sector. Set organisation_size from employee count or words like global enterprise, mid-market, SME. Set intent from the dominant goal: cost_saving, mpls_migration, rapid_deployment, remote_workforce, security_consolidation or global_expansion.

Call at most one tool per turn, then answer in prose. UK English. Never use em or en dashes. No marketing filler vocabulary. Plain text only: no markdown, no asterisks, no headings, no bullet lists. 150 words maximum in your final answer.`;

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "AI advisor not configured (missing API key)." },
      { status: 503, headers: cors },
    );
  }

  let body: {
    prompt?: string;
    messages?: { role: "user" | "assistant"; content: string }[];
    current_input?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400, headers: cors });
  }

  const history: Anthropic.MessageParam[] = (body.messages ?? [])
    .filter((m) => m && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (history.length === 0) {
    const prompt = (body.prompt ?? "").toString().slice(0, 4000);
    if (!prompt.trim()) return Response.json({ error: "Empty prompt." }, { status: 400, headers: cors });
    history.push({ role: "user", content: prompt });
  }
  history[history.length - 1] = {
    role: "user",
    content: `${history[history.length - 1].content}\n\n(Current filter state: ${JSON.stringify(body.current_input ?? {})})`,
  };

  const client = new Anthropic();
  let appliedInput: ShortlistInput | null = null;
  let comparison: ComparisonResult | null = null;

  try {
    const messages: Anthropic.MessageParam[] = [...history];
    let narrative = "";

    for (let turn = 0; turn < 3; turn++) {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 1200,
        system: SYSTEM,
        tools: [criteriaTool(), compareTool()],
        messages,
      });

      const toolUse = res.content.find(
        (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
      );
      const text = res.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join(" ")
        .trim();
      if (text) narrative = text;

      if (!toolUse) break;

      let toolResult = "";
      if (toolUse.name === TOOL_NAME) {
        const parsed = ShortlistInputSchema.safeParse(toolUse.input);
        if (parsed.success) {
          appliedInput = parsed.data;
          const result = buildShortlist(getShortlistDataset(), appliedInput, FEATURE_NAMES);
          toolResult = JSON.stringify({
            applied: true,
            criteria: result.criteria_summary,
            shortlist: result.shortlist.slice(0, 8).map((v) => `${v.rank}. ${v.name} (${v.score})`),
            excluded: result.excluded,
          });
        } else {
          toolResult = JSON.stringify({ applied: false, error: "Invalid criteria." });
        }
      } else if (toolUse.name === COMPARE_TOOL_NAME) {
        const slugs = ((toolUse.input as { slugs?: string[] })?.slugs ?? []).slice(0, 3);
        comparison = buildComparison(
          getShortlistDataset(),
          slugs,
          FEATURES.map((f) => ({ id: f.id, name: f.name, category: f.category })),
        );
        toolResult = comparison
          ? JSON.stringify({
              summary: comparison.summary,
              wins: Object.fromEntries(
                comparison.slugs.map((s) => [comparison!.names[s], comparison!.wins[s].slice(0, 6)]),
              ),
              level_features: comparison.even.length,
            })
          : JSON.stringify({ error: "Need 2 or 3 valid vendor slugs." });
      } else {
        toolResult = JSON.stringify({ error: `Unknown tool ${toolUse.name}` });
      }

      messages.push({ role: "assistant", content: res.content });
      messages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: toolUse.id, content: toolResult }],
      });
    }

    return Response.json(
      {
        narrative,
        input: appliedInput ?? undefined,
        comparison: comparison ?? undefined,
      },
      { headers: cors },
    );
  } catch (err) {
    console.error("agent error:", err);
    return Response.json({ error: "Advisor request failed." }, { status: 502, headers: cors });
  }
}
