import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getProject, getSession, listResponses, listSignoffs, kvConfigured, kvGetJson } from "@/lib/rfp-store";
import { SESSION_COOKIE } from "@/lib/auth";
import { projectPhase, openSecurityGaps } from "@/lib/project-machine";
import { projectHealth, type HealthTone } from "@/lib/project-health";
import { signoffHealthContext } from "@/lib/project-approvals";
import { humaniseEvent } from "@/lib/project-story";
import ApprovalRequest from "@/components/ApprovalRequest";
import { includedSections } from "@/lib/rfp-document";
import { PROJECT_PHASE } from "@/lib/rfp-types";
import type { SecurityScopeVerdict } from "@/lib/security/rulebook";
import ProjectNav from "@/components/ProjectNav";
import EngineFlowGuide from "@/components/EngineFlowGuide";
import GapActions from "@/components/GapActions";
import SignIn from "@/components/SignIn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Project Home (Phase D1): the buyer's front door and the permanent
 * navigation root. A container VIEW over the existing record, never an
 * editor: every tile reads fields that already exist and links out to the
 * existing surfaces. The one write on this screen is gap acceptance, which
 * records consent + history through the single write gate.
 *
 * One home for every project (Article 17): engine records render the full
 * set of tiles; legacy records render the same layout with the engine
 * tiles absent and phase derived from status. Private workspace: noindex.
 */

export const metadata: Metadata = { title: "Project", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ manage?: string }> };

const TONE_STYLES: Record<HealthTone, string> = {
  green: "border-emerald-300 bg-emerald-50 text-emerald-900",
  amber: "border-amber-400 bg-amber-50 text-amber-900",
  red: "border-red-300 bg-red-50 text-red-900",
  yellow: "border-yellow-300 bg-yellow-50 text-yellow-900",
  blue: "border-sky-300 bg-sky-50 text-sky-900",
  purple: "border-purple-300 bg-purple-50 text-purple-900",
  neutral: "border-[var(--ink-300,#ccc)] bg-[var(--paper-base,#faf9f7)] text-[var(--ink-800)]",
};

const TONE_DOT: Record<HealthTone, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  yellow: "bg-yellow-400",
  blue: "bg-sky-500",
  purple: "bg-purple-500",
  neutral: "bg-[var(--ink-400,#9ca3af)]",
};

const PHASE_LABELS: Record<string, string> = {
  scoping: "Scoping", scoped: "Scoped", drafting: "Drafting", drafted: "Drafted",
  published: "Published", qa: "Clarifications", evaluation: "Evaluation",
  awarded: "Awarded", transacting: "Transacting", complete: "Complete", closed: "Closed",
};

// Event humanisation is shared with the Story and Timeline (one truth):
// src/lib/project-story.ts humaniseEvent.

