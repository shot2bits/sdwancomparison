/** Narrative excerpts from the governed catalogue, not new capability grades.
 * Full editorial histories remain in the source records. Do not use this copy for matching.
 */
export const PROVIDER_SUMMARY_COPY: Record<string, { summary: string; buyerContext: string; source: string }> = {
  expereo: {
    summary: "Managed SD-WAN and internet connectivity, with Cato Networks as a named partner for managed SASE.",
    buyerContext: "Buyers comparing managed internet connectivity alongside SD-WAN and partner-delivered SASE.",
    source: "https://catonetworks.com/news/expereo-selects-cato-networks-for-delivering-managed-sase-services-worldwide/",
  },
  opensystems: {
    summary: "Managed SD-WAN and SASE supported by Open Systems' Mission Control service team.",
    buyerContext: "Buyers comparing a managed operating model for SD-WAN and SASE.",
    source: "https://open-systems.com/company/",
  },
  "barracuda-secureedge": {
    summary: "SecureEdge combines SD-WAN and cloud security, with an MSP option for multi-tenant management.",
    buyerContext: "Buyers and service providers comparing SecureEdge deployment and management options.",
    source: "https://barracuda.com/products/network-protection/secureedge/msp",
  },
  "virgin-media-o2": {
    summary: "Managed connectivity and SD-WAN with Zscaler-based SASE; confirm the current contracting entity and scope.",
    buyerContext: "Buyers comparing managed connectivity and partner-delivered cloud security.",
    source: "https://virginmediabusiness.co.uk/connectivity/sdwan/",
  },
};
