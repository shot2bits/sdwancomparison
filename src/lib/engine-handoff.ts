/**
 * Shortlist to engine handoff (3 Sep 2026).
 *
 * Robert's ruling: every buyer path on the SD-WAN and SASE side must end
 * with the project listed on the opportunity board. The comparison
 * workspace on /shortlist is therefore a door into the sourcing engine
 * (netify.co.uk/sase-sd-wan-rfp-builder/, ProjectDesk), never a
 * destination. This module builds the one URL every workspace tab uses to
 * walk through that door with the buyer's match already in place.
 *
 * Why a URL and not POST /api/rfp then ?id= resume: the desk treats ?id=
 * as a resume and only accepts a project that is a security_sourcing
 * engagement or already carries facts. A record minted by the shortlist
 * has neither, so the desk said "starting fresh instead" and the buyer
 * arrived at an empty engine with their five providers left behind in KV
 * (confirmed live 3 Sep 2026). The desk already parses ?q= (requirement
 * text fed to the extractor), ?vendors= (up to five slugs, pinned as the
 * buyer's own selection), ?sector= (a WORKSPACE_SECTORS label) and
 * ?scope=; those carriers are reused here, so no project is created until
 * the buyer saves or publishes inside the engine.
 *
 * The sentence is written for the desk's extractor, which reads regions,
 * operating model, clouds, MPLS estate, compliance and scope from plain
 * English (src/lib/workspace/extract.ts). Vendor names are deliberately
 * kept OUT of the sentence: they travel as pins, and a name such as BT
 * would otherwise be misread as an estate fact.
 */

import {
  SECTOR_LABELS,
  type ShortlistInput,
  type RegionKey,
  type SectorKey,
} from "@/lib/shortlist-core";

export const ENGINE_HANDOFF_VERSION = "engine-handoff/1.0.0";
export const ENGINE_URL = "https://netify.co.uk/sase-sd-wan-rfp-builder/";

export type EngineHandoffMode = "compare" | "requirements" | "top_five";

/** Shortlist sector keys to the desk's WORKSPACE_SECTORS labels (extract.ts). */
const WORKSPACE_SECTOR_LABEL: Record<SectorKey, string> = {
  healthcare: "Healthcare & pharma",
  financial_services: "Financial services",
  retail_ecommerce: "Retail & e-commerce",
  manufacturing: "Manufacturing",
  energy_utilities: "Energy & utilities",
  government_public_sector: "Government & public sector",
  education: "Education",
  transport_logistics: "Transport & logistics",
  professional_services: "Professional services",
  hospitality_leisure: "Hospitality & leisure",
};

/** Region phrases the extractor recognises (extract.ts organisation.regions). */
const REGION_PHRASE: Record<RegionKey, string> = {
  uk_ireland: "the UK and Ireland",
  europe: "Europe",
  north_america: "North America",
  asia_pacific: "Asia Pacific",
  middle_east_africa: "the Middle East and Africa",
  latin_america: "Latin America",
  china_mainland: "mainland China",
};

/** Cloud phrases the extractor grades (extract.ts estate.cloud). "Azure"
 *  rather than the label "Microsoft Azure": the word Microsoft alone reads
 *  as Microsoft 365 to the extractor and would add a cloud the buyer did
 *  not state (caught in the 3 Sep 2026 smoke run). */
const CLOUD_PHRASE: Record<ShortlistInput["required_clouds"][number], string> = {
  aws: "AWS",
  azure: "Azure",
  gcp: "Google Cloud",
  oracle_cloud: "Oracle Cloud",
  alibaba_cloud: "Alibaba Cloud",
};

const MODEL_PHRASE: Record<ShortlistInput["service_model"], string> = {
  managed: "Fully managed",
  co_managed: "Co-managed",
  diy: "Self-managed",
  any: "",
};

const SIZE_PHRASE: Record<ShortlistInput["organisation_size"], string> = {
  large_global_enterprise: "a large global enterprise",
  mid_market: "a mid-market organisation",
  small_business: "a small business",
  any: "",
};

const INTENT_PHRASE: Record<ShortlistInput["intent"], string> = {
  cost_saving: "Cost saving is the main driver.",
  mpls_migration: "We are replacing MPLS.",
  rapid_deployment: "Rapid deployment is required.",
  remote_workforce: "The estate includes a remote and hybrid workforce.",
  security_consolidation: "We are consolidating security.",
  global_expansion: "The programme supports global expansion.",
  none: "",
};

