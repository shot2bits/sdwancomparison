import type { FeedItem } from "@/components/OpportunityFeed";
export type ComparableBid = {
  supplier: string;
  slug: string | null;
  amount: number | null;
  currency: string;
  model: string;
  unit_note: string;
  notes: string;
  created: number;
};
/** Keep distinct charging bases and currencies separate. A missing figure is not zero. */
export function comparableBidGroups(feed: FeedItem[]) {
  const latest = new Map<string, ComparableBid>();
  for (const f of feed) {
    if (f.type !== "pricing" || !f.pricing) continue;
    const p = f.pricing;
    const currency = p.currency.trim().toUpperCase() || "Currency not stated";
    const basis = p.unit_note.trim();
    const key = JSON.stringify([
      f.actor_slug || f.actor_name,
      p.model,
      currency,
      basis,
    ]);
    if (!latest.has(key) || latest.get(key)!.created < f.created)
      latest.set(key, {
        slug: f.actor_slug,
        supplier: f.actor_name,
        amount: p.amount,
        currency,
        model: p.model,
        unit_note: basis,
        notes: p.notes,
        created: f.created,
      });
  }
  const groups = new Map<string, ComparableBid[]>();
  for (const b of latest.values()) {
    const key = JSON.stringify([b.model, b.currency, b.unit_note]);
    const group = groups.get(key) ?? [];
    group.push(b);
    groups.set(key, group);
  }
  for (const group of groups.values())
    group.sort(
      (a, b) =>
        (a.amount ?? Infinity) - (b.amount ?? Infinity) ||
        a.supplier.localeCompare(b.supplier),
    );
  return groups;
}
