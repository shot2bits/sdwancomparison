/**
 * The citable, server-rendered public content of the canonical builder
 * page, https://netify.co.uk/sase-sd-wan-rfp-builder/ (Robert, 3 Sep
 * 2026, "sd-wan rfp" / "sase rfp" citation work).
 *
 * WHY. The live audit of 3 Sep 2026 found Google's AI Overview for "sase
 * rfp" quoting a definition that existed only on the redirected legacy
 * URL, and Bing citing the long-form guides rather than this page. The
 * canonical page itself served roughly 120 words of prose; the rest of
 * its text was application UI labels. Everything here is plain HTML in
 * the first response: a captioned table of what an SD-WAN or SASE RFP
 * covers, five short FAQs, a visible review date, and links to the
 * question bank and both sample RFPs. No client state.
 *
 * ONE ARRAY, TWO OUTPUTS. The FAQPage JSON-LD is built from the same FAQS
 * array the HTML renders, so structured data cannot drift from the page.
 * The breadcrumb names the canonical apex URL, not the /sase/home/ route
 * that serves it.
 *
 * Copy laws: no em or en dashes, no fluff words, UK English, no invented
 * figures. The review date is this content's own editorial date (one
 * constant, shown in the <time> and in the WebPage dateModified).
 */

export const CANONICAL_BUILDER_URL = "https://netify.co.uk/sase-sd-wan-rfp-builder/";
export const QUESTION_BANK_URL = "https://netify.co.uk/sase/rfp-builder/questions/";
export const SASE_SAMPLE_RFP_URL = "https://netify.co.uk/sase/rfp-builder/sample-rfp/";
export const SDWAN_SAMPLE_RFP_URL = "https://netify.co.uk/sd-wan/sample-rfp/";
/** The open Word download of the governed sample RFP (no sign-in). Served
 *  by the SASE app under its /sase basePath; the apex rewrites the path. */
export const RFP_DOWNLOAD_URL = "https://netify.co.uk/sase/rfp-builder/sample-rfp/template.doc";
/** The editorial review date of THIS content (the definitions, table and
 *  FAQs), distinct from the validator's own reviewed date in
 *  rfp-validator.ts, which dates the scoring method and is shown by
 *  RfpCitationEvidence. Update this when the content below changes. */
export const RFP_CONTENT_REVIEWED = "2026-09-03";

/** What an SD-WAN or SASE RFP covers. Eight areas (Robert's list), each
 *  with the SD-WAN emphasis, the SASE emphasis and the evidence a buyer
 *  should ask suppliers to attach. */
export const RFP_AREAS: { area: string; sdwan: string; sase: string; evidence: string }[] = [
  {
    area: "Organisation and scale",
    sdwan: "Sites, regions, users per site, growth plans and the procurement route.",
    sase: "Remote and hybrid users, devices, identity provider and data residency by region.",
    evidence: "Site list, user counts and regions stated in the RFP; supplier confirms coverage per region.",
  },
  {
    area: "Network architecture",
    sdwan: "Underlay circuits, WAN topology, hub and cloud on-ramps, application performance targets, QoS and routing.",
    sase: "PoP footprint, cloud on-ramps, traffic steering between SD-WAN and the security edge, private application access.",
    evidence: "Reference architecture, PoP list with locations, latency and throughput figures per region.",
  },
  {
    area: "SASE security",
    sdwan: "Firewall integration, segmentation and how security is applied at the branch.",
    sase: "ZTNA, SWG, CASB, FWaaS, DLP, threat prevention, identity and device posture, logging and SIEM integration.",
    evidence: "Capability statement per function, single-vendor or partner delivered, certifications and independent test results.",
  },
  {
    area: "Resilience",
    sdwan: "Access diversity, failover behaviour, availability targets per site tier and disaster recovery.",
    sase: "PoP redundancy, fail-open or fail-closed policy, control plane availability and regional fallback.",
    evidence: "Published SLA, availability history and a description of the last significant incident.",
  },
  {
    area: "Managed service",
    sdwan: "Service ownership, service desk, change management, monitoring, reporting and co-managed options.",
    sase: "Policy administration, incident response, SOC integration and who owns the security policy day to day.",
    evidence: "RACI, escalation path, sample monthly service report and named service management roles.",
  },
  {
    area: "Implementation",
    sdwan: "Discovery, pilot sites, migration waves, cutover and rollback, dependencies and training.",
    sase: "Identity integration, agent rollout, legacy VPN and proxy retirement, phased policy migration.",
    evidence: "Implementation plan with milestones, pilot acceptance criteria and named delivery team.",
  },
  {
    area: "Pricing and contract terms",
    sdwan: "Pricing model per site and per circuit, hardware, licences, contract term, indexation and exit.",
    sase: "Pricing per user and per function, bundles, licence tiers, overage, term and exit provisions.",
    evidence: "Itemised pricing schedule, total cost over the proposed contract term (Netify recommends a three-year basis for comparison) and the assumptions behind it.",
  },
  {
    area: "Supplier evidence",
    sdwan: "Customer references in comparable sectors, accreditations and financial standing.",
    sase: "Analyst coverage, security certifications, data handling and sub-processor disclosure.",
    evidence: "Customer references (Netify recommends at least two, in comparable sectors), certification copies, insurance and the evidence request answered in full.",
  },
];

