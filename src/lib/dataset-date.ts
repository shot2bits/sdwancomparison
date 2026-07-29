import { getAllVendors } from "@/lib/vendors";

/**
 * One place that answers "when was the vendor dataset last verified".
 *
 * Every surface that ranks or compares the thirty supplier records used to
 * carry its own hardcoded month. When the records were re-verified on
 * 29 July 2026 the estate published four different answers at once: the
 * shortlist FAQ said June, the /best/ pages said 10 June in four places, the
 * compare pages said June, the alternatives pages said June three times, and
 * llms.txt told machines June while the JSON twin told them July.
 *
 * The date is a property of the data, so it is read from the data. A refresh
 * cannot leave a stale month behind, because there is no month to leave.
 *
 * Server-only: getAllVendors reads the filesystem.
 */

/** Latest last_verified across all vendor records, as YYYY-MM-DD. */
export function datasetVerifiedIso(): string {
  const dates = getAllVendors()
    .map((v) => v.last_verified)
    .filter(Boolean)
    .sort();
  return dates[dates.length - 1] ?? "";
}

function fmt(iso: string, opts: Intl.DateTimeFormatOptions): string {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    ...opts,
    timeZone: "UTC",
  });
}

/** "29 July 2026", for visible prose. */
export function datasetVerifiedLong(): string {
  return fmt(datasetVerifiedIso(), { day: "numeric", month: "long", year: "numeric" });
}

/** "July 2026", for eyebrows and summary sentences. */
export function datasetVerifiedMonth(): string {
  return fmt(datasetVerifiedIso(), { month: "long", year: "numeric" });
}

/**
 * The later of the dataset date and a writer's editorial date. The two answer
 * different questions and are deliberately not merged in storage, but a single
 * visible "updated" line has to be the more recent of them or it misleads.
 */
export function displayReviewedIso(editorialIso?: string | null): string {
  return [datasetVerifiedIso(), editorialIso || ""].filter(Boolean).sort().slice(-1)[0] ?? "";
}
