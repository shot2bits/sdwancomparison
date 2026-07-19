import type { Metadata } from "next";
import Link from "next/link";
import { MCP_TOOL_DEFINITIONS } from "@/lib/mcp-tools";
import { MCP_RFP_TOOL_DEFINITIONS } from "@/lib/mcp-rfp-tools";
import { MCP_COST_TOOL_DEFINITIONS } from "@/lib/mcp-cost-tools";
import { TOOL_ANNOTATIONS } from "@/lib/mcp-annotations";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema } from "@/lib/structured-data";

/**
 * The connector page (18 July 2026): the public, indexable home of the
 * Netify MCP server. Three jobs: let a human install Netify into their AI
 * assistant in under a minute, give directories the documentation and
 * policy links their reviews require, and be citable when assistants are
 * asked "can my AI compare SASE vendors or build an RFP".
 */

export const metadata: Metadata = {
  title: "Use Netify inside Claude, ChatGPT and Copilot: the SASE & SD-WAN procurement connector",
  description:
    "Connect your AI assistant to the Netify marketplace over MCP: compare 30 evidence-graded SASE and SD-WAN vendors, build ranked shortlists, estimate cost bands and draft RFPs from inside Claude, ChatGPT or Copilot. No account needed for research; publishing stays sign-in gated.",
  alternates: { canonical: `${SITE_URL}/connector/` },
  openGraph: {
    title: "The Netify connector: SASE & SD-WAN procurement inside your AI assistant",
    description:
      "Add one MCP endpoint to your assistant and it can compare vendors, build shortlists, estimate costs and draft RFPs using Netify's evidence-graded dataset.",
    url: `${SITE_URL}/connector`,
    type: "website",
    locale: "en_GB",
  },
};

const ENDPOINT = `${SITE_URL}/api/mcp`;

const TOOL_GROUPS: { name: string; blurb: string; tools: string[] }[] = [
  {
    name: "Research and compare",
    blurb: "Pure reads over the evidence-graded dataset: 30 vendors, 40 capabilities, public evidence only.",
    tools: ["build_sase_shortlist", "list_sase_vendors", "list_sase_features", "get_sase_vendor_profile"],
  },
  {
    name: "Cost and budget",
    blurb: "The Netify TCO estimator as callable tools. Bands, never point figures, methodology version stated.",
    tools: ["netify_estimate_sase_tco", "netify_get_sase_cost_drivers", "netify_get_delivery_model_comparison", "netify_get_sase_provider_categories", "netify_get_sase_demand_stats"],
  },
  {
    name: "Create and publish",
    blurb: "Draft project notices and RFPs without an account. Publishing to suppliers requires the buyer to sign in on the website; the assistant hands over a link.",
    tools: ["draft_opportunity_notice", "validate_opportunity_notice", "generate_rfp_from_opportunity", "publish_rfp"],
  },
  {
    name: "Respond as a supplier",
    blurb: "Invited suppliers hold a share token. Netify pre-drafts evidence answers so a supplier agent starts from a grounded draft, never a blank form.",
    tools: ["list_opportunities", "get_opportunity", "opportunity_inbox", "opportunity_respond", "get_rfp", "list_rfp_questions", "get_rfp_evidence_draft", "respond_to_rfp", "get_rfp_status", "supplier_inbox", "supplier_reply"],
  },
];

