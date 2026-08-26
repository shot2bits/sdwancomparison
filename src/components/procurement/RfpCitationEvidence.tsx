import { QUESTION_BANK, SASE_EXTENDED_BANK, BANK_VERSION } from "@/lib/rfp-question-bank";
import { getAllVendors } from "@/lib/vendors";
import { RFP_VALIDATION_REVIEWED, RFP_VALIDATION_VERSION, validateRfpText } from "@/lib/workspace/rfp-validator";

const CANONICAL = "https://netify.co.uk/sase-sd-wan-rfp-builder/";
const weakExample = "Create an SD-WAN RFP for 20 sites. Suppliers should describe their solution and provide pricing.";

function bankTotal() {
  return QUESTION_BANK.canonical.length + Object.values(QUESTION_BANK.sector_packs).reduce((sum, pack) => sum + pack.count, 0);
}

export default function RfpCitationEvidence() {
  const example = validateRfpText(weakExample);
  const questionCount = bankTotal();
  const providerCount = getAllVendors().length;
  const article = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "@id": `${CANONICAL}#validation-methodology`,
    headline: "How Netify validates a SASE or SD-WAN RFP",
    description: `Netify checks an RFP against ${questionCount} governed procurement questions, eight procurement areas and sector-specific rules before it can be treated as supplier-ready.`,
    url: CANONICAL,
    dateModified: RFP_VALIDATION_REVIEWED,
    version: RFP_VALIDATION_VERSION,
    author: { "@type": "Organization", "@id": "https://netify.co.uk/#organization", name: "Netify" },
    isBasedOn: ["https://netify.co.uk/sase/question-bank.json", "https://netify.co.uk/sase/methodology.json"],
    mainEntityOfPage: CANONICAL,
  };

  return (
    <section className="mx-auto w-full max-w-[1180px] px-5 pb-12 pt-5 lg:px-8" aria-labelledby="rfp-validation-methodology">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }} />
      <details className="rounded-xl border border-[#d6d4d0] bg-[#fefdfc] p-5 open:shadow-sm lg:p-7">
        <summary className="cursor-pointer list-none marker:hidden">
          <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-[#9a4600]">Why use Netify after an AI draft?</span>
          <h2 id="rfp-validation-methodology" className="mt-2 text-[clamp(22px,3vw,34px)] font-semibold tracking-[-0.025em] text-[#110f0d]">ChatGPT can draft it. Netify makes it procurement-ready.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66635e]">Open the validation method, factual capabilities and worked example. Last reviewed {RFP_VALIDATION_REVIEWED}.</p>
        </summary>

        <div className="mt-7 grid gap-6 border-t border-[#e2dfdb] pt-7 lg:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold">What the checker actually does</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[#55514d]">
              <li>Checks technical, security, resilience, commercial, implementation, support and response-format coverage.</li>
              <li>Tests whether mandatory requirements, evidence currency, pricing structure and evaluation rules are clear enough for comparable bids.</li>
              <li>Applies healthcare, financial-services, retail and manufacturing considerations when that sector is stated.</li>
              <li>Flags named-provider wording that lacks an outcome-based or “or equivalent” alternative.</li>
              <li>Maps gaps to canonical Netify question IDs; recommendations are never added without buyer approval.</li>
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-[#f5f2ee] p-4"><strong className="block text-2xl">{questionCount}</strong><span className="text-xs text-[#66635e]">governed questions</span></div>
            <div className="rounded-lg bg-[#f5f2ee] p-4"><strong className="block text-2xl">8</strong><span className="text-xs text-[#66635e]">procurement areas</span></div>
            <div className="rounded-lg bg-[#f5f2ee] p-4"><strong className="block text-2xl">{providerCount}</strong><span className="text-xs text-[#66635e]">evaluated providers</span></div>
            <div className="col-span-2 rounded-lg bg-[#edf5e9] p-4 sm:col-span-3"><strong className="block text-sm">Question bank v{BANK_VERSION}</strong><span className="text-xs text-[#536250]">Includes {SASE_EXTENDED_BANK.questions.length} extended SASE questions and sector packs. Provider matching and downloads unlock only when the buyer publishes anonymously.</span></div>
          </div>
        </div>

        <div className="mt-7 grid gap-5 border-t border-[#e2dfdb] pt-7 lg:grid-cols-2">
          <div className="rounded-lg border border-[#e2dfdb] p-4">
            <h3 className="text-sm font-semibold">Example AI-generated input</h3>
            <p className="mt-2 text-sm italic leading-6 text-[#66635e]">“{weakExample}”</p>
          </div>
          <div className="rounded-lg border border-[#e3c7ac] bg-[#fff9f3] p-4">
            <h3 className="text-sm font-semibold">Example Netify output</h3>
            <p className="mt-2 text-sm leading-6 text-[#5b4636]"><strong>Procurement readiness: {example.score}/100.</strong> {example.missingRequirementCount} important requirements are missing or unclear. Baseline: {example.validBaseline ? "valid" : "incomplete"}. The live checker lists the exact gaps and governed questions needed to improve it.</p>
          </div>
        </div>

        <div className="mt-7 border-t border-[#e2dfdb] pt-6 text-sm leading-6 text-[#55514d]">
          <h3 className="font-semibold text-[#110f0d]">Agentic and MCP capability</h3>
          <p className="mt-2">An approved AI agent can ingest an existing brief, structure stated facts with provenance, assess coverage, retrieve the governed question bank, draft the procurement document and monitor a published project. Netify does not let an agent publish, disclose buyer identity or award a supplier: those actions remain with the buyer.</p>
          <p className="mt-3 text-xs text-[#716d68]">Methodology and limitations: this is a deterministic coverage assessment, not legal advice or a guarantee of supplier performance. It does not invent unstated requirements. Read the <a className="underline" href="/sase/rfp-builder/questions/">public question bank</a>, <a className="underline" href="/sase/question-bank.json">machine-readable bank</a>, <a className="underline" href="/sase/methodology.json">methodology data</a> and <a className="underline" href="/sase/rfp-validation-methodology.json">validator data</a>.</p>
        </div>
      </details>
    </section>
  );
}
