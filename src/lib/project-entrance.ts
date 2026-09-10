import { BuyerContextSchema, ProjectDetailsSchema, type ProjectDetails } from "@/lib/rfp-types";
import { ShortlistInputSchema, type ShortlistInput } from "@/lib/shortlist-core";
import {
  PROJECT_ENTRANCE_CONTRACT_VERSION,
  ProjectEntranceContextSchema,
  type ProjectEntranceContext,
} from "@/lib/project-entrance-contract";

type JsonRecord = Record<string, unknown>;

function cloneRecord(input: JsonRecord): JsonRecord {
  return structuredClone(input);
}

function context(input: Omit<ProjectEntranceContext, "version">): ProjectEntranceContext {
  return ProjectEntranceContextSchema.parse({ version: PROJECT_ENTRANCE_CONTRACT_VERSION, ...input });
}

export function rfpBuilderEntrance(input: {
  rawInput: JsonRecord;
  sourceUrl?: string;
  capturedAt?: number;
}): ProjectEntranceContext {
  const buyer = BuyerContextSchema.parse(input.rawInput.buyer ?? {});
  return context({
    source: "rfp_builder",
    source_url: input.sourceUrl ?? "",
    captured_at: input.capturedAt ?? Date.now(),
    requirement_text: typeof input.rawInput.requirement_text === "string" ? input.rawInput.requirement_text : "",
    sector: buyer.sector,
    marketplace_slug: null,
    vendor_slugs: [...buyer.pinned_vendors],
    buyer_input: structuredClone(buyer),
    shortlist_input: null,
    raw_input: cloneRecord(input.rawInput),
  });
}

export function shortlistEntrance(input: {
  shortlist: ShortlistInput;
  rankedVendorSlugs?: string[];
  requirementText?: string;
  sourceUrl?: string;
  capturedAt?: number;
}): ProjectEntranceContext {
  const shortlist = ShortlistInputSchema.parse(input.shortlist);
  const buyerInput = {
    sector: shortlist.sector,
    organisation_size: shortlist.organisation_size,
    operating_model: shortlist.service_model,
    regions: [...shortlist.required_regions],
    pinned_vendors: [...(input.rankedVendorSlugs ?? [])],
  };
  return context({
    source: "shortlist",
    source_url: input.sourceUrl ?? "",
    captured_at: input.capturedAt ?? Date.now(),
    requirement_text: input.requirementText ?? "",
    sector: shortlist.sector,
    marketplace_slug: null,
    vendor_slugs: [...(input.rankedVendorSlugs ?? [])],
    buyer_input: buyerInput,
    shortlist_input: structuredClone(shortlist) as JsonRecord,
    raw_input: {
      shortlist: structuredClone(shortlist),
      ranked_vendor_slugs: [...(input.rankedVendorSlugs ?? [])],
      requirement_text: input.requirementText ?? "",
    },
  });
}

export function marketplaceEntrance(input: {
  vendorSlug: string;
  requirementText?: string;
  buyerInput?: JsonRecord;
  sourceUrl?: string;
  capturedAt?: number;
  rawInput?: JsonRecord;
}): ProjectEntranceContext {
  return context({
    source: "marketplace",
    source_url: input.sourceUrl ?? "",
    captured_at: input.capturedAt ?? Date.now(),
    requirement_text: input.requirementText ?? "",
    sector: typeof input.buyerInput?.sector === "string" ? input.buyerInput.sector : null,
    marketplace_slug: input.vendorSlug,
    vendor_slugs: [input.vendorSlug],
    buyer_input: cloneRecord(input.buyerInput ?? {}),
    shortlist_input: null,
    raw_input: cloneRecord(input.rawInput ?? {
      vendor_slug: input.vendorSlug,
      requirement_text: input.requirementText ?? "",
      buyer_input: input.buyerInput ?? {},
    }),
  });
}

export function sectorEntrance(input: {
  sector: string;
  requirementText?: string;
  buyerInput?: JsonRecord;
  sourceUrl?: string;
  capturedAt?: number;
  rawInput?: JsonRecord;
}): ProjectEntranceContext {
  return context({
    source: "sector",
    source_url: input.sourceUrl ?? "",
    captured_at: input.capturedAt ?? Date.now(),
    requirement_text: input.requirementText ?? "",
    sector: input.sector,
    marketplace_slug: null,
    vendor_slugs: [],
    buyer_input: { ...cloneRecord(input.buyerInput ?? {}), sector: input.sector },
    shortlist_input: null,
    raw_input: cloneRecord(input.rawInput ?? {
      sector: input.sector,
      requirement_text: input.requirementText ?? "",
      buyer_input: input.buyerInput ?? {},
    }),
  });
}

export function entranceToProjectDetails(input: {
  entrance: ProjectEntranceContext;
  ids: { id: string; shareToken: string; manageToken: string };
  now?: number;
  ownerEmail?: string;
  title?: string;
}): ProjectDetails {
  const entrance = ProjectEntranceContextSchema.parse(input.entrance);
  const buyer = BuyerContextSchema.parse({
    ...entrance.buyer_input,
    sector: entrance.sector ?? entrance.buyer_input.sector,
    pinned_vendors: entrance.vendor_slugs,
    notes: entrance.requirement_text,
  });
  const now = input.now ?? Date.now();
  return ProjectDetailsSchema.parse({
    id: input.ids.id,
    created: now,
    updated: now,
    title: input.title ?? "Untitled SASE / SD-WAN RFP",
    buyer,
    rfp_sections: [],
    invited_vendors: [],
    share_token: input.ids.shareToken,
    manage_token: input.ids.manageToken,
    source: entrance.source === "rfp_builder" ? "wizard" : entrance.source,
    entrance_context: entrance,
    owner_email: input.ownerEmail ?? "",
  });
}
