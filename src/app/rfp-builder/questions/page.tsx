import type { Metadata } from "next";
import Continuation from "@/components/Continuation";
import { deriveContinuationQuestion } from "@/lib/continuation/derive";
import Link from "next/link";
import { QUESTION_BANK, SASE_EXTENDED_BANK, EXTENDED_CATEGORY_LABELS, saseExtendedQuestions, bankSummary } from "@/lib/rfp-question-bank";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema, getSpeakableSchema } from "@/lib/structured-data";

/**
 * The canonical, in-app home of the Netify RFP question bank. Fully
 * server-rendered and citable: the 43-question extended SASE canonical set
 * with evidence, weighting, red-flag and follow-up metadata, plus the four
 * sector packs. Machine-readable twin at /question-bank.json. This page (not
 * any external site) is what the app cites as its question-bank source.
 */

export const metadata: Metadata = {
  title: "Netify SASE & SD-WAN RFP Question Bank (2026.1)",
  description:
    "The analyst-written Netify question bank: 43 canonical SASE questions with evidence requirements, sector applicability, weighting and red-flag answers, plus retail, manufacturing, financial services and healthcare packs. 386+ questions, versioned and machine-readable.",
  alternates: { canonical: `${SITE_URL}/rfp-builder/questions/` },
  openGraph: {
    title: "Netify SASE & SD-WAN RFP Question Bank (2026.1)",
    description: "Analyst-written RFP questions with evidence requirements, weighting and red-flag answers. Versioned and machine-readable.",
    url: `${SITE_URL}/rfp-builder/questions`,
    type: "website",
    locale: "en_GB",
  },
};

const WEIGHT_STYLE: Record<string, string> = {
  high: "bg-amber-100 text-amber-800",
  medium: "bg-[var(--ink-100,#f0f0f0)] text-[var(--ink-600)]",
  low: "bg-[var(--ink-100,#f0f0f0)] text-[var(--ink-400,#9ca3af)]",
};

