import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getProject, getSession, listResponses, kvConfigured } from "@/lib/rfp-store";
import { SESSION_COOKIE } from "@/lib/auth";
import { buildStory, gapLabel } from "@/lib/project-story";
import { projectHealth } from "@/lib/project-health";
import { openSecurityGaps } from "@/lib/project-machine";
import ProjectNav from "@/components/ProjectNav";
import SignIn from "@/components/SignIn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Project Story (Phase D3, flagship): the record, explained in
 * chapters. Six months later this page answers why it was scoped this
 * way, why things were excluded, who accepted which risk, what changed
 * between versions and who approved what. Pure view: every line renders
 * a recorded field; verbatim quotations are visually separated from
 * narration. The chronological projection lives on the Timeline tab.
 */

export const metadata: Metadata = { title: "Project story", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ manage?: string }> };

const dt = (ms: number) => new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function ProjectStoryPage({ params, searchParams }: Props) {
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
        <p className="eyebrow mb-2">Project story</p>
        <h1 className="mb-3 text-2xl">This project is private to the buyer</h1>
        <div className="mb-6"><SignIn role="buyer" prompt="Sign in with the email that created this project." /></div>
        <p className="text-sm"><Link href="/rfp-builder" className="underline">Go to the RFP builder</Link></p>
      </div>
    );
  }

  const qs = tokenOk && manage ? `?manage=${encodeURIComponent(manage)}` : "";
  const s = buildStory(project);
  const engine = project.engine === "security_sourcing";

  // D3.1 (Robert's tweak): the executive landing. What happened, where are
  // we, anything to worry about, in five seconds, before the evidence.
  // Every line derives from the same one-truth helpers as everywhere else.
  const responses = await listResponses(id);
  const health = projectHealth(project, { responseCount: responses.length });
  const gaps = engine ? openSecurityGaps(project) : [];
  const latestChapter = s.verdictChapters[s.verdictChapters.length - 1];
  const keyDecisions: string[] = [
    ...(latestChapter?.excluded ?? []).map((e) => `${e.label} excluded`),
    ...s.decisions.filter((c) => c.action.startsWith("accept_gap:")).map((c) => `Gap accepted: ${gapLabel(c.action.slice("accept_gap:".length))}`),
    ...s.decisions.filter((c) => c.action.startsWith("rescope")).map(() => "Project re-scoped"),
    ...s.decisions.filter((c) => c.action.startsWith("approve_publish:")).map((c) => `Approved by ${c.action.slice("approve_publish:".length)}`),
  ];
  const risks = gaps.length > 0 ? `${gaps.length} open scoping gap${gaps.length === 1 ? "" : "s"}` : "None";

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <p className="eyebrow mb-1">Project</p>
      <h1 className="mb-1 text-2xl">{project.title || "Untitled project"}</h1>
      <p className="mb-5 text-sm text-[var(--ink-600)]">
        The story of this procurement, rendered from its append-only record: why it was scoped this way, what changed, and who decided what.
        Quoted lines are verbatim from the record.
      </p>

      <ProjectNav id={id} manage={tokenOk ? manage : undefined} active="story" engine={engine} />

      {/* Project summary (D3.1): the executive landing before the evidence. */}
      <section className="mb-8 rounded-2xl border border-[var(--ink-200,#e5e5e5)] bg-[var(--paper-base,#faf9f7)] p-5">
        <p className="eyebrow mb-3">Project summary</p>
        <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="m-0 text-xs font-medium uppercase tracking-wide text-[var(--ink-500)]">Status</p>
            <p className="m-0 mt-0.5 font-medium text-[var(--ink-900,#111)]">{health.label}</p>
          </div>
          <div>
            <p className="m-0 text-xs font-medium uppercase tracking-wide text-[var(--ink-500)]">Current verdict</p>
            <p className="m-0 mt-0.5 text-[var(--ink-800)]">{latestChapter ? `v${latestChapter.version}` : "None"}</p>
          </div>
          <div>
            <p className="m-0 text-xs font-medium uppercase tracking-wide text-[var(--ink-500)]">Current RFP</p>
            <p className="m-0 mt-0.5 text-[var(--ink-800)]">{s.documentVersions.length ? `v${s.documentVersions[s.documentVersions.length - 1].version}` : "None"}</p>
          </div>
          <div>
            <p className="m-0 text-xs font-medium uppercase tracking-wide text-[var(--ink-500)]">Outstanding risks</p>
            <p className="m-0 mt-0.5 text-[var(--ink-800)]">{risks}</p>
          </div>
        </div>
        {keyDecisions.length > 0 && (
          <div className="mt-4">
            <p className="m-0 text-xs font-medium uppercase tracking-wide text-[var(--ink-500)]">Key decisions</p>
            <ul className="m-0 mt-1 list-disc pl-5 text-sm text-[var(--ink-800)]">
              {keyDecisions.slice(0, 5).map((d, i) => <li key={i}>{d}</li>)}
              {keyDecisions.length > 5 && <li>and {keyDecisions.length - 5} more in the decisions ledger below</li>}
            </ul>
          </div>
        )}
      </section>

      <div className="mb-6">
        <a href={`/sase/project/${id}/story/download${qs}`} className="inline-flex items-center rounded-full border border-[var(--ink-900,#111)] px-4 py-1.5 text-sm no-underline hover:bg-[var(--ink-900,#111)] hover:text-white transition-colors">
          Download the story (Markdown)
        </a>
      </div>

      {/* Origin */}
      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">Origin</h2>
        <p className="m-0 text-sm text-[var(--ink-800)]">Created {dt(s.origin.at)} by {s.origin.actor} via {s.origin.via}.</p>
        {s.origin.consentText && (
          <blockquote className="mt-2 border-l-2 border-[var(--ink-300,#ccc)] pl-3 text-sm italic text-[var(--ink-700)]">&ldquo;{s.origin.consentText}&rdquo;</blockquote>
        )}
      </section>

      {/* Scoping chapters */}
      {s.verdictChapters.map((v) => (
        <section key={v.version} className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">Scoping verdict v{v.version}</h2>
          <p className="m-0 mb-2 text-sm text-[var(--ink-600)]">{dt(v.at)} · {v.rulebookVersion} · confidence {v.confidence}</p>
          {v.required.length > 0 && <p className="m-0 text-sm text-[var(--ink-800)]"><span className="font-medium">Required:</span> {v.required.join("; ")}.</p>}
          {v.conditional.length > 0 && <p className="m-0 mt-1 text-sm text-[var(--ink-800)]"><span className="font-medium">Conditional:</span> {v.conditional.join("; ")}.</p>}
          {v.excluded.map((e) => (
            <div key={e.label} className="mt-2 rounded-sm border border-[var(--ink-200,#e5e5e5)] p-3">
              <p className="m-0 text-sm font-medium text-[var(--ink-900,#111)]">Excluded: {e.label}</p>
              <blockquote className="m-0 mt-1 border-l-2 border-[var(--ink-300,#ccc)] pl-3 text-sm italic text-[var(--ink-700)]">&ldquo;{e.reason}&rdquo;</blockquote>
              {e.alternative && <p className="m-0 mt-1 text-xs text-[var(--ink-600)]">Alternative recorded: {e.alternative}</p>}
            </div>
          ))}
          {v.againstInterest.length > 0 && (
            <div className="mt-2 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-3">
              <p className="m-0 mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-900">Said against Netify&apos;s own interest</p>
              {v.againstInterest.map((a, i) => (
                <blockquote key={i} className="m-0 mt-1 border-l-2 border-emerald-400 pl-3 text-sm italic text-emerald-900">&ldquo;{a}&rdquo;</blockquote>
              ))}
            </div>
          )}
          {v.gaps.length > 0 && (
            <p className="m-0 mt-2 text-xs text-[var(--ink-600)]">Gaps at this version: {v.gaps.map((g) => g.question).join(" ")}</p>
          )}
          <p className="m-0 mt-2 break-all text-xs text-[var(--ink-500)]">Digest {v.digest}</p>
        </section>
      ))}

      {/* Document versions with diffs */}
      {s.documentVersions.map((d) => (
        <section key={d.version} className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">RFP version {d.version}</h2>
          <p className="m-0 text-sm text-[var(--ink-800)]">{dt(d.at)} · {d.sections} sections, {d.questions} questions · generated from verdict {d.digest.slice(0, 16)}…</p>
          {d.diff && (
            <div className="mt-2 text-sm text-[var(--ink-800)]">
              {d.diff.sectionsAdded.length > 0 && <p className="m-0">Sections added: {d.diff.sectionsAdded.join("; ")}.</p>}
              {d.diff.sectionsRemoved.length > 0 && <p className="m-0">Sections removed: {d.diff.sectionsRemoved.join("; ")}.</p>}
              {d.diff.questionsAdded.length > 0 && <p className="m-0">Questions added: {d.diff.questionsAdded.length}.</p>}
              {d.diff.questionsRemoved.length > 0 && <p className="m-0">Questions removed: {d.diff.questionsRemoved.length}.</p>}
              {d.diff.questionsReworded.map((r) => (
                <p key={r.id} className="m-0 mt-1 text-xs text-[var(--ink-600)]">Reworded {r.id}: &ldquo;{r.before}&rdquo; → &ldquo;{r.after}&rdquo;</p>
              ))}
              {d.diff.sectionsAdded.length === 0 && d.diff.sectionsRemoved.length === 0 && d.diff.questionsAdded.length === 0 && d.diff.questionsRemoved.length === 0 && d.diff.questionsReworded.length === 0 && (
                <p className="m-0 text-[var(--ink-600)]">No content changes against version {d.version - 1}.</p>
              )}
            </div>
          )}
        </section>
      ))}

      {/* Decisions: the consent ledger */}
      {s.decisions.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">Decisions</h2>
          <p className="mb-2 text-sm text-[var(--ink-600)]">The consent ledger, verbatim: every wording exactly as shown when it was agreed.</p>
          <ul className="m-0 list-none space-y-2 p-0">
            {s.decisions.map((c, i) => (
              <li key={i} className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-3">
                <p className="m-0 text-xs text-[var(--ink-500)]">{dt(c.at)} · {c.action} · {c.granted_by} via {c.via}</p>
                <blockquote className="m-0 mt-1 border-l-2 border-[var(--ink-300,#ccc)] pl-3 text-sm italic text-[var(--ink-700)]">&ldquo;{c.text}&rdquo;</blockquote>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-[var(--ink-500)]">
        Provenance: methodology {s.provenance.methodologyVersion}{s.provenance.rulebookVersion ? `; ${s.provenance.rulebookVersion}` : ""}. The record is append-only; corrections appear as corrections, never as replacements. Prefer events to artefacts? <Link href={`/project/${id}/timeline${qs}`} className="underline">Open the timeline</Link>.
      </p>
    </div>
  );
}
