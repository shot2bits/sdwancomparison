import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { sessionFromRequest } from "@/lib/auth";
import { isAdminEmail } from "@/lib/access-control";
import { getVendor, getAllVendorSlugs } from "@/lib/vendors";
import WikiOutcome from "@/components/WikiOutcome";
import {
  FACT_FIELDS,
  JUDGEMENT_FIELDS,
  GUIDANCE,
  FACT_GUIDANCE,
  WIKI_ACTION,
  classifyField,
} from "@/lib/vendor-edit";

/**
 * The supplier record editor.
 *
 * Deliberately a plain server-rendered form posting to /api/vendor-edit, with
 * no client bundle. Harry should be able to correct a record from a phone on a
 * train, and a supplier should not need JavaScript to send us a correction.
 *
 * The screen is written as a brief rather than a form. Each judgement field
 * carries the question it answers, the standard it is held to, and a good and
 * a bad example, because the quality of what Harry writes here is the whole
 * reason the page gets cited rather than merely read.
 *
 * The two lanes are visible as well as enforced: facts are open to the
 * supplier with evidence, judgement is Netify only, and the page says so
 * plainly rather than hiding the second set.
 */

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ r?: string | string[] }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return { title: `Edit record: ${slug}`, robots: { index: false, follow: false } };
}

function Field({
  vendorSlug,
  field,
  current,
  lane,
  netify,
}: {
  vendorSlug: string;
  field: string;
  current: string;
  lane: "fact" | "judgement";
  netify: boolean;
}) {
  const g = GUIDANCE[field] ?? FACT_GUIDANCE;
  const long = lane === "judgement";
  return (
    <details className="mb-3 border border-[var(--ink-200,#e8ebef)] rounded-lg overflow-hidden">
      <summary className="cursor-pointer list-none px-4 py-3 bg-[var(--ink-50,#f6f8fa)] flex items-baseline gap-3">
        <span aria-hidden="true" className="text-[var(--ink-500)] text-xs">▶</span>
        <span className="flex-1">
          <span className="font-medium text-sm">{field.replace(/_/g, " ")}</span>{" "}
          <span className="text-xs text-[var(--ink-600,#5b636e)]">
            {current ? `currently: ${current.slice(0, 70)}${current.length > 70 ? "…" : ""}` : "not set"}
          </span>
        </span>
      </summary>
      <form method="post" action={WIKI_ACTION} className="px-4 py-4 space-y-3">
        <input type="hidden" name="vendor_slug" value={vendorSlug} />
        <input type="hidden" name="field" value={field} />

        <div className="text-sm text-[var(--ink-700)] space-y-1.5 max-w-3xl">
          <p><span className="font-medium">What this answers.</span> {g.question}</p>
          <p><span className="font-medium">The standard.</span> {g.standard}</p>
          <p className="text-[var(--ink-600,#5b636e)]"><span className="font-medium">Good.</span> {g.good}</p>
          <p className="text-[var(--ink-600,#5b636e)]"><span className="font-medium">Not good enough.</span> {g.bad}</p>
        </div>

        <label className="block">
          <span className="text-xs font-medium block mb-1">New value</span>
          {long ? (
            <textarea name="value" rows={4} defaultValue={current} className="w-full text-sm border border-[var(--ink-300,#c9ced6)] rounded p-2" />
          ) : (
            <input name="value" defaultValue={current} className="w-full text-sm border border-[var(--ink-300,#c9ced6)] rounded p-2" />
          )}
        </label>

        {lane === "fact" && (
          <>
            <label className="block">
              <span className="text-xs font-medium block mb-1">Source URL, required for a supplier proposal</span>
              <input name="source_url" placeholder="https://" className="w-full text-sm border border-[var(--ink-300,#c9ced6)] rounded p-2" />
            </label>
            <label className="block">
              <span className="text-xs font-medium block mb-1">
                The exact sentence on that page. We check it is really there before anything is applied.
              </span>
              <textarea name="quote" rows={2} className="w-full text-sm border border-[var(--ink-300,#c9ced6)] rounded p-2" />
            </label>
          </>
        )}

        <label className="block">
          <span className="text-xs font-medium block mb-1">Why, optional</span>
          <input name="rationale" className="w-full text-sm border border-[var(--ink-300,#c9ced6)] rounded p-2" />
        </label>

        <button type="submit" className="text-sm px-4 py-2 rounded bg-[var(--ink-900,#14161a)] text-white">
          {netify ? "Save this change" : "Propose this change"}
        </button>
      </form>
    </details>
  );
}

