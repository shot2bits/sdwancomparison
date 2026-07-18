/**
 * The deterministic sample RFP project, extracted from the sample-rfp page
 * (18 July 2026) so the ungated template download route can build the same
 * document. Fictional buyer, mirrors the retail sample RFI.
 */

import { BuyerContextSchema, ProjectDetailsSchema, type ProjectDetails } from "@/lib/rfp-types";
import { synthesiseSections } from "@/lib/rfp-methodology";

export function buildSampleProject(): ProjectDetails {
  const buyer = BuyerContextSchema.parse({
    organisation: "Example Retail Group (fictional)",
    sector: "retail_ecommerce",
    organisation_size: "mid_market",
    site_count: 38,
    regions: ["uk_ireland"],
    compliance: ["pci_dss", "uk_gdpr"],
    operating_model: "managed",
    product_scope: "sdwan_only",
    notes:
      "Fictional worked example. A UK retailer with 38 stores plus a distribution centre replacing an ageing MPLS estate: managed SD-WAN with underlay circuits, local internet breakout for store systems, and a managed firewall service. Stores trade seven days a week, so migration must be phased with no trading-hours downtime.",
  });
  return ProjectDetailsSchema.parse({
    id: "rfp_sample",
    created: 0,
    updated: 0,
    status: "draft",
    title: "Managed SD-WAN with underlay and firewall for 38 UK retail sites (sample)",
    buyer,
    rfp_sections: synthesiseSections(buyer),
    invited_vendors: [],
    share_token: "sample",
    manage_token: "",
    methodology_version: "2026.1",
  });
}
