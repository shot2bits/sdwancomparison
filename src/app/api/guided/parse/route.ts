import Anthropic from "@anthropic-ai/sdk";
import { corsHeaders, preflight } from "@/lib/cors";

export const runtime = "nodejs";
export const maxDuration = 30;
// Haiku is plenty for a single structured extraction and keeps the homepage
// auto-fill fast.
const MODEL = "claude-haiku-4-5-20251001";

// These option keys mirror the chips in src/components/GuidedStart.tsx. The
// response is validated against them, so any drift simply drops an unknown
// value rather than breaking the form.
const NEEDS = ["underlay_circuits", "sd_wan", "sse", "sase"] as const;
const SECTORS = ["healthcare", "financial_services", "retail_ecommerce", "manufacturing", "energy_utilities", "government_public_sector", "education", "transport_logistics", "professional_services", "hospitality_leisure"] as const;
const REGIONS = ["uk_ireland", "europe", "north_america", "apac", "middle_east_africa", "latin_america"] as const;
const ORG_SIZES = ["large_global_enterprise", "mid_market", "small_business"] as const;
const DELIVERY = ["managed", "co_managed", "diy", "any"] as const;
const SDWAN = ["f12_application_aware_routing", "f13_qos_and_traffic_shaping", "f10_dynamic_path_selection", "f15_local_internet_breakout", "f16_mpls_coexistence_and_migration", "f17_cellular_and_5g_support", "f18_cloud_on_ramp"] as const;
const SASE = ["f27_integrated_next_generation_firewall", "f30_zero_trust_network_access", "f31_secure_web_gateway", "f32_casb_capability", "f33_data_loss_prevention", "f28_full_sase_platform", "f35_soc_siem_soar_integration"] as const;
const COMPLIANCE = ["uk_gdpr", "pci_dss", "iec_62443", "iso_27001", "dora", "nis2", "cyber_resilience_bill"] as const;

export async function OPTIONS(req: Request) {
  return preflight(req);
}

/**
 * Parse a plain-English buyer description into the guided-start form selections,
 * so the homepage prompt box can auto-fill the chips instead of the buyer
 * entering everything twice. Open endpoint (the homepage is ungated); returns
 * 503 if the model is not configured so the UI can fall back to manual chips.
 */
export async function POST(req: Request) {
  const cors = corsHeaders(req);
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Auto-fill is not available right now. Use the options below." }, { status: 503, headers: cors });
  }

  let body: { description?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400, headers: cors });
  }
  const description = (body.description ?? "").trim().slice(0, 2000);
  if (!description) return Response.json({ error: "Describe your need first." }, { status: 400, headers: cors });

  const tool = {
    name: "set_form",
    description: "Record only the requirements clearly implied by the buyer's description. Omit any field that is not stated. Never guess or pad.",
    input_schema: {
      type: "object",
      properties: {
        needs: { type: "array", items: { type: "string", enum: [...NEEDS] }, description: "What they need. underlay_circuits = just connectivity/circuits; sd_wan = SD-WAN; sse = security service edge only; sase = full SASE (SD-WAN plus cloud security)." },
        sector: { type: "string", enum: [...SECTORS], description: "Their industry, if stated." },
        regions: { type: "array", items: { type: "string", enum: [...REGIONS] }, description: "Geographies mentioned." },
        project: { type: "string", enum: ["new", "migration"], description: "migration if replacing an existing network (e.g. moving off MPLS); new for a greenfield build." },
        orgSize: { type: "string", enum: [...ORG_SIZES] },
        delivery: { type: "string", enum: [...DELIVERY], description: "Operating model. Use any if unstated." },
        sdwan: { type: "array", items: { type: "string", enum: [...SDWAN] }, description: "SD-WAN features explicitly wanted." },
        sase: { type: "array", items: { type: "string", enum: [...SASE] }, description: "Security/SASE features explicitly wanted (ZTNA, SWG, CASB, DLP, NGFW, full SASE, SOC/SIEM)." },
        compliance: { type: "array", items: { type: "string", enum: [...COMPLIANCE] }, description: "Compliance obligations mentioned." },
        sites: { type: "integer", description: "Number of sites or locations, if stated." },
        budget: { type: "string", description: "A short budget note, if mentioned." },
      },
    },
  };

  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: "You map a plain-English SASE, SSE and SD-WAN buyer description onto a structured marketplace form. Extract only what the buyer clearly states; never invent or assume. Always answer by calling set_form exactly once.",
      tools: [tool as unknown as Anthropic.Tool],
      tool_choice: { type: "tool", name: "set_form" },
      messages: [{ role: "user", content: description }],
    });

    const tu = res.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
    const input = (tu?.input ?? {}) as Record<string, unknown>;

    const inSet = (set: readonly string[], v: unknown): boolean => typeof v === "string" && set.includes(v);
    const arrIn = (set: readonly string[], v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => inSet(set, x)) : []);

    const fields: Record<string, unknown> = {};
    const needs = arrIn(NEEDS, input.needs); if (needs.length) fields.needs = needs;
    if (inSet(SECTORS, input.sector)) fields.sector = input.sector;
    const regions = arrIn(REGIONS, input.regions); if (regions.length) fields.regions = regions;
    if (input.project === "new" || input.project === "migration") fields.project = input.project;
    if (inSet(ORG_SIZES, input.orgSize)) fields.orgSize = input.orgSize;
    if (inSet(DELIVERY, input.delivery)) fields.delivery = input.delivery;
    const sdwan = arrIn(SDWAN, input.sdwan); if (sdwan.length) fields.sdwan = sdwan;
    const sase = arrIn(SASE, input.sase); if (sase.length) fields.sase = sase;
    const compliance = arrIn(COMPLIANCE, input.compliance); if (compliance.length) fields.compliance = compliance;
    if (typeof input.sites === "number" && input.sites > 0) fields.sites = String(Math.round(input.sites));
    if (typeof input.budget === "string" && input.budget.trim()) fields.budget = input.budget.trim().slice(0, 120);

    return Response.json({ ok: true, fields }, { headers: cors });
  } catch (e) {
    console.error("guided parse error:", e);
    return Response.json({ error: "Could not read that. Try the options below, or rephrase." }, { status: 502, headers: cors });
  }
}