export default async function VendorEditPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { r } = await searchParams;

  // Who is looking decides what the screen promises. Telling Harry his edit
  // will be reviewed, when it applies the moment he saves, would be a lie on
  // the one screen whose whole purpose is keeping the record honest.
  const h = await headers();
  const session = await sessionFromRequest(
    new Request(`https://netify.co.uk/vendors/${slug}/edit`, { headers: { cookie: h.get("cookie") ?? "" } }),
  );
  const netify = isAdminEmail(session?.email);
  if (!getAllVendorSlugs().includes(slug)) notFound();
  const v = getVendor(slug);
  const rec = v as unknown as Record<string, unknown>;
  const str = (k: string) => {
    const x = rec[k];
    if (Array.isArray(x)) return x.join("\n");
    return x === null || x === undefined ? "" : String(x);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <p className="eyebrow mb-3">Record editor</p>
      <h1 className="mb-3">{v.name}</h1>
      <WikiOutcome code={r} />
      <p className="text-[var(--ink-700)] max-w-3xl mb-2">
        Last verified {v.last_verified}.{" "}
        {netify
          ? "You are signed in as Netify, so what you save is applied to the record straight away and logged under your name. It reaches the live pages at the next build."
          : "Changes are proposed here, never applied directly. Netify reviews each one, checks the sentence you cite against the page, and publishes it at the next build or explains why not."}
      </p>
      <p className="text-sm text-[var(--ink-600,#5b636e)] max-w-3xl mb-8">
        Everything you change here reaches this supplier&apos;s profile, its alternatives page, the
        comparison pages it appears in and every ranked list it qualifies for, because they are all
        generated from this one record.{" "}
        <Link href={`/vendors/${slug}`} className="underline">
          See the live profile
        </Link>
        .
      </p>

      <section className="mb-10">
        <h2 className="mb-1 text-xl">Facts</h2>
        <p className="text-sm text-[var(--ink-700)] mb-4 max-w-3xl">
          Open to the supplier as well as to Netify. A supplier proposal must carry a source and the
          sentence on it, which is the same standard we hold ourselves to.
        </p>
        {FACT_FIELDS.filter((f) => classifyField(f) === "fact").map((f) => (
          <Field key={f} vendorSlug={slug} field={f} current={str(f)} lane="fact" netify={netify} />
        ))}
      </section>

      <section className="mb-10">
        <h2 className="mb-1 text-xl">The Netify View</h2>
        <p className="text-sm text-[var(--ink-700)] mb-4 max-w-3xl">
          Written by Netify and never by the company it describes, not even as a suggestion. These
          are the judgements a buyer cannot get from a datasheet, and the reason an assistant cites
          this page rather than a vendor&apos;s own. A supplier attempting to edit them is refused
          by the server, not just by this screen.
        </p>
        {JUDGEMENT_FIELDS.map((f) => (
          <Field key={f} vendorSlug={slug} field={f} current={str(f)} lane="judgement" netify={netify} />
        ))}
      </section>

      <p className="text-sm text-[var(--ink-600,#5b636e)]">
        <Link href="/admin/records" className="underline">
          All 30 records
        </Link>
        {" · "}
        <Link href="/admin/record-queue" className="underline">
          Review queue
        </Link>{" "}
        for supplier proposals.
      </p>
    </div>
  );
}
