import type { Metadata } from "next";
import Link from "next/link";
import MyOpportunities from "@/components/MyOpportunities";
import { SAMPLE_NOTICES } from "@/lib/sample-notices";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema, getSpeakableSchema } from "@/lib/structured-data";

const UNDERLAY = "/opportunities/new?prefill=1&engagement=quote_room&scope=underlay_circuits&summary=" + encodeURIComponent("Quick pricing request: underlay circuits. Please quote access/last-mile options and indicative monthly pricing.");
const OVERLAY = "/opportunities/new?prefill=1&engagement=quote_room&scope=sd_wan.sse.sase&summary=" + encodeURIComponent("Quick pricing request: overlay SD-WAN, SSE and SASE. Please quote a managed solution and indicative pricing.");

export const metadata: Metadata = {
  title: "Publish a SASE or SD-WAN RFI: Vendor Interest",
  description:
    "Publish a short SASE or SD-WAN RFI: what you need, where and by when. Verified vendors and service providers respond with interest and indicative pricing. Draft in the clear; sign in only to publish.",
  alternates: { canonical: `${SITE_URL}/opportunities/` },
  openGraph: {
    title: "Publish a SASE or SD-WAN RFI: Vendor Interest",
    description: "A short public listing of what you need. Verified vendors respond; pricing stays private.",
    url: `${SITE_URL}/opportunities`,
    type: "website",
    locale: "en_GB",
  },
};

const CARDS = [
  {
    href: "/opportunities/new",
    title: "Publish an RFI",
    body: "Publish a short RFI in minutes. Use this when you need pricing, discovery calls or vendor interest before writing a full RFP.",
    cta: "Start an RFI",
    primary: true,
  },
  {
    href: "/rfp-builder/new",
    title: "Build a full RFP",
    body: "Describe your project in two minutes and Netify builds the complete RFP from its question bank for you to review and publish.",
    cta: "Start your project",
    primary: false,
  },
  {
    href: "/opportunities/board",
    title: "Browse opportunities",
    body: "See live SASE, SSE and SD-WAN opportunities from buyers looking for vendors, carriers and managed providers.",
    cta: "View the board",
    primary: false,
  },
  {
    href: "/rfp-builder/start",
    title: "Not sure?",
    body: "Answer a few questions and Netify will recommend whether to publish an RFI, build an RFP or start with a shortlist.",
    cta: "Get a recommendation",
    primary: false,
  },
];

export default function OpportunitiesPage() {
  const schemas = [getOrganizationSchema(), getBreadcrumbSchema("Opportunities", "/opportunities"), getSpeakableSchema("/opportunities")];
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {schemas.map((s, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />)}
      <div className="mb-10 max-w-3xl">
        <p className="eyebrow mb-3">Publish an RFI</p>
        <h1 id="page-h1" className="mb-4">Publish a SASE or SD-WAN RFI and gather vendor interest.</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">
          An RFI (request for information) is a short public listing: what you need, where and by when. Verified vendors and
          service providers respond with interest and indicative pricing, and you never write a full document. Draft in the
          clear, sign in only to publish, and pricing stays private to you. Need the complete RFP instead?
          The RFP Builder creates one from your answers in about two minutes.
        </p>
      </div>

      <MyOpportunities />

      <div className="mb-12 grid gap-4 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className={`block rounded-sm border p-6 no-underline text-inherit transition-colors ${c.primary ? "border-amber-500 bg-amber-50 hover:bg-amber-100" : "border-[var(--ink-200,#e5e5e5)] hover:border-[var(--ink-400,#999)]"}`}
          >
            <h2 className="text-lg font-semibold mb-1.5">{c.title}</h2>
            <p className="text-sm text-[var(--ink-700)] mb-3">{c.body}</p>
            <span className={`text-sm font-medium ${c.primary ? "text-amber-700" : "text-[var(--ink-800)]"}`}>{c.cta} →</span>
          </Link>
        ))}
      </div>

      <div className="mb-12 rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5">
        <p className="eyebrow mb-1">Quick pricing request</p>
        <p className="text-sm text-[var(--ink-700)] mb-3">Need a fast indicative price? Tap one and we prefill the RFI for you to review, preview and publish. Verified vendors and service providers then pick it up and quote.</p>
        <div className="flex flex-wrap gap-3">
          <Link href={UNDERLAY} className="inline-flex items-center rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400">Request underlay pricing (circuits)</Link>
          <Link href={OVERLAY} className="inline-flex items-center rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400">Request overlay pricing (SD-WAN / SASE)</Link>
        </div>
        <p className="text-xs text-[var(--ink-500)] mt-3">Published RFIs appear on the <Link href="/opportunities/board" className="underline">public board</Link>. Pricing you receive stays private to you. You can post anonymously.</p>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-1">What a published RFI looks like</h2>
        <p className="text-sm text-[var(--ink-600)] mb-4">Three worked examples — the same structure your RFI will have.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {SAMPLE_NOTICES.map((s) => (
            <Link key={s.slug} href={`/opportunities/${s.slug}`} className="block rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4 no-underline text-inherit transition-colors hover:border-[var(--ink-400,#999)]">
              <span className="mb-2 inline-block rounded-full bg-[var(--ink-100,#f0f0f0)] px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-[var(--ink-600)]">Sample</span>
              <h3 className="text-sm font-semibold leading-snug mb-1">{s.title}</h3>
              <p className="text-xs text-[var(--ink-600)] line-clamp-2">{s.summary}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
