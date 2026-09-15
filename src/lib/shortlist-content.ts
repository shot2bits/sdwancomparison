/**
 * All copy for the /shortlist route. One source, three consumers:
 * page.tsx, data.json route and llms.txt.
 */

export const SHORTLIST_FAQS: { q: string; a: string }[] = [
  {
    q: "Which SD-WAN vendor is best?",
    a: "There is no single best vendor for every estate. The right shortlist depends on operating model, regions, applications, security requirements and the evidence a supplier can provide for the project.",
  },
  {
    q: "Who are the leading SD-WAN providers?",
    a: "The SD-WAN vendor view lists public provider evidence by proven capability count, verification date and name. Computed fit against your operating model, regions and requirements unlocks after verified project publication.",
  },
  {
    q: "Is SD-WAN obsolete?",
    a: "No. SD-WAN remains the network layer in many SASE designs. SASE adds cloud-delivered security and access controls rather than removing the need to control WAN traffic.",
  },
  {
    q: "Should a business choose SD-WAN or MPLS?",
    a: "Many estates use both during migration. SD-WAN can use internet, cellular and MPLS underlays, while the RFP should define application performance, resilience and any sites that must retain private circuits.",
  },
  {
    q: "Who are the leading SASE vendors?",
    a: "The SASE vendor view lists providers with public SASE, ZTNA or secure web gateway evidence in published evidence order. Buyers should compare the networking and security components separately before accepting a single-vendor claim.",
  },
  {
    q: "How does the shortlist builder rank vendors?",
    a: "Public comparison pages show source grades and provider lists ordered by published evidence. After verified publication, the private matching engine evaluates your requirements against the current catalogue and freezes its matching rules, evidence, ranks and scores with that publication.",
  },
  {
    q: "Can I share or save my shortlist?",
    a: "You can share a public comparison link. Your personalised shortlist is saved in your project and unlocks after verified anonymous publication.",
  },
  {
    q: "What does Build from requirements do?",
    a: "Describe your estate, review a short project notice and verify your business identity. Publishing anonymously unlocks a personalised shortlist and supplier responses; a full RFP is optional.",
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
  eyebrow: "SD-WAN and SASE shortlist builder",
  h1: "Compare SD-WAN and SASE providers, vendors and managed services",
  subhead:
    "Compare 30 researched SD-WAN and SASE providers across operating model, network and security capability. Explore the public provider evidence, then review and publish an anonymous project when you are ready. Personalised matching is available through authorised access after publication. Publication does not guarantee invitations or supplier responses. A full RFP is optional.",
};
