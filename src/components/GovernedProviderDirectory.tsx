import { getGovernedProviderSummaries } from "@/lib/governed-provider-catalogue";

const capabilityCodes = ["sd_wan", "ztna", "secure_web_gateway", "firewall_as_a_service"] as const;

function mark(state?: string) {
  if (state === "supported") return "Supported";
  if (state === "partially_supported") return "Partial";
  if (state === "partner_delivered") return "Partner";
  if (state === "not_supported") return "Not supported";
  return "Confirm";
}

export default function GovernedProviderDirectory() {
  const providers = getGovernedProviderSummaries();
  return (
    <section className="mt-16" id="provider-directory">
      <p className="eyebrow mb-3">Provider research</p>
      <h2 className="mb-3">30 SASE and SD-WAN vendors and providers compared</h2>
      <p className="text-sm text-[var(--ink-600)] max-w-3xl mb-7">
        This directory and the comparison engine use the same governed research records. Supported means the current profile contains evidence. Confirm means the public evidence did not establish the claim and it should be tested in an RFP.
      </p>
      <div className="overflow-x-auto border border-[var(--ink-200,#e8ebef)] rounded-xl mb-10">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-[var(--ink-50,#f6f8fa)] text-left">
            <tr><th className="p-3">Provider</th><th className="p-3">Type</th><th className="p-3">SD-WAN</th><th className="p-3">ZTNA</th><th className="p-3">SWG</th><th className="p-3">FWaaS</th><th className="p-3">Sources</th></tr>
          </thead>
          <tbody>
            {providers.map((provider) => {
              const states = Object.fromEntries(capabilityCodes.map((code) => [code, provider.capabilities.find((c) => c.capability_code === code)?.support_state]));
              return <tr key={provider.slug} className="border-t border-[var(--ink-200,#e8ebef)] align-top">
                <th scope="row" className="p-3 text-left font-medium"><a href={provider.url}>{provider.name}</a></th>
                <td className="p-3 capitalize">{provider.providerTypes.join(", ").replaceAll("_", " ")}</td>
                {capabilityCodes.map((code) => <td key={code} className="p-3">{mark(states[code])}</td>)}
                <td className="p-3 tabular-nums">{provider.evidenceSourceCount}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {providers.map((provider) => (
          <article key={provider.slug} id={`provider-${provider.slug}`} className="border border-[var(--ink-200,#e8ebef)] rounded-xl p-5">
            <h3 className="text-lg mb-2"><a href={provider.url}>{provider.name}</a></h3>
            <p className="text-sm leading-6 text-[var(--ink-700)]">{provider.summary}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div><dt className="text-[var(--ink-500)]">Products recorded</dt><dd className="font-medium">{provider.products.length}</dd></div>
              <div><dt className="text-[var(--ink-500)]">Evidence sources</dt><dd className="font-medium">{provider.evidenceSourceCount}</dd></div>
              <div><dt className="text-[var(--ink-500)]">Dataset</dt><dd className="font-medium break-all">{provider.datasetVersion}</dd></div>
              <div><dt className="text-[var(--ink-500)]">Reviewed</dt><dd className="font-medium">{provider.reviewedAt.slice(0, 10)}</dd></div>
            </dl>
            <p className="mt-4 text-sm"><a href={provider.url}>Read the full evidence profile →</a></p>
          </article>
        ))}
      </div>
    </section>
  );
}
