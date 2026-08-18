import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "The Netify vendor vetting standard",
  description:
    "What vetted means on Netify: verified work email at the company's own domain, recognised vendor domains or named admin approval, evaluated capability records with evidence, scoped access per opportunity, and contact details that move last.",
  alternates: { canonical: `${SITE_URL}/supplier-vetting-standard/` },
  openGraph: {
    title: "The Netify vendor vetting standard",
    description: "The checks every responding vendor and service provider passes, and what the standard does not claim.",
    url: `${SITE_URL}/supplier-vetting-standard`,
    type: "website",
    locale: "en_GB",
  },
};

/**
 * The citable vetting standard (approved by Robert Sturt, 29 Jul 2026).
 * This page exists so the four promises' vetting sentences are checkable
 * rather than asserted: the buyer-facing copy links here, and every check
 * described is one that actually runs. States only what runs; the "does
 * not claim" section keeps the page honest. WORDING PROVISIONAL pending
 * Harry's copy pass; the checks themselves are the approved standard.
 */
export default function SupplierVettingStandardPage() {
  const schemas = [getOrganizationSchema(), getBreadcrumbSchema("Vendor vetting standard", "/supplier-vetting-standard")];
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}
      <p className="eyebrow mb-3">The standard</p>
      <h1 id="page-h1" className="mb-4">What vetted means on Netify</h1>
      <p className="text-lg text-[var(--ink-700)] mb-8">
        Buyers publish anonymously and vendors and service providers respond through the platform. A vendor or
        service provider can see and respond to buyer opportunities only after passing every check below. None of
        them reaches a buyer&rsquo;s room, requirement or contact details without them.
      </p>

      <section className="space-y-5 text-[15px] leading-relaxed text-[var(--ink-800)]">
        <div>
          <h2 className="text-lg font-semibold mb-1">1. A verified work email at the company&rsquo;s own domain</h2>
          <p>
            Sign-in is by a one-time link or code sent to the address; completing that round trip proves the person
            controls the mailbox. Free webmail, disposable addresses and academic domains are rejected for every role,
            from a maintained blocklist plus a live extension list.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-1">2. The domain must belong to a recognised vendor or service provider</h2>
          <p>
            Known vendor domains are compiled from the evaluated vendor dataset and admin-managed records. An address
            at an unrecognised domain does not get access: it lands in a pending queue and a named Netify admin approves
            or rejects it by hand. Rejections are recorded.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-1">3. Evaluated vendors carry an evidence record</h2>
          <p>
            The comparison dataset behind matching holds per-vendor capability evaluations with evaluation
            dates and named sources. Vendors and service providers are matched to opportunities from this dataset,
            not from self-description. The dataset and its sources are public on the{" "}
            <Link href="/shortlist" className="underline">vendor comparison</Link>.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-1">4. Scoped access, not browsing rights</h2>
          <p>
            A vetted vendor sees public notices like anyone else; the gated room, the full requirement and the
            response mechanics open per opportunity, by the buyer&rsquo;s own settings: open to matching vetted vendors,
            or invite-only.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-1">5. Contact details move last</h2>
          <p>
            Buyer contact information is never in any public projection and never shown to a vendor by default.
            Pricing submitted by one vendor is never visible to another. Contact details pass to a specific vendor
            only when the buyer chooses.
          </p>
        </div>
      </section>

      <section className="mt-10 rounded-sm border border-[var(--ink-200,#e5e5e5)] bg-[var(--ink-50,#fafafa)] p-5">
        <h2 className="text-lg font-semibold mb-1">What this standard does not claim</h2>
        <p className="text-sm text-[var(--ink-700)]">
          Netify does not audit finances, insurance or certifications unless stated on the evaluation
          record; it does not guarantee commercial outcomes; and it does not vet the buyer side beyond business-email
          verification. The standard covers who can respond to opportunities and how buyer information is protected
          while they do.
        </p>
      </section>

      <p className="mt-8 text-sm text-[var(--ink-500)]">
        Standard approved 29 July 2026. Questions, or a vendor wanting to register:{" "}
        <Link href="/for-suppliers" className="underline">for vendors and providers</Link>.
      </p>
    </div>
  );
}
