import type { Metadata } from "next";
import Link from "next/link";
import SignIn from "@/components/SignIn";
import { listPublicOpportunities } from "@/lib/rfp-store";
import { OPP_SCOPE_LABELS, type OppScope } from "@/lib/opportunity-types";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema, getSpeakableSchema } from "@/lib/structured-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "For SASE & SD-WAN vendors and providers | Netify marketplace",
  description: "Win SASE, SSE, SD-WAN, circuit and managed service work. See open buyer opportunities, sign in with a verified work email, and bid. Agents can bid over MCP.",
  alternates: { canonical: `${SITE_URL}/for-suppliers/` },
  openGraph: { title: "For vendors and providers", description: "See open buyer opportunities and bid. Domain-verified sign-in.", url: `${SITE_URL}/for-suppliers`, type: "website", locale: "en_GB" },
};

const VALUE = [
  ["Real demand, not leads", "Opportunities are posted by buyers describing a live need, from circuits to full managed SASE."],
  ["Compete on your terms", "Submit a competitive bid in an auction or an indicative quote in a live room. Your pricing stays private to the buyer."],
  ["Verified, low-noise", "Buyers and suppliers sign in with a domain-verified business email, so you engage with real organisations."],
  ["Agent-ready", "Your AI agent can read the board and bid over the marketplace MCP, no portal clicking required."],
];

const STEPS = [
  ["Browse", "See open opportunities below or on the public board. No sign-in to look."],
  ["Verify", "Sign in with your work email; we verify the domain against your organisation."],
  ["Bid or quote", "Submit a bid or indicative quote, comment, register interest, or decline."],
  ["Win", "The buyer compares against independent grades and awards."],
];

export default async function ForSuppliersPage() {
  const opps = (await listPublicOpportunities()).slice(0, 8);
  const schemas = [getOrganizationSchema(), getBreadcrumbSchema("For suppliers", "/for-suppliers"), getSpeakableSchema("/for-suppliers")];
  const card = "rounded-sm border border-[var(--ink-200,#e5e5e5)] p-5";

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {schemas.map((s, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />)}

      <div className="mb-12 max-w-3xl">
        <p className="eyebrow mb-3">For vendors and providers</p>
        <h1 id="page-h1" className="mb-4">Win SASE, SSE and SD-WAN work from buyers who are ready to engage.</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">Netify buyers post real needs, from underlay circuits and appliances to cloud security and full managed SASE. See what is open, sign in with your work email, and bid or quote. Your prices stay private to the buyer.</p>
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
          <h2 className="text-2xl font-semibold mb-4">Sign in to bid</h2>
          <SignIn role="supplier" prompt="Sign in with your work email to bid and quote. We verify your domain against the listed supplier." />
          <p className="text-sm text-[var(--ink-600)] mt-4">Prefer agent-to-agent? Your AI agent can read open opportunities with the <code>list_opportunities</code> tool and bid with <code>opportunity_respond</code> over the marketplace MCP at <a className="underline" href="/api/mcp">/api/mcp</a>.</p>
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
