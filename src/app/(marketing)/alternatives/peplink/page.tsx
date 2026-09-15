import type { Metadata } from "next";
import Link from "next/link";
import SourcedTable from "@/components/SourcedTable";
import { SITE_URL } from "@/lib/structured-data";
import { peplinkContext, getPeplinkEvidence } from "./content";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Top Peplink alternatives (2026): provider evidence",
  description: "Compare sourced provider evidence when considering Peplink alternatives, with questions on WAN resilience, security and service ownership.",
  alternates: { canonical: `${SITE_URL}/alternatives/peplink/` },
};
export default function PeplinkAlternatives() {
  const result = getPeplinkEvidence();
  return <div className="max-w-4xl mx-auto px-6 py-16">
    <p className="eyebrow mb-3">Alternatives · Editorial sources checked {peplinkContext.reviewed_on}</p>
    <h1 className="mb-4">Top Peplink alternatives (2026): provider evidence</h1>
    <p className="text-lg mb-4">{peplinkContext.summary}</p>
    <p className="mb-6">{peplinkContext.scope}</p>
    <h2 className="text-xl mb-3">What to compare</h2>
    <ul className="list-disc pl-6 space-y-3 mb-6">{peplinkContext.questions.map(q => <li key={q}>{q}</li>)}</ul>
    <p className="mb-2">Primary sources (publication dates not stated; checked {peplinkContext.reviewed_on}):</p>
    <ul className="list-disc pl-6 mb-8">{peplinkContext.sources.map(s => <li key={s.url}><a href={s.url}>{s.name}</a></li>)}</ul>
    <h2 className="text-xl mb-3">Explore provider evidence</h2>
    <p className="mb-6">{result.methodology_note}</p>
    <SourcedTable ranked={false} slugs={result.shortlist.map(v => v.slug)} caption="Peplink alternatives compared on sourced evidence" intro="Compare network ownership, service delivery and published capability evidence. These are research candidates, not confirmed substitutes. The table includes providers with detailed source-table records; the directory below includes the full current catalogue." id="evidence-table" />
    <ol className="list-none p-0 space-y-6">{result.shortlist.map(v => <li key={v.slug} className="border rounded p-5" id={`provider-${v.slug}`}>
      <h2 className="text-xl mb-2"><span>{v.position}. </span><Link href={v.marketplace_url ?? `/vendors/${v.slug}`}>{v.name}</Link></h2>
      <p className="mb-2">{v.differentiator}</p>
      <p className="text-sm">Proven capability items: {v.proven_evidence_count} · Provider verification: {v.last_verified || "Not recorded"}</p>
    </li>)}</ol>
    <section className="mt-10">
      <h2 className="text-xl mb-3">Turn your requirements into a project</h2>
      <p className="mb-4">Review your anonymous notice before publication. Personalised fit requires authorised access after publication. Where the evaluation confirms no eligible matches, no suppliers are invited. You can review your requirements and the evidence gaps before choosing your next step. Supplier participation and response times are not guaranteed.</p>
      <Link href="https://netify.co.uk/sase-sd-wan-rfp-builder/">Start or review your project</Link>
      <p className="mt-3"><Link href="/shortlist/">Explore the public provider directory</Link></p>
    </section>
  </div>;
}
