import adjudications from "../../data/provider-sector-adjudications.json";
import { UK_CARRIER_REVIEWS } from "./provider-projection-review";
import { sectorSignoff } from "./sector-signoff";
import {expiredEvidenceHeld} from "./evidence-release-holds";
export function evidenceReviewHealth(now = Date.now()) {
  const rows = [
    ...Object.entries(adjudications).map(([slug, r]) => ({
      slug,
      kind: "sector",
      held: expiredEvidenceHeld(`${slug}/sector`, r, now),
      due: r.review_due,
      signed: sectorSignoff(r, now).status === "signed_off",
    })),
    ...Object.entries(UK_CARRIER_REVIEWS).map(([slug, r]) => ({
      slug,
      kind: "uk_carrier",
      held: expiredEvidenceHeld(`${slug}/uk_carrier`, r, now),
      due: r.review_due,
      signed: sectorSignoff(r, now).status === "signed_off",
    })),
  ];
  const pending = rows.filter((r) => !r.signed);
  return {
    pending: pending.length,
    held_expired: rows.filter(r => r.held).length,
    unresolved_expired: rows.filter(r => Date.parse(r.due) <= now && !r.held).length,
    invalid: rows.filter(r => !Number.isFinite(Date.parse(r.due))).length,
    expiring: rows.filter(
      (r) =>
        Date.parse(r.due) - now <= 14 * 86400000 && Date.parse(r.due) > now,
    ).length,
    expired: rows.filter((r) => Date.parse(r.due) <= now).length,
    owner_deadline: "2026-10-16",
    rows,
  };
}
