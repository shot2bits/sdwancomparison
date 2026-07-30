/**
 * Content definitions for the RFP Builder path pages
 * (/rfp-builder/sase, /rfp-builder/sd-wan, /rfp-builder/sse).
 * Server-rendered education per path, feeding the builder with the right
 * product_scope prefill. One source of truth so the pages never drift.
 */

export type RfpPath = {
  slug: string;
  label: string;
  scopeValue: string; // persisted product_scope prefill
  title: string;
  description: string;
  intro: string;
  whoFor: string[];
  covers: string[];
  extendedCategories: string[]; // category_ids from the extended SASE bank shown as preview
  faq: { q: string; a: string }[];
};

export const RFP_PATHS: RfpPath[] = [
  {
    slug: "sase",
    label: "SASE",
    scopeValue: "full_sase",
    title: "Build a SASE RFP",
    description:
      "A structured SASE RFP: ZTNA, SWG, CASB, DLP, FWaaS and SD-WAN integration questions from the Netify question bank, with evidence checklists, gap checking and vendor comparison.",
    intro:
      "A SASE procurement covers both networking and security, which is why generic RFP templates fail: they miss the integration questions (single policy plane, PoP performance, identity integration) where SASE projects actually go wrong. This builder starts from your estate and generates a methodology-backed RFP you can publish to verified vendors and service providers.",
    whoFor: [
      "Replacing VPN with ZTNA for a hybrid workforce",
      "Consolidating web proxy, CASB and DLP point products",
      "Combining an SD-WAN refresh with cloud-delivered security",
      "Regulated buyers needing evidence and audit trails from vendors",
    ],
    covers: [
      "Identity and ZTNA, including device posture and third-party access",
      "SWG, CASB and DLP with TLS inspection specifics",
      "FWaaS and threat protection",
      "SD-WAN integration, PoP selection and failover",
      "Logging, SIEM export and data residency",
      "Service model, deployment, commercials and vendor evidence",
    ],
    extendedCategories: ["identity_ztna", "swg_casb_dlp", "fwaas_threat", "sdwan_integration"],
    faq: [
      { q: "Do I need a full SASE RFP or a shorter project notice?", a: "If you mainly need pricing signals or discovery calls, post a project notice first. It takes minutes and you can turn it into a full RFP later. Use the RFP when you need structured, scored vendor comparison." },
      { q: "Single-vendor or best-of-breed?", a: "The builder lets you set vendor approach (no preference, unified single vendor, or best-of-breed) and adjusts the integration questions accordingly." },
    ],
  },
  {
    slug: "sd-wan",
    label: "SD-WAN",
    scopeValue: "sdwan_only",
    title: "Build an SD-WAN RFP",
    description:
      "A structured SD-WAN RFP: underlay, path selection, breakout, failover, managed service and commercial questions mapped to the Netify SD-WAN methodology and scoring model.",
    intro:
      "SD-WAN tenders live or die on operational detail: underlay coverage per site, failover behaviour during real link events, who answers the phone at 2am, and what a mid-term site addition costs. This builder generates those questions from your estate profile so vendor responses come back comparable.",
    whoFor: [
      "Replacing MPLS with SD-WAN over internet underlay",
      "Multi-site estates (retail, manufacturing, logistics) needing managed service",
      "Buyers comparing vendor-direct against managed provider delivery",
      "Estates with OT networks or cellular failover requirements",
    ],
    covers: [
      "Underlay options, coverage and lead times per region",
      "Application-aware routing, QoS and local breakout",
      "Link failover including 4G/5G behaviour",
      "Managed service model, SLAs, escalation and reporting",
      "Migration from MPLS with phased cutover",
      "Commercials: licensing, term flexibility, hardware lifecycle",
    ],
    extendedCategories: ["sdwan_integration", "service_model", "deployment", "commercials"],
    faq: [
      { q: "Does this cover underlay circuits too?", a: "Yes. Include underlay in scope and the RFP carries circuit coverage and lead-time questions. If you only need circuit pricing, a quick project notice is faster." },
      { q: "How does this relate to the Netify SD-WAN question bank?", a: "Questions are drawn from and cite the published Netify SD-WAN question bank and scoring model (2026.1), so vendors can see the rubric behind the tender." },
    ],
  },
  {
    slug: "sse",
    label: "SSE",
    scopeValue: "sse_only",
    title: "Build an SSE RFP",
    description:
      "A structured SSE RFP: ZTNA, SWG, CASB, DLP and FWaaS questions with evidence requirements — security service edge procurement without an SD-WAN refresh.",
    intro:
      "SSE is the security half of SASE: right when your WAN is fine but VPN, proxy and CASB point products are not. The pitfalls are inspection coverage (TLS, unmanaged devices), data residency and what happens to policy when you later add SD-WAN. This builder asks those questions up front.",
    whoFor: [
      "Replacing VPN concentrators with ZTNA",
      "Consolidating proxy, CASB and DLP into one policy plane",
      "Security-led buyers keeping the existing WAN",
      "Buyers who may add SD-WAN later and need a compatible platform",
    ],
    covers: [
      "ZTNA with device posture and continuous validation",
      "SWG with TLS inspection and category coverage",
      "Inline and API CASB, DLP templates and incident workflow",
      "FWaaS and DNS-layer security",
      "Logging, SIEM export, data residency and sub-processors",
      "Future SD-WAN compatibility and commercials",
    ],
    extendedCategories: ["identity_ztna", "swg_casb_dlp", "logging_siem", "data_residency"],
    faq: [
      { q: "SSE now, SASE later — will this RFP lock me in?", a: "The builder includes SD-WAN compatibility questions in SSE RFPs precisely so a later SASE consolidation stays open." },
      { q: "Is this only for large enterprises?", a: "No — question depth adapts to your estate. A 200-user organisation gets a shorter, sharper RFP than a 10,000-user one." },
    ],
  },
];

export function getRfpPath(slug: string): RfpPath | null {
  return RFP_PATHS.find((p) => p.slug === slug) ?? null;
}
