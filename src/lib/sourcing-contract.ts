import { z } from "zod";
import { REGION_KEYS, SECTOR_KEYS } from "./shortlist-core";
export const SOURCING_VERSION = "netify-sourcing/1.0.0";
export const SOURCING_TITLE =
  "Get comparable SD-WAN and SASE proposals from UK providers";
// Working copy for Harry's editorial approval before production.
export const SOURCING_DESCRIPTION =
  "Use Netify to request comparable proposals, demos and pre-sales introductions from named SD-WAN and SASE providers. Research is open, and you approve each request before a supplier receives it. SD-WAN provides the connectivity component of SASE.";
export const COMMISSION_DESCRIPTION =
  "Netify is paid by suppliers when an introduction leads to business. Commission never affects the evidence order.";
export const SourcingBriefSchema = z.object({
  sites: z.number().int().min(1).max(100000),
  remote_users: z.number().int().min(0).max(1000000),
  region: z.enum(REGION_KEYS),
  sector: z.enum(SECTOR_KEYS).nullable(),
  need: z.enum(["sdwan", "sase", "secure_access", "help_deciding"]),
  when: z.string().min(1).max(120),
  requirement: z.string().max(12000).default(""),
  // This text is separately reviewed for anonymous sharing; do not reuse pasted documents silently.
  supplier_brief: z.string().max(12000).default(""),
});
export type SourcingBrief = z.infer<typeof SourcingBriefSchema>;
export const SourcingRequestSchema = z
  .object({
    brief: SourcingBriefSchema,
    recipients: z
      .array(
        z.object({
          slug: z.string().min(1).max(120),
          actions: z
            .array(z.enum(["contacts", "demo", "proposals"]))
            .min(1)
            .max(3),
        }),
      )
      .max(30),
    email: z
      .string()
      .email()
      .max(254)
      .transform((s) => s.trim().toLowerCase()),
    consent: z.literal(true),
    anonymous: z.literal(true),
    acquisition: z
      .enum([
        "web",
        "chatgpt",
        "gemini",
        "perplexity",
        "copilot",
        "mcp",
        "other",
      ])
      .default("web"),
    idempotency_key: z.string().uuid(),
  })
  .strict();
export type SourcingRequest = z.infer<typeof SourcingRequestSchema>;
export function validateRecipients(input: SourcingRequest, slugs: string[]) {
  const seen = new Set<string>();
  for (const recipient of input.recipients) {
    if (!slugs.includes(recipient.slug) || seen.has(recipient.slug))
      throw new Error("Choose each researched provider at most once.");
    seen.add(recipient.slug);
    if (new Set(recipient.actions).size !== recipient.actions.length)
      throw new Error("Choose each action at most once.");
  }
  if (input.recipients.length && !input.brief.supplier_brief.trim())
    throw new Error(
      "Review the anonymous supplier brief before approving recipients.",
    );
}
export type PanelMember = {
  slug: string;
  contact_name: string;
  contact_email: string;
  response_working_days: number;
  terms_version: string;
  acknowledged_at: string;
  active: boolean;
};
export function responsePanelMember(member: PanelMember | undefined) {
  return Boolean(
    member?.active &&
      member.contact_name &&
      member.contact_email &&
      member.response_working_days > 0 &&
      member.terms_version &&
      member.acknowledged_at,
  );
}
export const PUBLIC_SOURCING_TOOLS = [
  "prepare_sourcing_plan",
  "request_comparable_proposals",
  "get_sourcing_request_status",
] as const;

export const PRIVATE_CIRCUIT_CONSENT = "Ask Netify to review these private connectivity requirements within my sourcing project. No public notice is created. Supplier recipients and any identifying details must be approved before disclosure. This is not an order.";
