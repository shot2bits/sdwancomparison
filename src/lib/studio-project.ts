import {createHash} from 'node:crypto';
/** Studio is a renderer of ProjectDetails, not a second project store. */
import { z } from "zod";
import { canonicalQuestions } from "./rfp-question-bank";
import {
  ProjectDetailsSchema,
  RfpSectionSchema,
  type ProjectDetails,
} from "./rfp-types";
import {
  EMPTY_STUDIO_DRAFT,
  STUDIO_REGIONS,
  studioReadiness,
  studioPublicNotice,
  type StudioDraft,
} from "./opportunity-studio";

export const STUDIO_CONTRACT = "opportunity-studio/1";
export const STUDIO_SUPPLIER_CONSENT =
  "I have removed identifying details from my requirement and approve sharing this reviewed requirement with signed-in, approved suppliers.";
export const StudioDraftSchema = z
  .object({
    format: z.enum(["rfi", "rfp"]),
    requirement: z.string().max(20000),
    scope: z.enum(["", "SASE", "SD-WAN", "SSE"]),
    sites: z.string().max(8).regex(/^\d*$/),
    users: z.string().max(8).regex(/^\d*$/),
    regions: z.array(z.enum(STUDIO_REGIONS as [string, ...string[]])).max(7),
    timescale: z.enum([
      "",
      "Within 3 months",
      "3–6 months",
      "6–12 months",
      "Not decided",
    ]),
    service: z.enum([
      "",
      "Fully managed",
      "Co-managed",
      "Self-managed",
      "Open to advice",
    ]),
    responseDays:z.union([z.literal(7),z.literal(14),z.literal(21),z.literal(30),z.literal(60)]).optional(),
    questionIds: z.array(z.string()).max(100),
  })
  .strict()
  .superRefine((d, c) => {
    const valid = new Set(canonicalQuestions().map((q) => q.id));
    if (d.questionIds.some((id) => !valid.has(id)))
      c.addIssue({ code: "custom", message: "Unknown supplier question." });
    if (Number(d.sites) > 20000)
      c.addIssue({ code: "custom", message: "Use up to 20,000 sites." });
  });
const regionKeys = ["uk", "eu", "us", "apac", "me", "latam", "china"];
const scopeKeys: Record<string, string> = {
  SASE: "full_sase",
  "SD-WAN": "sdwan_only",
  SSE: "sse_only",
  "": "not_stated",
};
const serviceKeys: Record<string, string> = {
  "Fully managed": "managed",
  "Co-managed": "co_managed",
  "Self-managed": "in_house",
  "Open to advice": "any",
  "": "any",
};
export function isStudioProject(p: Pick<ProjectDetails, "entrance_context">) {
  return p.entrance_context?.raw_input.studio_contract === STUDIO_CONTRACT;
}
export function studioDraftFromProject(p: ProjectDetails): StudioDraft {
  const raw = p.entrance_context?.raw_input ?? {};
  return {
    ...EMPTY_STUDIO_DRAFT,
    format: raw.document_purpose === "rfp" ? "rfp" : "rfi",
    requirement: p.buyer.notes,
    scope: (Object.keys(scopeKeys).find(
      (k) => scopeKeys[k] === p.buyer.product_scope,
    ) ?? "") as StudioDraft["scope"],
    service: (Object.keys(serviceKeys).find(
      (k) => serviceKeys[k] === p.buyer.operating_model,
    ) ?? "Open to advice") as StudioDraft["service"],
    sites: p.buyer.site_count ? String(p.buyer.site_count) : "",
    users: typeof raw.studio_users === "string" ? raw.studio_users : "",
    regions: p.buyer.regions
      .map((r) => STUDIO_REGIONS[regionKeys.indexOf(r)])
      .filter(Boolean),
    timescale: typeof raw.timescale === "string" ? raw.timescale : "",
    ...(typeof raw.studio_response_days==="number"?{responseDays:raw.studio_response_days}:{}),
    questionIds: p.rfp_sections.flatMap((s) => s.questions.map((q) => q.id)),
  };
}
export function studioFields(
  raw: unknown,
  existing: ProjectDetails | null = null,
) {
  const d = StudioDraftSchema.parse(raw);
  // Existing ledgers cannot be replaced by a simpler form. Their original editor remains available.
  if (
    existing &&
    (existing.facts.length ||
      existing.procurement_document ||
      existing.envelope)
  )
    throw new Error(
      "This project uses the detailed workspace. Continue in its original editor; its history is preserved.",
    );
  const bank = canonicalQuestions().filter((q) => d.questionIds.includes(q.id));
  const sections = [...new Set(bank.map((q) => q.category))].map((category) =>
    RfpSectionSchema.parse({
      category,
      included: d.format === "rfp",
      questions: bank
        .filter((q) => q.category === category)
        .map((q) => ({
          ...q,
          category: undefined,
          feature_id: "",
          priority: "required",
          source: "bank",
        }))
        .map(({ category: _category, ...q }) => {
          void _category;
          return q;
        }),
    }),
  );
  const buyer = {
    ...existing?.buyer,
    notes: d.requirement,
    product_scope: scopeKeys[d.scope],
    operating_model: serviceKeys[d.service],
    site_count: Number(d.sites) || null,
    regions: d.regions.map((r) => regionKeys[STUDIO_REGIONS.indexOf(r)]),
  };
  const metadata = {
    studio_contract: STUDIO_CONTRACT,
    document_purpose: d.format,
    studio_users: d.users,
    ...(d.responseDays!==undefined?{studio_response_days:d.responseDays}:{}),
    timescale: d.timescale,
    studio_review_revision: null,
    studio_review_hash:null,
  };
  return {
    buyer,
    rfp_sections: sections,
    title: studioPublicNotice(d).title,
    metadata,
  };
}
export function applyStudioFields(
  p: ProjectDetails,
  raw: unknown,
): ProjectDetails {
  const f = studioFields(raw, p);
  const { studio_draft: _draft, ...rawInput } =
    p.entrance_context?.raw_input ?? {};
  void _draft;
  return ProjectDetailsSchema.parse({
    ...p,
    buyer: f.buyer,
    rfp_sections: f.rfp_sections,
    title: f.title,
    ...(typeof f.metadata.studio_response_days==="number"?{response_deadline:Date.now()+f.metadata.studio_response_days*86400000}:{}),
    entrance_context: {
      ...p.entrance_context,
      requirement_text: f.buyer.notes,
      buyer_input: f.buyer,
      raw_input: { ...rawInput, ...f.metadata },
    },
    journey: {
      ...p.journey,
      mode: f.metadata.document_purpose === "rfp" ? "build_rfp" : "quick_list",
    },
  });
}
export function studioPublicationReadiness(p: ProjectDetails) {
  const reasons = studioReadiness(
    studioDraftFromProject(p),
    canonicalQuestions(),
  );
  if (p.buyer.organisation.trim().length < 2)
    reasons.push("Confirm your company name (private).");
  return { allowed: reasons.length === 0, reasons };
}

export function studioReviewHash(p:ProjectDetails){return createHash("sha256").update(JSON.stringify(studioDraftFromProject(p))).digest("hex");}
