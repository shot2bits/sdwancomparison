import type { shortlistEntity } from "@/lib/shortlist-entity";
export default function ShortlistEntityBlock({
  entity,
}: {
  entity: ReturnType<typeof shortlistEntity>;
}) {
  return (
    <div data-entity-block>
      {entity.reviewer.name && (
        <p>
          {entity.reviewer.name}
          {entity.reviewer.role && ` · ${entity.reviewer.role}`}
          {entity.reviewer.reviewed_at && ` · ${entity.reviewer.reviewed_at}`}
        </p>
      )}
      <p data-count-sentence>{entity.count_sentence}</p>
      <p>{entity.uk_sentence}</p>
      {entity.market_structure_sentence && (
        <p>{entity.market_structure_sentence}</p>
      )}
      {entity.desk_sentence && <p>{entity.desk_sentence}</p>}
    </div>
  );
}
