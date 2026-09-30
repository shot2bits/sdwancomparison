import { SOURCING_DESCRIPTION } from "@/lib/sourcing-contract";
import type { BriefFields } from '@/lib/buying-workspace-project';
import { REGION_LABELS, SECTOR_LABELS } from '@/lib/shortlist-core';

export function PublicationBenefits({ afterPublication = false, compact = false }: { afterPublication?: boolean; compact?: boolean }) {
  return <ul className={`nf-publication-benefits${compact ? " nf-publication-benefits-compact" : ""}`} aria-label={afterPublication ? 'Publication benefits' : 'Your project benefits'}>
    <li><strong>{compact ? "Prepared requirements" : "Your requirements in one place"}</strong>{!compact && <span>A structured brief you can download, with optional supplier questions to build an RFP.</span>}</li>
    <li><strong>{compact ? "Provider and vendor matching" : "Personalised provider and vendor matching"}</strong>{!compact && <span>{SOURCING_DESCRIPTION}</span>}</li>
    <li><strong>{compact ? "Supplier response workspace" : "A route to supplier proposals"}</strong>{!compact && <span>Use your published project to review any responses. Invitations require confirmed eligibility and your approval.</span>}</li>
  </ul>;
}

export function PreparedRequirements({ fields, hasRfp = false }: { fields: BriefFields; hasRfp?: boolean }) {
  const scope = fields.scope === 'sdwan' ? 'SD-WAN' : fields.scope.toUpperCase();
  const operatingModel = ({managed:'Fully managed',co_managed:'Co-managed',diy:'Self-managed',any:'Not decided'} as Record<string,string>)[fields.operatingModel] ?? 'Not decided';
  return <section className="nf-prepared-requirements" aria-label="Prepared project requirements">
    <h3>Your prepared project requirements</h3>
    <p>{hasRfp ? 'This is the project summary from your supplied details. Your RFP or imported document remains in the requirement editor for you to review.' : 'This structured brief uses the details you supplied. It is not a full RFP yet. Add supplier questions in the RFP editor if you need them; a brief is enough to publish.'}</p>
    <dl>
      <div><dt>Business requirement</dt><dd className="whitespace-pre-wrap">{fields.outcome}</dd></div>
      <div><dt>Project scope</dt><dd>{scope} for {fields.sites} sites in {fields.regions.map(r => REGION_LABELS[r as keyof typeof REGION_LABELS] ?? r).join(', ')}.</dd></div>
      <div><dt>Sector and delivery</dt><dd>{SECTOR_LABELS[fields.sector as keyof typeof SECTOR_LABELS] ?? fields.sector}; {operatingModel}; {fields.timescale}.</dd></div>
    </dl>
    <p className="nf-buying-subtle">No supplier, product, price or service commitment has been selected for you.</p>
  </section>;
}

export function MatchingExample() {
  return <details className="nf-matching-example">
    <summary>See an example of the matching result</summary>
    <p><strong>Illustration only.</strong> These are fictional examples, not your matches or participating suppliers. Your results depend on your requirements and the available evidence.</p>
    <div className="nf-matching-example-grid">
      <article><h4>Example managed provider</h4><p><strong>Fit to check:</strong> managed delivery, required regions and resilient site connectivity.</p><p><strong>Evidence to review:</strong> supported capabilities and any gaps or conditions.</p><p><strong>Still to confirm:</strong> site availability, migration plan and a project quote.</p></article>
      <article><h4>Example technology vendor</h4><p><strong>Fit to check:</strong> networking and security features required by your project.</p><p><strong>Evidence to review:</strong> feature coverage, limitations and delivery model.</p><p><strong>Still to confirm:</strong> the service provider or partner that will implement and support it.</p></article>
    </div>
    <p>A match is a research result, not confirmation that a supplier will bid.</p>
  </details>;
}
