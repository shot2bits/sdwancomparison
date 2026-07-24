/**
 * The casing gate (Harry's report, 24 July 2026): the generated RFP
 * document once read "Sector: retail ecommerce" and "Regions: europe, uk
 * ireland", and the opportunity room read "Scope: sase, managed_service".
 * One root cause: machine slugs rendered by swapping underscores for
 * spaces instead of speaking through the label catalogue. This gate makes
 * the regression impossible: it builds a real document from a fixture
 * project and fails the build if a raw slug or lowercase label survives,
 * and it checks the catalogues themselves stay presentable.
 *
 * Part of the union validate chain (vendors, continuations, instruments,
 * notice-titles, labels). Both sessions preserve the whole line.
 */

import { SECTORS, REGIONS, COMPLIANCE_OPTIONS, OPP_SCOPE_TAGS, RFP_ORG_SIZES, labelsFor } from "../src/lib/notice-options";
import { buildRfpMarkdown, buyerProfileSentence, sectorLabel, regionLabelList, complianceLabelList } from "../src/lib/rfp-document";
import type { ProjectDetails } from "../src/lib/rfp-types";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function expect(cond: boolean, msg: string) {
  if (cond) pass += 1;
  else { fail += 1; failures.push(msg); }
}

/* 1. Catalogue sanity: every label is presentable (no underscores, and it
      does not begin with a bare lowercase letter). */
for (const [name, list] of [
  ["SECTORS", SECTORS],
  ["REGIONS", REGIONS],
  ["COMPLIANCE_OPTIONS", COMPLIANCE_OPTIONS],
  ["OPP_SCOPE_TAGS", OPP_SCOPE_TAGS],
  ["RFP_ORG_SIZES", RFP_ORG_SIZES],
] as const) {
  for (const o of list) {
    expect(!o.label.includes("_"), `${name}.${o.key}: label carries an underscore`);
    expect(!/^[a-z]/.test(o.label), `${name}.${o.key}: label starts lowercase`);
  }
}

/* 2. The helpers speak the catalogue and fall back gracefully. */
expect(sectorLabel("retail_ecommerce") === "Retail & e-commerce", "sectorLabel catalogue hit");
expect(sectorLabel("space_mining") === "Space mining", "sectorLabel graceful fallback");
expect(regionLabelList(["europe", "uk_ireland"]) === "Europe, UK & Ireland", "regionLabelList");
expect(complianceLabelList(["pci_dss", "uk_gdpr"]) === "PCI DSS, UK GDPR", "complianceLabelList");
expect(labelsFor(OPP_SCOPE_TAGS, ["sase", "managed_service"]).join(", ") === "SASE, Managed service", "scope tags");

/* 3. The document itself: Harry's exact failing case, rebuilt and asserted.
      A retail buyer across Europe and UK & Ireland with PCI DSS in scope
      must read as buyer English everywhere, with no slug surviving. */
const fixture = {
  id: "rfp_labelgate",
  title: "SASE requirement, 50 sites",
  methodology_version: "2026.1",
  status: "draft",
  nda: { required: false },
  buyer: {
    sector: "retail_ecommerce",
    site_count: 50,
    regions: ["europe", "uk_ireland"],
    compliance: ["pci_dss"],
    product_scope: "full_sase",
    operating_model: "managed",
    organisation_size: "mid_market",
    notes: "",
    pinned_vendors: [],
  },
  rfp_sections: [
    {
      category: "Service & support",
      included: true,
      questions: [
        {
          id: "q1",
          text: "Describe the managed service model.",
          priority: "required",
          mandatory: false,
          weight: 5,
          source: "bank",
          evidence_requested: "Support model and escalation path",
          rationale: "Included because: fully managed operation stated (per SASE Methodology v2026.1, Fully managed service).",
        },
      ],
    },
  ],
} as unknown as ProjectDetails;

const sentence = buyerProfileSentence(fixture);
const doc = buildRfpMarkdown(fixture);
expect(sentence.includes("Retail & e-commerce"), "background speaks the sector label");
expect(sentence.includes("Europe, UK & Ireland"), "background speaks the region labels");
expect(sentence.includes("PCI DSS"), "background speaks compliance");
expect(!/retail ecommerce|uk ireland/.test(sentence), "background carries no raw slug text");
expect(doc.includes("| Sector | Retail & e-commerce |"), "cover table sector label");
expect(doc.includes("| Regions | Europe, UK & Ireland |"), "cover table region labels");
expect(doc.includes("| Compliance | PCI DSS |"), "cover table compliance");
expect(!/\| Sector \| [a-z]/.test(doc), "cover sector never lowercase");
expect(!/retail ecommerce|uk ireland|managed_service|retail_ecommerce/.test(doc), "no slug survives anywhere in the document");

console.log(`labels: ${pass} checks pass (${fail} fail)`);
if (fail > 0) {
  console.error(failures.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
