import type { Metadata } from "next";
import ShortlistBuilder from "@/components/ShortlistBuilder";
import { FEATURES, getShortlistDataset } from "@/lib/vendors";
import { SHORTLIST_FAQS, SHORTLIST_INTRO } from "@/lib/shortlist-content";
import {
  SITE_URL,
  getBreadcrumbSchema,
  getOrganizationSchema,
  getShortlistDatasetSchema,
  getShortlistFaqSchema,
  getShortlistWebApplicationSchema,
  getSpeakableSchema,
} from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "SASE shortlist builder: compare 30 SD-WAN and SASE providers",
  description:
    "Build a bespoke SASE and SD-WAN shortlist from 30 graded providers. Filter 40 features, regions, clouds, AI and resilience, or ask the AI advisor.",
  alternates: { canonical: `${SITE_URL}/shortlist` },
  openGraph: {
    title: "SASE shortlist builder: compare 30 SD-WAN and SASE providers",
    description:
      "Build a bespoke SASE and SD-WAN shortlist from 30 graded providers, by hand or with the AI advisor.",
    url: `${SITE_URL}/shortlist`,
    type: "website",
    locale: "en_GB",
  },
};

export default function ShortlistPage() {
  const vendors = getShortlistDataset();
  const features = FEATURES.map((f) => ({ id: f.id, name: f.name, category: f.category }));

  const schemas = [
    getOrganizationSchema(),
    getBreadcrumbSchema("Shortlist builder", "/shortlist"),
    getSpeakableSchema("/shortlist"),
    getShortlistWebApplicationSchema(),
    getShortlistDatasetSchema(vendors.length, features.length),
    getShortlistFaqSchema(SHORTLIST_FAQS),
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {schemas.map((s, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
        />
      ))}

      <div className="mb-10 max-w-3xl fade-rise">
        <p className="eyebrow mb-3">{SHORTLIST_INTRO.eyebrow}</p>
        <h1 id="page-h1" className="mb-4">{SHORTLIST_INTRO.h1}</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">
          {SHORTLIST_INTRO.subhead}
        </p>
        <p className="text-sm text-[var(--ink-500)] mt-3">
          Written and reviewed by the Netify research team. Capability grades last
          verified May 2026; extended dimensions June 2026.
        </p>
      </div>

      <ShortlistBuilder vendors={vendors} features={features} />

      <section className="mt-20 max-w-3xl">
        <p className="eyebrow mb-3">Questions</p>
        <h2 className="mb-6">How the shortlist builder works</h2>
        <div className="space-y-6">
          {SHORTLIST_FAQS.map((f) => (
            <div key={f.q}>
              <h3 className="text-base font-medium mb-1">{f.q}</h3>
              <p className="text-sm text-[var(--ink-700)]">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