export default async function ProjectHomePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { manage } = await searchParams;
  if (!kvConfigured()) notFound();
  const project = await getProject(id);
  if (!project) notFound();

  const jar = await cookies();
  const session = await getSession(jar.get(SESSION_COOKIE)?.value ?? null);
  const tokenOk = Boolean(project.manage_token) && manage === project.manage_token;
  const sessionOwner =
    Boolean(session) &&
    (session?.role === "netify" ||
      (session?.role === "buyer" && Boolean(project.owner_email) && session.email.toLowerCase() === project.owner_email.toLowerCase()));

  if (!tokenOk && !sessionOwner) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24">
        <p className="eyebrow mb-2">Project</p>
        <h1 className="mb-3 text-2xl">This project is private to the buyer</h1>
        <p className="mb-6 text-sm text-[var(--ink-600)]">
          Open it from your builder link (it carries your private key), or sign in with the email that created it.
          Vendors and service providers respond through the invitation link instead.
        </p>
        <div className="mb-6"><SignIn role="buyer" prompt="Sign in with the email that created this project." /></div>
        <p className="text-sm"><a href="https://netify.co.uk/" className="underline">Start a project on the desk</a></p>
      </div>
    );
  }

  const qs = tokenOk && manage ? `?manage=${encodeURIComponent(manage)}` : "";
  /* Preview doors carry their origin so the return link comes back here,
   * not to the builder (Harry's Section 1 finding, 28 Jul 2026). */
  const qsFrom = qs ? `${qs}&from=project` : "?from=project";
  /* The board twin, when this project listed publicly: the publication card
   * points at its real object instead of duplicating the builder door. */
  const boardOpp = await kvGetJson<string>(`rfp:${id}:board_opp`).catch(() => null);
  const phase = projectPhase(project);
  const engine = project.engine === "security_sourcing";
  const responses = await listResponses(id);
  const signoffs = await listSignoffs(id);
  const health = projectHealth(project, { responseCount: responses.length, approvals: signoffHealthContext(signoffs) });

  const verdictEntry = (project.engine_data?.verdicts ?? []).slice(-1)[0];
  const verdict = verdictEntry?.verdict as SecurityScopeVerdict | undefined;
  const artefacts = project.engine_data?.artefacts ?? [];
  const latestArtefact = artefacts[artefacts.length - 1];
  const gaps = engine ? openSecurityGaps(project) : [];
  const scored = includedSections(project);
  const questionCount = scored.reduce((n, s) => n + s.questions.length, 0);
  const infoCount = project.rfp_sections.reduce(
    (n, s) => n + s.questions.filter((q) => q.priority === "optional" && q.source === "custom").length,
    0,
  );
  const history = project.history ?? [];
  const recent = history.slice(-5).reverse();
  const phaseIdx = PROJECT_PHASE.indexOf(phase);
  const isPublished = phase === "published" || phaseIdx > PROJECT_PHASE.indexOf("published");
  const invitedCount = (project.invited_vendors ?? []).length;
  const boardOppId = engine && isPublished ? await kvGetJson<string>(`rfp:${id}:board_opp`) : null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <p className="eyebrow mb-1">Project</p>
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-2xl">{project.title || "Untitled project"}</h1>
        <span className="rounded-full border border-[var(--ink-300,#ccc)] px-2 py-0.5 text-xs text-[var(--ink-700)]">{PHASE_LABELS[phase] ?? phase}</span>
        {project.test && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">TEST</span>}
      </div>
      <p className="mb-5 text-sm text-[var(--ink-600)]">
        Everything about this procurement starts here: the assessment, the document, publication, responses and the record of every decision.
      </p>

      <ProjectNav id={id} manage={tokenOk ? manage : undefined} active="overview" engine={engine} />

      {/* Procurement health: the one thing a busy buyer looks at. */}
      <div className={`mb-6 flex items-start gap-3 rounded-2xl border-2 p-4 ${TONE_STYLES[health.tone]}`}>
        <span aria-hidden className={`mt-1 inline-block h-3 w-3 shrink-0 rounded-full ${TONE_DOT[health.tone]}`} />
        <div>
          <p className="m-0 text-sm font-semibold">{health.label}</p>
          <p className="m-0 mt-0.5 text-sm">{health.detail}</p>
        </div>
      </div>

      {/* Engine projects get the three-act flow guide (goal: a published
          requirement); legacy projects keep the machine's phase strip. */}
      {engine ? (
        <EngineFlowGuide published={isPublished} gapCount={gaps.length} invitedCount={invitedCount} responseCount={responses.length} />
      ) : (
        <ol className="mb-8 flex list-none flex-wrap items-center gap-x-1.5 gap-y-1 p-0 text-xs" aria-label="Procurement phases">
          {PROJECT_PHASE.filter((p) => p !== "closed").map((p, i) => (
            <li key={p} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden className="text-[var(--ink-300,#ccc)]">→</span>}
              <span className={p === phase ? "rounded-full bg-[var(--ink-900,#111)] px-2 py-0.5 font-medium text-white" : PROJECT_PHASE.indexOf(p) < phaseIdx ? "text-[var(--ink-700)]" : "text-[var(--ink-400,#9ca3af)]"}>
                {PHASE_LABELS[p] ?? p}
              </span>
            </li>
          ))}
        </ol>
      )}

      {/* Published: the live board listing, front and centre. */}
      {engine && isPublished && (
        <div className="mb-6 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4">
          <p className="m-0 text-sm font-semibold text-emerald-900">Your requirement is live on the Netify board</p>
          <p className="m-0 mt-0.5 text-sm text-emerald-900">
            {invitedCount} vendor{invitedCount === 1 ? "" : "s"} invited, {responses.length} response{responses.length === 1 ? "" : "s"} so far. The public listing is anonymous; vendors sign in to see the full requirement, and your identity stays private until you reply.
          </p>
          <p className="m-0 mt-2 text-sm">
            {boardOppId && (
              <>
                <Link href={`/opportunities/${boardOppId}`} className="font-medium underline">View your live board listing</Link>
                <span className="mx-2 text-emerald-700/40">·</span>
              </>
            )}
            <Link href={`/rfp-builder/${id}/review${qs}`} className="underline">Review responses</Link>
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {engine && (
          <section className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4">
            <p className="eyebrow mb-1">Assessment</p>
            <p className="m-0 text-sm text-[var(--ink-800)]">
              {verdict ? `Confidence ${verdict.confidence}. ${verdict.summary.recommended.length} required, ${verdict.summary.conditional.length} conditional, ${verdict.summary.not_recommended.length} excluded.` : "No verdict on record."}
            </p>
            <p className="m-0 mt-2 text-sm">
              <Link href={`/project/${id}/assessment${qs}`} className="underline">View the assessment</Link>
              {["scoping", "scoped", "drafting", "drafted"].includes(phase) && (
                <>
                  <span className="mx-2 text-[var(--ink-300,#ccc)]">·</span>
                  <Link href={`/project/${id}/rescope${qs}`} className="underline">Re-scope</Link>
                </>
              )}
              {/* Fifth amendment (13 Aug 2026): the one real entry point
                  into ProjectDesk's resume capability -- carries this
                  project's id, and its manage token when the visitor
                  actually holds one, so the workspace chat can rehydrate
                  its source ledger and keep saving to THIS project instead
                  of minting a new one.
                  Sixth amendment (13 Aug 2026), Robert's gap 4: a
                  signed-in owner reaching this page through their account
                  (sessionOwner, no manage token in the URL at all) could
                  see this whole page -- this page's own access gate two
                  lines up is `!tokenOk && !sessionOwner`, so sessionOwner
                  alone is already enough to be looking at this page -- but
                  the link itself required `tokenOk` regardless, so that
                  same owner had no way to reach resume. The server side
                  never needed a token from a session-authorised owner
                  (requireRfpOwner falls back to the session, same-origin
                  cookies travel with ProjectDesk's own fetch calls
                  automatically) -- only this link's gate was too narrow.
                  Now gated on owner-ness generally (tokenOk OR
                  sessionOwner), and the URL carries `manage=` only when a
                  real token is actually held; a session-only owner's link
                  omits it, and ProjectDesk's resume effect authenticates
                  by cookie instead. Still only while the project is
                  editable. */}
              {(tokenOk || sessionOwner) && ["scoping", "scoped", "drafting", "drafted"].includes(phase) && (
                <>
                  <span className="mx-2 text-[var(--ink-300,#ccc)]">·</span>
                  <Link href={`/workspace/?id=${id}${tokenOk && manage ? `&manage=${encodeURIComponent(manage)}` : ""}`} className="underline">Add more detail</Link>
                </>
              )}
            </p>
          </section>
        )}

        {engine && (
          <section className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4">
            <p className="eyebrow mb-1">Current verdict</p>
            <p className="m-0 text-sm text-[var(--ink-800)]">
              {verdictEntry ? `Version ${verdictEntry.version}, ${new Date(verdictEntry.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.` : "None."}
            </p>
            {verdictEntry && <p className="m-0 mt-1 break-all text-xs text-[var(--ink-500)]">Digest {String(verdictEntry.input_digest).slice(0, 16)}…</p>}
          </section>
        )}

        {engine ? (
          <section className={`rounded-sm border p-4 sm:col-span-2 ${isPublished ? "border-[var(--ink-200,#e5e5e5)]" : "border-2 border-amber-400"}`}>
            <p className="eyebrow mb-1">Your statement of requirements</p>
            <p className="m-0 text-sm text-[var(--ink-800)]">
              {latestArtefact
                ? `Version ${latestArtefact.version}: ${questionCount} questions${infoCount ? ` plus ${infoCount} information items` : ""}, generated from your assessment.`
                : "Not yet generated from your assessment."}
            </p>
            <p className="m-0 mt-1.5 text-xs text-[var(--ink-600,#555)]">
              This is the page vendors and service providers see and respond to. Review it, adjust what is in scope, then publish it to the board.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Link
                href={`/rfp-builder/${id}/preview${qsFrom}`}
                className="inline-flex items-center rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 no-underline transition-colors hover:bg-amber-400"
              >
                {isPublished ? "View your requirement →" : "Preview and publish →"}
              </Link>
              {project.share_token && (
                <Link href={`/rfp-builder/${id}/respond?token=${encodeURIComponent(project.share_token)}`} className="text-sm underline">
                  View as vendors will see it
                </Link>
              )}
            </div>
          </section>
        ) : (
          <section className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4">
            <p className="eyebrow mb-1">Current RFP</p>
            <p className="m-0 text-sm text-[var(--ink-800)]">
              {latestArtefact
                ? `Version ${latestArtefact.version}: ${questionCount} questions${infoCount ? ` plus ${infoCount} information items` : ""}.`
                : questionCount
                  ? `${questionCount} questions.`
                  : "Not yet drafted."}
            </p>
            <p className="m-0 mt-1.5 text-xs text-[var(--ink-600,#555)]">
              Opens in the Netify RFP builder with your assessment carried through; you review and refine there before anything goes to vendors and service providers.
            </p>
            <p className="m-0 mt-2 text-sm">
              <Link href={`/rfp-builder/${id}${qs}`} className="underline">Review and edit</Link>
              <span className="mx-2 text-[var(--ink-300,#ccc)]">·</span>
              <Link href={`/rfp-builder/${id}/preview${qsFrom}`} className="underline">Preview</Link>
            </p>
          </section>
        )}

        {engine && (
          <section className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4">
            <p className="eyebrow mb-1">Before you publish</p>
            {gaps.length === 0 ? (
              <p className="m-0 text-sm text-[var(--ink-800)]">No open scoping gaps. Nothing blocks publication.</p>
            ) : (
              <>
                <p className="m-0 mb-2 text-sm text-[var(--ink-800)]">
                  {gaps.length} to answer or accept before publication. <Link href={`/project/${id}/rescope${qs}`} className="underline">Answer by re-scoping</Link> (a new verdict and document version, earlier versions kept), or accept below to record the decision.
                </p>
                <GapActions projectId={id} manage={tokenOk ? manage : undefined} gaps={gaps} />
              </>
            )}
          </section>
        )}

        <section className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4">
          <p className="eyebrow mb-1">Publication</p>
          <p className="m-0 text-sm text-[var(--ink-800)]">
            {phase === "published" || phaseIdx > PROJECT_PHASE.indexOf("published")
              ? `Published. ${(project.invited_vendors ?? []).length} vendors invited.`
              : "Not yet published. Publishing invites matched vendors and service providers; pricing stays private to you."}
          </p>
          {signoffs.length > 0 && (
            <ul className="m-0 mt-2 list-none space-y-1 p-0 text-xs text-[var(--ink-700)]">
              {signoffs.map((a, i) => (
                <li key={i}>
                  {a.role} ({a.name}):{" "}
                  {a.decision === "approved" ? <span className="text-emerald-700">approved</span>
                    : a.decision === "declined" ? <span className="text-amber-700">declined{a.note ? ` ("${a.note}")` : ""}</span>
                    : <span className="text-[var(--ink-500)]">awaiting decision</span>}
                </li>
              ))}
            </ul>
          )}
          {/* One door per activity (Harry's Section 1 finding, 28 Jul 2026:
              RFP tab, Review and edit, and Open the builder all reached the
              same page). Editing lives on the Current RFP card; this card
              opens publication's own objects: the publish step when drafted,
              the public notice or the published document after. */}
          <p className="m-0 mt-2 text-sm">
            {engine ? (
              <Link href={`/rfp-builder/${id}/preview${qsFrom}`} className="underline">
                {isPublished ? "View your published requirement" : "Preview and publish your requirement"}
              </Link>
            ) : phase === "drafted" ? (
              // One door per activity, non-engine lane (Harry's P1 retest,
              // 29 Jul 2026): this card no longer duplicates the Current RFP
              // card's builder door. Pre-publish its own object does not
              // exist yet, so it states where publishing happens instead of
              // opening a second door there.
              <span className="text-[var(--ink-600,#555)]">Publishing happens from the builder&rsquo;s submit step, through Review and edit above.</span>
            ) : isPublished ? (
              boardOpp ? (
                <Link href={`/opportunities/${boardOpp}`} className="underline">View the public notice</Link>
              ) : (
                <Link href={`/rfp-builder/${id}/preview${qsFrom}`} className="underline">View the published document</Link>
              )
            ) : null}
          </p>
          {phase === "drafted" && <ApprovalRequest projectId={id} manage={tokenOk ? manage : undefined} />}
        </section>

        <section className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4">
          <p className="eyebrow mb-1">Vendor responses</p>
          <p className="m-0 text-sm text-[var(--ink-800)]">
            {responses.length === 0 ? "No responses yet." : `${responses.length} response${responses.length === 1 ? "" : "s"} received.`}
          </p>
          <p className="m-0 mt-2 text-sm"><Link href={`/rfp-builder/${id}/review${qs}`} className="underline">Review and compare</Link></p>
        </section>
      </div>

      {/* The RFP Builder as a deliberate escape hatch, never the main road
          (Robert's copy, verbatim, 21 July 2026). */}
      {engine && (
        <div className="mt-6 rounded-sm border border-dashed border-[var(--ink-300,#ccc)] p-3.5">
          <p className="m-0 text-xs text-[var(--ink-600,#555)]">
            Prefer to create an RFP?{" "}
            <Link href={`/rfp-builder/${id}${qs}`} className="underline">Try the RFP Builder</Link>. Note: Using the Netify
            Marketplace &lsquo;publish project&rsquo; feature is a much simpler method to understand which vendors and providers
            are fit for your business.
          </p>
        </div>
      )}

      {/* Activity: the record, humanised (shared with Story and Timeline). */}
      <section className="mt-8">
        <p className="eyebrow mb-2">Activity</p>
        {recent.length === 0 ? (
          <>
            {/* Never a bare "nothing" on a project that exists (Harry's
                Section 1 finding, 28 Jul 2026): the creation date is always
                true, and older projects born before creation events were
                recorded still deserve a first line. */}
            <p className="text-sm text-[var(--ink-600)]">
              Created {new Date(project.created).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}. Recorded events appear here as they happen.
            </p>
            <p className="mt-3 text-sm">
              <Link href={`/project/${id}/story${qs}`} className="underline">Full story</Link>
              <span className="mx-2 text-[var(--ink-300,#ccc)]">·</span>
              <Link href={`/project/${id}/timeline${qs}`} className="underline">Timeline</Link>
            </p>
          </>
        ) : (
          <>
            <ul className="m-0 list-none space-y-1.5 p-0">
              {recent.map((h, i) => (
                <li key={`${h.at}-${i}`} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                  <span className="tabular-nums text-xs text-[var(--ink-500)]">
                    {new Date(h.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-[var(--ink-800)]">{humaniseEvent(h.event, h.detail as Record<string, unknown> | undefined)}</span>
                  <span className="text-xs text-[var(--ink-400,#9ca3af)]">{h.actor}{h.via ? ` · ${h.via}` : ""}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm">
              <Link href={`/project/${id}/story${qs}`} className="underline">Full story</Link>
              <span className="mx-2 text-[var(--ink-300,#ccc)]">·</span>
              <Link href={`/project/${id}/timeline${qs}`} className="underline">Timeline</Link>
            </p>
          </>
        )}
      </section>
    </div>
  );
}
