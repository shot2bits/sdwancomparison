import type { Metadata } from "next";
import Continuation from "@/components/Continuation";
import { deriveContinuationQuestion } from "@/lib/continuation/derive";
import Link from "next/link";
import { QUESTION_BANK, SASE_EXTENDED_BANK, bankSummary } from "@/lib/rfp-question-bank";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema, getSpeakableSchema } from "@/lib/structured-data";
import frameworkData from "@data/harry-rfp-framework.json";

/**
 * The canonical, in-app home of the Netify RFP question bank. Fully
 * server-rendered and citable: Harry Yelland's 120-question, 20-pillar public
 * procurement framework, with the governed canonical and sector banks kept
 * intact behind it. Machine-readable twin at /question-bank.json.
 */

export const metadata: Metadata = {
  title: "Living SASE & SD-WAN RFP Template | 120 Questions",
  description:
    "A vendor-neutral SASE and SD-WAN RFP template with 120 supplier questions across 20 procurement pillars, evidence requests, strong-response markers and red flags.",
  alternates: { canonical: `${SITE_URL}/rfp-builder/questions/` },
  openGraph: {
    title: "The Living SASE & SD-WAN RFP Template",
    description: "120 vendor-neutral supplier questions across 20 procurement pillars, with evidence requests, strong-response markers and red flags.",
    url: `${SITE_URL}/rfp-builder/questions`,
    type: "website",
    locale: "en_GB",
  },
};

