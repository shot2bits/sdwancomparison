import { publicEvidenceOutput } from "@/lib/public-provider-evidence";
import { approvedEditorialReview } from "@/lib/provider-editorial-review";
import BuyerDecisionGuide from "@/components/BuyerDecisionGuide";
import { buildShortlistMarketView, parseShortlistMarketView, SHORTLIST_VIEWS } from "@/lib/shortlist-market-views";
import ShortlistEntityBlock from "@/components/ShortlistEntityBlock";
import { shortlistSchema } from "@/lib/shortlist-schema";
import { shortlistEntity, bestFor } from "@/lib/shortlist-entity";
import {publicResponsePanel} from '@/lib/response-panel';
import {annotateResponsePanel} from '@/lib/response-panel-contract';
import {listPublicOutcomes} from "@/lib/market-outcomes";
import MarketOutcomeView from "@/components/MarketOutcomeView";
import type { Metadata } from "next";
import { getLiveShortlistDataset } from "@/lib/live-shortlist";
import {
  sourcingUndertaking,
  SOURCING_DESCRIPTION,
  COMMISSION_DESCRIPTION,
} from "@/lib/sourcing-contract";
import { shortlistFaqs } from "@/lib/shortlist-faq";
import { SITE_URL } from "@/lib/structured-data";
import { FEATURES } from "@/lib/vendors";
import SourcingEntrance from "@/components/SourcingEntrance";
import "./sourcing.css";
import "./buyer-profiles.css";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const entity = shortlistEntity((await getLiveShortlistDataset()).vendors);
  return { title: {absolute: `${entity.h1} | Netify`}, description: `${entity.count_sentence} ${SOURCING_DESCRIPTION}`, alternates: {canonical: `${SITE_URL}/shortlist/`} };
}
export default async function ShortlistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const outcomes = await listPublicOutcomes().catch(() => null);
  const query = await searchParams;
  const live = await getLiveShortlistDataset();
  const view = parseShortlistMarketView(typeof query.view === "string" ? query.view : "all");
  const vendors = annotateResponsePanel(buildShortlistMarketView(live.vendors,view),await publicResponsePanel());
  const buyerProfiles = view === "all";
  const entity = shortlistEntity(vendors,view === "all" ? undefined : SHORTLIST_VIEWS[view].title);
  const faqs = shortlistFaqs(vendors);
  const schemas = [shortlistSchema(vendors,entity.h1,view === "all" ? "/shortlist/" : `/shortlist/${view}/`)];
  return (
    <main className={`sourcing${buyerProfiles ? " buyer-hub" : ""}`}>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
          }}
        />
      ))}
      <div className={buyerProfiles ? "buyer-layout" : undefined}>
      {buyerProfiles && <nav className="buyer-contents" aria-label="Page contents"><p>Contents</p><a href="#shortlist-overview"><span>01</span>Overview</a><a href="#provider-research"><span>02</span>Compare providers</a><a href="#provider-profiles"><span>03</span>Provider profiles</a><a href="#sourcing-brief"><span>04</span>Your shortlist</a><a href="#research-title"><span>05</span>How we research</a><div className="buyer-side-note">Free to research.<br />No account required.<br /><br />You choose which providers receive your brief.</div></nav>}
      <div className={buyerProfiles ? "buyer-main" : undefined}>
      <header data-entity-block id="shortlist-overview">
        {buyerProfiles ? <><p className="sourcing-eyebrow">SD-WAN and SASE procurement</p><h1>Compare providers.<br />Build your shortlist.</h1></> : <h1>{entity.h1}</h1>}
        <p className="sourcing-lead">{buyerProfiles ? "Compare SD-WAN and SASE providers, understand their services and choose who you want to hear from." : <>Explore {vendors.length} SD-WAN and SASE providers using Netify’s research into their network, security and service capabilities. Tell us what your business needs to narrow the options, or browse the providers yourself.</>}</p>
        <nav className="sourcing-entry-links" aria-label="Choose how to start">
          <a className="sourcing-primary" href={buyerProfiles ? "#provider-research" : "#sourcing-brief"}>{buyerProfiles ? "Compare providers ↓" : "Find providers for my business"}</a>
          <a className="sourcing-outline" href={buyerProfiles ? "#sourcing-brief" : "#provider-research"}>{buyerProfiles ? "Get help with my shortlist" : <>Browse all {vendors.length} providers</>}</a>
        </nav>
        {view!=="all" && <p>{SHORTLIST_VIEWS[view].answer}</p>}

      </header>
      {buyerProfiles ? <div className="sourcing-steps" aria-label="How it works"><div><strong>01 · Compare the options</strong><p>Technology vendors, managed services and carriers.</p></div><div><strong>02 · Understand the service</strong><p>Management responsibilities, deployment and customer examples.</p></div><div><strong>03 · Choose who to approach</strong><p>Request proposals, demos or a pre-sales conversation.</p></div></div> : (<div className="sourcing-steps" aria-label="How it works">
        <div><strong>1. Tell us what you need</strong><p>Enter your sites, users, locations and service needs.</p></div>
        <div><strong>2. Choose the providers we approach</strong><p>Review your brief and select the providers and requests you approve.</p></div>
        <div><strong>3. Compare their responses</strong><p>Netify reviews your request and coordinates supplier responses on an agreed timetable.</p></div>
      </div>)}
      {live.source === "snapshot_fallback" && (
        <p className="sourcing-small">
          Saved research snapshot. A live source connection
          is not currently available; the dates on each provider refer to its
          original review.
        </p>
      )}
      <SourcingEntrance
        showProductFocus={view === "all"}
        buyerProfiles={buyerProfiles}
        features={FEATURES.map(({ id, name }) => ({ id, name }))}
        vendors={vendors.map(v=>publicEvidenceOutput({...v,...bestFor(v),editorial:approvedEditorialReview(v)}))}
        initialSelection={typeof query.provider === "string" && vendors.some(v=>v.slug===query.provider) && typeof query.action === "string" && ["contacts","demo","proposals"].includes(query.action) ? {slug:query.provider,action:query.action as "contacts"|"demo"|"proposals"} : undefined}
        initialSector={
          typeof query.sector === "string" ? query.sector : undefined
        }
      />
      {!buyerProfiles && <BuyerDecisionGuide vendors={vendors}/>}
      <section aria-labelledby="research-title">
        <h2 id="research-title">About this research</h2>
        <details><summary>Research coverage and method</summary>
          <ShortlistEntityBlock entity={entity}/>
          <p><a href="/sase/shortlist/research-methodology/">How the research works</a></p>
          <p><a href="https://creativecommons.org/licenses/by/4.0/">Research licence CC BY 4.0 with attribution to Netify</a></p>
        </details>
        <p className="sourcing-small"><strong>How Netify is paid:</strong> {COMMISSION_DESCRIPTION}</p>
      </section>
      <section>
        <h2>What comes back</h2>
        <details><summary>Response timetable and follow-up</summary><p>{sourcingUndertaking()}</p></details>
        <p>
          Written proposals on one scope, connectivity pricing attached to the
          same requirement, missing costs identified and a decision pack with
          contacts once established. A full RFP can be generated from the brief
          when it is useful.
        </p>
        <p>
          Missing charges remain open questions, never zero. Recommendations
          require supplier confirmation and a review of your hard requirements.
        </p>
      </section>
      <section id="market-record">
        <h2>Market Record</h2>
        <p>Buyer-approved anonymous sourcing outcomes, including declines and incomplete outcomes.</p>
        {outcomes === null ? <p>The Market Record is temporarily unavailable. Please try again later.</p> : outcomes.length === 0 ? <p>No approved outcome records have been published yet.</p> : outcomes.map(record => <div key={record.id}><MarketOutcomeView record={record}/><a href={`/sase/shortlist/outcomes/${record.id}/`}>Read this outcome</a></div>)}
        <a href="/sase/shortlist/market-record.json/">
          Read the record contract and feed
        </a>
      </section>
      <section>
        <h2>Already have an AI-generated shortlist?</h2>
        <p>
          Bring it to Netify. We’ll help check the options, agree which providers
          to approach and request comparable proposals. You approve who receives
          your brief.
        </p>
        <a className="sourcing-primary" href="#sourcing-requirement">Bring my shortlist</a>
        <p className="sourcing-small">
          <a href="/sase/connector/">Connect your AI assistant</a>
        </p>
      </section>
      <section>
        <h2>For suppliers</h2>
        <p>
          Join the response panel with a named contact, an agreed
          response time and acknowledgement of introduction terms. Research
          inclusion alone does not confer panel membership.
        </p>
        <a href="mailto:support@netify.com?subject=Netify%20response%20panel">
          Discuss joining the response panel
        </a>
      </section>
      <section>
        <h2>Provider questions</h2>
        {faqs.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>
      </div></div>
    </main>
  );
}
