import type { ShortlistVendor } from "./shortlist-core";
import { shortlistEntity, providerTypes } from "./shortlist-entity";
import { shortlistFaqs } from "./shortlist-faq";
import { sourcingServiceSchema } from "./sourcing-contract";
import { SITE_URL, getBreadcrumbSchema } from "./structured-data";
export function shortlistSchema(
  vendors: ShortlistVendor[],
  h1?: string,
  path = "/shortlist/",
) {
  const entity = shortlistEntity(vendors, h1);
  const url = `${SITE_URL}${path}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: entity.h1,
        url,
        dateModified: entity.reviewed_at,
      },
      {
        "@type": "ItemList",
        name: entity.h1,
        numberOfItems: vendors.length,
        itemListElement: vendors.map((v, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Organization",
            name: v.name,
            url: `${SITE_URL}/vendors/${v.slug}/`,
            sameAs: v.website,
            additionalType: Object.entries(providerTypes(v))
              .filter(([, yes]) => yes)
              .map(
                ([type]) =>
                  ({
                    technology: "Technology vendor",
                    carrier: "Carrier",
                    managed: "Managed service provider",
                  })[type],
              ),
          },
        })),
      },
      {
        "@type": "Dataset",
        license: "https://creativecommons.org/licenses/by/4.0/",
        name: entity.h1,
        url: `${SITE_URL}/shortlist/data.json`,
        dateModified: entity.reviewed_at,
        isBasedOn: `${SITE_URL}/shortlist/research-methodology/`,
      },
      ...(entity.reviewer.name
        ? [
            {
              "@type": "Person",
              name: entity.reviewer.name,
              ...(entity.reviewer.role
                ? { jobTitle: entity.reviewer.role }
                : {}),
            },
          ]
        : []),
      sourcingServiceSchema(url),
      {
        "@type": "FAQPage",
        mainEntity: shortlistFaqs(vendors).map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      getBreadcrumbSchema(entity.h1, path),
    ],
  };
}
