import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getProject, getSession, kvConfigured } from "@/lib/rfp-store";
import { SESSION_COOKIE } from "@/lib/auth";
import { documentSections, sectionStats, evidenceChecklist, scopeLabel, modelLabel, buyerProfileSentence } from "@/lib/rfp-document";
import { BANK_VERSION, SASE_EXTENDED_BANK } from "@/lib/rfp-question-bank";
import PrintButton from "@/components/PrintButton";
import SignIn from "@/components/SignIn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-rendered RFP preview: the draft as the finished document — cover,
 * background, sections with evidence and weighting, evidence checklist,
 * scoring matrix, submission instructions and provenance appendix.
 *
 * Owner-only. The builder links here with ?manage={manage_token} so anonymous
 * drafts keep working; the owning account gets in by session alone. Anyone
 * else (including a supplier who trimmed a share link down to the id) sees a
 * sign-in panel, not the document. Suppliers read the RFP through their
 * response link instead. Private workspace content: always noindexed.
 */

export const metadata: Metadata = { title: "RFP preview", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ manage?: string }> };

export default async function RfpPreviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { manage } = await searchParams;
  if (!kvConfigured()) notFound();
  const project = await getProject(id);
  if (!project) notFound();

  const jar = await cookies();
  const session = await getSession(jar.get(SESSION_COOKIE)?.value ?? null);
  const signedIn = Boolean(session);

  const tokenOk = Boolean(project.manage_token) && manage === project.manage_token;
  const sessionOwner =
    Boolean(session) &&
    (session?.role === "netify" ||
      (session?.role === "buyer" && Boolean(project.owner_email) && session.email.toLowerCase() === project.owner_email.toLowerCase()));
  if (!tokenOk && !sessionOwner) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24">
        <p className="eyebrow mb-2">RFP preview</p>
        <h1 className="mb-3 text-2xl">This preview is private to the buyer</h1>
        <p className="mb-6 text-sm text-[var(--ink-600)]">
          The RFP preview and download belong to the buyer who created the RFP. If that is you, open the preview from
          your builder page (it carries your private key), or sign in with the email you used when creating it.
          If you are a supplier, the buyer&apos;s invitation contains your response link — that is where you read the
          RFP and reply.
        </p>
        <div className="mb-6"><SignIn role="buyer" prompt="Sign in with the email that created this RFP." /></div>
        <p className="text-sm"><Link href="/rfp-builder" className="underline">Go to the RFP builder</Link></p>
      </div>
    );
  }

  // Carry the manage key through preview links so the anonymous-owner flow survives navigation.
  const keyQs = tokenOk && manage ? `?manage=${encodeURIComponent(manage)}` : "";

  const sections = documentSections(project);
  const stats = sectionStats(project);
  const evidence = evidenceChecklist(project);
  const totalQuestions = sections.reduce((n, s) => n + s.questions.length, 0);

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <nav className="mb-6 text-sm text-[var(--ink-500)] print:hidden">
        <Link href={`/rfp-builder/${id}`} className="underline">← Back to the builder</Link>
      </nav>

      <div className="grid gap-10 lg:grid-cols-3">
        <article className="lg:col-span-2">
          {/* Cover */}
          <header className="mb-8 border-b border-[var(--ink-200,#e5e5e5)] pb-6">
            <p className="eyebrow mb-2">Request for Proposal</p>
            <h1 className="mb-4 text-2xl leading-snug">{project.title}</h1>
            <div className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
              <p><span className="text-[var(--ink-500)]">Scope:</span> {scopeLabel(project)}</p>
              <p><span className="text-[var(--ink-500)]">Delivery:</span> {modelLabel(project)}</p>
              {project.buyer.sector && <p><span className="text-[var(--ink-500)]">Sector:</span> {project.buyer.sector.replace(/_/g, " ")}</p>}
              {project.buyer.site_count != null && <p><span className="text-[var(--ink-500)]">Sites:</span> {project.buyer.site_count}</p>}
              {project.buyer.regions.length > 0 && <p><span className="text-[var(--ink-500)]">Regions:</span> {project.buyer.regions.join(", ").replace(/_/g, " ")}</p>}
              {project.buyer.compliance.length > 0 && <p><span className="text-[var(--ink-500)]">Compliance:</span> {project.buyer.compliance.join(", ").replace(/_/g, " ").toUpperCase()}</p>}
              <p><span className="text-[var(--ink-500)]">Methodology:</span> v{project.methodology_version}</p>
              <p><span className="text-[var(--ink-500)]">Questions:</span> {totalQuestions} across {sections.length} sections</p>
            </div>
          </header>

          {/* Background: synthesised buyer profile + any free-text notes */}
          <section className="mb-8">
            <h2 className="mb-2 text-lg font-semibold">Project background</h2>
            <p className="mb-2 text-sm text-[var(--ink-800)]">{buyerProfileSentence(project)}</p>
            {project.buyer.notes.trim() && (
              <p className="whitespace-pre-line text-sm text-[var(--ink-800)]">{project.buyer.notes.trim()}</p>
            )}
          </section>

          {/* Sections */}
          {sections.map((s) => (
            <section key={s.category} className="mb-8">
              <h2 className="mb-3 text-lg font-semibold">{s.category}</h2>
              <ol className="space-y-3 pl-5 text-sm" style={{ listStyleType: "decimal" }}>
                {s.questions.map((q) => (
                  <li key={q.id}>
                    <p>
                      {q.mandatory && <span className="mr-1.5 rounded-full bg-red-50 px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide text-red-700">Mandatory</span>}
                      {q.priority === "optional" && <span className="mr-1.5 rounded-full bg-[var(--ink-100,#f3f4f6)] px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide text-[var(--ink-600)]">For information</span>}
                      {q.text}
                    </p>
                    {q.evidence_requested && <p className="mt-0.5 text-xs text-[var(--ink-600)]">Evidence required: {q.evidence_requested}</p>}
                    {q.rationale && <p className="mt-0.5 text-xs text-[var(--ink-500)]">Why this matters: {q.rationale}</p>}
                    {/* Informational items carry no scoring furniture: they are
                        never answered, counted or weighted. */}
                    {q.priority !== "optional" && <p className="mt-0.5 text-xs text-[var(--ink-400,#9ca3af)]">Weighting {q.weight}/5{q.priority === "required" ? " · required" : ""}</p>}
                  </li>
                ))}
              </ol>
            </section>
          ))}

          {/* Evidence checklist */}
          {evidence.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-2 text-lg font-semibold">Evidence checklist</h2>
              <p className="mb-2 text-sm text-[var(--ink-600)]">Suppliers should return these artefacts with their response:</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--ink-800)]">
                {evidence.map((e) => (
                  <li key={e.item}>{e.item} <span className="text-xs text-[var(--ink-400,#9ca3af)]">({e.questionIds.length} {e.questionIds.length === 1 ? "question" : "questions"})</span></li>
                ))}
              </ul>
            </section>
          )}

          {/* Scoring */}
          <section className="mb-8">
            <h2 className="mb-2 text-lg font-semibold">Scoring approach</h2>
            <p className="mb-3 text-sm text-[var(--ink-700)]">
              Responses are scored per question (1–5) multiplied by the question weighting. Mandatory questions are pass/fail
              gates: a failed mandatory excludes the response regardless of score.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--ink-200,#e5e5e5)] text-left text-xs uppercase tracking-wide text-[var(--ink-500)]">
                  <th className="py-1.5 pr-4">Section</th>
                  <th className="py-1.5 pr-4">Questions</th>
                  <th className="py-1.5 pr-4">Mandatory</th>
                  <th className="py-1.5">Weight share</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((st) => (
                  <tr key={st.category} className="border-b border-[var(--ink-100,#f1f1f1)]">
                    <td className="py-1.5 pr-4">{st.category}</td>
                    <td className="py-1.5 pr-4">{st.questionCount}</td>
                    <td className="py-1.5 pr-4">{st.mandatoryCount}</td>
                    <td className="py-1.5">{(st.weightShare * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Submission + appendix */}
          <section className="mb-8">
            <h2 className="mb-2 text-lg font-semibold">Submission instructions</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--ink-700)]">
              <li>Respond through the Netify marketplace response link provided with this RFP: structured answers per question, evidence uploads, private pricing.</li>
              <li>Answer every question; mark exceptions explicitly rather than omitting them.</li>
              <li>Pricing submitted through the marketplace stays private to the buyer.</li>
              {project.nda.required && <li>An NDA must be accepted before the full requirement detail and response form unlock.</li>}
            </ul>
          </section>

          <section className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4 text-xs text-[var(--ink-600)]">
            <p className="eyebrow mb-2">Provenance and review</p>
            <p className="mb-1">Question sources: Netify question bank v{BANK_VERSION} and the extended SASE canonical bank ({SASE_EXTENDED_BANK.question_bank_version}), plus buyer-specific questions generated from the project context. Per-question provenance is carried in the rationale lines.</p>
            <p className="mb-1">Canonical methodology: <a href="https://netify.co.uk/methodology/" className="underline">netify.co.uk/methodology</a> · Question bank: <Link href={`/rfp-builder/questions`} className="underline">/sase/rfp-builder/questions</Link></p>
            <p><strong>Human review required.</strong> This document was assembled with AI assistance. Review every question, weighting and mandatory flag against your actual requirement before issuing to suppliers.</p>
          </section>
        </article>

        {/* Download gate */}
        <aside className="print:hidden">
          <div className="sticky top-6 space-y-4">
            <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5">
              {signedIn ? (
                <>
                  <p className="mb-1 text-sm font-medium">Download this RFP</p>
                  <p className="mb-4 text-sm text-[var(--ink-600)]">Signed in as {session?.email}. Download the document, or print to PDF.</p>
                  <a href={`/sase/rfp-builder/${id}/preview/download${keyQs}`} className="mb-2 inline-flex w-full items-center justify-center rounded-full bg-amber-500 px-5 py-2.5 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400">
                    Download RFP (Markdown)
                  </a>
                  <PrintButton />
                </>
              ) : (
                <>
                  <p className="mb-1 text-sm font-medium">Download this RFP</p>
                  <p className="mb-4 text-sm text-[var(--ink-600)]">
                    Create an account to download the final RFP, save versions and invite suppliers.
                    You can keep editing the preview before signing in — nothing is lost.
                  </p>
                  <SignIn role="buyer" prompt="Sign in with your work email to download and manage this RFP." />
                </>
              )}
            </div>
            <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5 text-sm">
              <p className="eyebrow mb-2">Next steps</p>
              <ul className="space-y-1.5">
                <li><Link href={`/rfp-builder/${id}${keyQs}`} className="underline">Keep editing in the builder</Link></li>
                <li><Link href={`/rfp-builder/${id}/review${keyQs}`} className="underline">Agent review and approvals</Link></li>
                <li><Link href="/opportunities/new" className="underline">Publish a companion project notice</Link></li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
