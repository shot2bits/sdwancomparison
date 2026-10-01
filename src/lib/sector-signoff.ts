export type SectorSignoff = {
  status: "pending" | "signed_off";
  label: string;
  signed_off_by: string | null;
  signed_off_at: string | null;
};
export function sectorSignoff(
  row: { signed_off_by?: string; signed_off_at?: string },
  now = Date.now(),
): SectorSignoff {
  const by = row.signed_off_by?.trim(),
    at = row.signed_off_at?.trim();
  if (
    by &&
    at &&
    /^\d{4}-\d{2}-\d{2}(?:T.*Z)?$/.test(at) &&
    Number.isFinite(Date.parse(at)) &&
    Date.parse(at) <= now
  )
    return {
      status: "signed_off",
      label: `Sector evidence reviewed by ${by} on ${at.slice(0, 10)}`,
      signed_off_by: by,
      signed_off_at: at,
    };
  return {
    status: "pending",
    label: "Sector evidence: source-reviewed",
    signed_off_by: null,
    signed_off_at: null,
  };
}
