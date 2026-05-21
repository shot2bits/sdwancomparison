import { z } from "zod";

export const VendorSchema = z
  .object({
    slug: z.string(),
    name: z.string(),
    tagline: z.string(),
    website: z.string(),
    founded: z.number(),
    headquarters: z.string(),

    provider_types: z.array(
      z.enum([
        "technology_vendor",
        "cloud_native_sase_vendor",
        "carrier_managed_provider",
        "msp_integrator",
      ]),
    ),
    operating_models: z.array(z.enum(["diy", "fully_managed", "co_managed"])),
    architecture: z.enum([
      "internet_overlay_only",
      "public_pops",
      "private_pops",
      "private_global_backbone",
    ]),
    edge_form_factors: z.array(
      z.enum(["physical", "virtual", "cloud_image", "container", "ucpe"]),
    ),
    cellular_5g_support: z.boolean(),

    sase_depth: z.enum([
      "none",
      "partial",
      "native_single_platform",
      "partner_integrated",
    ]),
    native_sase_components: z.array(
      z.enum([
        "ngfw",
        "swg",
        "casb",
        "ztna",
        "fwaas",
        "dlp",
        "dns_security",
        "rbi",
        "threat_prevention",
      ]),
    ),
    sse_ecosystem_integrations: z.array(
      z.enum([
        "zscaler",
        "netskope",
        "palo_alto_prisma",
        "cisco_secure_access",
        "cloudflare",
      ]),
    ),
    cloud_on_ramp_partners: z.array(
      z.enum(["aws", "azure", "gcp", "oracle", "equinix", "megaport"]),
    ),

    underlay_management: z.enum([
      "fully_owned",
      "partner_coordinated",
      "customer_managed",
    ]),
    noc_coverage: z.enum(["24_7", "business_hours", "none"]),
    soc_coverage: z.enum(["24_7", "business_hours", "none"]),

    geographic_strength: z.array(
      z.enum([
        "global",
        "emea",
        "north_america",
        "apac",
        "latam",
        "africa",
        "uk",
        "europe",
      ]),
    ),
    industry_focus: z.array(z.string()),

    pricing_tier: z.enum([
      "smb",
      "mid_market",
      "enterprise",
      "mid_market_to_enterprise",
    ]),
    typical_site_count: z.string(),

    key_differentiators: z.array(z.string()),
    best_fit_for: z.array(z.string()),
    watch_outs: z.array(z.string()),

    last_verified: z.string(),
    verification_notes: z.string(),
  })
  .strict();

export type Vendor = z.infer<typeof VendorSchema>;
