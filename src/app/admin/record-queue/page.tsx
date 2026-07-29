import Link from "next/link";
import { headers } from "next/headers";
import { isAdminEmail } from "@/lib/access-control";
import { sessionFromRequest } from "@/lib/auth";
import WikiOutcome from "@/components/WikiOutcome";
import {
  listProposals,
  editingConfigured,
  WIKI_ACTION,
  type Proposal,
} from "@/lib/vendor-edit";

/**
 * The review queue. This is the product, not the editor.
 *
 * Anyone can build a form. The thing that makes a supplier wiki safe is a
 * human deciding, with the evidence in front of them, and a record of who
 * decided what and when. Approving writes to an overlay the build folds into
 * the records, so an approved correction reaches all 104 generated pages
 * without a developer touching a file.
 *
 * Server-rendered, no client bundle, plain form posts, so it works on a phone.
 */

export const dynamic = "force-dynamic";
export const metadata = { title: "Record review queue", robots: { index: false, follow: false } };

function Row({ p }: { p: Proposal }) {
  const judgement = p.field_class === "judgement";
  return (
    <li className="border border-[var(--ink-200,#e8ebef)] rounded-lg p-4 mb-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
        <span className="font-medium">{p.vendor_slug}</span>
        <span className="text-sm text-[var(--ink-700)]">{p.field.replace(/_/g, " ")}</span>
        <span className="text-xs px-2 py-0.5 rounded-full border border-[var(--ink-300,#c9ced6)]">
          {judgement ? "Netify View" : "fact"}
        </span>
        <span className="text-xs text-[var(--ink-600,#5b636e)]">
          {p.proposed_by === "supplier" ? "proposed by the supplier" : "proposed by Netify"} ·{" "}
          {p.proposer_email} · {p.proposed_at.slice(0, 16).replace("T", " ")}
        </span>
      </div>

      <p className="text-sm mb-2 whitespace-pre-wrap">
        <span className="font-medium">Proposed:</span> {p.proposed_value}
      </p>

      {p.quote ? (
        <p className="text-sm text-[var(--ink-700)] mb-1">
          <span className="font-medium">Quote given:</span> &ldquo;{p.quote}&rdquo;
        </p>
      ) : (
        <p className="text-sm text-[var(--ink-500,#8b939d)] mb-1">No quote supplied.</p>
      )}
      {p.source_url && (
        <p className="text-sm mb-2">
          <span className="font-medium">Source:</span>{" "}
          <a href={p.source_url} target="_blank" rel="noopener" className="underline break-all">
            {p.source_url}
          </a>{" "}
          <span className="text-[var(--ink-600,#5b636e)]">
            Open it and confirm the sentence is really there before approving.
          </span>
        </p>
      )}
      {p.rationale && (
        <p className="text-sm text-[var(--ink-700)] mb-2">
          <span className="font-medium">Reason given:</span> {p.rationale}
        </p>
      )}

      {p.status === "pending" ? (
        <div className="flex flex-wrap gap-2 items-end mt-3">
          <form method="post" action={WIKI_ACTION} className="flex gap-2 items-end">
            <input type="hidden" name="action" value="approve" />
            <input type="hidden" name="id" value={p.id} />
            <input name="note" placeholder="note, optional" className="text-sm border border-[var(--ink-300,#c9ced6)] rounded p-2" />
            <button className="text-sm px-3 py-2 rounded bg-[var(--ink-900,#14161a)] text-white">Approve</button>
          </form>
          <form method="post" action={WIKI_ACTION} className="flex gap-2 items-end">
            <input type="hidden" name="action" value="reject" />
            <input type="hidden" name="id" value={p.id} />
            <input name="note" placeholder="why not" className="text-sm border border-[var(--ink-300,#c9ced6)] rounded p-2" />
            <button className="text-sm px-3 py-2 rounded border border-[var(--ink-300,#c9ced6)]">Reject</button>
          </form>
        </div>
      ) : (
        <p className="text-sm text-[var(--ink-600,#5b636e)] mt-2">
          {p.status} by {p.reviewed_by} on {(p.reviewed_at ?? "").slice(0, 10)}
          {p.review_note ? `. ${p.review_note}` : "."}
        </p>
      )}
    </li>
  );
}

export default async function RecordQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string | string[] }>;
}) {
  const { r } = await searchParams;
  if (!editingConfigured()) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="mb-3">Record review queue</h1>
        <p className="text-[var(--ink-700)]">
          The editing store is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN.
        </p>
      </div>
    );
  }

  const h = await headers();
  const req = new Request("https://netify.co.uk/admin/record-queue", {
    headers: { cookie: h.get("cookie") ?? "" },
  });
  const session = await sessionFromRequest(req);
  if (!isAdminEmail(session?.email)) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="mb-3">Record review queue</h1>
        <p className="text-[var(--ink-700)] mb-4">
          Sign in with a Netify address to review proposals. Suppliers can propose corrections to
          facts about their own company from their profile page; only Netify approves them.
        </p>
        <Link href="/vendors" className="underline">
          Back to the supplier index
        </Link>
      </div>
    );
  }

  const all = await listProposals();
  const pending = all.filter((p) => p.status === "pending");
  const decided = all.filter((p) => p.status !== "pending").slice(0, 25);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <p className="eyebrow mb-3">Netify only</p>
      <h1 className="mb-3">Record review queue</h1>
      <WikiOutcome code={r} />
      <p className="text-[var(--ink-700)] max-w-3xl mb-8">
        {pending.length === 0
          ? "Nothing waiting."
          : `${pending.length} proposal${pending.length === 1 ? "" : "s"} waiting.`}{" "}
        Your own edits are not here: a Netify edit applies on save and appears below under what was
        decided, logged under your name. This queue is for supplier proposals. Approving one writes
        the value to the overlay, and the next build folds it into the record, so
        it reaches the supplier&apos;s profile and every generated page at once. Check any cited
        sentence against the page before approving: a supplier proposal is only as good as its
        source, which is the standard we hold ourselves to.
      </p>

      {pending.length > 0 && (
        <ul className="list-none p-0 mb-10">
          {pending.map((p) => (
            <Row key={p.id} p={p} />
          ))}
        </ul>
      )}

      {decided.length > 0 && (
        <>
          <h2 className="text-xl mb-3">Recently decided</h2>
          <ul className="list-none p-0">
            {decided.map((p) => (
              <Row key={p.id} p={p} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