export default function QuestionBankPage() {
  const summary = bankSummary();
  const framework = frameworkData;

  const schemas = [
    getOrganizationSchema(),
    getBreadcrumbSchema("Question bank", "/rfp-builder/questions"),
    getSpeakableSchema("/rfp-builder/questions"),
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      "@id": `${SITE_URL}/rfp-builder/questions/#dataset`,
      name: "Netify Living SASE and SD-WAN RFP Template",
      description:
        "Vendor-neutral SASE and SD-WAN procurement framework with 120 supplier questions across 20 pillars, evidence requests, strong-response markers and red flags.",
      version: SASE_EXTENDED_BANK.question_bank_version,
      dateModified: SASE_EXTENDED_BANK.last_reviewed,
      license: "Public methodology. Reuse permitted with attribution to Netify and the canonical URL.",
      creator: { "@id": `${SITE_URL}/#organization` },
      distribution: {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: `${SITE_URL}/question-bank.json`,
      },
      url: `${SITE_URL}/rfp-builder/questions/`,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}

      <nav className="mb-6 text-sm text-[var(--ink-500)]">
        <a href="https://netify.co.uk/sase-sd-wan-rfp-builder/" className="underline">SD-WAN and SASE RFP Builder</a> / Question bank
      </nav>

      <div className="mb-10 rounded-3xl bg-[#081f33] px-6 py-10 text-white sm:px-10 sm:py-14">
        <p className="eyebrow mb-3 text-amber-300">Netify SASE &amp; SD-WAN Procurement Framework</p>
        <h1 id="page-h1" className="mb-4 max-w-4xl text-white">{framework.title}</h1>
        <p className="max-w-3xl text-xl leading-8 text-slate-200">{framework.strapline}</p>
        <p id="page-subhead" className="mt-5 max-w-3xl text-base leading-7 text-slate-300">{framework.introduction}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a href="https://netify.co.uk/sase-sd-wan-rfp-builder/" className="rounded-full bg-amber-400 px-5 py-3 font-semibold text-slate-950">Build an SD-WAN or SASE RFP</a>
          <a href="#supplier-questions" className="rounded-full border border-white/30 px-5 py-3 font-semibold text-white">Explore all 120 questions</a>
        </div>
        <p className="mt-6 text-sm text-slate-300">Your project stays private until you choose to publish it. A public opportunity can be listed anonymously, with you controlling when your identity is disclosed.</p>
      </div>

      <section className="mb-10 max-w-4xl">
        <h2 className="mb-3">How to use this living template</h2>
        <p className="leading-7 text-[var(--ink-700)]">{framework.useIntroduction}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--ink-200,#e5e5e5)] p-5">
            <h3 className="font-semibold">Question classifications</h3>
            <ul className="mt-3 space-y-2 text-sm text-[var(--ink-700)]">
              <li><strong>M, Mandatory:</strong> a failed requirement can disqualify a response.</li>
              <li><strong>W, Weighted:</strong> the answer contributes to the evaluated score.</li>
              <li><strong>I, Informational:</strong> the answer provides context but is not scored by default.</li>
              <li><strong>PoC, Validate:</strong> the claim should be tested before contract award.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--ink-200,#e5e5e5)] p-5">
            <h3 className="font-semibold">Recommended scoring method</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-700)]">Score each weighted response from 0 to 5, then multiply it by the question weight. Keep mandatory requirements as separate pass or fail gates. A high weighted score must not compensate for a failed mandatory control.</p>
          </div>
        </div>
      </section>

      {/* Citation block */}
      <div className="mb-10 rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5">
        <p className="eyebrow mb-2">Suggested citation</p>
        <p className="mb-4 text-sm font-medium">
          Netify Living SASE &amp; SD-WAN RFP Template, 120 questions across 20 procurement pillars, Netify, available at {SITE_URL}/rfp-builder/questions/
        </p>
        <div className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          <p><span className="text-[var(--ink-500)]">Question bank version:</span> {SASE_EXTENDED_BANK.question_bank_version}</p>
          <p><span className="text-[var(--ink-500)]">Methodology version:</span> {SASE_EXTENDED_BANK.methodology_version}</p>
          <p><span className="text-[var(--ink-500)]">Last reviewed:</span> {SASE_EXTENDED_BANK.last_reviewed}</p>
          <p><span className="text-[var(--ink-500)]">Public framework:</span> 120 questions across 20 pillars</p>
          <p><span className="text-[var(--ink-500)]">Governed bank retained:</span> {summary.total} questions plus canonical metadata</p>
          <p><span className="text-[var(--ink-500)]">Canonical URL:</span> /sase/rfp-builder/questions/</p>
          <p><span className="text-[var(--ink-500)]">Machine-readable:</span> <a href="/sase/question-bank.json" className="underline">/question-bank.json</a></p>
        </div>
        <p className="mt-3 text-xs text-[var(--ink-500)]">Licence: public methodology. Reuse permitted with attribution to Netify and the canonical URL. Agents can also read the bank over the marketplace MCP at <a href="/sase/api/mcp/" className="underline">/sase/api/mcp/</a>.</p>
      </div>

      {/* Harry Yelland's revised public framework, in full. */}
      <div id="supplier-questions" className="mb-12 scroll-mt-24">
        <h2 className="mb-1 text-2xl font-semibold">The 20-pillar supplier question set</h2>
        <p className="mb-6 max-w-3xl text-sm leading-6 text-[var(--ink-600)]">120 core questions across 20 procurement pillars. Each question carries a classification tag, the exact wording suppliers must answer, and the evidence, strong-response and red-flag markers evaluators should use.</p>
        <div className="space-y-5">
          {framework.pillars.map((pillar) => (
            <details key={pillar.id} id={pillar.id.toLowerCase()} className="scroll-mt-24 rounded-xl border border-[var(--ink-200,#e5e5e5)] bg-white" open={pillar.id === "P01"}>
              <summary className="cursor-pointer px-5 py-4 text-lg font-semibold">{pillar.title}</summary>
              <div className="border-t border-[var(--ink-200,#e5e5e5)] px-5 py-5">
                <p className="mb-5 max-w-4xl leading-7 text-[var(--ink-700)]">{pillar.introduction}</p>
                <div className="space-y-4">
                  {pillar.questions.map((q) => (
                    <article key={q.id} id={q.id.toLowerCase().replace(".", "-")} className="scroll-mt-24 rounded-lg bg-[var(--ink-50,#fafafa)] p-4">
                      <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]"><span>{q.id}</span><span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">{q.classification}</span></p>
                      <h3 className="mt-2 text-base font-semibold">{q.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--ink-700)]">{q.question}</p>
                      <dl className="mt-3 grid gap-2 text-xs text-[var(--ink-600)] md:grid-cols-3">
                        <div><dt className="font-semibold text-[var(--ink-800)]">Evidence requested</dt><dd>{q.evidence}</dd></div>
                        <div><dt className="font-semibold text-[var(--ink-800)]">Strong response</dt><dd>{q.strongResponse}</dd></div>
                        <div><dt className="font-semibold text-red-800">Red flag</dt><dd>{q.redFlag}</dd></div>
                      </dl>
                    </article>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* Sector packs */}
      <div className="mb-12">
        <h2 className="mb-1 text-lg font-semibold">Optional sector packs</h2>
        <p className="mb-5 text-sm text-[var(--ink-600)]">
          The governed bank remains available beneath Harry&apos;s public 120-question framework. These deeper, sector-specific sets carry buyer and vendor lenses on every question. Browse them in full
          inside the <a href="https://netify.co.uk/sase-sd-wan-rfp-builder/" className="underline">SD-WAN and SASE RFP Builder</a> or via the <a href="/sase/question-bank.json" className="underline">machine-readable bank</a>.
        </p>
        <div className="space-y-3">
          {Object.entries(QUESTION_BANK.sector_packs).map(([key, pack]) => (
            <details key={key} className="rounded-sm border border-[var(--ink-200,#e5e5e5)]">
              <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">{pack.label}: {pack.count} questions in {pack.sections.length} sections</summary>
              <div className="px-4 pb-3">
                {pack.sections.map((sec) => (
                  <details key={sec.title} className="mb-1 rounded-sm border border-[var(--ink-100,#f1f1f1)]">
                    <summary className="cursor-pointer px-3 py-1.5 text-sm">{sec.title} ({sec.questions.length})</summary>
                    <ol className="space-y-1.5 px-3 pb-2 pl-8 text-sm text-[var(--ink-700)]" style={{ listStyleType: "decimal" }}>
                      {sec.questions.map((q) => (
                        <li key={q.id}>{q.text}</li>
                      ))}
                    </ol>
                  </details>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>

      <section className="mb-12">
        <h2 className="mb-5 text-2xl font-semibold">Frequently asked questions</h2>
        <div className="space-y-3">
          {framework.faqs.map((faq) => (
            <details key={faq.question} className="rounded-xl border border-[var(--ink-200,#e5e5e5)] bg-white">
              <summary className="cursor-pointer px-5 py-4 font-semibold">{faq.question}</summary>
              <div className="space-y-3 border-t border-[var(--ink-200,#e5e5e5)] px-5 py-4 text-sm leading-7 text-[var(--ink-700)]">
                {faq.answer.map((paragraph, index) => <p key={`${faq.question}-${index}`}>{paragraph}</p>)}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* The Continuation (DEF wave one): derived from the bank's own
          live counts or not rendered at all. */}
      <div className="mb-8">
        <Continuation
          c={deriveContinuationQuestion({
            packCount: Object.keys(summary.sector_packs).length,
            questionCount: summary.total,
          })}
          pageUrl={`${SITE_URL}/rfp-builder/questions`}
        />
      </div>

      {/* Related */}
      <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5 text-sm text-[var(--ink-600)]">
        <p className="eyebrow mb-2">Use the bank</p>
        <p>
          <a href="https://netify.co.uk/sase-sd-wan-rfp-builder/" className="underline">Build an SD-WAN or SASE RFP with these questions</a> ·{" "}
          <Link href="/rfp-builder/sample-rfp" className="underline">See a sample RFP built from the bank</Link> ·{" "}
          <Link href="/opportunities/new" className="underline">Post a project notice instead</Link> ·{" "}
          Samples: <Link href="/rfp-builder/sample-rfp" className="underline">SASE sample RFP</Link> · <a href="https://netify.co.uk/sd-wan/sample-rfp/" className="underline">SD-WAN sample RFP</a>
        </p>
      </div>
    </div>
  );
}
