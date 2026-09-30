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
  SOURCING_TITLE,
  sourcingUndertaking,
  SOURCING_DESCRIPTION,
  COMMISSION_DESCRIPTION,
} from "@/lib/sourcing-contract";
import { shortlistFaqs } from "@/lib/shortlist-faq";
import { SITE_URL } from "@/lib/structured-data";
import { FEATURES } from "@/lib/vendors";
import SourcingEntrance from "@/components/SourcingEntrance";
import "./sourcing.css";
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
  const entity = shortlistEntity(vendors,view === "all" ? undefined : SHORTLIST_VIEWS[view].title);
  const faqs = shortlistFaqs(vendors);
  const schemas = [shortlistSchema(vendors,entity.h1,view === "all" ? "/shortlist/" : `/shortlist/${view}/`)];
  return (
    <main className="sourcing">
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
          }}
        />
      ))}
      <header data-entity-block>
        <h1>{entity.h1}</h1>
        <ShortlistEntityBlock entity={entity}/>
      </header>
      <h2>{SOURCING_TITLE}</h2>
      <p className="sourcing-lead">{SOURCING_DESCRIPTION}</p>
      <div className="sourcing-steps">
        <div>
          <strong>1. Tell us your requirement</strong>
          <p>
            Start with six essentials or paste your existing shortlist. We
            clarify the detail with you.
          </p>
        </div>
        <div>
          <strong>2. Approve who we approach</strong>
          <p>
            Named suppliers, the anonymous information shared and one agreed
            scope.
          </p>
        </div>
        <div>
          <strong>3. Compare the written responses</strong>
          <p>
            {sourcingUndertaking()}
          </p>
        </div>
      </div>
      <div className="sourcing-trust">
        <span>BT Authorised Partner</span>
        <span>{vendors.length} providers researched</span>
        <span>Research open to everyone</span>
      </div>
      <p className="sourcing-small">{COMMISSION_DESCRIPTION}</p>
      <nav className="sourcing-sectors" aria-label="Sector entrance">
        {[
          ["healthcare", "Healthcare"],
          ["retail_ecommerce", "Retail"],
          ["manufacturing", "Manufacturing"],
          ["financial_services", "Financial services"],
        ].map(([key, label]) => (
          <a key={key} href={`/sase/shortlist/?sector=${key}#sourcing-brief`}>
            {label}
          </a>
        ))}
      </nav>
      {live.source === "snapshot_fallback" && (
        <p className="sourcing-small">
          Research snapshot captured 30 September 2026. A live source connection
          is not currently available; the dates on each provider refer to its
          original review.
        </p>
      )}
      <SourcingEntrance
        features={FEATURES.map(({ id, name }) => ({ id, name }))}
        vendors={vendors.map(v=>({...v,...bestFor(v)}))}
        initialSelection={typeof query.provider === "string" && vendors.some(v=>v.slug===query.provider) && typeof query.action === "string" && ["contacts","demo","proposals"].includes(query.action) ? {slug:query.provider,action:query.action as "contacts"|"demo"|"proposals"} : undefined}
        initialSector={
          typeof query.sector === "string" ? query.sector : undefined
        }
      />
      <section>
        <h2>What comes back</h2>
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
        <a className="sourcing-primary" href="#sourcing-requirement">Bring my shortlist →</a>
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
        <p><a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0 with attribution to Netify</a></p>
        <h2>Provider questions</h2>
        {faqs.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>
    </main>
  );
}
