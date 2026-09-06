import { z } from "zod";

export const ESTIMATE_DISCLOSURE = "Provisional modelling assumptions; calibration approval is outstanding. These illustrative bands are not validated market prices or supplier quotes.";
export const ESTIMATE_USERS_HELP = "Count everyone who needs a licence, including on-site and remote users. Do not enter only your remote-user count. Supported range: 50–250,000 licensed users.";
export const RegionEnum = z.enum(["uk-europe", "north-america", "apac", "middle-east-africa", "latam"]);
export const EstimateInput = z.object({
  users: z.number().int("Enter a whole number of licensed users.").min(50, "This model supports at least 50 licensed users. For a smaller estate, publish a project brief to request supplier pricing.").max(250000, "This model supports up to 250,000 licensed users."),
  sites: z.number().int("Enter a whole number of sites.").min(1, "Enter at least one site.").max(5000, "This model supports up to 5,000 sites."),
  regions: z.array(RegionEnum).nonempty("Select at least one region.").max(5).refine(r => new Set(r).size === r.length, "Select each region only once."),
  securityDepth: z.enum(["sse-only", "full-sase", "full-sase-plus-advanced"]),
  deliveryModel: z.enum(["managed", "co-managed", "diy"]),
  termYears: z.union([z.literal(1), z.literal(3), z.literal(5)]),
});
export type EstimateInputT = z.infer<typeof EstimateInput>;
