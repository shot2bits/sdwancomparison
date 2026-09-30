import {
  SourcingBriefSchema,
  SourcingRequestSchema,
} from "./sourcing-contract";
import { publicShortlistPreview } from "./public-shortlist";
import { getLiveShortlistDataset } from "./live-shortlist";
import { requestSourcing, readSourcingRequest } from "./sourcing-store";
import { z } from "zod";
export const SOURCING_TOOL_DEFINITIONS = [
  {
    name: "prepare_sourcing_plan",
    description:
      "Prepare a Netify sourcing plan from a buyer brief. Returns open named evidence matches and outstanding supplier checks. Read-only, no account or publication required; does not contact suppliers.",
    inputSchema: z.toJSONSchema(SourcingBriefSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "request_comparable_proposals",
    description:
      "Ask Netify to coordinate contacts, demos or comparable proposals for the explicitly approved providers. Sends a request-specific confirmation to the buyer work email. Requires consent:true and a reviewed anonymous supplier brief. The buyer confirms by email before desk review; this tool cannot trigger supplier introductions or bypass identity confirmation.",
    inputSchema: z.toJSONSchema(SourcingRequestSchema, { io: "input" }),
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "get_sourcing_request_status",
    description:
      "Read the status of an authorised sourcing request with its private request token. Never returns buyer contact details or the unredacted brief.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        token: { type: "string", minLength: 40, maxLength: 100 },
      },
      required: ["id", "token"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];
export const SOURCING_TOOL_NAMES = new Set(
  SOURCING_TOOL_DEFINITIONS.map((t) => t.name),
);
export async function callSourcingTool(
  name: string,
  args: unknown,
  requestKey: string,
) {
  if (name === "request_comparable_proposals")
    return requestSourcing(
      { ...SourcingRequestSchema.parse(args), acquisition: "mcp" },
      requestKey,
    );
  if (name === "get_sourcing_request_status") {
    const p = z
      .object({ id: z.string().uuid(), token: z.string().min(40).max(100) })
      .strict()
      .parse(args);
    const r = await readSourcingRequest(p.id, p.token);
    return { request_id: r.id, status: r.status };
  }
  if (name !== "prepare_sourcing_plan")
    throw new Error("Unsupported sourcing action");
  const b = SourcingBriefSchema.parse(args);
  const live = await getLiveShortlistDataset();
  return {
    brief: b,
    ...publicShortlistPreview(live.vendors, {
      sector: b.sector,
      required_regions: [b.region],
      required_features:
        b.need === "sdwan"
          ? ["f09_encrypted_overlay_fabric"]
          : b.need === "sase"
            ? ["f28_full_sase_platform"]
            : b.need === "secure_access"
              ? ["f30_zero_trust_network_access"]
              : [],
    }),
    next_action:
      "Review the evidence, agree named recipients and an anonymous supplier brief. Ask Netify to resolve missing evidence; no provider is a confirmed recommendation.",
  };
}
