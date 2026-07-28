import type { Metadata } from "next";
import Link from "next/link";
import { listPublicOpportunities, listArchivedPublicOpportunities, kvConfigured } from "@/lib/rfp-store";
import { OPP_SCOPE_LABELS, type OppScope } from "@/lib/opportunity-types";
import BoardList from "@/components/BoardList";
import { SAMPLE_NOTICES } from "@/lib/sample-notices";
import { cookies } from "next/headers";
import { getSession } from "@/lib/rfp-store";
import { SESSION_COOKIE } from "@/lib/auth";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema, getSpeakableSchema } from "@/lib/structured-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live SASE, SSE & SD-WAN opportunity board",
  description: "Open SASE, SSE, SD-WAN, circuit and managed service opportunities from buyers. Listings are anonymous and visible to signed-in suppliers; verified vendors bid and quote.",
  alternates: { canonical: `${SITE_URL}/opportunities/board/` },
  openGraph: { title: "Live SASE and SD-WAN opportunity board", description: "Open buyer opportunities; verified vendors bid and quote.", url: `${SITE_URL}/opportunities/board`, type: "website", locale: "en_GB" },
};

export default async function OpportunityBoardPage() {
  // The regate (Robert, 23 Jul): listings are private to anonymous
  // visitors and visible to the signed-in supply side. Counts stay
  // public (an aggregate, not a listing); sample notices stay public
  // (example class, clearly labelled).
  const jar = await cookies();
  const session = await getSession(jar.get(SESSION_COOKIE)?.value ?? null);
  const signedIn = Boolean(session);
  const [allOpps, allArchived] = kvConfigured()
    ? await Promise.all([listPublicOpportunities(), listArchivedPublicOpportunities(12)])
    : [[], []];
  const opps = signedIn ? allOpps : [];
  const archived = signedIn ? allArchived : [];
  const openCount = allOpps.length;
  const schemas = [
    getOrganizationSchema(),
    getBreadcrumbSchema("Opportunity board", "/opportunities/board"),
    getSpeakableSchema("/opportunities/board"),
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {schemas.map((s, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />)}

      <div className="mb-10 max-w-3xl">
        <p className="eyebrow mb-3">Live marketplace</p>
        <h1 id="page-h1" className="mb-4">Open SASE, SSE and SD-WAN opportunities</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">Buyers post a need, from underlay circuits to appliances, cloud security or a full managed SASE rollout. Verified vendors bid and quote. Browsing is open to everyone; you sign in only to submit a bid.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/opportunities/new" className="inline-flex items-center rounded-full bg-amber-500 px-5 py-2 text-sm font-medium text-zinc-950 no-underline transition-colors hover:bg-amber-400">Publish an RFI</Link>
          <Link href="/for-suppliers" className="inline-flex items-center rounded-full border border-[var(--ink-300,#ccc)] px-5 py-2 text-sm no-underline text-[var(--ink-800)] hover:bg-[var(--ink-100,#f5f5f5)]">For vendors and providers</Link>
        </div>
      </div>

      {signedIn ? (
        <BoardList opps={opps} />
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white p-5">
          <p className="m-0 text-[14px] font-semibold text-zinc-900">
            {openCount} opportunit{openCount === 1 ? "y is" : "ies are"} genuinely open on the board right now.
          </p>
          <p className="m-0 mt-1.5 text-[12.5px] leading-relaxed text-zinc-600">
            Listings are anonymous about the buyer and private to Netify&rsquo;s signed-in supplier community. Sign in
            to see the open notices and respond; buyers publish from the workspace and stay anonymous until they choose
            otherwise. The sample notices below show the shape of a listing.
          </p>
          <a href="/sase/account/?return_to=/sase/opportunities/board/" className="mt-3 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-[13px] font-semibold text-white no-underline hover:bg-black">
            Supplier sign in
          </a>
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-semibold mb-1">Recently closed and awarded</h2>
          <p className="text-sm text-[var(--ink-600)] mb-4">Every notice that was published here stays published, permanently, with its status and close date. Outcomes only, no responses or pricing. The most recent are shown below; the full permanent archive is in the <a className="underline" href="/sase/opportunities/board/data.json">board data feed</a>.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {archived.map((o) => (
              <Link key={o.id} href={`/opportunities/${o.id}`} className="block rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5 no-underline text-inherit opacity-80 transition-opacity hover:opacity-100">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium uppercase tracking-wide ${o.status === "awarded" ? "bg-emerald-50 text-emerald-700" : "bg-[var(--ink-100,#f0f0f0)] text-[var(--ink-500)]"}`}>
                    {o.status === "awarded" ? "Awarded" : "Closed"}
                  </span>
                  {o.closed_at && (
                    <span className="text-[var(--ink-500)]">
                      {new Date(o.closed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-semibold leading-snug mb-1">{o.title}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {o.scope.map((s) => <span key={s} className="rounded-full border border-[var(--ink-200,#e5e5e5)] px-2 py-0.5 text-xs text-[var(--ink-600)]">{OPP_SCOPE_LABELS[s as OppScope] ?? s}</span>)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-12">
        <h2 className="text-lg font-semibold mb-1">Worked examples</h2>
        <p className="text-sm text-[var(--ink-600)] mb-4">Three full-depth example procurements showing what a published notice looks like here. Illustrative only, never open for response, never counted as live demand.</p>
        <div className="grid gap-4">
          {SAMPLE_NOTICES.map((s) => (
            <Link key={s.slug} href={`/opportunities/${s.slug}`} className="block rounded-lg border border-[var(--ink-200,#e5e5e5)] bg-white p-5 no-underline text-inherit transition-colors hover:border-[var(--ink-400,#999)]">
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                <span className="inline-block rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-amber-800">Worked example · not open for response</span>
                <span className="text-xs text-[var(--ink-500)]">{s.sites} sites · {s.users_band} users · {s.response_mode === "written_responses" ? "written responses" : "indicative pricing"}</span>
              </div>
              <h3 className="text-[15px] font-semibold leading-snug mb-1">{s.title}</h3>
              <p className="text-[13px] leading-relaxed text-[var(--ink-600)] line-clamp-3">{s.summary}</p>
              <p className="mt-1.5 text-xs text-[var(--ink-500)]">Compliance: {s.compliance_requirements.join(", ").replace(/_/g, " ").toUpperCase()}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* The public / gated line (Robert's ruling, approved as written,
          28 Jul 2026). The table is the ruled content; the intro sentence
          below it is provisional structure. HARRY COPY SLOT: the section
          intro and any plain-English framing are Harry's to write; the
          table rows themselves are Robert's ruled line and stay as ruled.
          Repo twin: docs/netify-public-gated-line-2026-07-28.md. */}
      <div className="mt-12">
        <h2 className="text-lg font-semibold mb-1">What is public and what stays gated</h2>
        <p className="text-sm text-[var(--ink-600)] mb-4">Every notice keeps the same line between its public record and its gated room. Site and user figures are published as bands; exact figures stay with the buyer and participating suppliers.</p>
        <div className="overflow-x-auto rounded-sm border border-[var(--ink-200,#e5e5e5)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--ink-200,#e5e5e5)] bg-[var(--ink-50,#fafafa)] text-left">
                <th className="px-4 py-2.5 font-semibold w-44">Public, forever</th>
                <th className="px-4 py-2.5 font-normal text-[var(--ink-600)]">On the notice page, the data feeds, the MCP and search alike</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-b border-[var(--ink-100,#f0f0f0)]"><td className="px-4 py-2 font-medium">Identity of the notice</td><td className="px-4 py-2 text-[var(--ink-700)]">Its URL and id, created and updated dates, status (open, closed, awarded) and the close date once closed</td></tr>
              <tr className="border-b border-[var(--ink-100,#f0f0f0)]"><td className="px-4 py-2 font-medium">What is sought</td><td className="px-4 py-2 text-[var(--ink-700)]">Title, summary, scope, sector (or the literal &ldquo;not stated&rdquo;), desired outcomes, compliance, evidence requested, evaluation priorities</td></tr>
              <tr className="border-b border-[var(--ink-100,#f0f0f0)]"><td className="px-4 py-2 font-medium">Size and place</td><td className="px-4 py-2 text-[var(--ink-700)]">Regions, the site band, user bands, cloud platforms. Bands always, exact figures never</td></tr>
              <tr className="border-b border-[var(--ink-100,#f0f0f0)]"><td className="px-4 py-2 font-medium">Process</td><td className="px-4 py-2 text-[var(--ink-700)]">Response mode and deadlines, decision and go-live targets, engagement type, eligibility</td></tr>
              <tr className="border-b border-[var(--ink-100,#f0f0f0)]"><td className="px-4 py-2 font-medium">Document and activity</td><td className="px-4 py-2 text-[var(--ink-700)]">Whether a full RFP is attached and its section shape (titles and question counts only), plus bid and comment counts, never contents</td></tr>
            </tbody>
            <thead>
              <tr className="border-b border-t border-[var(--ink-200,#e5e5e5)] bg-[var(--ink-50,#fafafa)] text-left">
                <th className="px-4 py-2.5 font-semibold w-44">Gated</th>
                <th className="px-4 py-2.5 font-normal text-[var(--ink-600)]">Sign-in, or the supplier&rsquo;s issued token</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-b border-[var(--ink-100,#f0f0f0)]"><td className="px-4 py-2 font-medium">Buyer identity</td><td className="px-4 py-2 text-[var(--ink-700)]">The organisation name where the buyer chose anonymity, and any contact route. Publishing emails are never rendered anywhere</td></tr>
              <tr className="border-b border-[var(--ink-100,#f0f0f0)]"><td className="px-4 py-2 font-medium">Exact figures</td><td className="px-4 py-2 text-[var(--ink-700)]">The exact site and user counts behind the public bands</td></tr>
              <tr className="border-b border-[var(--ink-100,#f0f0f0)]"><td className="px-4 py-2 font-medium">The room</td><td className="px-4 py-2 text-[var(--ink-700)]">Supplier responses and the feed, the full RFP question set, all pricing (each supplier sees only its own; the buyer sees all)</td></tr>
              <tr><td className="px-4 py-2 font-medium">The controls</td><td className="px-4 py-2 text-[var(--ink-700)]">Responding, inviting, closing. Tokens and infrastructure are never public</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-10 text-sm text-[var(--ink-500)]">Machine-readable board: <a className="underline" href="/sase/opportunities/board/data.json">/opportunities/board/data.json</a>. Each opportunity also has its own feed at /opportunities/&lt;id&gt;/data.json. Agents can read open opportunities and respond via the marketplace MCP at <a className="underline" href="/sase/api/mcp/">/sase/api/mcp/</a>. Pricing amounts stay private to the posting buyer.</p>
    </div>
  );
}
