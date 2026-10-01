export const ANSWER_FIRST_FIELDS = {
  dataset: "/sase/shortlist/data.json",
  entity: {
    h1: "string",
    count_sentence: "string, identical to the rendered count sentence",
    uk_sentence: "string, identical to the rendered UK evidence sentence",
    counts: "dataset-derived provider and overlapping category counts",
    reviewer: "name, role, reviewed_at; blank until owner approval",
    market_structure_sentence: "string; blank until editorial approval",
    desk_sentence: "string; blank until editorial approval",
    reviewed_at: "latest evidence review date",
  },
  provider: {
    best_for:
      "data-derived labels, including partial evidence and sector sign-off",
    best_for_fields: [
      "sectors_yes",
      "sectors_partial",
      "regions",
      "size",
      "service_model",
      "signoff",
    ],
    uk_delivery_compatibility:'Legacy alias for UK-entity classification, not service availability. Use uk_evidence for separated meanings.',
    uk_evidence:{entity:'Legal entity evidence with source, scope and review dates',regional_delivery:'UK and Ireland regional evidence, not site coverage',buyer_contract:'Supplier confirmation required for the actual purchase'},
    uk_status: {
      status:
        "uk_hq | uk_entity | uk_pops_partner | global_managed | not_confirmed",
      source_urls: "reviewed primary sources",
      reviewed_at: "ISO date or null",
      qualification: "review scope or null",
    },
  },
  prepare_sourcing_plan: {
    entity: ["count_sentence", "uk_sentence"],
    matches: [
      "best_for",
      "best_for_fields",
      "sector_status",
      "qualification_summary",
      "qualification",
      "uk_sector_evidence",
    ],
  },
} as const;
