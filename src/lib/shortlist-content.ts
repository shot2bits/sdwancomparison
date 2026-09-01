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
    a: "There are two different levels of evidence here and we would rather be plain about which is which. Eighteen facts per provider were re-sourced on 29 July 2026 from the provider's own published material or an independently accountable record, and each one carries a named source, a reliability tier and a sentence quoted from that source which we then re-checked against the live page: the thirteen capabilities that genuinely separate this market, who owns the underlay, whose security service edge stack it is, whether real compliance documentation exists rather than a general assurance, plus published points of presence and availability SLA. The remaining grades, including regional coverage, cloud support, AI capability and resilience, are still indicative desk research rather than individually sourced, and we say so rather than dress them up. Where we could not evidence something we publish it as unknown with the reason. For anything you are going to sign a contract on, confirm it through a structured RFP, which Netify can create and issue to your shortlisted providers.",
  },
];

export const SHORTLIST_INTRO = {
  eyebrow: "SASE and SD-WAN shortlist builder",
  h1: "Compare SASE and SD-WAN providers, vendors and managed services",
  subhead:
    "Compare 30 researched SASE and SD-WAN providers across operating model, network and security capability. Build a ranked shortlist, inspect the evidence, compare two providers directly, then hand your requirements to the Netify RFP Builder.",
};
