/**
 * Netify SASE TCO estimator engine — Methodology v2026.1
 * Pure and deterministic: same input always produces the same output.
 * All economics live in data/estimator-bands-2026-1.json; nothing is priced in code.
 * Output is a band [low, high], never a point figure, and never a vendor quote.
 */
import { z } from "zod";
import bands from "./data/estimator-bands-2026-1.json";

export const RegionEnum = z.enum([
  "uk-europe",
  "north-america",
  "apac",
  "middle-east-africa",
  "latam",
]);

export const EstimateInput = z.object({
  users: z.number().int().min(50).max(250000),
  sites: z.number().int().min(1).max(5000),
  regions: z.array(RegionEnum).nonempty().max(5)
    .refine((r) => new Set(r).size === r.length, "regions must be unique"),
  securityDepth: z.enum(["sse-only", "full-sase", "full-sase-plus-advanced"]),
  deliveryModel: z.enum(["managed", "co-managed", "diy"]),
  termYears: z.union([z.literal(1), z.literal(3), z.literal(5)]),
});
export type EstimateInputT = z.infer<typeof EstimateInput>;

export type Band = [number, number];

export interface EstimateResult {
  monthlyBandGBP: Band;
  threeYearTcoBandGBP: Band;
  byDriver: {
    usersAndDevices: Band;
    securityDepth: Band;
    sitesAndRegions: Band;
    bandwidthProfile: Band;
    deliveryModel: Band;
    implementationAndMigration: Band; // amortised monthly at the chosen term
    hiddenAndRecurring: Band;
  };
  oneOffImplementationBandGBP: Band;
  methodologyVersion: string;
  disclaimer: string;
  notes: string[];
}

const B = bands;

function volumeMultiplier(users: number): Band {
  for (const tier of B.volumeMultiplierByUsers) {
    if (users <= tier.maxUsers) return [tier.low, tier.high];
  }
  const last = B.volumeMultiplierByUsers[B.volumeMultiplierByUsers.length - 1];
  return [last.low, last.high];
}

const mul = (a: Band, b: Band): Band => [a[0] * b[0], a[1] * b[1]];
const add = (a: Band, b: Band): Band => [a[0] + b[0], a[1] + b[1]];
const scale = (a: Band, k: number): Band => [a[0] * k, a[1] * k];
const pct = (a: Band, p: Band): Band => [a[0] * (p[0] / 100), a[1] * (p[1] / 100)];
const roundBand = (a: Band, nearest: number): Band => [
  Math.round(a[0] / nearest) * nearest,
  Math.round(a[1] / nearest) * nearest,
];
const band = (o: { low: number; high: number }): Band => [o.low, o.high];

/** Core estimate at a given term (used for both the chosen-term monthly view and the fixed 3-year TCO). */
function coreMonthly(input: EstimateInputT, termYears: 1 | 3 | 5) {
  const vol = volumeMultiplier(input.users);
  const termKey = String(termYears) as "1" | "3" | "5";
  const term = band(B.termMultiplier[termKey]);

  // Per-user licensing, split so the driver attribution is honest
  const network = scale(mul(band(B.perUserMonthly.baseNetworking), vol), input.users);
  const security = scale(
    mul(band(B.perUserMonthly.securityByDepth[input.securityDepth]), vol),
    input.users
  );

  // Sites, then regional loading on the licence + site subtotal
  const sitesBase = scale(band(B.perSiteMonthly), input.sites);
  const extraRegions = Math.max(0, input.regions.length - 1);
  const loadCfg = B.additionalRegionLoadingPct;
  const regionPct: Band = [
    Math.min(loadCfg.low * extraRegions, loadCfg.capPct),
    Math.min(loadCfg.high * extraRegions, loadCfg.capPct),
  ];
  const licenceAndSites = add(add(network, security), sitesBase);
  const regionLoad = pct(licenceAndSites, regionPct);
  const sitesAndRegions = add(sitesBase, regionLoad);

  const subtotal = add(add(network, security), sitesAndRegions);
  const bandwidth = pct(subtotal, band(B.bandwidthLoadingPct[input.deliveryModel]));
  const delivery = pct(subtotal, band(B.deliveryFeePctOfSubtotal[input.deliveryModel]));
  const hidden = pct(subtotal, band(B.hiddenRecurringLoadingPct[input.deliveryModel]));

  // Recurring monthly (term discount applies to recurring charges)
  const recurring = mul(add(add(add(subtotal, bandwidth), delivery), hidden), term);

  // One-off implementation
  const impl = B.implementationOneOff;
  const oneOffRaw = add(
    add(scale(band(impl.perUser), input.users), scale(band(impl.perSite), input.sites)),
    [0, 0]
  );
  const oneOffFloored: Band = [
    Math.max(oneOffRaw[0], impl.minimum.low),
    Math.max(oneOffRaw[1], impl.minimum.high),
  ];
  const oneOff = mul(oneOffFloored, band(impl.deliveryMultiplier[input.deliveryModel]));
  const implMonthly = scale(oneOff, 1 / (termYears * 12));

  return {
    drivers: {
      usersAndDevices: mul(network, term),
      securityDepth: mul(security, term),
      sitesAndRegions: mul(sitesAndRegions, term),
      bandwidthProfile: mul(bandwidth, term),
      deliveryModel: mul(delivery, term),
      implementationAndMigration: implMonthly,
      hiddenAndRecurring: mul(hidden, term),
    },
    monthly: add(recurring, implMonthly),
    recurringMonthly: recurring,
    oneOff,
  };
}

export function estimate(raw: unknown): EstimateResult {
  const input = EstimateInput.parse(raw);

  const chosen = coreMonthly(input, input.termYears);
  const threeYr = coreMonthly(input, 3);
  const tco = add(scale(threeYr.recurringMonthly, 36), threeYr.oneOff);

  const rM = B.rounding.monthlyNearest;
  const rT = B.rounding.tcoNearest;

  const notes: string[] = [B.reviewNote];
  const diyNote = B.deliveryFeePctOfSubtotal.diy.internalOpsNote;
  if (input.deliveryModel === "diy" && diyNote) notes.push(diyNote);

  return {
    monthlyBandGBP: roundBand(chosen.monthly, rM),
    threeYearTcoBandGBP: roundBand(tco, rT),
    byDriver: {
      usersAndDevices: roundBand(chosen.drivers.usersAndDevices, rM),
      securityDepth: roundBand(chosen.drivers.securityDepth, rM),
      sitesAndRegions: roundBand(chosen.drivers.sitesAndRegions, rM),
      bandwidthProfile: roundBand(chosen.drivers.bandwidthProfile, rM),
      deliveryModel: roundBand(chosen.drivers.deliveryModel, rM),
      implementationAndMigration: roundBand(chosen.drivers.implementationAndMigration, rM),
      hiddenAndRecurring: roundBand(chosen.drivers.hiddenAndRecurring, rM),
    },
    oneOffImplementationBandGBP: roundBand(chosen.oneOff, rT),
    methodologyVersion: B.methodologyVersion,
    disclaimer: B.disclaimer,
    notes,
  };
}