function joinNatural(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function scopeForInput(input: ShortlistInput): "sase" | "sdwan" | null {
  if (input.weight_preset === "security_led") return "sase";
  if (input.weight_preset === "network_led") return "sdwan";
  return null;
}

/**
 * One requirement sentence from the shortlist filters, followed by any
 * text the buyer typed. Empty filters still yield a minimal statement so
 * the desk starts (facts.length > 0) and the pinned shortlist is visible.
 */
export function requirementSentence(
  input: ShortlistInput,
  featureNames: Record<string, string> = {},
  requirementText = "",
): string {
  const scope = scopeForInput(input);
  const product = scope === "sase" ? "SASE" : scope === "sdwan" ? "SD-WAN" : "SD-WAN and SASE";
  /* "Fully managed" leads the sentence; co-managed and self-managed are
   * stated as their own clause because the extractor reads "managed
   * SD-WAN" inside "Co-managed SD-WAN" as fully managed (smoke run, 3 Sep
   * 2026). */
  const model = input.service_model === "managed" ? MODEL_PHRASE.managed : "";
  const subject = `${model ? `${model} ` : ""}${product}`;
  const size = SIZE_PHRASE[input.organisation_size];
  const sector = input.sector ? `${SECTOR_LABELS[input.sector].toLowerCase()} organisation` : "";
  const who = size && sector ? `${size} in the ${sector.replace(/ organisation$/, "")} sector` : size || (sector ? `a ${sector}` : "");
  const regions = input.required_regions.map((key) => REGION_PHRASE[key]);
  const parts: string[] = [];
  parts.push(`${subject}${who ? ` for ${who}` : " requirement"}${regions.length ? `, covering ${joinNatural(regions)}` : ""}.`);
  if (input.service_model === "co_managed") parts.push("The operating model is co-managed.");
  if (input.service_model === "diy") parts.push("The operating model is self-managed, run by our own team.");
  const intent = INTENT_PHRASE[input.intent];
  if (intent) parts.push(intent);
  const required = input.required_features.map((id) => featureNames[id] ?? "").filter(Boolean).slice(0, 8);
  if (required.length) parts.push(`Required capabilities: ${joinNatural(required)}.`);
  const preferred = input.preferred_features.map((id) => featureNames[id] ?? "").filter(Boolean).slice(0, 6);
  if (preferred.length) parts.push(`Preferred: ${joinNatural(preferred)}.`);
  const clouds = input.required_clouds.map((key) => CLOUD_PHRASE[key]);
  if (clouds.length) parts.push(`Cloud estate: ${joinNatural(clouds)}.`);
  if (input.disaster_recovery_required) parts.push("Disaster recovery is required.");
  if (input.uk_provider_only) parts.push("The contract holder must be a UK-registered provider.");
  if (input.max_deployment_speed !== "any") parts.push(`Deployment must complete within ${input.max_deployment_speed}.`);
  const typed = clean(requirementText);
  if (typed) parts.push(typed);
  return clean(parts.join(" ")).slice(0, 1200);
}

export type EngineHandoff = {
  url: string;
  sentence: string;
  vendors: string[];
  sector: string | null;
  scope: "sase" | "sdwan" | null;
  mode: EngineHandoffMode;
};

export function buildEngineHandoff(args: {
  input: ShortlistInput;
  vendorSlugs: string[];
  featureNames?: Record<string, string>;
  requirementText?: string;
  mode: EngineHandoffMode;
}): EngineHandoff {
  const vendors = [...new Set(args.vendorSlugs.map((slug) => slug.trim().toLowerCase()).filter((slug) => /^[a-z0-9-]{2,60}$/.test(slug)))].slice(0, 5);
  const sentence = requirementSentence(args.input, args.featureNames, args.requirementText);
  const sector = args.input.sector ? WORKSPACE_SECTOR_LABEL[args.input.sector] : null;
  const scope = scopeForInput(args.input);
  const params = new URLSearchParams();
  params.set("q", sentence);
  if (vendors.length) params.set("vendors", vendors.join(","));
  if (sector) params.set("sector", sector);
  if (scope) params.set("scope", scope);
  params.set("source", `shortlist-${args.mode.replace("_", "-")}`);
  params.set("handoff", ENGINE_HANDOFF_VERSION);
  return { url: `${ENGINE_URL}?${params.toString()}`, sentence, vendors, sector, scope, mode: args.mode };
}
