/**
 * All copy for the /shortlist route. One source, three consumers:
 * page.tsx, data.json route and llms.txt.
 */

export const SHORTLIST_FAQS: { q: string; a: string }[] = [
  {
    q: "How does the shortlist builder rank vendors?",
    a: "The Netify shortlist builder ranks each and every provider based on their capabilities to deliver 40 different in-built features, alongside the likes of regional coverage, cloud support, AI capabilities, resilience and deployment speed, all of which is drawn from information we've been able to publicly source or find evidence for.",
  },
  {
    q: "Can I share or save my shortlist?",
    a: "Yes absolutely, every filter combination is matched to an associated page URL, enabling you to copy a link to take you (or board directors) straight back to the same filtered list again at a later date, as well as being able to download a PDF version or have the ranked list emailed to you.",
  },
  {
    q: "What does the AI advisor do?",
    a: "We've built our AI advisor to make everything easier for you: you describe your estate in plain language (for example site count, regions, security requirements and operating model) and the advisor will take your instructions to map them onto the same filters and scoring engine used by the manual controls, then the advisor will explain the resulting shortlist to you.",
  },
  {
    q: "Is this comparison vendor neutral?",
    a: "Yes, we don't have a bias to any vendor and use publicly available sources and evidence only, as well as every vendor being scored against the exact same matrix. We must mention that Netify is a BT Authorised Partner and earns commission on some routes to market, however these rankings are not influenced by commercial relationships.",
  },
  {
    q: "How accurate are the extended dimensions?",
    a: "We've ensured that everything from the likes of regional coverage, cloud support, AI capability, resilience and deployment speed grades are all indicative research from June 2026, though to be absolutely sure that everything is 100% up to date, we'd strongly recommend confirming offerings via a structured RFP, which Netify can also assist in creating and issue on your behalf to your shortlisted vendors.",
  },
];

export const SHORTLIST_INTRO = {
  eyebrow: "SASE and SD-WAN shortlist builder",
  h1: "Build your bespoke SASE and SD-WAN shortlist from 30 graded providers.",
  subhead:
    "Get started by filtering on the likes of operating model, region, cloud support, security features, AI capability and resilience or, alternatively, use our AI advisor below to describe your requirements in plain language and we'll build the shortlist for you, instantly creating a shareable URL, a PDF or an email.",
};