export default function ConnectorPage() {
  const allDefs = [...MCP_TOOL_DEFINITIONS, ...MCP_RFP_TOOL_DEFINITIONS, ...MCP_COST_TOOL_DEFINITIONS] as ReadonlyArray<{ name: string; description: string }>;
  const defByName = new Map(allDefs.map((t) => [t.name, t]));

  const schemas = [
    getOrganizationSchema(),
    getBreadcrumbSchema("Connector", "/connector"),
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/connector/#connector`,
      name: "Netify SASE & SD-WAN Marketplace connector (MCP)",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any (Model Context Protocol)",
      offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
      url: `${SITE_URL}/connector/`,
      installUrl: ENDPOINT,
      description:
        "A Model Context Protocol server that lets AI assistants compare 30 evidence-graded SASE and SD-WAN vendors, build ranked shortlists, estimate cost and TCO bands, and draft and publish RFPs on the Netify marketplace.",
      publisher: { "@id": `${SITE_URL}/#organization` },
      potentialAction: {
        "@type": "InstallAction",
        name: "Add the Netify connector to an AI assistant",
        target: `${SITE_URL}/connector/`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "How to add Netify to Claude, ChatGPT or Copilot",
      step: [
        { "@type": "HowToStep", position: 1, name: "Copy the endpoint", text: `Copy ${ENDPOINT} (no trailing slash).` },
        { "@type": "HowToStep", position: 2, name: "Add a custom connector", text: "In your assistant's connector or app settings, add a custom remote MCP server and paste the endpoint. Authentication: none." },
        { "@type": "HowToStep", position: 3, name: "Ask a procurement question", text: "Ask for a ranked SASE shortlist, a cost band for your estate, or a drafted RFP. Publishing hands you a Netify link to sign in and confirm." },
      ],
    },
  ];

  const codeBox = "block overflow-x-auto rounded-sm border border-[var(--ink-200,#e5e5e5)] bg-[var(--paper-base,#faf9f7)] p-3 text-xs";

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}

      <p className="eyebrow mb-2">Netify connector · Model Context Protocol</p>
      <h1 id="page-h1" className="mb-3">Use Netify inside your AI assistant</h1>
      <p id="answer" className="max-w-3xl text-lg text-[var(--ink-700)]">
        Add one URL to Claude, ChatGPT or Copilot and your assistant can compare 30 evidence-graded SASE and
        SD-WAN vendors, build ranked shortlists, estimate cost and TCO bands, and draft a complete RFP on the
        Netify marketplace. Research needs no account. Publishing to suppliers always ends with you signing in
        on netify.co.uk, so nothing reaches a supplier without your say-so.
      </p>

      <div className="mt-6 rounded-sm border border-amber-300 bg-amber-50 p-4">
        <p className="text-sm font-semibold mb-1">The endpoint</p>
        <code className={codeBox}>{ENDPOINT}</code>
        <p className="mt-2 text-xs text-[var(--ink-600,#555)]">
          Streamable HTTP, JSON-RPC 2.0, protocol versions 2024-11-05 to 2025-06-18. Authentication: none.
          Machine metadata: <a href="/sase/.well-known/mcp-server-metadata.json" className="underline">/.well-known/mcp-server-metadata.json</a>.
        </p>
      </div>

      <section className="mt-10">
        <h2 className="text-xl mb-4">Add it to your assistant</h2>
        <div className="space-y-5 text-sm text-[var(--ink-700)]">
          <div>
            <h3 className="font-semibold text-[var(--ink-900,#111)] mb-1">Claude (web and desktop)</h3>
            <p>Settings, then Connectors, then Add custom connector. Name it Netify, paste the endpoint above, leave authentication off, and save. Claude can then call every research tool directly in chat.</p>
          </div>
          <div>
            <h3 className="font-semibold text-[var(--ink-900,#111)] mb-1">ChatGPT</h3>
            <p>Enable developer mode in Settings, then Connectors, then Create. Paste the endpoint as the MCP server URL with no authentication. Availability of custom connectors varies by plan; if the option is missing, your plan does not yet include it.</p>
          </div>
          <div>
            <h3 className="font-semibold text-[var(--ink-900,#111)] mb-1">Microsoft Copilot Studio and agents</h3>
            <p>Add a custom connector or tool of type Model Context Protocol and supply the endpoint. Enterprise tenants may need an administrator to approve it.</p>
          </div>
          <div>
            <h3 className="font-semibold text-[var(--ink-900,#111)] mb-1">Any other MCP client</h3>
            <code className={codeBox}>{`{ "mcpServers": { "netify": { "url": "${ENDPOINT}" } } }`}</code>
          </div>
        </div>
        <p className="mt-4 text-xs text-[var(--ink-500)]">
          Menu names move as these products evolve. If a step does not match your screen, search your
          assistant&rsquo;s settings for &ldquo;connector&rdquo; or &ldquo;MCP&rdquo;.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl mb-2">What your assistant can do</h2>
        <p className="text-sm text-[var(--ink-600)] mb-5">
          Every tool is served with behaviour annotations, so assistants know reads from writes. Nothing here
          deletes anything, and no tool reaches beyond the Netify marketplace.
        </p>
        <div className="space-y-6">
          {TOOL_GROUPS.map((g) => (
            <div key={g.name}>
              <h3 className="font-semibold text-[var(--ink-900,#111)] mb-1">{g.name}</h3>
              <p className="text-sm text-[var(--ink-600)] mb-2">{g.blurb}</p>
              <ul className="space-y-1.5">
                {g.tools.filter((t) => defByName.has(t)).map((t) => (
                  <li key={t} className="text-sm">
                    <code className="rounded-sm bg-[var(--ink-100,#f5f5f5)] px-1.5 py-0.5 text-xs">{t}</code>{" "}
                    <span className="text-[var(--ink-700)]">{TOOL_ANNOTATIONS[t]?.title ?? ""}.</span>{" "}
                    <span className="text-xs text-[var(--ink-500)]">{TOOL_ANNOTATIONS[t]?.annotations.readOnlyHint ? "Read-only." : "Write, token-gated."}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 max-w-3xl">
        <h2 className="text-xl mb-2">Privacy and safety, plainly</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-[var(--ink-700)]">
          <li>Research, drafting and estimating are anonymous. No account, no tracking identity, no stored conversation data on Netify&rsquo;s side.</li>
          <li>Actions that reach named suppliers require tokens only the rightful holder has, and publishing an RFP always requires the buyer to sign in on netify.co.uk with a business email.</li>
          <li>Pricing amounts are private to the posting buyer. This server never returns one party&rsquo;s pricing to another.</li>
          <li>Capability answers come from Netify&rsquo;s public-evidence evaluation with dates stated; unconfirmed capabilities are labelled unknown, never guessed.</li>
          <li>Full policies: <a href="https://netify.co.uk/privacy-policy/" className="underline">privacy</a>, <a href="https://netify.co.uk/terms-conditions/" className="underline">terms</a>. Support: support@netify.com.</li>
        </ul>
      </section>

      <section className="mt-10 max-w-3xl">
        <h2 className="text-xl mb-2">Prefer the website?</h2>
        <p className="text-sm text-[var(--ink-700)]">
          Everything the connector does exists on the site: the{" "}
          <Link href="/shortlist" className="underline">shortlist builder</Link>, the{" "}
          <Link href="/cost-estimator" className="underline">cost and TCO estimator</Link> and the{" "}
          <Link href="/rfp-builder/new" className="underline">RFP Builder</Link>, which creates and publishes a
          complete RFP in about two minutes, free, with supplier responses side by side and pricing private to
          you.
        </p>
      </section>
    </div>
  );
}
