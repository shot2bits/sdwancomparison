import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import NoticeView from "@/components/NoticeView";
import { getOpportunity, kvConfigured } from "@/lib/rfp-store";
import { toPublicOpportunity, type PublicOpportunity } from "@/lib/opportunity-types";
import { getSampleNotice } from "@/lib/sample-notices";
import { getNoticeSchema } from "@/lib/notice-schema";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema } from "@/lib/structured-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * Public project notice page. Server-rendered so every public opportunity is
 * crawlable and citable: procurement-notice layout, JSON-LD, canonical URL and
 * a machine-readable twin at ./data.json. Sample opportunities (worked examples)
 * share this route and are clearly labelled. Unlisted opportunities render but are
 * noindexed; the interactive room lives at ./room.
 */

async function loadNotice(id: string): Promise<{ notice: PublicOpportunity; isSample: boolean; visibility: string } | null> {
  const sample = getSampleNotice(id);
  if (sample) return { notice: sample, isSample: true, visibility: "public" };
  if (!kvConfigured()) return null;
  const opp = await getOpportunity(id);
  if (!opp) return null;
  return { notice: toPublicOpportunity(opp), isSample: false, visibility: opp.visibility };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await loadNotice(id);
  if (!data) return { title: "Opportunity not found", robots: { index: false, follow: false } };
  const { notice, isSample, visibility } = data;
  const title = isSample ? `Sample RFI: ${notice.title}` : notice.title;
  const description = (notice.ai_summary || notice.summary).slice(0, 158);
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/opportunities/${id}/` },
    robots: visibility === "public" ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { title, description, url: `${SITE_URL}/opportunities/${id}`, type: "website", locale: "en_GB" },
  };
}

export default async function OpportunityNoticePage({ params }: Props) {
  const { id } = await params;
  const data = await loadNotice(id);
  if (!data) notFound();
  const { notice, isSample } = data;

  const schemas = [
    getOrganizationSchema(),
    getBreadcrumbSchema("Opportunity board", "/opportunities/board"),
    getNoticeSchema(notice, { canonicalPath: `/opportunities/${id}`, isSample }),
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}

      <nav className="mb-6 text-sm text-[var(--ink-500)]">
        <Link href="/opportunities/board" className="underline">Opportunity board</Link>
        {" / "}
        {isSample ? "Sample notice" : "Notice"}
      </nav>

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NoticeView notice={notice} isSample={isSample} />
        </div>

        <aside>
          <div className="sticky top-6 space-y-4">
            {/* Supplier CTA */}
            <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5">
              <p className="text-sm font-medium mb-1">Suppliers</p>
              <p className="text-sm text-[var(--ink-600)] mb-3">
                This {isSample ? "is what an open notice looks like" : "opportunity is open for supplier responses"}. Sign in as a
                verified supplier to submit comments, pricing or clarification questions. Pricing stays private to the buyer.
              </p>
              {isSample ? (
                <Link href="/opportunities/board" className="inline-flex w-full items-center justify-center rounded-full bg-amber-500 px-5 py-2.5 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400">
                  See live opportunities
                </Link>
              ) : (
                <Link href={`/opportunities/${id}/room`} className="inline-flex w-full items-center justify-center rounded-full bg-amber-500 px-5 py-2.5 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400">
                  Sign in to respond
                </Link>
              )}
              <Link href="/for-suppliers#register" className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-[var(--ink-300,#ccc)] px-5 py-2.5 text-sm no-underline text-[var(--ink-800)] transition-colors hover:bg-[var(--ink-100,#f5f5f5)]">
                Register as a verified supplier
              </Link>
            </div>

            {/* Buyer CTAs */}
            <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5">
              <p className="text-sm font-medium mb-1">Buyers</p>
              <ul className="space-y-2 text-sm">
                <li><Link href={`/opportunities/new?clone=${id}`} className="underline">Post a similar project</Link> (prefills this opportunity as your template)</li>
                <li><a href={`/sase/rfp-builder/?from_opportunity=${id}`} className="underline">Turn this into a full RFP</a> (carries this opportunity into the builder)</li>
                <li><Link href="/shortlist" className="underline">Request a Netify shortlist</Link></li>
              </ul>
              {!isSample && (
                <p className="mt-3 text-xs text-[var(--ink-500)]">
                  Posted this opportunity? <Link href={`/opportunities/${id}/room`} className="underline">Open your response room</Link>.
                </p>
              )}
            </div>

            {/* Machine-readable panel */}
            <div className="rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5">
              <p className="eyebrow mb-2">Machine-readable</p>
              <ul className="space-y-1.5 text-xs text-[var(--ink-600)]">
                <li>JSON: <a href={`/sase/opportunities/${id}/data.json`} className="underline">/opportunities/{id}/data.json</a></li>
                <li>Board feed: <a href="/sase/opportunities/board/data.json" className="underline">/opportunities/board/data.json</a></li>
                <li>Agents: MCP at <a href="/sase/api/mcp/" className="underline">/sase/api/mcp/</a> (list_opportunities, opportunity_respond)</li>
                <li>Methodology: {notice.methodology_version || "sase-marketplace-2026.1"}</li>
                <li>Updated: {new Date(notice.updated).toISOString().slice(0, 10)}</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