/** Short, direct answers. Each question is a query buyers search. */
export const FAQS: { q: string; a: string }[] = [
  {
    q: "What should an SD-WAN RFP include?",
    a: "An SD-WAN RFP should state the site list and regions, the underlay circuits and WAN topology, application performance and QoS targets, failover and availability requirements, security integration, the managed or co-managed operating model, the implementation and migration plan, the pricing model and contract terms, and the evidence suppliers must attach. Netify's question bank covers each of these areas with supplier questions you can select.",
  },
  {
    q: "What should a SASE RFP include?",
    a: "A SASE RFP should cover the user and device estate, identity provider and device posture, the required security functions (ZTNA, SWG, CASB, FWaaS and DLP), SD-WAN or branch connectivity, PoP coverage and data residency, logging and SIEM integration, resilience and fail-open policy, the operating model, implementation phasing, per-user pricing and contract terms, and the certifications and references suppliers must provide.",
  },
  {
    q: "What is the difference between an RFI and an RFP?",
    a: "An RFI (request for information) asks suppliers to describe their capabilities so a buyer can learn the market and build a shortlist; it carries no scoring or pricing commitment. An RFP (request for proposal) sets out defined requirements, evaluation criteria and a pricing structure so suppliers return comparable, priced proposals. Netify can produce either from the same project, depending on how far the requirement has been developed.",
  },
  {
    q: "How should SD-WAN and SASE vendors be evaluated?",
    a: "Score each supplier against the same weighted criteria: capability fit against the stated requirements, security efficacy, performance and PoP coverage in your regions, resilience and SLA, operating model fit, implementation approach, total cost over the contract term and the quality of evidence provided. Netify grades 30 vendors and service providers on 40 capabilities, and supplier responses to a published RFP land side by side against the questions you asked.",
  },
  {
    q: "Is the Netify RFP Builder free?",
    a: "Yes. Building, validating and downloading an SD-WAN or SASE RFP is free for buyers, and the sample RFP is available as a Word download on this page without sign-in. Publishing is anonymous, pricing returned by suppliers is private to you, and nothing is published without your signature.",
  },
];

export function getRfpFaqSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${CANONICAL_BUILDER_URL}#faq`,
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function getRfpBreadcrumbSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${CANONICAL_BUILDER_URL}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://netify.co.uk/" },
      { "@type": "ListItem", position: 2, name: "SD-WAN and SASE RFP Builder", item: CANONICAL_BUILDER_URL },
    ],
  };
}

/** The page's own dated description of itself, so the review date is
 *  machine-readable as well as visible. */
export function getRfpWebPageSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${CANONICAL_BUILDER_URL}#webpage`,
    url: CANONICAL_BUILDER_URL,
    name: "Free SD-WAN and SASE RFP Builder and Template",
    dateModified: RFP_CONTENT_REVIEWED,
    inLanguage: "en-GB",
    isPartOf: { "@id": "https://netify.co.uk/#website" },
    breadcrumb: { "@id": `${CANONICAL_BUILDER_URL}#breadcrumb` },
    mainEntity: { "@id": `${CANONICAL_BUILDER_URL}#webapplication` },
    significantLink: [QUESTION_BANK_URL, SASE_SAMPLE_RFP_URL, SDWAN_SAMPLE_RFP_URL],
    potentialAction: {
      "@type": "DownloadAction",
      name: "Download the SD-WAN and SASE RFP (Word, free)",
      target: RFP_DOWNLOAD_URL,
    },
  };
}

