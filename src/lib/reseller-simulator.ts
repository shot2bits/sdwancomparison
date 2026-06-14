/**
 * Revenue simulator tool for the partner agent.
 *
 * The confidential BT/Netify rate card lives server-only in the netify.co.uk
 * app (programme-data.server.ts). Rather than duplicate those rates here (which
 * would be a second copy of confidential data to keep in sync), this tool calls
 * the live calculator endpoint server-to-server. Single source of truth.
 */

import { z } from "zod";

export const SIM_PRODUCTS = ["fttp", "sogea", "sogea76"] as const;
export const SIM_DEAL_TYPES = ["new", "resign", "upgrade"] as const;
export const SIM_BUNDLES = ["solus", "bundled"] as const;

export const SimInputSchema = z.object({
  product: z.enum(SIM_PRODUCTS).default("fttp"),
  dealType: z.enum(SIM_DEAL_TYPES).default("new"),
  bundle: z.enum(SIM_BUNDLES).default("solus"),
  contractLengthMonths: z.union([z.literal(36), z.literal(60)]).default(36),
  threatProtectionDevicesPerOrder: z.number().int().min(0).max(20).default(0),
  dealsPerMonth: z.number().int().min(0).max(100).default(1),
}).strict();
export type SimInput = z.infer<typeof SimInputSchema>;

export type SimOutput = {
  perDealCommission: number;
  perDealBreakdown: { broadband: number; cve: number; threatProtection: number };
  broadbandContractSov: number;
  annualCommissionAtMonthlyRunRate: number;
  scenarioUrl?: string;
};

const CALC_URL = (process.env.NETIFY_SITE_URL ?? "https://netify.co.uk").replace(/\/$/, "") + "/api/calculate";

/** Run the live commission calculator. Returns null on any failure so the agent
 *  degrades gracefully (it reports it could not model the scenario). */
export async function runSimulator(raw: unknown): Promise<SimOutput | null> {
  const parsed = SimInputSchema.safeParse(raw ?? {});
  const input = parsed.success ? parsed.data : SimInputSchema.parse({});
  try {
    const res = await fetch(CALC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as SimOutput;
    return data;
  } catch {
    return null;
  }
}
