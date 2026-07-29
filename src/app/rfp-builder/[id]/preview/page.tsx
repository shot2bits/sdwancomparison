import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getProject, getSession, listResponses, kvConfigured, kvGetJson } from "@/lib/rfp-store";
import { SESSION_COOKIE } from "@/lib/auth";
import { documentSections, sectionStats, evidenceChecklist, scopeLabel, modelLabel, buyerProfileSentence, sectorLabel, regionLabelList, complianceLabelList } from "@/lib/rfp-document";
import { BANK_VERSION, SASE_EXTENDED_BANK } from "@/lib/rfp-question-bank";
import { projectPhase, openSecurityGaps } from "@/lib/project-machine";
import { PROJECT_PHASE } from "@/lib/rfp-types";
import { CAPABILITY_BANK_MAP, SERVICE_PATH_CORE_CATEGORIES } from "@/lib/security/criteria";
import { securityCodeLabel, humaniseSecurityCodes } from "@/lib/security/labels";
import type { SecurityScopeVerdict } from "@/lib/security/rulebook";
import { siteFigureIsIdentifying, siteBandLabelFor } from "@/lib/notice-options";
import PrintButton from "@/components/PrintButton";
import SignIn from "@/components/SignIn";
import ProjectNav from "@/components/ProjectNav";
import EngineFlowGuide from "@/components/EngineFlowGuide";
import ScopeToggles, { type ScopeItem } from "@/components/ScopeToggles";
import PublishRequirement from "@/components/PublishRequirement";
import GapActions from "@/components/GapActions";

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

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ manage?: string; from?: string }> };

/** Coarse public band for the anonymous board card; never the raw number. */
function usersBandLabel(n: number | null): string | null {
  if (!n || n <= 0) return null;
  if (n < 50) return "Under 50 users";
  if (n < 250) return "50 to 250 users";
  if (n < 500) return "250 to 500 users";
  if (n < 1000) return "500 to 1,000 users";
  if (n < 5000) return "1,000 to 5,000 users";
  return "Over 5,000 users";
}

