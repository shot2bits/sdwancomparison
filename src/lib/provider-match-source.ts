import { z } from "zod";
import { ProviderMatchRecordSchema, type ProviderMatchRecord } from "@/lib/provider-matching";

const ResponseSchema = z.object({
  contract_version: z.enum(["provider-match-records/1.0.0", "provider-match-records/2.0.0"]),
  providers: z.array(ProviderMatchRecordSchema),
}).strict();

export type ProviderMatchRecordFeed = {
  contractVersion: "provider-match-records/1.0.0" | "provider-match-records/2.0.0";
  providers: ProviderMatchRecord[];
};

export class ProviderMatchSourceUnavailable extends Error {}

export async function loadProviderMatchRecordFeed(): Promise<ProviderMatchRecordFeed> {
  const url = process.env.PROVIDER_MATCH_DATA_URL;
  const token = process.env.PROVIDER_MATCH_SERVICE_TOKEN;
  const protectionBypass = process.env.PROVIDER_MATCH_PROTECTION_BYPASS;
  if (!url || !token) throw new ProviderMatchSourceUnavailable("Provider matching source is not configured.");
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        ...(protectionBypass ? { "x-vercel-protection-bypass": protectionBypass } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new ProviderMatchSourceUnavailable("Provider matching source is unavailable.");
  }
  if (!response.ok) throw new ProviderMatchSourceUnavailable("Provider matching source rejected the request.");
  const parsed = ResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new ProviderMatchSourceUnavailable("Provider matching source returned an incompatible contract.");
  return { contractVersion: parsed.data.contract_version, providers: parsed.data.providers };
}

export async function loadProviderMatchRecords(): Promise<ProviderMatchRecord[]> {
  return (await loadProviderMatchRecordFeed()).providers;
}
