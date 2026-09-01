import { z } from "zod";

export const PROJECT_ENTRANCE_CONTRACT_VERSION = "project-entrance/1.0.0" as const;

export const PROJECT_ENTRANCE_SOURCES = [
  "rfp_builder",
  "shortlist",
  "marketplace",
  "sector",
  "mcp",
] as const;

export const ProjectEntranceContextSchema = z.object({
  version: z.literal(PROJECT_ENTRANCE_CONTRACT_VERSION),
  source: z.enum(PROJECT_ENTRANCE_SOURCES),
  source_url: z.string().default(""),
  captured_at: z.number(),
  requirement_text: z.string().default(""),
  sector: z.string().nullable().default(null),
  marketplace_slug: z.string().nullable().default(null),
  vendor_slugs: z.array(z.string()).default([]),
  /** Normalised fields used to seed ProjectDetails.buyer. */
  buyer_input: z.record(z.string(), z.unknown()).default({}),
  /** Complete shortlist state when the source is a shortlist. */
  shortlist_input: z.record(z.string(), z.unknown()).nullable().default(null),
  /** Lossless, JSON-safe source payload. Never reconstructed from prose. */
  raw_input: z.record(z.string(), z.unknown()),
}).strict();

export type ProjectEntranceContext = z.infer<typeof ProjectEntranceContextSchema>;
