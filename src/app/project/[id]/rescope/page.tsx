import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getProject, getSession, kvConfigured } from "@/lib/rfp-store";
import { SESSION_COOKIE } from "@/lib/auth";
import { projectPhase } from "@/lib/project-machine";
import { documentEdited, confirmationSentence, rescopeConsentText, replaceEditsConsentText } from "@/lib/security/rescope-project";
import type { SecurityRequirementInput } from "@/lib/security/rulebook";
import { SecuritySourcingAdvisor } from "@/components/SecuritySourcingAdvisor";
import ProjectNav from "@/components/ProjectNav";
import SignIn from "@/components/SignIn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Re-scope (Phase D4): the buyer's estate changed; the record accretes.
 * The SAME assessment form and live verdict as creation, pre-filled from
 * the stored requirement, with the version-consequence confirmation
 * before consent. Only sensible before publication: afterwards the
 * machine refuses regeneration anyway (published documents do not change
 * under suppliers).
 */

export const metadata: Metadata = { title: "Re-scope project", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ manage?: string }> };

const PRE_PUBLICATION = ["scoping", "scoped", "drafting", "drafted"];

export default async function RescopePage({ params, searchParams }: Props) {
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
        <p className="eyebrow mb-2">Re-scope project</p>
        <h1 className="mb-3 text-2xl">This project is private to the buyer</h1>
        <div className="mb-6"><SignIn role="buyer" prompt="Sign in with the email that created this project." /></div>
        <p className="text-sm"><Link href="/rfp-builder" className="underline">Go to the RFP builder</Link></p>
      </div>
    );
  }

  const qs = tokenOk && manage ? `?manage=${encodeURIComponent(manage)}` : "";
  if (project.engine !== "security_sourcing") redirect(`/project/${id}${qs}`);
  if (!PRE_PUBLICATION.includes(projectPhase(project))) redirect(`/project/${id}${qs}`);

  const requirement = (project.engine_data?.requirement ?? {}) as SecurityRequirementInput;
  const edited = documentEdited(project);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <p className="eyebrow mb-1">Project</p>
      <h1 className="mb-1 text-2xl">{project.title || "Untitled project"}</h1>
      <p className="mb-5 max-w-3xl text-sm text-[var(--ink-600)]">
        Your estate or situation has changed: adjust the assessment below and the verdict updates live.
        Re-scoping attaches a new verdict version and regenerates the RFP; every earlier version stays in the
        project record and the story shows exactly what changed.
      </p>

      <ProjectNav id={id} manage={tokenOk ? manage : undefined} active="rescope" engine={true} />

      <SecuritySourcingAdvisor
        initial={requirement}
        rescope={{
          projectId: id,
          manage: tokenOk && manage ? manage : "",
          confirmationSentence: confirmationSentence(project),
          edited,
          consentText: rescopeConsentText(project),
          replaceEditsText: replaceEditsConsentText(project),
        }}
      />
    </div>
  );
}
