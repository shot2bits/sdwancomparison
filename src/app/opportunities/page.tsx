import type { Metadata } from "next";
import Link from "next/link";
import OpportunityBuyer from "@/components/OpportunityBuyer";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema, getSpeakableSchema } from "@/lib/structured-data";

const UNDERLAY = "/opportunities?prefill=1&engagement=quote_room&scope=underlay_circuits&summary=" + encodeURIComponent("Quick pricing request: underlay circuits. Please quote access/last-mile options and indicative monthly pricing.");
const OVERLAY = "/opportunities?prefill=1&engagement=quote_room&scope=sd_wan.sse.sase&summary=" + encodeURIComponent("Quick pricing request: overlay SD-WAN, SSE and SASE. Please quote a managed solution and indicative pricing.");

export const metadata: Metadata = {
  title: "Post a live SASE & SD-WAN opportunity",
  description: "Post a network opportunity, from underlay circuits to full SASE, and have graded suppliers reply in real time with comments and indicative pricing.",
  alternates: { canonical: `${SITE_URL}/opportunities/` },
  openGraph: { title: "Post a live SASE & SD-WAN opportunity", description: "Graded suppliers reply in real time with comments and pricing.", url: `${SITE_URL}/opportunities`, type: "website", locale: "en_GB" },
};

export default function OpportunitiesPage() {
  const schemas = [getOrganizationSchema(), getBreadcrumbSchema("Opportunities", "/opportunities"), getSpeakableSchema("/opportunities")];
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {schemas.map((s, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />)}
      <div className="mb-10 max-w-3xl">
        <p className="eyebrow mb-3">Live marketplace</p>
        <h1 id="page-h1" className="mb-4">Post an opportunity. Watch suppliers respond in real time.</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">Describe what you need, from just underlay circuits to full SASE, SSE and SD-WAN. Invite graded suppliers from the Netify marketplace and see them reply live with comments and indicative pricing.</p>
      </div>

      <div className="mb-10 rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5">
        <p className="eyebrow mb-1">Quick pricing request</p>
        <p className="text-sm text-[var(--ink-700)] mb-3">Need a fast indicative price? Tap one and we prefill the request in the form below for you to review and post, no sign-in. Verified suppliers then pick it up and quote.</p>
        <div className="flex flex-wrap gap-3">
          <a href={UNDERLAY} className="inline-flex items-center rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400">Request underlay pricing (circuits)</a>
          <a href={OVERLAY} className="inline-flex items-center rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400">Request overlay pricing (SD-WAN / SASE)</a>
        </div>
        <p className="text-xs text-[var(--ink-500)] mt-3">Anonymous and agent-friendly: this posts to the <Link href="/opportunities/board" className="underline">public board</Link>. Pricing you receive stays private to you.</p>
      </div>

      <OpportunityBuyer />
    </div>
  );
}
