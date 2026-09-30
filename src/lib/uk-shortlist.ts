/** Buying guidance only: these choices do not certify coverage or change evidence grades. */
export const UK_BUYING_SITUATIONS = [
  {
    id: "uk-sites",
    label: "UK sites only",
    guidance: "Compare site connectivity, backup connections, migration support and who manages each location. Ask suppliers to confirm coverage at your actual addresses.",
  },
  {
    id: "uk-international",
    label: "UK headquarters with overseas offices",
    guidance: "Compare UK and overseas delivery, local connectivity, support hours and escalation ownership. Confirm each country and site separately.",
  },
  {
    id: "uk-cloud-workforce",
    label: "UK workforce using cloud applications",
    guidance: "Compare remote access, identity integration, application performance and security management. Confirm where traffic is inspected and logs are stored.",
  },
] as const;

export const PROVIDER_ROLE_GUIDE = [
  { role: "Technology vendor", description: "Provides the networking or security platform. Confirm whether deployment and ongoing management come from the vendor, your IT team or a delivery partner." },
  { role: "Carrier / connectivity provider", description: "Provides network connectivity and may also offer SD-WAN or SASE. Confirm the platform, circuit responsibilities and service management included in the proposal." },
  { role: "Managed service provider", description: "Operates an agreed service using its own or partner technology. Confirm which platform, support tasks and service levels are included." },
] as const;

export function getUKBuyingSituation(value: string | null | undefined) {
  return UK_BUYING_SITUATIONS.find((situation) => situation.id === value);
}

/** Preserve the buyer's wording; carry only their explicit choice, never suggested requirements. */
export function withUKBuyingContext(requirement: string, situationId: string | null | undefined): string {
  const situation = getUKBuyingSituation(situationId);
  return [situation ? `Buying situation: ${situation.label}.` : "", requirement.trim()].filter(Boolean).join("\n\n");
}
