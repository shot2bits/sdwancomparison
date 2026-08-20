"use client";

/**
 * "Netify captured" — the running list of what the buyer has actually
 * answered, in the chat pane, directly beneath the transcript.
 *
 * WHY HERE AND NOT ON A STATION. Robert, 19 Aug 2026: "when selecting the
 * options for sites, I cannot be sure if the system has recorded it. It's
 * not clear what I have answered or not." The first fix put this list on
 * the Decisions station, which is correct data in the wrong place: the
 * buyer is looking at the chat column at the moment they click, and
 * asking them to change station to check whether a click worked is the
 * same defect one screen further away. The mockup Robert brought on
 * 20 Aug puts it under "You said" for exactly this reason, and he chose
 * that placement over keeping it where it was.
 *
 * WHAT IT SHOWS. Only real, standing document state — `buildAnsweredLog`
 * (answered-log.ts) reads facts the buyer CHOSE (`source: "answer"`) and
 * their own noted items, excludes struck ones, and excludes anything
 * Netify inferred. If a row appears here, publication carries it; strike
 * it and the row leaves at the same instant. It is a mirror, never a
 * second store.
 *
 * Presentational only: `onEdit` is resolved by ProjectDesk (it owns the
 * edit sheet), never by this file.
 */

import { useState } from "react";
import type { AnsweredEntry } from "@/lib/workspace/answered-log";

const mono: React.CSSProperties = { fontFamily: "var(--nf-font-mono)" };

/** How many rows show before the list collapses behind a "show all".
 *  The chat column is a fixed-height persistent pane (see ProjectDesk's
 *  sticky block) — an uncapped list would push the composer and the open
 *  questions out of it, which is the Mission Control mistake again. */
const VISIBLE = 3;

export default function CapturedList({
  entries,
  assumed,
  onEdit,
}: {
  entries: AnsweredEntry[];
  /** Facts Netify INFERRED that are standing in the document right now.
   *  Shown separately and labelled as assumptions — never folded in with
   *  what the buyer said, and never hidden. A live check on 20 Aug 2026
   *  found an inferred sector driving the sector pack and the document
   *  title with nowhere on screen a buyer could see or correct it. */
  assumed: AnsweredEntry[];
  /** Reopens the existing edit sheet for a fact row. Null for rows with
   *  no slot to reopen (noted items) — never a dead control. */
  onEdit: (entry: AnsweredEntry) => void | null;
}) {
  const [expanded, setExpanded] = useState(false);
  if (entries.length === 0 && assumed.length === 0) return null;
  const shown = expanded ? entries : entries.slice(0, VISIBLE);
  const hidden = entries.length - shown.length;

  return (
    <div data-captured className="w-full border-t px-0 pt-3.5 lg:px-6" style={{ borderColor: "var(--nf-rule, #d6d4d0)" }}>
      {entries.length > 0 && (
      <>
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] uppercase" style={{ ...mono, letterSpacing: "0.09em", color: "var(--nf-ink-600, #66635e)" }}>
          Netify captured
        </span>
        <span className="text-[10px]" style={{ ...mono, color: "var(--nf-emerald, #1e4e22)", fontWeight: 700 }}>
          {`${entries.length} recorded`}
        </span>
        <span className="text-[10px]" style={{ color: "var(--nf-ink-400, #83807b)" }}>
          in the document now
        </span>
      </div>

      <ul className="m-0 mt-2 list-none p-0">
        {shown.map((e) => (
          <li key={e.key} className="flex items-baseline gap-2 py-[3px] text-[12px] leading-[1.45]">
            <span aria-hidden="true" className="flex-none font-bold" style={{ color: "var(--nf-emerald, #1e4e22)" }}>
              &#10003;
            </span>
            <span className="min-w-0 flex-1" style={{ color: "var(--nf-ink-800, #302d2a)" }}>
              <span style={{ color: "var(--nf-ink-600, #66635e)" }}>{`${e.label}: `}</span>
              <span style={{ fontWeight: 600 }}>{e.answer}</span>
              {/* How it got here, kept visible: a clicked option and a
                  typed sentence are different evidence, and collapsing
                  them would be the first step back toward "Netify decided
                  this". */}
              <span className="ml-1.5 whitespace-nowrap text-[9.5px] uppercase" style={{ ...mono, letterSpacing: "0.05em", color: "var(--nf-ink-400, #83807b)" }}>
                {e.via === "chose" ? "you chose" : "your words"}
              </span>
            </span>
            {e.path && (
              <button
                type="button"
                onClick={() => onEdit(e)}
                className="flex-none cursor-pointer border-0 bg-transparent p-0 text-[11px] font-semibold"
                style={{ color: "var(--nf-orange-strong, #832f00)" }}
              >
                Edit
              </button>
            )}
          </li>
        ))}
      </ul>

      </>
      )}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 cursor-pointer border-0 bg-transparent p-0 text-[11.5px] font-semibold"
          style={{ color: "var(--nf-orange-strong, #832f00)" }}
        >
          {`Show ${hidden} more`}
        </button>
      )}
      {expanded && entries.length > VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-1 cursor-pointer border-0 bg-transparent p-0 text-[11.5px] font-semibold"
          style={{ color: "var(--nf-ink-600, #66635e)" }}
        >
          Show less
        </button>
      )}

      {assumed.length > 0 && (
        <div className="mt-3 rounded-[3px] border px-2.5 py-2" style={{ borderColor: "var(--nf-orange-soft-border, #db9f76)", background: "var(--nf-orange-soft, #ffe3cc)" }}>
          <div className="text-[10px] uppercase" style={{ ...mono, letterSpacing: "0.09em", color: "var(--nf-orange-strong, #832f00)", fontWeight: 700 }}>
            {`Netify assumed \u00b7 ${assumed.length}`}
          </div>
          <p className="m-0 mt-0.5 text-[11px] leading-[1.4]" style={{ color: "var(--nf-ink-600, #66635e)" }}>
            In the document, but you didn&rsquo;t say it. Change any of these if it&rsquo;s wrong.
          </p>
          <ul className="m-0 mt-1.5 list-none p-0">
            {assumed.map((e) => (
              <li key={e.key} className="flex items-baseline gap-2 py-[3px] text-[12px] leading-[1.45]">
                <span aria-hidden="true" className="flex-none font-bold" style={{ color: "var(--nf-orange-strong, #832f00)" }}>
                  ?
                </span>
                <span className="min-w-0 flex-1" style={{ color: "var(--nf-ink-800, #302d2a)" }}>
                  <span style={{ color: "var(--nf-ink-600, #66635e)" }}>{`${e.label}: `}</span>
                  <span style={{ fontWeight: 600 }}>{e.answer}</span>
                </span>
                {e.path && (
                  <button
                    type="button"
                    onClick={() => onEdit(e)}
                    className="flex-none cursor-pointer border-0 bg-transparent p-0 text-[11px] font-semibold"
                    style={{ color: "var(--nf-orange-strong, #832f00)" }}
                  >
                    Change
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
