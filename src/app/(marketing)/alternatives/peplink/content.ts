import { publicProviderEvidence } from "@/lib/public-provider-evidence";
import { getShortlistDataset } from "@/lib/vendors";
// Editorial subject only: this must never add Peplink to the matching catalogue.
export const peplinkContext = {
  reviewed_on: "2026-09-15",
  summary: "Peplink documents SpeedFusion WAN bonding and failover, and InControl 2 cloud network management. If you are considering alternatives, compare how each option meets your connectivity, security and operating requirements rather than treating all products as interchangeable.",
  questions: [
    "Which sites need cellular, satellite or wired links, and which applications need session continuity during failover?",
    "Do you need WAN connectivity alone or cloud-delivered security as well? Ask who supplies and operates each component.",
    "Who will configure, monitor and support the service? Confirm device, subscription, connectivity and managed-service costs with the supplier.",
  ],
  sources: [
    { name: "Peplink: SpeedFusion bonding and failover", url: "https://www.peplink.com/technology/speedfusion-bonding-technology/" },
    { name: "Peplink: InControl 2 network management", url: "https://www.peplink.com/services/software/network-management-solution-incontrol-2/" },
  ],
  scope: "Peplink is the research subject of this page. It is not currently included in Netify’s matching catalogue. The directory below contains researched providers to investigate, not confirmed replacements or invitations.",
};

export function getPeplinkEvidence() {
  const result = publicProviderEvidence(getShortlistDataset().filter(v => v.slug !== "peplink"));
  return {...result, shortlist: result.shortlist.map(v => ({...v, differentiator: v.key_differentiators[0] || v.product_focus || v.shortlist_summary}))};
}
