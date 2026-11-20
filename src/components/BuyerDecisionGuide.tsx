import { buyerDecisionGuide } from '@/lib/buyer-decision-guide';
import type { ShortlistVendor } from '@/lib/shortlist-core';
const grades: Record<string,string> = {yes:'supported',partial:'partial evidence',partner_integrated:'partner-delivered',managed_service_dependent:'managed-service dependent'};
export default function BuyerDecisionGuide({vendors}:{vendors:ShortlistVendor[]}) {
  return <section id="buyer-decisions" aria-labelledby="buyer-decisions-title">
    <h2 id="buyer-decisions-title">Who will manage your service?</h2>
    <p>Start by deciding whether your team will manage the service or you want a provider to run it. These lists show providers with research supporting each option.</p>
    <p>Separately, decide whether you need networking and security together. SASE combines SD-WAN networking with cloud security; the third list covers this scope.</p>
    <div className="sourcing-cards">{buyerDecisionGuide(vendors).map(group=><article key={group.id}>
      <h3>{group.title}</h3><p>{group.question}</p>
      <details><summary>View {group.providers.length} providers</summary>
        <ul>{group.providers.map(p=><li key={p.slug}><a href={`#provider-${p.slug}`}>{p.name}</a>: {grades[p.grade]}.</li>)}</ul>
        {!group.providers.length && <p>No confirmed records in this view. This does not establish that no supplier can fulfil the requirement.</p>}
      </details>
    </article>)}</div>
  </section>;
}