export default function RfpPublicContent() {
  const schemas = [getRfpFaqSchema(), getRfpBreadcrumbSchema(), getRfpWebPageSchema()];
  return (
    <section
      id="rfp-guide"
      className="mx-auto w-full max-w-[1180px] px-5 pb-10 pt-6 text-[#110f0d] lg:px-8"
      aria-labelledby="rfp-guide-heading"
    >
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}

      <nav aria-label="Breadcrumb" className="text-xs text-[#66635e]">
        <ol className="flex flex-wrap gap-1">
          <li>
            <a className="underline" href="https://netify.co.uk/">Home</a>
            <span aria-hidden="true"> / </span>
          </li>
          <li aria-current="page">SD-WAN and SASE RFP Builder</li>
        </ol>
      </nav>

      <p className="mt-6 max-w-3xl text-sm leading-6 text-[#55514d]">
        The document this page builds is also available as it stands: <a className="underline" href={RFP_DOWNLOAD_URL}>download the SD-WAN and SASE RFP (Word, free, no sign-in)</a>, drawn from the <a className="underline" href={QUESTION_BANK_URL}>120 supplier questions across 20 pillars</a> in the question bank. Use it as a starting point, or build a tailored version above and publish it to receive supplier responses.
      </p>

      <h2 id="rfp-guide-heading" className="mt-6 text-[clamp(22px,3vw,32px)] font-semibold tracking-[-0.02em]">
        What an SD-WAN or SASE RFP covers
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#55514d]">
        The eight areas below are the sections Netify builds and validates. Each row shows the SD-WAN emphasis, the SASE emphasis and the evidence Netify recommends requesting from suppliers; adapt them to your own procurement rules. Reviewed <time dateTime={RFP_CONTENT_REVIEWED}>{RFP_CONTENT_REVIEWED}</time>.
      </p>

      <div className="mt-5 overflow-x-auto rounded-xl border border-[#d6d4d0]">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <caption className="px-4 py-3 text-left text-xs text-[#66635e]">
            SD-WAN and SASE RFP sections compared: what each area covers and the supplier evidence Netify recommends requesting. Source: Netify governed question bank; content reviewed {RFP_CONTENT_REVIEWED}.
          </caption>
          <thead className="bg-[#f5f2ee] text-xs uppercase tracking-[0.06em] text-[#55514d]">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">RFP area</th>
              <th scope="col" className="px-4 py-3 font-semibold">SD-WAN RFP</th>
              <th scope="col" className="px-4 py-3 font-semibold">SASE RFP</th>
              <th scope="col" className="px-4 py-3 font-semibold">Supplier evidence</th>
            </tr>
          </thead>
          <tbody>
            {RFP_AREAS.map((row) => (
              <tr key={row.area} className="border-t border-[#e2dfdb] align-top">
                <th scope="row" className="px-4 py-3 font-semibold text-[#110f0d]">{row.area}</th>
                <td className="px-4 py-3 leading-6 text-[#55514d]">{row.sdwan}</td>
                <td className="px-4 py-3 leading-6 text-[#55514d]">{row.sase}</td>
                <td className="px-4 py-3 leading-6 text-[#55514d]">{row.evidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm leading-6 text-[#55514d]">
        Read the <a className="underline" href={QUESTION_BANK_URL}>SD-WAN and SASE question bank</a> that the builder draws from, or see a finished document: the <a className="underline" href={SASE_SAMPLE_RFP_URL}>SASE sample RFP</a> (identity, ZTNA, SWG, CASB, FWaaS and SSE) and the <a className="underline" href={SDWAN_SAMPLE_RFP_URL}>SD-WAN sample RFP</a> (routing, underlay, application performance, failover and managed operations).
      </p>

      <h2 className="mt-10 text-[clamp(20px,2.6vw,28px)] font-semibold tracking-[-0.02em]">SD-WAN and SASE RFP questions answered</h2>
      <div className="mt-3 divide-y divide-[#e2dfdb] rounded-xl border border-[#d6d4d0] bg-[#fefdfc]">
        {FAQS.map((f) => (
          <details key={f.q} className="group px-5 py-4">
            <summary className="cursor-pointer list-none text-[15px] font-semibold marker:hidden">
              <h3 className="inline">{f.q}</h3>
            </summary>
            <p className="mt-2 text-sm leading-6 text-[#55514d]">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
