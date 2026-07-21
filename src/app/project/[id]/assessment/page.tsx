import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getProject, getSession, kvConfigured } from "@/lib/rfp-store";
import { SESSION_COOKIE } from "@/lib/auth";
import type { SecurityScopeVerdict } from "@/lib/security/rulebook";
import { CAPABILITY_LABELS } from "@/lib/security/generate-rfp";
import type { CapabilityId } from "@/lib/security/rulebook";
import ProjectNav from "@/components/ProjectNav";
import SignIn from "@/components/SignIn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The stored assessment, read-only (Phase D1): the verdict as attached to
 * the project, rendered from the record rather than recomputed, because
 * this page answers "what did we decide" not "what would we decide now".
 * Re-scoping (D4) is the path to a new verdict; nothing here mutates.
 */

export const metadata: Metadata = { title: "Project assessment", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ manage?: string }> };

const NEEDED_LABELS: Record<string, string> = {
  required: "Required",
  recommended: "Recommended",
  not_indicated: "Not indicated",
  cannot_assess: "Cannot assess",
};

export default async function ProjectAssessmentPage({ params, searchParams }: Props) {
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
        <p className="eyebrow mb-2">Project assessment</p>
        <h1 className="mb-3 text-2xl">This project is private to the buyer</h1>
        <div className="mb-6"><SignIn role="buyer" prompt="Sign in with the email that created this project." /></div>
        <p className="text-sm"><Link href="/rfp-builder" className="underline">Go to the RFP builder</Link></p>
      </div>
    );
  }

  const qs = tokenOk && manage ? `?manage=${encodeURIComponent(manage)}` : "";
  const verdictEntry = (project.engine_data?.verdicts ?? []).slice(-1)[0];
  const verdict = verdictEntry?.verdict as SecurityScopeVerdict | undefined;
  if (!verdict) redirect(`/project/${id}${qs}`);

  const label = (cid: string) => CAPABILITY_LABELS[cid as CapabilityId] ?? cid;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <p className="eyebrow mb-1">Project</p>
      <h1 className="mb-1 text-2xl">{project.title || "Untitled project"}</h1>
      <p className="mb-5 text-sm text-[var(--ink-600)]">
        The scoping verdict as recorded (version {verdictEntry.version}, {verdict.rulebookVersion}, confidence {verdict.confidence}).
        This is the record, not a recomputation; re-scoping attaches a new version and keeps this one.
      </p>

      <ProjectNav id={id} manage={tokenOk ? manage : undefined} active="assessment" engine={true} />

      <section className="mb-6">
        <p className="eyebrow mb-2">Capabilities</p>
        <ul className="m-0 list-none space-y-2 p-0">
          {verdict.capabilities.map((c) => (
            <li key={c.id} className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-3">
              <p className="m-0 text-sm font-medium text-[var(--ink-900,#111)]">
                {label(c.id)}
                <span className="ml-2 rounded-full border border-[var(--ink-300,#ccc)] px-2 py-0.5 text-xs font-normal text-[var(--ink-700)]">{NEEDED_LABELS[c.needed] ?? c.needed}</span>
              </p>
              <p className="m-0 mt-1 text-sm text-[var(--ink-700)]">{c.reasoning}</p>
              {c.firedRules.length > 0 && <p className="m-0 mt-1 text-xs text-[var(--ink-500)]">Rules: {c.firedRules.join(", ")}</p>}
            </li>
          ))}
        </ul>
      </section>

      {verdict.summary.not_recommended.length > 0 && (
        <section className="mb-6">
          <p className="eyebrow mb-2">Why we did not recommend</p>
          <ul className="m-0 list-none space-y-2 p-0">
            {verdict.summary.not_recommended.map((n) => (
              <li key={n.capabilityId} className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-3 text-sm text-[var(--ink-800)]">
                <span className="font-medium">{label(n.capabilityId)}:</span> {n.reason}
                {n.alternative && <span className="text-[var(--ink-600)]"> {n.alternative}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {verdict.againstInterest.length > 0 && (
        <section className="mb-6 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4">
          <p className="eyebrow mb-2 text-emerald-900">Said against Netify&apos;s own interest</p>
          <ul className="m-0 list-none space-y-2 p-0">
            {verdict.againstInterest.map((a, i) => (
              <li key={i} className="text-sm text-emerald-900">{a.statement}</li>
            ))}
          </ul>
        </section>
      )}

      {verdict.assumptions.length > 0 && (
        <section className="mb-6">
          <p className="eyebrow mb-2">Assumptions</p>
          <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-[var(--ink-700)]">
            {verdict.assumptions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </section>
      )}

      {verdict.gaps.length > 0 && (
        <section className="mb-6">
          <p className="eyebrow mb-2">Gaps recorded at this version</p>
          <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-[var(--ink-700)]">
            {verdict.gaps.map((g, i) => <li key={i}>{g.question}</li>)}
          </ul>
          <p className="mt-2 text-xs text-[var(--ink-500)]">Open gaps are answered by re-scoping or individually accepted on the <Link href={`/project/${id}${qs}`} className="underline">project overview</Link>; acceptance is recorded.</p>
        </section>
      )}

      <p className="break-all text-xs text-[var(--ink-500)]">
        Provenance: {verdict.rulebookVersion}, generated {verdict.generatedAt}, input digest {verdict.inputDigest}.
      </p>
    </div>
  );
}
