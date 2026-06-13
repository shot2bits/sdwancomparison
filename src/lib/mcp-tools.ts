/**
 * MCP tool definitions and handlers. The logic core lives in
 * src/lib/shortlist-core.ts; handlers here only validate and dispatch.
 */

import { FEATURES, FEATURE_NAMES, getShortlistDataset, getVendor, getAllVendorSlugs } from "@/lib/vendors";
import { buildShortlist } from "@/lib/shortlist-core";
import { SITE_URL } from "@/lib/structured-data";

export const MCP_TOOL_DEFINITIONS = [
  {
    name: "build_sase_shortlist",
    description:
      "Build a ranked SASE and SD-WAN provider shortlist from 30 vendors graded by Netify. Hard requirements exclude vendors without public evidence; everything else feeds a weighted score. Returns ranked vendors with reasoning, gaps and watch-outs, plus a canonical shareable URL.",
    inputSchema: {
      type: "object",
      properties: {
        service_model: { type: "string", enum: ["managed", "co_managed", "diy", "any"], description: "Operating model requirement." },
        required_features: { type: "array", items: { type: "string" }, description: "Feature ids (f01 to f40) that are hard requirements. Call list_sase_features for the catalogue." },
        preferred_features: { type: "array", items: { type: "string" }, description: "Feature ids given extra scoring weight." },
        required_regions: { type: "array", items: { type: "string", enum: ["uk_ireland", "europe", "north_america", "asia_pacific", "middle_east_africa", "latin_america", "china_mainland"] } },
        required_clouds: { type: "array", items: { type: "string", enum: ["aws", "azure", "gcp", "oracle_cloud", "alibaba_cloud"] } },
        ai_requirements: { type: "array", items: { type: "string", enum: ["ai_driven_operations", "ai_security_analytics", "ai_assistant"] } },
        disaster_recovery_required: { type: "boolean" },
        max_deployment_speed: { type: "string", enum: ["hours", "days", "weeks", "months", "any"] },
        weight_preset: { type: "string", enum: ["balanced", "security_led", "network_led", "cloud_first", "managed_service_led"] },
        shortlist_size: { type: "integer", minimum: 3, maximum: 30 },
        sector: { type: "string", enum: ["healthcare", "financial_services", "retail_ecommerce", "manufacturing", "energy_utilities", "government_public_sector", "education", "transport_logistics", "professional_services", "hospitality_leisure"], description: "Filter to vendors with evidence of capability in this sector." },
        organisation_size: { type: "string", enum: ["large_global_enterprise", "mid_market", "small_business", "any"] },
        intent: { type: "string", enum: ["cost_saving", "mpls_migration", "rapid_deployment", "remote_workforce", "security_consolidation", "global_expansion", "none"], description: "Buyer priority; adjusts scoring weights and preferred features." },
        uk_provider_only: { type: "boolean", description: "Restrict to providers with a UK contracting entity (UK HQ or UK-registered arm). Off by default; global vendors with UK PoPs and partner delivery are otherwise included." },
      },
      required: [],
    },
  },
  {
    name: "list_sase_features",
    description:
      "List the 40-feature evaluation catalogue (id, name, category, definition) used to grade every vendor, plus the extended dimensions (regions, clouds, AI capability, resilience, deployment speed).",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_sase_vendors",
    description:
      "List all 30 graded SASE and SD-WAN vendors with slug, name, category and evidence coverage.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_sase_vendor_profile",
    description:
      "Full Netify capability profile for one vendor: all 40 feature grades, regions, clouds, AI capability, resilience, deployment speed, differentiators, best fit and watch-outs.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "Vendor slug, e.g. cato-networks. Call list_sase_vendors for valid slugs." } },
      required: ["slug"],
    },
  },
] as const;

export function callMcpTool(name: string, args: unknown): unknown {
  switch (name) {
    case "build_sase_shortlist": {
      const result = buildShortlist(getShortlistDataset(), args ?? {}, FEATURE_NAMES);
      return {
        ...result,
        _meta: {
          canonicalUrl: `${SITE_URL}/shortlist`,
          note: "Reproduce this shortlist in a browser by applying the same criteria at the canonical URL.",
        },
      };
    }
    case "list_sase_features":
      return {
        features: FEATURES,
        extended_dimensions: {
          regions: ["uk_ireland", "europe", "north_america", "asia_pacific", "middle_east_africa", "latin_america", "china_mainland"],
          clouds: ["aws", "azure", "gcp", "oracle_cloud", "alibaba_cloud"],
          ai: ["ai_driven_operations", "ai_security_analytics", "ai_assistant"],
          other: ["disaster_recovery", "deployment_speed"],
        },
        _meta: { canonicalUrl: `${SITE_URL}/shortlist` },
      };
    case "list_sase_vendors":
      return {
        vendors: getShortlistDataset().map((v) => ({
          slug: v.slug,
          name: v.name,
          category: v.category,
          evidence_coverage_pct: v.evidence_coverage_pct,
          profile_url: `${SITE_URL}/vendors/${v.slug}`,
        })),
        _meta: { canonicalUrl: `${SITE_URL}/vendors` },
      };
    case "get_sase_vendor_profile": {
      const slug = (args as { slug?: string })?.slug ?? "";
      if (!getAllVendorSlugs().includes(slug)) {
        return { error: `Unknown vendor slug: ${slug}. Call list_sase_vendors for valid slugs.` };
      }
      const v = getVendor(slug);
      return { ...v, _meta: { canonicalUrl: `${SITE_URL}/vendors/${slug}` } };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
