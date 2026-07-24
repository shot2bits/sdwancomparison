import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getProject, getSession, kvConfigured } from "@/lib/rfp-store";
import { SESSION_COOKIE } from "@/lib/auth";
import { timelineEntries } from "@/lib/project-story";
import ProjectNav from "@/components/ProjectNav";
import SignIn from "@/components/SignIn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The chronological projection (Phase D3, Robert's amendment): the same
 * record as the Story, ordered by time instead of by artefact. Sometimes
 * people think in artefacts; sometimes in events. Pure view.
 */

export const metadata: Metadata = { title: "Project timeline", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ manage?: string }> };

export default async function ProjectTimelinePage({ params, searchParams }: Props) {
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
        <p className="eyebrow mb-2">Project timeline</p>
        <h1 className="mb-3 text-2xl">This project is private to the buyer</h1>
        <div className="mb-6"><SignIn role="buyer" prompt="Sign in with the email that created this project." /></div>
        <p className="text-sm"><a href="https://netify.co.uk/" className="underline">Start a project on the desk</a></p>
      </div>
    );
  }

  const qs = tokenOk && manage ? `?manage=${encodeURIComponent(manage)}` : "";
  const entries = timelineEntries(project);
  const engine = project.engine === "security_sourcing";

  // Group entries by day for scanability; order stays strictly chronological.
  const days = new Map<string, typeof entries>();
  for (const e of entries) {
    const day = new Date(e.at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    const list = days.get(day) ?? [];
    list.push(e);
    days.set(day, list);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <p className="eyebrow mb-1">Project</p>
      <h1 className="mb-1 text-2xl">{project.title || "Untitled project"}</h1>
      <p className="mb-5 text-sm text-[var(--ink-600)]">
        Every recorded event and decision, in time order. The append-only record is the chronology; nothing here can be rewritten.
      </p>

      <ProjectNav id={id} manage={tokenOk ? manage : undefined} active="timeline" engine={engine} />

      {entries.length === 0 ? (
        <p className="text-sm text-[var(--ink-600)]">No recorded events yet.</p>
      ) : (
        <div className="space-y-6">
          {[...days.entries()].map(([day, list]) => (
            <section key={day}>
              <p className="eyebrow mb-2">{day}</p>
              <ol className="m-0 list-none space-y-0 border-l-2 border-[var(--ink-200,#e5e5e5)] p-0">
                {list.map((e, i) => (
                  <li key={`${e.at}-${i}`} className="relative pb-4 pl-5 last:pb-0">
                    <span aria-hidden className={`absolute left-[-5px] top-1.5 inline-block h-2 w-2 rounded-full ${e.consent ? "bg-emerald-500" : "bg-[var(--ink-400,#9ca3af)]"}`} />
                    <p className="m-0 text-sm text-[var(--ink-800)]">
                      <span className="mr-2 tabular-nums text-xs text-[var(--ink-500)]">{new Date(e.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                      {e.text}
                    </p>
                    <p className="m-0 text-xs text-[var(--ink-400,#9ca3af)]">{e.actor ?? ""}{e.via ? ` · ${e.via}` : ""}{e.consent ? " · consent recorded" : ""}</p>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-[var(--ink-500)]">
        Prefer the explanation to the chronology? <Link href={`/project/${id}/story${qs}`} className="underline">Open the story</Link>.
      </p>
    </div>
  );
}
