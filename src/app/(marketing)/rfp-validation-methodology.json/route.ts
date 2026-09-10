import { BANK_VERSION, QUESTION_BANK, SASE_EXTENDED_BANK } from "@/lib/rfp-question-bank";
import { getAllVendors } from "@/lib/vendors";
import { RFP_VALIDATION_REVIEWED, RFP_VALIDATION_VERSION, validateRfpText } from "@/lib/workspace/rfp-validator";

const exampleInput = "Create an SD-WAN RFP for 20 sites. Suppliers should describe their solution and provide pricing.";

export async function GET() {
  const totalQuestions = QUESTION_BANK.canonical.length + Object.values(QUESTION_BANK.sector_packs).reduce((sum, pack) => sum + pack.count, 0);
  return Response.json({
    name: "Netify SASE and SD-WAN RFP text-coverage checker",
    canonical_url: "https://netify.co.uk/sase-sd-wan-rfp-builder/",
    assessment_version: RFP_VALIDATION_VERSION,
    question_bank_version: BANK_VERSION,
    last_reviewed: RFP_VALIDATION_REVIEWED,
    facts: {
      governed_questions: totalQuestions,
      extended_sase_questions: SASE_EXTENDED_BANK.questions.length,
      evaluated_providers: getAllVendors().length,
      procurement_areas: 8,
    },
    assesses: [
      "organisation and scale", "solution scope", "current estate", "resilience and availability",
      "security, identity and data", "operating model and support", "migration and implementation",
      "commercial and contractual", "supplier evidence", "evaluation and scoring", "response comparability",
      "vendor neutrality", "sector-specific considerations",
    ],
    sectors: ["healthcare", "financial services", "retail", "manufacturing", "government and public sector"],
    input: "RFP text supplied by the user. Word, PDF, text and spreadsheet files are converted to text before assessment.",
    output: "Topic coverage, information to confirm, comparability warnings and question-bank recommendations. Legacy score and missingRequirementCount fields remain for compatibility; they measure heuristic coverage and overlapping checks, not procurement readiness or unique requirements.",
    limitations: [
      "Coverage assessment does not verify technical correctness, measurable targets, or readiness to issue an RFP.",
      "The validator does not invent unstated buyer requirements.",
      "Recommendations require buyer approval before inclusion.",
      "Provider matching, downloads and structured responses unlock only after anonymous publication to the Netify Opportunity Board.",
    ],
    source_data: {
      question_bank: "https://netify.co.uk/sase/question-bank.json",
      methodology: "https://netify.co.uk/sase/methodology.json",
    },
    example: { input: exampleInput, report: validateRfpText(exampleInput) },
  }, { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
