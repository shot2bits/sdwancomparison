/**
 * All copy for the /shortlist route. One source, three consumers:
 * page.tsx, data.json route and llms.txt.
 */

export const SHORTLIST_FAQS: { q: string; a: string }[] = [
  {
    q: "How does the shortlist builder rank vendors?",
    a: "Every provider is graded against 40 capability features plus regional coverage, cloud support, AI capability, resilience and deployment speed, using public source evidence. Your hard requirements act as filters; everything else feeds a weighted score. Grades map to points: yes 1.0, via partner 0.75, via managed service 0.65, partial 0.5, not confirmed 0.15, not primary 0.",
  },
  {
    q: "Can I share or save my shortlist?",
    a: "Yes. Every filter combination is encoded into the page URL, so you can copy a link, download a PDF version, or have the ranked list emailed to you.",
  },
  {
    q: "What does the AI advisor do?",
    a: "You describe your estate in plain language, for example site count, regions, security requirements and operating model. The advisor maps your description onto the same filters and scoring engine used by the manual controls, then explains the resulting shortlist.",
  },
  {
    q: "Is this comparison vendor neutral?",
    a: "The capability grades use public source evidence only and every vendor is scored against the same matrix. Netify is a BT Authorised Partner and earns commission on some routes to market; rankings are not influenced by commercial relationships.",
  },
  {
    q: "How accurate are the extended dimensions?",
    a: "Regional coverage, cloud support, AI capability, resilience and deployment speed grades are indicative desk research from June 2026. Treat them as a starting point and confirm via a structured RFP, which Netify can issue to your shortlisted vendors.",
  },
];

export const SHORTLIST_INTRO = {
  eyebrow: "SASE and SD-WAN shortlist builder",
  h1: "Build your bespoke SASE and SD-WAN shortlist from 30 graded providers.",
  subhead:
    "Filter by operating model, region, cloud support, security features, AI capability and resilience, or describe your requirements in plain language and let the AI advisor build the shortlist for you. Every result is a shareable URL, a PDF, or an email.",
};
