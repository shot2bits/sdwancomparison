import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import SignIn from "@/components/SignIn";
import { sessionFromRequest } from "@/lib/auth";
import { isAdminEmail } from "@/lib/access-control";
import { readAdminProject } from "@/lib/admin-project";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin project details",
  robots: { index: false, follow: false },
};
export default async function AdminProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const h = await headers();
  const session = await sessionFromRequest(
    new Request("https://netify.co.uk/sase/admin/projects/", {
      headers: { cookie: h.get("cookie") ?? "" },
    }),
  );
  if (!isAdminEmail(session?.email))
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-semibold mb-4">
          Sign in to view this project
        </h1>
        <SignIn
          simple
          role="buyer"
          returnTo={`/sase/admin/projects/${encodeURIComponent(id)}/`}
          prompt="Use your authorised Netify admin email."
        />
      </div>
    );
  const p = await readAdminProject(id, session);
  if (!p) notFound();
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <Link href="/admin/#projects" className="underline">
        ← All projects
      </Link>
      <p className="mt-6 text-sm text-zinc-600">
        Admin view · Read only · {p.format} · {p.status}
      </p>
      <h1 className="text-3xl font-semibold my-4">{p.title || p.id}</h1>
      <p className="text-sm text-zinc-600 mb-6">
        Reference: {p.id}. Supplier approvals are managed in{" "}
        <Link href="/admin/#supplier-approvals" className="underline">
          Supplier approvals
        </Link>
        . Buyers decide their own bid requests.
      </p>
      <section className="border rounded p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Project details</h2>
        <dl className="grid sm:grid-cols-2 gap-4">
          {[
            ["Company (private)", p.company],
            ["Owner email (private)", p.owner_email],
            ["Solution", p.scope],
            [
              "Sites / users",
              `${p.sites || "Not stated"} / ${p.users || "Not stated"}`,
            ],
            ["Coverage", p.regions.join(", ")],
            ["Management", p.service],
            ["Timing", p.timing],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-sm text-zinc-600">{k}</dt>
              <dd className="break-words">{v || "Not stated"}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="border rounded p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">{p.requirement_source}</h2>
        <p className="whitespace-pre-wrap break-words">
          {p.requirement || "No brief recorded."}
        </p>
        {p.questions.length > 0 && (
          <details className="mt-6">
            <summary className="cursor-pointer font-semibold">
              Supplier questions ({p.questions.length})
            </summary>
            <ol className="list-decimal pl-6 mt-4 space-y-3">
              {p.questions.map((q) => (
                <li key={q.id}>{q.text}</li>
              ))}
            </ol>
          </details>
        )}
      </section>
      <section className="border rounded p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">
          Supplier requests and replies
        </h2>
        {!p.requests.length ? (
          <p>No requests recorded for this project.</p>
        ) : (
          p.requests.map((r) => (
            <article key={r.vendor_slug} className="border-t pt-4 mb-6">
              <h3 className="font-semibold">
                {r.vendor_name} · {r.status}
              </h3>
              <p className="whitespace-pre-wrap break-words mt-2">{r.reason}</p>
              <ol className="mt-4 space-y-4">
                {r.messages.map((m) => (
                  <li key={m.id}>
                    <strong>
                      {m.from === "buyer" ? "Buyer" : r.vendor_name}
                    </strong>
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  </li>
                ))}
              </ol>
            </article>
          ))
        )}
      </section>
      {p.public_notice && (
        <a className="underline" href={p.public_notice}>
          View anonymous public listing →
        </a>
      )}
    </div>
  );
}
