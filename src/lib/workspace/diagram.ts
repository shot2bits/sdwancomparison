/**
 * Live Sourcing Workspace: the deterministic network diagram (W0, decided
 * into scope by Robert on 21 July 2026). PURE: a function of the stated
 * requirement and the verdict, nothing else, so it redraws instantly on
 * every correction and can NEVER invent topology.
 *
 * Honesty rules encoded here:
 * - Sites are never distributed across regions unless the split is known;
 *   multiple regions draw ONE cluster labelled with all of them.
 * - The secure edge is labelled "proposed" because it is the future state,
 *   not the estate.
 * - Risk pins derive only from stated facts and the verdict's reasoning;
 *   no pin exists without a source in the model.
 */

import type { SecurityRequirementInput, SecurityScopeVerdict } from "@/lib/security/rulebook";
import type { BuyingId } from "@/lib/workspace/extract";
import { CLOUD_LABELS, NETWORK_LABELS, REGION_LABELS, COMPLIANCE_LABELS } from "@/lib/workspace/draft";

export interface DiagramPin {
  anchor: "sites" | "edge" | "core";
  label: string;
}

export interface DiagramModel {
  empty: boolean;
  clouds: string[];                 // labels, stated cloud platforms only
  edge: { label: string; proposed: boolean };
  core: string[];                   // existing network labels
  sites: { label: string; count: number | null; siteSquares: number; overflow: number };
  /** Geography of the estate, named beside the one cluster (never a split).
   *  Carried separately from the sites label so the figure can set it as
   *  its own wrapped line: geography grows with the buyer's words and must
   *  never push text over a box border (Robert, 23 Jul). */
  regions: string[];
  staff: string | null;
  shields: string[];                // compliance regimes, badge row
  pins: DiagramPin[];
}

export function diagramModel(
  req: SecurityRequirementInput,
  verdict: SecurityScopeVerdict | null,
  buying: BuyingId | null,
): DiagramModel {
  const clouds = (req.estate?.cloud ?? []).map((c) => CLOUD_LABELS[c] ?? c);
  const core = (req.estate?.existingNetwork ?? []).map((n) => NETWORK_LABELS[n] ?? n);
  const regions = (req.organisation?.regions ?? []).map((r) => REGION_LABELS[r] ?? r);
  const sitesN = typeof req.estate?.sites === "number" ? req.estate.sites : null;
  const usersN = typeof req.estate?.users === "number" ? req.estate.users : null;

  const sseInScope =
    buying === "sase" ||
    buying === "sse" ||
    Boolean(
      verdict?.capabilities.some(
        (c) => c.id === "sse" && (c.needed === "required" || c.needed === "recommended"),
      ),
    ) ||
    verdict?.pathRecommendation === "escalate_sase";

  const sitesLabel = sitesN === null ? "Sites: not stated" : `${sitesN} site${sitesN === 1 ? "" : "s"}`;

  const squares = sitesN === null ? 0 : Math.min(sitesN, 8);

  const pins: DiagramPin[] = [];
  const cap = (id: string) => verdict?.capabilities.find((c) => c.id === id);
  if (cap("endpoint")?.needed === "required") pins.push({ anchor: "sites", label: "Endpoint cover required" });
  if (cap("mdr_soc")?.needed === "required") pins.push({ anchor: "edge", label: "Detection and response required" });
  const soc = req.constraints?.inHouseSocCapacity;
  if (soc === "none") pins.push({ anchor: "edge", label: "No out-of-hours cover" });
  else if (soc === "business_hours") pins.push({ anchor: "edge", label: "Business-hours cover only" });
  if ((req.drivers ?? []).includes("incident")) pins.push({ anchor: "sites", label: "Recent incident" });
  if ((req.drivers ?? []).includes("ransomware_concern")) pins.push({ anchor: "sites", label: "Ransomware concern" });
  if (cap("managed_firewall")?.needed === "required") pins.push({ anchor: "core", label: "Managed firewall required" });

  const shields = (req.constraints?.complianceRequirements ?? []).map((c) => COMPLIANCE_LABELS[c] ?? c);

  const empty = clouds.length === 0 && core.length === 0 && sitesN === null && usersN === null && regions.length === 0;

  return {
    empty,
    clouds,
    // The edge speaks what the buyer is actually buying (Harry, 24 July
    // 2026, third session running: SASE selected, node labelled "Secure
    // service edge"). SASE buyers see SASE; the SSE wording remains for
    // SSE-only signals, where it is the correct name.
    edge: sseInScope
      ? { label: buying === "sase" ? "SASE" : "Secure service edge", proposed: true }
      : { label: "Internet", proposed: false },
    core,
    sites: { label: sitesLabel, count: sitesN, siteSquares: squares, overflow: sitesN !== null ? Math.max(0, sitesN - squares) : 0 },
    regions,
    staff: usersN !== null ? `${usersN} staff` : null,
    shields,
    pins: pins.slice(0, 4),
  };
}
