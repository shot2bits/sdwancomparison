import type { Metadata } from "next";
import { MCP_TOOL_DEFINITIONS } from "@/lib/mcp-tool-definitions";
import { MCP_RFP_TOOL_DEFINITIONS } from "@/lib/mcp-rfp-tools";
import { MCP_COST_TOOL_DEFINITIONS } from "@/lib/mcp-cost-tools";
import { SECURITY_TOOL_DEFINITIONS_ALL } from "@/lib/mcp-security-tools";
import { WORKSPACE_TOOL_DEFINITIONS } from "@/lib/mcp-workspace-tools";
import { MCP_ACCESS_GROUPS } from "@/lib/capabilities";
import { TOOL_ANNOTATIONS } from "@/lib/mcp-annotations";
import { SITE_URL, getOrganizationSchema, getBreadcrumbSchema } from "@/lib/structured-data";

const ENDPOINT = `${SITE_URL}/api/mcp/`;
const DESCRIPTION = "Use Netify's sourced SASE and SD-WAN research through a supported MCP client. Compare named providers, check evidence, prepare requirements and estimate indicative cost bands. Public research needs no account; private project and supplier actions have additional access checks.";

export const metadata: Metadata = {
  title: "Netify MCP connector: SASE and SD-WAN research and procurement",
  description: "Compare sourced SASE and SD-WAN providers and prepare requirements through MCP. Public research is open; private actions and publication require additional approval.",
  alternates: { canonical: `${SITE_URL}/connector/` },
  openGraph: { title: "Netify MCP connector", description: DESCRIPTION, url: `${SITE_URL}/connector/`, type: "website", locale: "en_GB" },
};

