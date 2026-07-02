import type { Metadata } from "next";
import Link from "next/link";
import NoticeBuilder from "@/components/NoticeBuilder";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema, getSpeakableSchema } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "Post a SASE or SD-WAN project notice",
  description:
    "Draft a short project notice in minutes: scope, sites, timeline and what you want from suppliers. Preview it in the clear; sign in only to publish. Pricing responses stay private.",
  alternates: { canonical: `${SITE_URL}/opportunities/new/` },
  openGraph: {
    title: "Post a SASE or SD-WAN project notice",
    description: "Draft and preview without signing in. Publish to verified suppliers when ready.",
    url: `${SITE_URL}/opportunities/new`,
    type: "website",
    locale: "en_GB",
  },
};

export default function NewOpportunityPage() {
  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to post a SASE or SD-WAN project notice on Netify",
    description:
      "Draft a short project notice describing your network or security need, preview it as a public opportunity, then sign in to publish it to verified suppliers.",
    step: [
      { "@type": "HowToStep", name: "Choose scope", text: "Pick what the project covers: underlay circuits, SD-WAN, SSE, full SASE, firewall, ZTNA, managed service or 'not sure'." },
      { "@type": "HowToStep", name: "Add project basics", text: "Sector, size, regions, sites, users and cloud platforms. Choose whether to publish named or anonymous." },
      { "@type": "HowToStep", name: "Describe the need", text: "Plain English is enough — no RFP writing required." },
      { "@type": "HowToStep", name: "Choose response mode", text: "Indicative pricing, discovery calls, written responses, reverse auction or a Netify-assisted shortlist." },
      { "@type": "HowToStep", name: "Set the timeline", text: "Response deadline, decision target and go-live." },
      { "@type": "HowToStep", name: "Improve with AI", text: "Optional AI pass that clarifies the brief, flags gaps and suggests evidence to request, with assumptions marked." },
      { "@type": "HowToStep", name: "Preview and publish", text: "Preview the exact public notice, then sign in to publish. Supplier pricing stays private to you." },
    ],
  };
  const schemas = [getOrganizationSchema(), getBreadcrumbSchema("Post a project", "/opportunities/new"), getSpeakableSchema("/opportunities/new"), howTo];

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}
      <div className="mb-10 max-w-3xl">
        <p className="eyebrow mb-3">Post a project</p>
        <h1 id="page-h1" className="mb-4">Publish a project notice in minutes.</h1>
        <p id="page-subhead" className="text-lg text-[var(--ink-700)]">
          Tell the market what you need — no full RFP required. Draft and preview everything in the clear;
          you sign in only when you publish. See a{" "}
          <Link href="/opportunities/sample-uk-retailer-sd-wan-managed-underlay" className="underline">sample notice</Link>{" "}
          or the <Link href="/opportunities/board" className="underline">live board</Link> first.
        </p>
      </div>
      <NoticeBuilder />
    </div>
  );
}