export default function QuestionBankPage() {
  const summary = bankSummary();
  const extended = saseExtendedQuestions();
  const byCategory = new Map<string, typeof extended>();
  for (const q of extended) {
    const list = byCategory.get(q.category_id) ?? [];
    list.push(q);
    byCategory.set(q.category_id, list);
  }

  const schemas = [
    getOrganizationSchema(),
    getBreadcrumbSchema("Question bank", "/rfp-builder/questions"),
    getSpeakableSchema("/rfp-builder/questions"),
    {
      "@context": "https://schema.org",
      "@type": "Dataset",
      "@id": `${SITE_URL}/rfp-builder/questions/#dataset`,
      name: "Netify SASE and SD-WAN RFP Question Bank",
      description:
        "Analyst-written RFP question bank for SASE, SSE and SD-WAN procurement: canonical questions with evidence requirements, sector applicability, weighting hints and red-flag answers, plus sector packs with buyer and supplier lenses.",
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
        <Link href="/rfp-builder" className="underline">RFP Builder</Link> / Question bank
      </nav>

      <div className="mb-8 max-w-3xl">
        <p className="eyebrow mb-3">Netify question bank</p>
        <h1 id="page-h1" className="mb-4">The Netify SASE &amp; SD-WAN RFP question bank</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">
          These questions were written by our analyst team, and they are the same set the RFP Builder and the
          marketplace run on. Every question tells you what evidence a supplier should be able to show you, which
          sectors it is mandatory for, how much weight to give the answer, the responses that should ring alarm bells
          and the follow-up worth asking. Alongside the main set sit four sector packs, each written with a buyer lens
          and a supplier lens. You are welcome to use the questions in your own procurement with attribution, or{" "}
          <a href="/sase/rfp-builder/" className="underline">let the builder assemble everything for you</a>.
        </p>
      </div>

      {/* Citation block */}
      <div className="mb-10 rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5">
        <p className="eyebrow mb-2">Suggested citation</p>
        <p className="mb-4 text-sm font-medium">
          Netify SASE &amp; SD-WAN RFP Question Bank {QUESTION_BANK.version}, Netify, available at {SITE_URL}/rfp-builder/questions/
        </p>
        <div className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          <p><span className="text-[var(--ink-500)]">Question bank version:</span> {SASE_EXTENDED_BANK.question_bank_version}</p>
          <p><span className="text-[var(--ink-500)]">Methodology version:</span> {SASE_EXTENDED_BANK.methodology_version}</p>
          <p><span className="text-[var(--ink-500)]">Last reviewed:</span> {SASE_EXTENDED_BANK.last_reviewed}</p>
          <p><span className="text-[var(--ink-500)]">Total questions:</span> {summary.total} ({summary.sase_extended_count} canonical + sector packs)</p>
          <p><span className="text-[var(--ink-500)]">Canonical URL:</span> /sase/rfp-builder/questions/</p>
          <p><span className="text-[var(--ink-500)]">Machine-readable:</span> <a href="/sase/question-bank.json" className="underline">/question-bank.json</a></p>
        </div>
        <p className="mt-3 text-xs text-[var(--ink-500)]">Licence: public methodology. Reuse permitted with attribution to Netify and the canonical URL. Agents can also read the bank over the marketplace MCP at <a href="/sase/api/mcp/" className="underline">/sase/api/mcp/</a>.</p>
      </div>

      {/* Extended canonical bank, in full */}
      <div className="mb-12">
        <h2 className="mb-1 text-lg font-semibold">SASE canonical bank ({summary.sase_extended_count} questions)</h2>
        <p className="mb-5 text-sm text-[var(--ink-600)]">
          The core set behind every Netify SASE, SSE and SD-WAN RFP. Sector tags show where a question is mandatory.
        </p>
        {[...byCategory.entries()].map(([catId, qs]) => (
          <section key={catId} className="mb-8">
            <h3 className="mb-3 text-base font-semibold">{EXTENDED_CATEGORY_LABELS[catId] ?? catId} ({qs.length})</h3>
            <div className="space-y-4">
              {qs.map((q) => (
                <article key={q.question_id} className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4">
                  <p className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide">
                    <span className="text-[var(--ink-400,#9ca3af)]">{q.question_id}</span>
                    <span className={`rounded-full px-1.5 py-0 ${WEIGHT_STYLE[q.weighting_hint] ?? WEIGHT_STYLE.medium}`}>{q.weighting_hint} weight</span>
                    {q.mandatory_for.map((s) => (
                      <span key={s} className="rounded-full bg-red-50 px-1.5 py-0 text-red-700">mandatory: {s.replace(/-/g, " ")}</span>
                    ))}
                  </p>
                  <p className="text-sm font-medium">{q.question}</p>
                  <p className="mt-1 text-xs text-[var(--ink-600)]">{q.why_it_matters}</p>
                  <p className="mt-1 text-xs text-[var(--ink-600)]"><span className="font-medium">Evidence:</span> {q.evidence_required.join("; ")}</p>
                  {q.red_flag_answers.length > 0 && (
                    <p className="mt-1 text-xs text-red-700"><span className="font-medium">Red flags:</span> {q.red_flag_answers.join("; ")}</p>
                  )}
                  {q.follow_up_questions.length > 0 && (
                    <p className="mt-1 text-xs text-[var(--ink-500)]"><span className="font-medium">Follow-ups:</span> {q.follow_up_questions.join(" ")}</p>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Sector packs */}
      <div className="mb-12">
        <h2 className="mb-1 text-lg font-semibold">Sector packs</h2>
        <p className="mb-5 text-sm text-[var(--ink-600)]">
          Deep, sector-specific question sets with buyer and supplier lenses on every question. Browse them in full
          inside the <a href="/sase/rfp-builder/" className="underline">RFP Builder</a> or via the <a href="/sase/question-bank.json" className="underline">machine-readable bank</a>.
        </p>
        <div className="space-y-3">
          {Object.entries(QUESTION_BANK.sector_packs).map(([key, pack]) => (
            <details key={key} className="rounded-sm border border-[var(--ink-200,#e5e5e5)]">
              <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">{pack.label} — {pack.count} questions in {pack.sections.length} sections</summary>
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
          <a href="/sase/rfp-builder/" className="underline">Build an RFP with these questions</a> ·{" "}
          <Link href="/rfp-builder/sample-rfp" className="underline">See a sample RFP built from the bank</Link> ·{" "}
          <Link href="/opportunities/new" className="underline">Post a project notice instead</Link> ·{" "}
          Paths: <Link href="/rfp-builder/sase" className="underline">SASE</Link> · <Link href="/rfp-builder/sd-wan" className="underline">SD-WAN</Link> · <Link href="/rfp-builder/sse" className="underline">SSE</Link>
        </p>
      </div>
    </div>
  );
}