export default function ConnectorPage() {
  const definitions = [...MCP_TOOL_DEFINITIONS, ...MCP_RFP_TOOL_DEFINITIONS, ...MCP_COST_TOOL_DEFINITIONS, ...SECURITY_TOOL_DEFINITIONS_ALL, ...WORKSPACE_TOOL_DEFINITIONS];
  const defByName = new Map<string, { name: string; description: string }>(definitions.map((tool) => [tool.name, tool]));
  const schemas = [getOrganizationSchema(), getBreadcrumbSchema("Connector", "/connector"), {
    "@context": "https://schema.org", "@type": "SoftwareApplication", "@id": `${SITE_URL}/connector/#connector`,
    name: "Netify SASE & SD-WAN Marketplace connector (MCP)", applicationCategory: "BusinessApplication",
    operatingSystem: "Supported Model Context Protocol clients", url: `${SITE_URL}/connector/`, description: DESCRIPTION,
    publisher: { "@id": "https://netify.co.uk/#organization" },
  }];
  return (
    <div className="mx-auto min-w-0 max-w-4xl px-6 py-12 [overflow-wrap:anywhere]">
      {schemas.map((schema, index) => <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />)}
      <p className="mb-2 text-sm text-slate-600">Netify connector · Model Context Protocol</p>
      <h1 id="page-h1" className="mb-3">Use Netify research from your AI assistant</h1>
      <p id="answer" className="max-w-3xl text-lg text-slate-700">{DESCRIPTION}</p>
      <p className="mt-4 text-slate-700">An assistant can help prepare an RFP or a basic statement of requirements. Netify adds a governed question bank, sourced provider comparisons and a shared process for reviewing an anonymous notice and receiving supplier responses. Publication requires the verified buyer&apos;s approval.</p>

      <section className="mt-7 rounded-lg border border-slate-200 bg-slate-50 p-5" aria-labelledby="mcp-endpoint">
        <h2 id="mcp-endpoint" className="mb-2 text-lg font-semibold">Connect public research</h2>
        <code className="block overflow-x-auto text-sm">{ENDPOINT}</code>
        <p className="mt-3 text-sm text-slate-600">Use this exact URL, including the trailing slash, in a supported client&apos;s remote MCP settings. Public research needs no authentication. Private project credentials and verified buyer or supplier identity are separate requirements; adding this endpoint does not sign you into a private project.</p>
        <p className="mt-3 text-sm text-slate-600">Availability and administrator permissions vary between clients, including ChatGPT, Claude and Copilot Studio. Follow your client&apos;s current remote MCP setup instructions. This page does not claim an approved app-directory listing or universal client compatibility.</p>
        <p className="mt-3 text-sm"><a className="underline" href="/sase/.well-known/mcp-server-metadata.json">Server metadata</a> · <a className="underline" href="/sase/capabilities.json">Capabilities and access flags</a> · <a className="underline" href={ENDPOINT}>Endpoint discovery</a></p>
      </section>

      <section className="mt-10" aria-labelledby="mcp-evidence">
        <h2 id="mcp-evidence" className="mb-3 text-xl font-semibold">Evidence your assistant can use</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li><code>compare_vendors</code> compares two or three named providers and returns a link to continue the comparison on Netify. Public comparison does not require publication.</li>
          <li><code>verify_claim</code> returns source evidence and dates where available; unsupported claims remain unconfirmed. <code>list_exclusions</code> explains excluded or conflicting evidence.</li>
          <li><code>workspace_cycle</code> and <code>workspace_ingest</code> return requirements with provenance, including stated facts and labelled inferences. They do not publish a project.</li>
          <li><code>build_sase_shortlist</code> previews aggregate coverage. Personalised provider identities are available through <code>get_unlocked_matches</code> only after publication and verified ownership.</li>
        </ul>
        <p className="mt-4 text-sm"><a className="underline" href="/sase/rfp-builder/questions/">Read the question bank</a> · <a className="underline" href="/sase/question-bank.json">Question data</a> · <a className="underline" href="/sase/rfp-validation-methodology.json">Validation method</a> · <a className="underline" href="/sase/shortlist/">Compare providers</a></p>
      </section>

      <section className="mt-10" aria-labelledby="mcp-tool-access">
        <h2 id="mcp-tool-access" className="mb-3 text-xl font-semibold">Tools and their access requirements</h2>
        <p className="mb-5 text-sm text-slate-600">The descriptions below come from the implemented tool definitions. Read-only does not mean public: some reads require private credentials. Open a tool to review its exact conditions before using it.</p>
        <div className="space-y-7">
          {MCP_ACCESS_GROUPS.map((group) => <section key={group.access} data-mcp-access={group.access}>
            <h3 className="font-semibold">{group.title}</h3><p className="mb-3 mt-1 text-sm text-slate-600">{group.description}</p>
            <div className="divide-y divide-slate-200 border-y border-slate-200">{group.tools.map((name) => {
              const tool = defByName.get(name);
              if (!tool) throw new Error(`Public capability references an unknown MCP tool: ${name}`);
              return <details key={name} className="py-3"><summary className="cursor-pointer text-sm"><code>{name}</code><span className="ml-2 text-slate-600">{TOOL_ANNOTATIONS[name]?.title ?? ""}</span></summary><p className="mt-3 text-sm leading-6 text-slate-700">{tool.description}</p></details>;
            })}</div>
          </section>)}
        </div>
      </section>

      <section className="mt-10 text-sm text-slate-700">
        <h2 className="mb-3 text-xl font-semibold">Continue with your project</h2>
        <p>Use a Short or Detailed RFP, bring an existing RFP or RFI, or publish a basic requirements brief. Keep your bespoke questions and review what suppliers will receive. A project credential is not consent to publish. Supplier RFP submissions currently require the verified web response form.</p>
        <p className="mt-3"><a className="underline" href="https://netify.co.uk/sase-sd-wan-rfp-builder/">Open the buying workspace</a> · <a className="underline" href="/sase/opportunities/board/">View the opportunity board</a> · <a className="underline" href="/sase/cost-estimator/">Estimate cost bands</a></p>
        <h2 className="mb-3 mt-8 text-xl font-semibold">Privacy and permissions</h2>
        <p>Public research does not require sign-in. Stateless tools do not create a project; draft-creation tools store private project data and return a credential. Do not share private tokens or buyer documents without authorization. Buyer identity and supplier pricing are protected by the relevant project permissions.</p>
        <p className="mt-3"><a className="underline" href="https://netify.co.uk/privacy-policy/">Privacy policy</a> · <a className="underline" href="https://netify.co.uk/terms-conditions/">Terms</a> · Support: support@netify.com</p>
        <h2 className="mb-3 mt-8 text-xl font-semibold">BT buying and reseller services</h2>
        <p>Netify also provides a separate BT companion endpoint at <code>https://netify.co.uk/api/mcp/</code>. Its tools, access conditions and commercial scope are separate from this marketplace connector. See <a className="underline" href="https://netify.co.uk/bt-reseller-programme/">BT reseller information</a> before using it.</p>
      </section>
    </div>
  );
}
