import {listPublicOutcomes} from "@/lib/market-outcomes";
import MarketOutcomeView from "@/components/MarketOutcomeView";
import type { Metadata } from "next";
import { getLiveShortlistDataset } from "@/lib/live-shortlist";
import {
  publicEvidenceProviders,
  PUBLIC_EVIDENCE_NOTICE,
} from "@/lib/public-provider-evidence";
import {
  SOURCING_TITLE,
  sourcingUndertaking, sourcingServiceSchema,
  SOURCING_DESCRIPTION,
  COMMISSION_DESCRIPTION,
} from "@/lib/sourcing-contract";
import { SHORTLIST_FAQS } from "@/lib/shortlist-content";
import { SITE_URL, getOrganizationSchema } from "@/lib/structured-data";
import { FEATURES } from "@/lib/vendors";
import SourcingEntrance from "@/components/SourcingEntrance";
import "./sourcing.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: SOURCING_TITLE,
  description: SOURCING_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/shortlist/` },
};
export default async function ShortlistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const outcomes = await listPublicOutcomes().catch(() => null);
  const query = await searchParams;
  const live = await getLiveShortlistDataset();
  const vendors = publicEvidenceProviders(live.vendors);
  const schemas = [
    getOrganizationSchema(),
    sourcingServiceSchema(`${SITE_URL}/shortlist/`),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "Provider research",
      description: PUBLIC_EVIDENCE_NOTICE,
      numberOfItems: vendors.length,
      itemListElement: vendors.map((v, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: v.name,
        url: v.marketplace_url,
      })),
    },
  ];
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
      {process.env.VERCEL_ENV !== "production" && (
        <div className="sourcing-banner">
          Implementation preview · Working wording for Harry · Supplier response
          commitments and operational acceptance remain release gates.
        </div>
      )}
      <p className="sourcing-eyebrow">Netify · UK connectivity marketplace</p>
      <h1>{SOURCING_TITLE}</h1>
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
        vendors={vendors}
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
          Join the response panel with a named pre-sales contact, an agreed
          response time and acknowledgement of introduction terms. Research
          inclusion alone does not confer panel membership.
        </p>
        <a href="mailto:support@netify.com?subject=Netify%20response%20panel">
          Discuss joining the response panel
        </a>
      </section>
      <section>
        <h2>Questions about the service</h2>
        {SHORTLIST_FAQS.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>
    </main>
  );
}
