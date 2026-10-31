import {createHash} from "node:crypto";
import holds from "../../data/evidence-release-holds.json";

export function evidenceFingerprint(record: unknown) {
  return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}
/** A hold retires an already expired override from release eligibility. It is
 * not a source review, sign-off or extension. Runtime expiry remains mandatory.
 * Exact hashes prevent edited or newly expired evidence inheriting a hold. */
export function expiredEvidenceHeld(key: string, record: {review_due: string}, now: number,
  registry: Record<string, {fingerprint: string; held_at: string; reason: string}> = holds.records) {
  const hold = registry[key];
  const due = Date.parse(record.review_due);
  const heldAt = Date.parse(hold?.held_at ?? "");
  return Boolean(hold && hold.reason.trim() && Number.isFinite(due) && due <= now &&
    Number.isFinite(heldAt) && heldAt >= due && heldAt <= now &&
    hold.fingerprint === evidenceFingerprint(record));
}
