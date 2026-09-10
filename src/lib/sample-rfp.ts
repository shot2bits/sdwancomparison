/**
 * The deterministic sample RFP project, extracted from the sample-rfp page
 * (18 July 2026) so the ungated template download route can build the same
 * document. Fictional buyer, mirrors the retail sample RFI. SASE scoped
 * since 3 Sep 2026 (see buildSampleProject).
 */

import { BuyerContextSchema, ProjectDetailsSchema, type ProjectDetails } from "@/lib/rfp-types";
import { synthesiseSections } from "@/lib/rfp-methodology";

export function buildSampleProject(): ProjectDetails {
  /* SASE scope (Robert, 3 Sep 2026): this is the SASE sample. The SD-WAN
   * sample lives on the apex at /sd-wan/sample-rfp/ and covers routing,
   * underlay, application performance, failover and managed operations,
   * so this one carries identity, ZTNA, SWG, CASB, FWaaS and SSE. Before
   * this change both samples were SD-WAN scoped (product_scope
   * "sdwan_only"), so the two pages competed for the same query and
   * neither showed a SASE document. Same fictional retailer, so the
   * worked example stays comparable with the sample RFI. */
  const buyer = BuyerContextSchema.parse({
    organisation: "Example Retail Group (fictional)",
    sector: "retail_ecommerce",
    organisation_size: "mid_market",
    site_count: 38,
    regions: ["uk_ireland"],
    compliance: ["pci_dss", "uk_gdpr"],
    operating_model: "managed",
    product_scope: "single_vendor_sase",
    notes:
      "Fictional worked example. A UK retailer with 38 stores, a distribution centre and head-office and remote staff, replacing an ageing MPLS estate and a remote-access VPN with single-vendor SASE: SD-WAN for the stores, plus ZTNA for remote and hybrid users, SWG, CASB and DLP for SaaS and web traffic, FWaaS at the security edge, identity integration with the existing directory, and UK data residency for logs. Stores trade seven days a week, so migration must be phased with no trading-hours downtime.",
  });
  return ProjectDetailsSchema.parse({
    id: "rfp_sample",
    created: 0,
    updated: 0,
    status: "draft",
    title: "Single-vendor SASE with SD-WAN, ZTNA, SWG, CASB and FWaaS for a 38-site UK retailer (sample)",
    buyer,
    rfp_sections: synthesiseSections(buyer),
    invited_vendors: [],
    share_token: "sample",
    manage_token: "",
    methodology_version: "2026.1",
  });
}
