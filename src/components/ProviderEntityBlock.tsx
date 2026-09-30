import { bestFor, ukStatus } from "@/lib/shortlist-entity";
import type { ShortlistVendor } from "@/lib/shortlist-core";
import SourcingActions from "./SourcingActions";
export default function ProviderEntityBlock({
  vendor,
  panel = false,
}: {
  vendor: ShortlistVendor;
  panel?: boolean;
}) {
  const uk = ukStatus(vendor);
  const sector = vendor.projection_provenance?.active_review;
  return (
    <section aria-label="Provider evidence and sourcing">
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({"@context":"https://schema.org","@type":"Organization",name:vendor.name,url:`https://netify.co.uk/sase/vendors/${vendor.slug}/`,sameAs:vendor.website}).replace(/</g,"\\u003c")}}/>
      <p>
        {vendor.category} · {uk.label}
        {uk.reviewed_at && ` · reviewed on ${uk.reviewed_at.slice(0, 10)}`}
      </p>
      <p data-best-for={vendor.slug}>
        <strong>Best for:</strong> {bestFor(vendor).best_for}
      </p>
      {uk.reviewed_at && <p>{vendor.uk_basis}</p>}
      {uk.qualification && <p>{uk.qualification}</p>}
      <ul>
        {uk.source_urls.map((url) => (
          <li key={url}>
            <a className="underline" href={url}>
              {url}
            </a>
          </li>
        ))}
      </ul>
      {sector && (
        <>
          <p>{sector.qualification}</p>
          <ul>
            {sector.source_urls.map((url) => (
              <li key={url}>
                <a className="underline" href={url}>
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      <p>{panel ? "Response panel" : "Research only"}</p>
      <a className="underline" href={vendor.website}>
        {vendor.website}
      </a>
      <SourcingActions slug={vendor.slug} />
    </section>
  );
}
