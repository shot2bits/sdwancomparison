import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProject, listSignoffs, kvConfigured } from "@/lib/rfp-store";
import { documentSections } from "@/lib/rfp-document";
import ApprovalDecision from "@/components/ApprovalDecision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The approver's view (D5): the full document, read only, with one
 * decision bar. The approval token is the ONLY credential and grants
 * exactly read-and-decide: no editing, no manage surfaces, no pricing.
 * Zero special-case document rendering: the same documentSections view
 * the preview uses.
 */

export const metadata: Metadata = { title: "Approve RFP publication", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> };

export default async function ApprovePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;
  if (!kvConfigured()) notFound();
  const project = await getProject(id);
  if (!project) notFound();

  const signoffs = await listSignoffs(id);
  const signoff = token ? signoffs.find((a) => a.token === token) : undefined;

  if (!signoff) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24">
        <p className="eyebrow mb-2">Approval</p>
        <h1 className="mb-3 text-2xl">This approval link is not recognised</h1>
        <p className="text-sm text-[var(--ink-600)]">
          Use the full link from your approval email. If it has been superseded, ask the buyer to send a fresh request.
        </p>
      </div>
    );
  }

  const sections = documentSections(project);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <p className="eyebrow mb-1">Approval requested</p>
      <h1 className="mb-1 text-2xl">{project.title || "Untitled project"}</h1>
      <p className="mb-6 text-sm text-[var(--ink-600)]">
        {signoff.name}, you have been asked as {signoff.role} to review this RFP before it is published to the
        Netify marketplace. The document below is exactly what vendors and service providers will receive. Read only.
      </p>

      {signoff.decision ? (
        <div className={`mb-8 rounded-2xl border-2 p-5 ${signoff.decision === "approved" ? "border-emerald-300 bg-emerald-50" : "border-amber-400 bg-amber-50"}`}>
          <p className="m-0 text-sm font-semibold">
            {signoff.decision === "approved" ? "You approved this publication." : "You declined this publication."}
          </p>
          <p className="m-0 mt-1 text-sm">
            Recorded {signoff.decided_at ? new Date(signoff.decided_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""} on the permanent project record.
            {signoff.note ? ` Your note: "${signoff.note}"` : ""}
          </p>
        </div>
      ) : (
        <div className="mb-8">
          <ApprovalDecision projectId={id} token={signoff.token} role={signoff.role} name={signoff.name} />
        </div>
      )}

      {/* The document, read only: same rendering rules as the preview. */}
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
                {q.priority !== "optional" && <p className="mt-0.5 text-xs text-[var(--ink-400,#9ca3af)]">Weighting {q.weight}/5{q.priority === "required" ? " · required" : ""}</p>}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
