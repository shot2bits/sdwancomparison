import { buyerDecisionGuide } from '@/lib/buyer-decision-guide';
import type { ShortlistVendor } from '@/lib/shortlist-core';
const grades: Record<string,string> = {yes:'supported',partial:'partial evidence',partner_integrated:'partner-delivered',managed_service_dependent:'managed-service dependent'};
export default function BuyerDecisionGuide({vendors}:{vendors:ShortlistVendor[]}) {
  return <section id="buyer-decisions" aria-labelledby="buyer-decisions-title">
    <p className="sourcing-eyebrow">Start with the operating decision</p>
    <h2 id="buyer-decisions-title">Which options should you investigate?</h2>
    <p>Choose how you want the service delivered, then inspect the named options. These groups use recorded capability evidence, not a league table. Partial support and delivery dependencies are shown beside each provider. SD-WAN is the networking component of SASE.</p>
    <div className="sourcing-cards">{buyerDecisionGuide(vendors).map(group=><article key={group.id}>
      <h3>{group.title}</h3><p>{group.question}</p>
      <details><summary>See all {group.providers.length} options with recorded evidence</summary>
        <ul>{group.providers.map(p=><li key={p.slug}><a href={`#provider-${p.slug}`}>{p.name}</a>: {grades[p.grade]}.</li>)}</ul>
        {!group.providers.length && <p>No confirmed records in this view. This does not establish that no supplier can fulfil the requirement.</p>}
      </details>
    </article>)}</div>
    <p>Your sector, locations, existing technology, security obligations, budget and delivery timetable can change the shortlist. A capability record alone does not establish suitability for your project.</p>
    <p><a className="sourcing-primary" href="#sourcing-brief">Check options against my requirements →</a>{' '}<a href="#provider-research">Explore all {vendors.length} providers</a></p>
    <p className="sourcing-small"><a href="/sase/shortlist/research-methodology/">How the research works</a>. Netify can take your chosen options into one brief and coordinate supplier responses after you approve the recipients.</p>
  </section>;
}
