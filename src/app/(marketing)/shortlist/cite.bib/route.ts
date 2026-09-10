import { getGovernedProviderSummaries, GOVERNED_SHORTLIST_CONTRACT_VERSION } from "@/lib/governed-provider-catalogue";

export async function GET() {
  const reviewed = getGovernedProviderSummaries().map((provider) => provider.reviewedAt.slice(0, 10)).sort().slice(-1)[0] ?? "2026-09-01";
  const bibtex = `@dataset{netify_sase_sdwan_shortlist_2026,
  author = {{Netify Group Limited}},
  title = {Netify SASE and SD-WAN Provider Capability Matrix},
  year = {2026},
  version = {${GOVERNED_SHORTLIST_CONTRACT_VERSION}},
  url = {https://netify.co.uk/sase/shortlist/},
  note = {30 providers assessed across 40 capabilities. Last reviewed ${reviewed}.}
}\n`;

  return new Response(bibtex, {
    headers: {
      "content-type": "application/x-bibtex; charset=utf-8",
      "content-disposition": 'inline; filename="netify-sase-sdwan-shortlist.bib"',
      "cache-control": "public, max-age=3600, s-maxage=86400",
      "x-robots-tag": "index, follow",
    },
  });
}
