import { z } from "zod";

/**
 * Pricing portal data model (feat/pricing-portal, 16 July 2026).
 * A buyer describes their estate site by site; matched or chosen providers
 * bid; the room shows pending and received pricing. Open to build and read
 * in public shape; contacts and bid values are private to the manage key.
 * Nothing ships to production until the programme is released.
 */

export const CIRCUIT_TYPES = ["fttp", "ethernet", "broadband", "wireless_5g", "satellite", "none"] as const;
export const CircuitSchema = z.object({
  type: z.enum(CIRCUIT_TYPES).default("ethernet"),
  bandwidth_mbps: z.number().int().min(0).max(100000).default(100),
});
export type Circuit = z.infer<typeof CircuitSchema>;

/** International address: free-form lines plus structured city/region/postal/country. */
export const AddressSchema = z.object({
  line1: z.string().max(120).default(""),
  line2: z.string().max(120).default(""),
  city: z.string().max(80).default(""),
  region: z.string().max(80).default(""),
  postal_code: z.string().max(20).default(""),
  country: z.string().max(60).default("United Kingdom"),
});
export type Address = z.infer<typeof AddressSchema>;

export const SiteSchema = z.object({
  id: z.string().default(""),
  name: z.string().max(80).default("Site"),
  site_type: z.enum(["hq", "branch", "data_centre", "warehouse", "retail", "other"]).default("branch"),
  address: AddressSchema.default({ line1: "", line2: "", city: "", region: "", postal_code: "", country: "United Kingdom" }),
  contact_name: z.string().max(80).default(""),
  contact_phone: z.string().max(40).default(""),
  users: z.number().int().min(0).max(100000).default(0),
  primary_circuit: CircuitSchema.default({ type: "ethernet", bandwidth_mbps: 100 }),
  failover_circuit: CircuitSchema.default({ type: "none", bandwidth_mbps: 0 }),
});
export type Site = z.infer<typeof SiteSchema>;

export const SASE_ELEMENTS = ["sdwan", "ztna", "swg", "casb", "fwaas", "dlp", "remote_access"] as const;
export const SASE_ELEMENT_LABELS: Record<(typeof SASE_ELEMENTS)[number], string> = {
  sdwan: "SD-WAN",
  ztna: "ZTNA",
  swg: "Secure web gateway",
  casb: "CASB",
  fwaas: "Firewall as a service",
  dlp: "DLP",
  remote_access: "Remote user access",
};

export const BidSchema = z.object({
  vendor_slug: z.string(),
  vendor_name: z.string().default(""),
  status: z.enum(["pending", "received", "declined"]).default("pending"),
  value: z.number().nullable().default(null),
  currency: z.string().default("GBP"),
  unit: z.enum(["per_user_month", "per_site_month", "total_month"]).default("per_user_month"),
  term_months: z.number().int().default(36),
  note: z.string().max(500).default(""),
  reason: z.string().max(200).default(""),
  at: z.number().default(0),
});
export type Bid = z.infer<typeof BidSchema>;

export const EstateSchema = z.object({
  id: z.string(),
  created: z.number(),
  updated: z.number(),
  status: z.enum(["draft", "submitted"]).default("draft"),
  manage_token: z.string(),
  service_model: z.enum(["managed", "co_managed", "diy"]).default("managed"),
  sase_elements: z.array(z.enum(SASE_ELEMENTS)).default(["sdwan", "ztna", "swg"]),
  vendor_slugs: z.array(z.string()).default([]),
  sites: z.array(SiteSchema).default([]),
  bids: z.array(BidSchema).default([]),
  owner_email: z.string().default(""),
  contact_email: z.string().default(""),
  business_name: z.string().max(120).default(""),
  first_name: z.string().max(60).default(""),
  last_name: z.string().max(60).default(""),
  consent: z.object({ version: z.string(), agreed_at: z.number() }).nullable().default(null),
  submitted_at: z.number().nullable().default(null),
});
export type Estate = z.infer<typeof EstateSchema>;

/**
 * The submission agreement. Indicative pricing is in the clear and needs
 * nothing; firm pricing is the identity moment. Bump the version when the
 * wording changes materially (same discipline as the RFP submit agreement).
 */
export const PRICING_TERMS_VERSION = "pricing-terms v1, 16 July 2026";
export const PRICING_TERMS_TEXT =
  "I agree that the providers invited to bid will populate pricing directly in this portal and that a vetted account manager from each may contact me with questions about my requirement. My details are shared only with those providers; pricing stays private to me and there is no obligation to award.";

export type IndicativeBand = {
  vendor_slug: string;
  vendor_name: string;
  category: string;
  unit: "per_user_month" | "per_site_month";
  low: number;
  high: number;
  currency: "GBP";
  basis: string;
};

/**
 * Public shape: safe for the open web and agents without the manage key.
 * Site contacts, precise address lines and bid values are stripped; bid
 * STATUSES stay visible so the pending-pricing story is in the clear.
 */
export function toPublicEstate(e: Estate) {
  return {
    id: e.id,
    status: e.status,
    created: e.created,
    updated: e.updated,
    service_model: e.service_model,
    sase_elements: e.sase_elements,
    site_count: e.sites.length,
    countries: Array.from(new Set(e.sites.map((s) => s.address.country).filter(Boolean))),
    total_users: e.sites.reduce((n, s) => n + (s.users || 0), 0),
    bids: e.bids.map((b) => ({ vendor_slug: b.vendor_slug, vendor_name: b.vendor_name, status: b.status, at: b.at })),
    submitted_at: e.submitted_at,
  };
}
