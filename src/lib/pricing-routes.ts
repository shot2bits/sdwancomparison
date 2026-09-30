import { SOURCING_DESCRIPTION } from "@/lib/sourcing-contract";
/** Public pricing choices shared by the website and assistant discovery. */
export const PRICING_ROUTES = [
  { id: "budget", title: "Explore an indicative budget", description: "Model SASE and SD-WAN costs before approaching suppliers. These provisional estimates are not supplier quotes; market calibration remains outstanding. The current user-based model covers 50–250,000 users. Outside that range, we keep your stated user count and ask suppliers for pricing rather than substituting a default estimate.", href: "https://netify.co.uk/sase/cost-estimator/", action: "Explore budget estimates" },
  { id: "project", title: "Request supplier project pricing", description: SOURCING_DESCRIPTION, href: "https://netify.co.uk/sase-sd-wan-rfp-builder/?journey=quick_list&intent=pricing", action: "Start a supplier pricing request" },
  { id: "circuits", title: "Get sourced circuit quotes", description: "Request Ethernet, broadband or remote SIM connectivity for UK and international locations. Netify goes to market and adds available quotes to your private Market responses. You are notified when pricing is available; this is not an instant price calculator.", href: "https://netify.co.uk/sase/circuit-pricing/", action: "Request circuit pricing" },
] as const;
