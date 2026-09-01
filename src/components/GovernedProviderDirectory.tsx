import { getGovernedProviderSummaries } from "@/lib/governed-provider-catalogue";

const capabilityCodes = ["sd_wan", "ztna", "secure_web_gateway", "firewall_as_a_service"] as const;

function mark(state?: string) {
  if (state === "supported") return "Supported";
  if (state === "partially_supported") return "Partially supported";
  if (state === "partner_delivered") return "Partner delivered";
  if (state === "not_supported") return "Not supported";
  if (state === "unknown") return "Unknown";
  return "Requires confirmation";
}

export default function GovernedProviderDirectory() {
  const providers = getGovernedProviderSummaries();
  return (
    <section className="mt-16" id="provider-directory">
      <p className="eyebrow mb-3">Provider research</p>
      <h2 className="mb-3">30 SASE and SD-WAN vendors and providers compared</h2>
      <div className="overflow-x-auto border border-[var(--ink-200,#e8ebef)] rounded-xl mb-10">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-[var(--ink-50,#f6f8fa)] text-left"><tr><th className="p-3">Provider</th><th className="p-3">Provider type</th><th className="p-3">Products</th><th className="p-3">SD-WAN</th><th className="p-3">ZTNA</th><th className="p-3">Secure web gateway</th><th className="p-3">Firewall as a service</th><th className="p-3">Case studies</th><th className="p-3">Evidence sources</th></tr></thead>
          <tbody>{providers.map((provider) => {
            const states = Object.fromEntries(capabilityCodes.map((code) => [code, provider.capabilities.find((c) => c.capability_code === code)?.support_state]));
            return <tr key={provider.slug} className="border-t border-[var(--ink-200,#e8ebef)] align-top"><th scope="row" className="p-3 text-left font-medium"><a href={provider.url}>{provider.name}</a></th><td className="p-3 capitalize">{provider.providerTypes.join(", ").replaceAll("_", " ")}</td><td className="p-3">{provider.products.map((product) => product.name).join(", ")}</td>{capabilityCodes.map((code) => <td key={code} className="p-3">{mark(states[code])}</td>)}<td className="p-3 tabular-nums">{provider.caseStudies.length}</td><td className="p-3 tabular-nums">{provider.evidenceSourceCount}</td></tr>;
          })}</tbody>
        </table>
      </div>

      <div className="space-y-4">{providers.map((provider) => (
        <article key={provider.slug} id={`provider-${provider.slug}`} className="border border-[var(--ink-200,#e8ebef)] rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl mb-2"><a href={provider.url}>{provider.name}</a></h3><p className="text-sm leading-6 text-[var(--ink-700)] max-w-4xl">{provider.summary}</p></div><a href={provider.url} className="shrink-0 rounded-full border border-[var(--ink-900)] px-4 py-2 text-sm font-medium no-underline">Full provider profile</a></div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4 lg:grid-cols-7"><div><dt className="text-[var(--ink-500)]">Products</dt><dd className="font-medium">{provider.products.length}</dd></div><div><dt className="text-[var(--ink-500)]">Geographies</dt><dd className="font-medium">{provider.geographies.length}</dd></div><div><dt className="text-[var(--ink-500)]">Compliance</dt><dd className="font-medium">{provider.compliance.length}</dd></div><div><dt className="text-[var(--ink-500)]">Integrations</dt><dd className="font-medium">{provider.integrations.length}</dd></div><div><dt className="text-[var(--ink-500)]">Case studies</dt><dd className="font-medium">{provider.caseStudies.length}</dd></div><div><dt className="text-[var(--ink-500)]">Evidence sources</dt><dd className="font-medium">{provider.evidenceSourceCount}</dd></div><div><dt className="text-[var(--ink-500)]">Reviewed</dt><dd className="font-medium">{provider.reviewedAt.slice(0, 10)}</dd></div></dl>
          <details className="mt-5 border-t border-[var(--ink-200,#e8ebef)] pt-4"><summary className="cursor-pointer font-medium">Products, compliance, case studies and evidence sources</summary>
            {provider.products.length > 0 && <div className="mt-5 overflow-x-auto"><h4 className="font-semibold mb-2">Products</h4><table className="w-full text-xs border-collapse"><thead><tr className="text-left bg-[var(--ink-50,#f6f8fa)]"><th className="p-2">Name</th><th className="p-2">Category</th><th className="p-2">Delivery relationship</th><th className="p-2">Delivery model</th><th className="p-2">Target buyer</th></tr></thead><tbody>{provider.products.map((product, index) => <tr key={`${product.name}-${index}`} className="border-t border-[var(--ink-200,#e8ebef)]"><td className="p-2 font-medium">{product.name}</td><td className="p-2">{product.category}</td><td className="p-2">{product.delivery_relationship}</td><td className="p-2">{product.delivery_model}</td><td className="p-2">{product.target_buyer}</td></tr>)}</tbody></table></div>}
            {provider.geographies.length > 0 && <div className="mt-6 overflow-x-auto"><h4 className="font-semibold mb-2">Geographies</h4><table className="w-full text-xs border-collapse"><thead><tr className="text-left bg-[var(--ink-50,#f6f8fa)]"><th className="p-2">Geography</th><th className="p-2">Delivery type</th><th className="p-2">Delivery relationship</th></tr></thead><tbody>{provider.geographies.slice(0, 8).map((item, index) => <tr key={`${item.geography}-${index}`} className="border-t border-[var(--ink-200,#e8ebef)] align-top"><td className="p-2 font-medium">{item.geography}</td><td className="p-2">{item.delivery_type}</td><td className="p-2">{item.delivery_relationship}</td></tr>)}</tbody></table></div>}
            {provider.compliance.length > 0 && <div className="mt-6 overflow-x-auto"><h4 className="font-semibold mb-2">Compliance</h4><table className="w-full text-xs border-collapse"><thead><tr className="text-left bg-[var(--ink-50,#f6f8fa)]"><th className="p-2">Framework</th><th className="p-2">Scope</th><th className="p-2">Support state</th><th className="p-2">Verified date</th></tr></thead><tbody>{provider.compliance.slice(0, 8).map((item) => <tr key={item.id} className="border-t border-[var(--ink-200,#e8ebef)] align-top"><td className="p-2 font-medium">{item.framework}</td><td className="p-2">{item.scope}</td><td className="p-2">{mark(item.support_state)}</td><td className="p-2">{item.verified_date.slice(0, 10)}</td></tr>)}</tbody></table></div>}
            {provider.integrations.length > 0 && <div className="mt-6 overflow-x-auto"><h4 className="font-semibold mb-2">Integrations</h4><table className="w-full text-xs border-collapse"><thead><tr className="text-left bg-[var(--ink-50,#f6f8fa)]"><th className="p-2">Integration name</th><th className="p-2">Integration type</th><th className="p-2">Delivery relationship</th></tr></thead><tbody>{provider.integrations.slice(0, 8).map((item) => <tr key={item.id} className="border-t border-[var(--ink-200,#e8ebef)] align-top"><td className="p-2 font-medium">{item.integration_name}</td><td className="p-2">{item.integration_type}</td><td className="p-2">{item.delivery_relationship}</td></tr>)}</tbody></table></div>}
            {provider.caseStudies.length > 0 && <div className="mt-6 overflow-x-auto"><h4 className="font-semibold mb-2">Case studies</h4><table className="w-full text-xs border-collapse"><thead><tr className="text-left bg-[var(--ink-50,#f6f8fa)]"><th className="p-2">Customer</th><th className="p-2">Sector</th><th className="p-2">Geography</th><th className="p-2">Estate</th><th className="p-2">Outcome</th><th className="p-2">Verified date</th></tr></thead><tbody>{provider.caseStudies.map((item) => <tr key={item.id} className="border-t border-[var(--ink-200,#e8ebef)] align-top"><td className="p-2 font-medium">{item.named_customer ?? item.customer_type}</td><td className="p-2">{item.sector}</td><td className="p-2">{item.geography}</td><td className="p-2">{item.estate}</td><td className="p-2 min-w-96">{item.outcome}</td><td className="p-2">{item.verified_date.slice(0, 10)}</td></tr>)}</tbody></table></div>}
            {provider.evidenceSources.length > 0 && <div className="mt-6"><h4 className="font-semibold mb-2">Evidence sources</h4><ol className="grid gap-2 text-xs md:grid-cols-2">{provider.evidenceSources.slice(0, 5).map((source) => <li key={source.id}><a href={source.url} rel="noreferrer">{source.title}</a> · {source.reliability_tier} · {source.verified_date.slice(0, 10)}</li>)}</ol></div>}
          </details>
        </article>
      ))}</div>
    </section>
  );
}
