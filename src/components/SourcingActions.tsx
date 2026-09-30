"use client";
import { SOURCING_ACTION_LABELS } from "@/lib/sourcing-contract";
export type SourcingAction = "contacts" | "demo" | "proposals";
export const SOURCING_ACTIONS: SourcingAction[] = [
  "contacts",
  "demo",
  "proposals",
];
/** All entrances use the existing desk for plan, consent and request submission. */
export default function SourcingActions({
  slug,
  selected = [],
  onChoose,
}: {
  slug: string;
  selected?: SourcingAction[];
  onChoose?: (slug: string, action: SourcingAction) => void;
}) {
  return (
    <div
      className="sourcing-actions flex flex-wrap gap-3"
      aria-label="Provider sourcing actions"
    >
      {SOURCING_ACTIONS.map((action) =>
        onChoose ? (
          <label key={action} className="sourcing-check">
            <input
              type="checkbox"
              checked={selected.includes(action)}
              onChange={() => onChoose(slug, action)}
            />
            {SOURCING_ACTION_LABELS[action]}
          </label>
        ) : (
          <a
            key={action}
            className="underline"
            href={`/sase/shortlist/?provider=${encodeURIComponent(slug)}&action=${action}#sourcing-brief`}
          >
            {SOURCING_ACTION_LABELS[action]}
          </a>
        ),
      )}
    </div>
  );
}
