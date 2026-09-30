import type { Metadata } from "next";
import { getLiveShortlistDataset } from "@/lib/live-shortlist";
import {
  publicEvidenceProviders,
  PUBLIC_EVIDENCE_NOTICE,
} from "@/lib/public-provider-evidence";
import {
  SOURCING_TITLE,
  SOURCING_DESCRIPTION,
  COMMISSION_DESCRIPTION,
  PUBLIC_SOURCING_TOOLS,
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
  const query = await searchParams;
  const live = await getLiveShortlistDataset();
  const vendors = publicEvidenceProviders(live.vendors);
  const schemas = [
    getOrganizationSchema(),
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: SOURCING_TITLE,
      description: SOURCING_DESCRIPTION,
      url: `${SITE_URL}/shortlist/`,
      provider: { "@type": "Organization", name: "Netify" },
    },
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
            Agree a response target before outreach. If a supplier declines, we
            report it and agree what happens next.
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
        <p>
          Consented sourcing outcomes will be recorded here, including declines
          and incomplete outcomes. No completed records have been published in
          this release.
        </p>
        <div className="sourcing-table">
          <table>
            <caption>Consented Netify sourcing outcomes</caption>
            <thead>
              <tr>
                {[
                  "Sector / scale",
                  "Scope",
                  "Approached / responded / declined",
                  "Days to proposals",
                  "Outcome",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody />
          </table>
        </div>
        <a href="/sase/shortlist/market-record.json/">
          Read the record contract and feed
        </a>
      </section>
      <section>
        <h2>For AI assistants</h2>
        <p>
          Bring a brief or research shortlist into the same Netify service.
          Requests require buyer-confirmed recipients and request-specific
          work-email confirmation before desk review.
        </p>
        <ul>
          {PUBLIC_SOURCING_TOOLS.map((t) => (
            <li key={t}>
              <code>{t}</code>
            </li>
          ))}
        </ul>
        <a href="/sase/api/mcp/">MCP connection and tools</a>
        <p className="sourcing-small">
          ChatGPT app availability is subject to app approval; the public MCP
          connection is the integration route.
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
