import type { Metadata } from "next";
import Link from "next/link";
import SignIn from "@/components/SignIn";
import { listPublicOpportunities } from "@/lib/rfp-store";
import { OPP_SCOPE_LABELS, type OppScope } from "@/lib/opportunity-types";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema, getSpeakableSchema } from "@/lib/structured-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "For SASE & SD-WAN vendors and providers",
  description: "Explore published SASE, SSE and SD-WAN requirements. Review participation conditions, verify access and respond through supported supplier tools.",
  alternates: { canonical: `${SITE_URL}/for-suppliers/` },
  openGraph: { title: "For vendors and providers", description: "Explore published opportunities and their participation conditions. Verified access applies.", url: `${SITE_URL}/for-suppliers`, type: "website", locale: "en_GB" },
};

const VALUE = [
  ["Published requirements", "Review the buyer’s stated need and clarify scope before preparing a response."],
  ["Compete on your terms", "Submit a competitive bid in an auction or an indicative quote in a live room. Your pricing stays private to the buyer."],
  ["Verified access", "Business-email verification supports account access; it does not establish purchasing authority or verified buying intent."],
  ["Connected agents", "An authorised agent can use supported marketplace MCP tools within the same access rules. Check the opportunity’s participation requirements."],
];

const STEPS = [
  ["Browse", "See open opportunities below or on the public board. No sign-in to look."],
  ["Verify", "Sign in with your work email; we verify the domain against your organisation."],
  ["Bid or quote", "Submit a bid or indicative quote, comment, register interest, or decline."],
  ["Buyer review", "The buyer reviews responses and decides whether to proceed. An award is not guaranteed."],
];

export default async function ForSuppliersPage() {
  const opps = (await listPublicOpportunities()).slice(0, 8);
  const schemas = [getOrganizationSchema(), getBreadcrumbSchema("For vendors and providers", "/for-suppliers"), getSpeakableSchema("/for-suppliers")];
  const card = "rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5";

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {schemas.map((s, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />)}

      <div className="mb-12 max-w-3xl">
        <p className="eyebrow mb-3">For vendors and providers</p>
        <h1 id="page-h1" className="mb-4">Explore SASE, SSE and SD-WAN opportunities.</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">Browse published requirements and review the participation route for each opportunity. Account verification and access checks apply. Publication does not independently verify a buyer’s intent, budget or readiness to purchase. Invitations depend on confirmed eligibility; participation does not guarantee an award.</p>
      </div>

      <section className="mb-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {VALUE.map(([t, b]) => <div key={t} className={card}><h2 className="font-semibold mb-1 text-base">{t}</h2><p className="text-sm text-[var(--ink-700)]">{b}</p></div>)}
      </section>

      <section className="mb-14 grid lg:grid-cols-2 gap-10">
        <div>
          <h2 className="text-2xl font-semibold mb-4">How bidding works</h2>
          <ol className="space-y-4">
            {STEPS.map(([t, b], i) => (
              <li key={t} className="flex gap-4">
                <span className="flex-none w-8 h-8 rounded-full bg-amber-500 text-zinc-950 font-semibold flex items-center justify-center">{i + 1}</span>
                <div><p className="font-medium">{t}</p><p className="text-sm text-[var(--ink-700)]">{b}</p></div>
              </li>
            ))}
          </ol>
          <p className="text-xs text-[var(--ink-500)] mt-4">Sign-in verifies your email domain against your organisation in the marketplace. If your domain is not yet recognised, the request is queued for the Netify team to approve. Free and personal email addresses are not accepted.</p>
        </div>
        <div>
          <h2 id="register" className="text-2xl font-semibold mb-4">Register or sign in to bid</h2>
          <SignIn role="supplier" prompt="Enter your work email. Registering and signing in are the same step: we verify your domain and email you a sign-in link." />
          <div className="mt-4 rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4 text-sm text-[var(--ink-700)]">
            <p className="font-medium mb-1">How verification works</p>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Your organisation is already listed</strong> (graded vendor or provider): your work-email domain matches the profile and the sign-in link arrives straight away.</li>
              <li><strong>Domain not recognised yet</strong> (new provider, MSP or a different domain): your request is queued for the Netify team. If approved, your sign-in link is emailed. Participation remains subject to each opportunity’s access rules. Approval timing is not guaranteed.</li>
              <li><strong>No listed profile at all?</strong> The same queue covers you: the Netify team reviews new vendors and service providers and links your domain to a new or claimed profile. You can also email <a className="underline" href="mailto:support@netify.com">support@netify.com</a> with your company name and website to speed it up.</li>
            </ul>
          </div>
          <p className="text-sm text-[var(--ink-600)] mt-4">Prefer agent-to-agent? An authorised agent can use supported tools within their access rules. Read public opportunities with the <code>list_opportunities</code> tool and bid with <code>opportunity_respond</code> over the marketplace MCP at <a className="underline" href="/sase/api/mcp/">/sase/api/mcp/</a>.</p>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Open opportunities</h2>
          <Link href="/opportunities/board" className="text-sm underline">View the full board</Link>
        </div>
        {opps.length === 0 ? (
          <p className="text-sm text-[var(--ink-500)]">No open opportunities right now. Check back, or sign in to be ready when one matches you.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {opps.map((o) => (
              <Link key={o.id} href={`/opportunities/${o.id}`} className="block rounded-sm border border-[var(--ink-200,#e5e5e5)] p-4 no-underline text-inherit transition-colors hover:border-[var(--ink-400,#999)]">
                <div className="flex items-center gap-2 mb-1 text-xs">
                  <span className="rounded-full bg-[var(--ink-100,#f0f0f0)] px-2 py-0.5 font-medium uppercase tracking-wide text-[var(--ink-600)]">{o.engagement_type === "auction" ? "Auction" : "Quote room"}</span>
                  {o.eligibility === "open" && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">Open to bid</span>}
                </div>
                <p className="font-medium leading-snug mb-1">{o.title}</p>
                <div className="flex flex-wrap gap-1.5">
                  {o.scope.map((s) => <span key={s} className="rounded-full border border-[var(--ink-200,#e5e5e5)] px-2 py-0.5 text-xs text-[var(--ink-700)]">{OPP_SCOPE_LABELS[s as OppScope] ?? s}</span>)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
