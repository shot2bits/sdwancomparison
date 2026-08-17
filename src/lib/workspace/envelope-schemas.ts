/**
 * Client-safe envelope schemas, split out of envelope.ts (17 Aug 2026 build
 * fix). `WorkspaceFactSchema` and `ReceiptLikeSchema` are the only two
 * exports rfp-types.ts needs, and rfp-types.ts is reachable from
 * RfpBuilder.tsx ("use client") via the ProjectDetails type chain. Keeping
 * them here -- a file with zero Node-only imports -- means that reachable
 * chain never pulls in envelope.ts's own `import crypto from "node:crypto"`
 * (used only by `envelopeContentHash`, a server-only hashing helper).
 * Without this split, Next's client webpack build fails outright:
 * `UnhandledSchemeError: Reading from "node:crypto" is not handled by
 * plugins` -- confirmed against the real Vercel build log for commit
 * eb95d5c, not just this sandbox. envelope.ts re-exports both symbols so
 * every existing server-side import keeps working unchanged.
 */

import { z } from "zod";
import { ALLOWED_PATHS } from "@/lib/workspace/extract";

/**
 * Validates against the REAL `ALLOWED_PATHS` whitelist (extract.ts),
 * exported for exactly this purpose -- never a second, hand-copied list
 * that could silently drift from the real one.
 *
 * `value` is deliberately `z.unknown()`: `AllowedPath` covers a genuinely
 * heterogeneous set of value shapes (numbers, strings, string arrays) by
 * design (the same reason `LivingProcurementDocumentSchema.factSnapshot`
 * is permissive) -- every OTHER field on a fact is fully, strictly
 * validated.
 */
export const WorkspaceFactSchema = z
  .object({
    id: z.string().min(1),
    path: z.enum(ALLOWED_PATHS),
    value: z.unknown(),
    provenance: z.enum(["stated", "inferred"]),
    quote: z.string().optional(),
    reason: z.string().optional(),
    matchedText: z.string().optional(),
    matchStart: z.number().optional(),
    struck: z.boolean(),
    source: z.enum(["extract", "answer", "link"]),
    cycle: z.number(),
  })
  .strict();

export const ReceiptLikeSchema = z
  .object({
    id: z.number(),
    text: z.string(),
    sourceTurnId: z.string().nullable().optional(),
  })
  .strict();