export default async function RfpPreviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { manage, from } = await searchParams;
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

  // Engine (Security Sourcing) context: this page is the buyer's statement
  // of requirements and the publish point (Robert's approved mockups,
  // 21 July 2026). Everything below is display-side; the record is untouched.
  const engine = project.engine === "security_sourcing";
  const phase = projectPhase(project);
  const isPublished = phase === "published" || PROJECT_PHASE.indexOf(phase) > PROJECT_PHASE.indexOf("published");
  const gaps = engine ? openSecurityGaps(project) : [];
  const responses = engine ? await listResponses(id) : [];
  const invitedCount = (project.invited_vendors ?? []).length;
  const boardOppId = engine && isPublished ? await kvGetJson<string>(`rfp:${id}:board_opp`) : null;

  const verdictEntry = (project.engine_data?.verdicts ?? []).slice(-1)[0];
  const verdict = verdictEntry?.verdict as SecurityScopeVerdict | undefined;

  // Conditional capabilities the buyer can keep or exclude inline: bank
  // categories driven ONLY by "recommended" capabilities (never core
  // sections, never categories a required capability also needs).
  const scopeItems: ScopeItem[] = [];
  if (engine && verdict) {
    const requiredCats = new Set<string>(SERVICE_PATH_CORE_CATEGORIES);
    for (const c of verdict.capabilities) {
      if (c.needed === "required") for (const cat of CAPABILITY_BANK_MAP[c.id] ?? []) requiredCats.add(cat);
    }
    const seen = new Set<string>();
    for (const capId of verdict.summary.conditional) {
      const cap = verdict.capabilities.find((c) => c.id === capId);
      for (const cat of CAPABILITY_BANK_MAP[capId] ?? []) {
        if (seen.has(cat) || requiredCats.has(cat)) continue;
        const section = project.rfp_sections.find((s) => s.category === cat);
        if (!section) continue;
        seen.add(cat);
        scopeItems.push({
          category: cat,
          label: `${cat} — from the recommended capability: ${securityCodeLabel(capId)}`,
          included: section.included,
          reason: humaniseSecurityCodes(cap?.reasoning ?? ""),
        });
      }
    }
  }

  // The anonymous public card mirrors what listOnBoard actually publishes.
  const engineUsers: number | null = (() => {
    if (!engine) return null;
    const est = (project.engine_data as unknown as { requirement?: { estate?: { users?: number } } } | undefined)?.requirement?.estate;
    if (est && typeof est.users === "number" && est.users > 0) return est.users;
    const m = /Staff:\s*(\d+)\./.exec(project.buyer.notes ?? "");
    return m ? Number(m[1]) : null;
  })();
  const band = usersBandLabel(engineUsers);
  const activeSectionNames = project.rfp_sections
    .filter((s) => s.included && s.questions.some((q) => q.priority !== "optional"))
    .map((s) => s.category);

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {engine && (
        <div className="print:hidden">
          <ProjectNav id={id} manage={tokenOk && manage ? manage : undefined} active="preview" engine />
          <EngineFlowGuide published={isPublished} gapCount={gaps.length} invitedCount={invitedCount} responseCount={responses.length} />
        </div>
      )}
      {!engine && (
        <nav className="mb-6 text-sm text-[var(--ink-500)] print:hidden">
          {/* The return honours where you came from (Harry's Section 1
              finding, 28 Jul 2026: preview opened from the project page
              still said back to the builder). */}
          {from === "project" ? (
            <Link href={`/project/${id}${manage ? `?manage=${encodeURIComponent(manage)}` : ""}`} className="underline">← Back to your project</Link>
          ) : (
            <Link href={`/rfp-builder/${id}`} className="underline">← Back to the builder</Link>
          )}
        </nav>
      )}

      {/* Published: the live listing confirmation. */}
      {engine && isPublished && (
        <div className="mb-6 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 print:hidden">
          <p className="m-0 text-sm font-semibold text-emerald-900">This requirement is live on the Netify board</p>
          <p className="m-0 mt-0.5 text-sm text-emerald-900">
            {invitedCount} supplier{invitedCount === 1 ? "" : "s"} invited, {responses.length} response{responses.length === 1 ? "" : "s"} so far. Your identity and contact details stay private until you reply to a supplier.
          </p>
          <p className="m-0 mt-2 text-sm">
            {boardOppId && (
              <>
                <Link href={`/opportunities/${boardOppId}`} className="font-medium underline">View your live board listing</Link>
                <span className="mx-2 text-emerald-700/40">·</span>
              </>
            )}
            <Link href={`/rfp-builder/${id}/review${keyQs}`} className="underline">Review responses</Link>
          </p>
        </div>
      )}

      {/* The dual-state publish preview (Robert, 21 July 2026: "the user can
          see 'anonymous' when publish public side which changes to 'full
          details' when the supply side logs in. This is the goal for us").
          Both cards render from the same fields the publish bridge sends to
          the board, so the preview cannot overpromise. */}
      {engine && !isPublished && (
        <section className="mb-8 print:hidden">
          <p className="eyebrow mb-1">What publishing looks like</p>
          <p className="m-0 mb-3 text-sm text-[var(--ink-600,#555)]">
            One publish, two views. The open board shows an anonymous notice; verified suppliers sign in to read this full statement of requirements and respond. Your identity, contact details and pricing stay private until you reply.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[var(--ink-200,#e5e5e5)] bg-[var(--paper-base,#faf9f7)] p-4">
              <p className="m-0 mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-500)]">Public board · anyone can see this</p>
              <p className="m-0 text-sm font-semibold text-[var(--ink-900,#111)]">{project.title}</p>
              {/* R4, the preview IS the public face: the site figure here
                  follows the same exact-unless-identifying rule as the live
                  projection, so this card cannot overpromise or overexpose. */}
              <p className="m-0 mt-1 text-xs text-[var(--ink-600,#555)]">
                Anonymous buyer
                {project.buyer.sector ? ` · ${sectorLabel(project.buyer.sector)}` : ""}
                {band ? ` · ${band}` : ""}
                {project.buyer.site_count != null
                  ? ` · ${siteFigureIsIdentifying({ buyer_visibility: "anonymous", buyer_sector: project.buyer.sector ?? "", regions: project.buyer.regions ?? [] })
                      ? (siteBandLabelFor(project.buyer.site_count) ?? `${project.buyer.site_count} sites`)
                      : `${project.buyer.site_count} sites`}`
                  : ""}
              </p>
              {project.buyer.site_count != null && siteFigureIsIdentifying({ buyer_visibility: "anonymous", buyer_sector: project.buyer.sector ?? "", regions: project.buyer.regions ?? [] }) && (
                <p className="m-0 mt-1.5 text-[11px] leading-relaxed text-[var(--ink-500)]">
                  Together, your sector, single region and exact site count could identify you, so the public notice
                  shows the range instead. Participating suppliers see the exact count after the gate.
                </p>
              )}
              {activeSectionNames.length > 0 && (
                <p className="m-0 mt-2 flex flex-wrap gap-1">
                  {activeSectionNames.slice(0, 4).map((c) => (
                    <span key={c} className="rounded-full border border-[var(--ink-300,#ccc)] px-2 py-0.5 text-[10.5px] text-[var(--ink-700)]">{c}</span>
                  ))}
                </p>
              )}
              <p className="m-0 mt-2 text-xs text-[var(--ink-600,#555)]">No company name, no contact details, no exact headcount.</p>
              <span className="mt-2.5 inline-block rounded-full border border-[var(--ink-300,#ccc)] px-3 py-1 text-xs text-[var(--ink-700)]">Sign in to respond</span>
            </div>
            <div className="rounded-lg border-2 border-amber-300 bg-white p-4">
              <p className="m-0 mb-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Signed-in suppliers · full details</p>
              <p className="m-0 text-sm font-semibold text-[var(--ink-900,#111)]">{project.title}</p>
              <p className="m-0 mt-1 text-xs text-[var(--ink-600,#555)]">
                The complete statement of requirements below: {totalQuestions} questions across {sections.length} sections, evidence checklist and scoring approach.
              </p>
              <p className="m-0 mt-2 text-xs text-[var(--ink-600,#555)]">
                Suppliers answer question by question with evidence; their pricing is private to you. Your identity and contact details are still withheld until you choose to reply.
              </p>
              <span className="mt-2.5 inline-block rounded-full bg-amber-500 px-3 py-1 text-xs font-medium text-zinc-950">Respond to this requirement</span>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-10 lg:grid-cols-3">
        <article className="lg:col-span-2">
          {/* Cover */}
          <header className="mb-8 border-b border-[var(--ink-200,#e5e5e5)] pb-6">
            <p className="eyebrow mb-2">{engine ? "Statement of requirements" : "Request for Proposal"}</p>
            <h1 className="mb-4 text-2xl leading-snug">{project.title}</h1>
            <div className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
              <p><span className="text-[var(--ink-500)]">Scope:</span> {scopeLabel(project)}</p>
              <p><span className="text-[var(--ink-500)]">Delivery:</span> {modelLabel(project)}</p>
              {project.buyer.sector && <p><span className="text-[var(--ink-500)]">Sector:</span> {sectorLabel(project.buyer.sector)}</p>}
              {project.buyer.site_count != null && <p><span className="text-[var(--ink-500)]">Sites:</span> {project.buyer.site_count}</p>}
              {project.buyer.regions.length > 0 && <p><span className="text-[var(--ink-500)]">Regions:</span> {regionLabelList(project.buyer.regions)}</p>}
              {project.buyer.compliance.length > 0 && <p><span className="text-[var(--ink-500)]">Compliance:</span> {complianceLabelList(project.buyer.compliance)}</p>}
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

          {/* Inline scope control: conditional capabilities decided here,
              no builder detour (the toggle is an ordinary recorded edit). */}
          {engine && !isPublished && (
            <ScopeToggles projectId={id} manage={tokenOk && manage ? manage : undefined} items={scopeItems} />
          )}

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

        {/* Action rail. The marketplace action leads and the download follows
            (Robert, 21 July 2026): the old order made "Download as Word" the
            loudest button on the page, which invited the buyer to take the
            document and end the process. The document stays free to take;
            the room's primary voice now argues for responses. */}
        <aside className="print:hidden">
          <div className="sticky top-6 space-y-4">
            {engine ? (
              isPublished ? (
                <div className="rounded-sm border-2 border-emerald-300 bg-emerald-50/50 p-5">
                  <p className="mb-1 text-sm font-semibold text-emerald-900">Published and live</p>
                  <p className="mb-3 text-sm text-emerald-900">
                    Matched suppliers can now respond. Pricing and supplier answers stay private to you.
                  </p>
                  <Link
                    href={`/rfp-builder/${id}/review${keyQs}`}
                    className="inline-flex w-full items-center justify-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white no-underline transition-colors hover:bg-emerald-500"
                  >
                    Review responses
                  </Link>
                </div>
              ) : (
                <div className="rounded-sm border-2 border-amber-400 bg-amber-50/40 p-5">
                  <p className="mb-1 text-sm font-semibold">Publish this requirement</p>
                  <p className="mb-3 text-sm text-[var(--ink-700)]">
                    Publishing lists the anonymous notice on the board and opens this statement of requirements
                    to matched, verified suppliers. Responses and pricing come back private to you.
                  </p>
                  {gaps.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-2 text-xs font-medium text-[var(--ink-700)]">First, {gaps.length} scoping gap{gaps.length === 1 ? "" : "s"} to answer or accept:</p>
                      <GapActions projectId={id} manage={tokenOk && manage ? manage : undefined} gaps={gaps} />
                    </div>
                  )}
                  <PublishRequirement projectId={id} manage={tokenOk && manage ? manage : undefined} gapCount={gaps.length} />
                </div>
              )
            ) : (
              <div className="rounded-sm border-2 border-amber-400 bg-amber-50/40 p-5">
                <p className="mb-1 text-sm font-semibold">Get responses, not just a document</p>
                <p className="mb-3 text-sm text-[var(--ink-700)]">
                  Submitting to the marketplace turns this document into competing bids: structured supplier
                  responses side by side, pricing private to you, and your Netify Market Report the moment you
                  submit. Downloading alone ends the process here.
                </p>
                <Link
                  href={`/rfp-builder/${id}${keyQs}`}
                  className="inline-flex w-full items-center justify-center rounded-full bg-amber-500 px-5 py-2.5 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400"
                >
                  Submit to your matched suppliers
                </Link>
              </div>
            )}
            <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5">
              {signedIn ? (
                <>
                  <p className="mb-1 text-sm font-medium">Download this RFP</p>
                  <p className="mb-4 text-sm text-[var(--ink-600)]">Signed in as {session?.email}. The document is yours either way; downloading shares nothing with suppliers.</p>
                  <a href={`/sase/rfp-builder/${id}/preview/download${keyQs}${keyQs ? "&" : "?"}format=doc`} className="mb-2 inline-flex w-full items-center justify-center rounded-full border border-zinc-400 px-5 py-2.5 text-sm font-medium text-zinc-800 no-underline transition-colors hover:bg-zinc-100">
                    Download as Word (.doc)
                  </a>
                  <a href={`/sase/rfp-builder/${id}/preview/download${keyQs}`} className="mb-2 inline-flex w-full items-center justify-center rounded-full border border-zinc-400 px-5 py-2.5 text-sm font-medium text-zinc-800 no-underline transition-colors hover:bg-zinc-100">
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
                <li><Link href={`/project/${id}${keyQs}`} className="underline">Project home</Link></li>
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
