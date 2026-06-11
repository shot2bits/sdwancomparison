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
  buildShortlist,
} from "@/lib/shortlist-core";

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

const FEATURE_CATALOGUE = FEATURES.map(
  (f) => `${f.id}: ${f.name} [${f.category}]`,
).join("\n");

const SYSTEM = `You are the Netify SASE and SD-WAN shortlist advisor, embedded in the shortlist builder at sase.netify.co.uk.

A buyer describes their estate and requirements in plain language. Your job:
1. Map their description onto the shortlist criteria using the ${TOOL_NAME} tool.
2. Be conservative with hard requirements (required_features, regions, clouds): only gate on things the buyer clearly needs. Use preferred_features for softer wants.
3. Pick the weight_preset that matches their emphasis: security_led, network_led, cloud_first, managed_service_led or balanced.

Feature catalogue (id: name [category]):
${FEATURE_CATALOGUE}

Mapping hints: ZTNA is f30. SWG is f31. CASB is f32. DLP is f33. Full SASE platform is f28. NGFW is f27. Remote and hybrid workers map to f34. MPLS migration is f16. 5G or cellular backup is f17. Cloud on-ramp is f18. Multi-cloud is f23. White-label or MSP resale is f04. Reporting and analytics map to f38 and f37. APIs and automation is f39. If the buyer wants someone else to run the service, set service_model to managed. If they want shared control, co_managed. If their own team runs it, diy.

Sector mapping: if the buyer names or implies an industry (hospital or NHS means healthcare; bank, insurer or fund means financial_services; shops, stores or e-commerce means retail_ecommerce; factories or plants means manufacturing; oil, gas, power or water means energy_utilities; council, ministry or agency means government_public_sector; school or university means education; fleet, haulage, rail or shipping means transport_logistics; law, accounting or consulting means professional_services; hotels, restaurants or stadiums means hospitality_leisure), set sector. Set organisation_size from employee count or words like global enterprise, mid-market, SME. Set intent from the dominant goal: cost_saving, mpls_migration, rapid_deployment, remote_workforce, security_consolidation or global_expansion.

Always call the tool exactly once.`;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "AI advisor not configured (missing API key)." },
      { status: 503 },
    );
  }

  let body: { prompt?: string; current_input?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const prompt = (body.prompt ?? "").toString().slice(0, 4000);
  if (!prompt.trim()) {
    return Response.json({ error: "Empty prompt." }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    // Step 1: map the buyer's description to criteria
    const first = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      tools: [criteriaTool()],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [
        {
          role: "user",
          content: `Buyer requirements: ${prompt}\n\nCurrent filter state (may be defaults): ${JSON.stringify(body.current_input ?? {})}`,
        },
      ],
    });

    const toolUse = first.content.find(
      (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
    );
    if (!toolUse) {
      return Response.json({ error: "Advisor produced no criteria." }, { status: 502 });
    }

    const parsed = ShortlistInputSchema.safeParse(toolUse.input);
    if (!parsed.success) {
      return Response.json({ error: "Advisor produced invalid criteria." }, { status: 502 });
    }
    const input = parsed.data;

    // Step 2: run the same engine every other surface uses
    const result = buildShortlist(getShortlistDataset(), input, FEATURE_NAMES);

    // Step 3: short narrative about the outcome
    const summary = result.shortlist
      .slice(0, 8)
      .map((v) => `${v.rank}. ${v.name} (score ${v.score}; ${v.key_differentiators[0]})`)
      .join("\n");
    const second = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system:
        "You write concise buyer guidance for Netify. UK English. Never use em or en dashes; use commas or full stops. No marketing filler vocabulary. Lead with numbers and concrete facts. 120 words maximum.",
      messages: [
        {
          role: "user",
          content: `The buyer asked: "${prompt}"\n\nCriteria applied: ${result.criteria_summary}\n\nShortlist (${result.shortlist.length} of ${result.considered} providers, ${result.excluded} excluded by hard requirements):\n${summary || "No providers met every requirement."}\n\nWrite a short narrative for the buyer: why these providers lead, one caution to check via RFP, and what to consider relaxing if the list is too short. Plain prose, no headings, no lists.`,
        },
      ],
    });

    const narrative =
      second.content.find((c): c is Anthropic.TextBlock => c.type === "text")
        ?.text ?? "";

    return Response.json({ input, narrative });
  } catch (err) {
    console.error("agent error:", err);
    return Response.json({ error: "Advisor request failed." }, { status: 502 });
  }
}
