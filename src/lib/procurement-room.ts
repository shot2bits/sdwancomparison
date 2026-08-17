/**
 * 2030 blueprint, Checkpoint D (17 Aug 2026): the Procurement Room's own
 * three-state read, pulled out of the page component into a pure function
 * so it is unit-testable without spinning a server (see
 * scripts/validate-procurement-room.ts) and so the page and any future
 * caller (an API projection, an export, a notification) share ONE
 * definition of what each state means, never a copy that could drift.
 *
 * The three states are deliberately distinct, not "published or not":
 *   - "not_published": no snapshot exists because publication has not
 *     happened yet. Nothing to show is the honest state, not an error.
 *   - "published_no_snapshot": the project's phase says published (or
 *     later), but no PublishedSnapshot exists -- a legacy record from
 *     before Phase 2 introduced snapshots. Showing a frozen room here
 *     would be dishonest (there is nothing frozen); the page must say so
 *     plainly rather than silently falling back to a live recompute
 *     dressed up as a frozen one.
 *   - "frozen": a real snapshot exists. This is the only state that may
 *     render room content, and it renders ONLY from the snapshot, never
 *     from the live project.
 */
import type { ProjectPhase } from "@/lib/rfp-types";
import type { PublishedSnapshot } from "@/lib/published-snapshot";

export type ProcurementRoomState = "not_published" | "published_no_snapshot" | "frozen";

const PUBLISHED_OR_LATER: ProjectPhase[] = ["published", "qa", "evaluation", "awarded", "transacting", "complete", "closed"];

export function procurementRoomState(phase: ProjectPhase, snapshot: PublishedSnapshot | null): ProcurementRoomState {
  if (snapshot) return "frozen";
  if (PUBLISHED_OR_LATER.includes(phase)) return "published_no_snapshot";
  return "not_published";
}
