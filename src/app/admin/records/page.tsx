import Link from "next/link";
import { headers } from "next/headers";
import { isAdminEmail } from "@/lib/access-control";
import { sessionFromRequest } from "@/lib/auth";
import { getAllVendors } from "@/lib/vendors";
import { listProposals, editingConfigured } from "@/lib/vendor-edit";

/**
 * One address to remember.
 *
 * The editor and the queue both existed before this page and neither was
 * reachable from anywhere on the site, so the only way in was to be told the
 * URL. Robert went looking on the shortlist page, found nothing, and was
 * right to expect otherwise. This is the door: thirty records, a link into
 * each, and a count of what has already been changed through the wiki so the
 * work in progress is visible rather than remembered.
 *
 * Netify only, noindex, server rendered, no client bundle.
 */

export const dynamic = "force-dynamic";
export const metadata = { title: "Vendor records", robots: { index: false, follow: false } };

export default async function RecordsPage() {
  const h = await headers();
  const session = await sessionFromRequest(
    new Request("https://netify.co.uk/admin/records", { headers: { cookie: h.get("cookie") ?? "" } }),
  );

  if (!isAdminEmail(session?.email)) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="mb-3">Vendor records</h1>
        <p className="text-[var(--ink-700)] mb-4">
          Sign in with a Netify address to edit the records.{" "}
          <Link href="/account" className="underline">
            Sign in
          </Link>
          .
        </p>
        <Link href="/vendors" className="underline">
          Back to the vendor index
        </Link>
      </div>
    );
  }

  const vendors = [...getAllVendors()].sort((a, b) => a.name.localeCompare(b.name));

  // Applied edits per supplier, so the list doubles as a progress view.
  const applied = new Map<string, number>();
  if (editingConfigured()) {
    for (const p of await listProposals()) {
      if (p.status === "approved") applied.set(p.vendor_slug, (applied.get(p.vendor_slug) ?? 0) + 1);
    }
  }
  const touched = [...applied.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <p className="eyebrow mb-3">Netify only</p>
      <h1 className="mb-3">Vendor records</h1>
      <p className="text-[var(--ink-700)] max-w-3xl mb-3">
        {vendors.length} records. Everything you change in one of them reaches that company&apos;s
        profile, its alternatives page, every comparison it appears in and every ranked list it
        qualifies for, because all of those are generated from this one record.
      </p>
      <p className="text-sm text-[var(--ink-600,#5b636e)] max-w-3xl mb-8">
        {touched === 0
          ? "No changes have been made through the wiki yet."
          : `${touched} change${touched === 1 ? "" : "s"} applied so far.`}{" "}
        A change you save is applied and logged straight away, and appears on the live pages at the
        next build.{" "}
        <Link href="/admin/record-queue" className="underline">
          Review queue
        </Link>{" "}
        for proposals from vendors and service providers.
      </p>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-[var(--ink-300,#c9ced6)]">
            <th className="py-2 pr-4 font-medium">Vendor</th>
            <th className="py-2 pr-4 font-medium">Category</th>
            <th className="py-2 pr-4 font-medium">Facts verified</th>
            <th className="py-2 pr-4 font-medium">Changed here</th>
            <th className="py-2 font-medium">&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((v) => {
            const n = applied.get(v.slug) ?? 0;
            return (
              <tr key={v.slug} className="border-b border-[var(--ink-200,#e8ebef)]">
                <td className="py-2 pr-4 font-medium">{v.name}</td>
                <td className="py-2 pr-4 text-[var(--ink-700)]">{v.category}</td>
                <td className="py-2 pr-4 text-[var(--ink-600,#5b636e)]">{v.last_verified}</td>
                <td className="py-2 pr-4 text-[var(--ink-600,#5b636e)]">{n === 0 ? "not yet" : n}</td>
                <td className="py-2">
                  <Link href={`/vendors/${v.slug}/edit`} className="underline">
                    Edit
                  </Link>
                  <span className="text-[var(--ink-300,#c9ced6)]"> · </span>
                  <Link href={`/vendors/${v.slug}`} className="underline">
                    View
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
