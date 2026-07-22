/**
 * The sector derivation (pure, fixtured): which pack a standing position
 * unlocks, which flavours the buyer's own words show, and which
 * suggestions remain visible under the pack law. No pack ever writes a
 * fact; this module only reads the position and filters offers.
 */

import type { SecurityRequirementInput } from "@/lib/security/rulebook";
import type { WorkspaceFact } from "@/lib/workspace/draft";
import { SECTOR_PACKS, type PackRiskNote, type PackSuggestion, type SectorPack } from "@/lib/sector/packs";
import { factId } from "@/lib/workspace/draft";
import type { AllowedPath } from "@/lib/workspace/extract";
import { TAXONOMY } from "@/lib/workspace/taxonomy";

/** The pack a STANDING sector fact unlocks; the example state never
 *  activates a pack because example content never lands as facts. */
export function activePack(requirement: SecurityRequirementInput): SectorPack | null {
  const sector = String(requirement.organisation?.sector ?? "");
  if (!sector) return null;
  return SECTOR_PACKS.find((p) => p.sectorMatch.test(sector)) ?? null;
}

/** Flavours the buyer's own words show. Empty corpus, no flavours. */
export function activeFlavours(pack: SectorPack, corpus: string): string[] {
  if (!corpus) return [];
  return pack.flavours.filter((f) => f.match.test(corpus)).map((f) => f.id);
}

const ITEM_PATHS = new Map<string, { path: AllowedPath; value: unknown }>();
for (const sec of TAXONOMY) {
  for (const item of sec.items) {
    if (item.path) ITEM_PATHS.set(item.id, { path: item.path as AllowedPath, value: item.value });
  }
}

/** A suggestion is visible only while it is genuinely an open offer:
 *  hidden once its fact stands (however it landed), once accepted (the
 *  noted record carries ps-<id>), and forever once declined. */
export function visibleSuggestions(
  pack: SectorPack,
  flavours: string[],
  facts: WorkspaceFact[],
  notedIds: string[],
  declined: string[],
): PackSuggestion[] {
  const all = [...pack.suggestions, ...flavours.flatMap((f) => pack.flavourSuggestions[f] ?? [])];
  return all.filter((s) => {
    if (declined.includes(s.id)) return false;
    if (notedIds.includes(`ps-${s.id}`)) return false;
    if (s.accept.kind === "items") {
      for (const itemId of s.accept.itemIds) {
        const def = ITEM_PATHS.get(itemId);
        if (!def) continue;
        const id = factId(def.path, def.value);
        if (facts.some((f) => f.id === id && String(f.value) === String(def.value) && !f.struck)) return false;
        if (notedIds.includes(itemId)) return false;
      }
    }
    return true;
  });
}

/** Declined suggestions that should render on the record for the active
 *  pack (id order follows the pack definition). */
export function declinedOnRecord(pack: SectorPack, flavours: string[], declined: string[]): PackSuggestion[] {
  const all = [...pack.suggestions, ...Object.values(pack.flavourSuggestions).flat()];
  void flavours;
  return all.filter((s) => declined.includes(s.id));
}

/** The pack's advice for the active flavours: rendered quietly with the
 *  pack version as provenance, never published, never facts. */
export function packRiskNotes(pack: SectorPack, flavours: string[]): PackRiskNote[] {
  return [...pack.riskNotes, ...flavours.flatMap((f) => pack.flavourRiskNotes[f] ?? [])];
}
