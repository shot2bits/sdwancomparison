/**
 * Flattening a loaded Excel workbook into plain text, shared by the two
 * places a spreadsheet can enter the workspace (ingest-file's uploaded
 * `.xlsx`, ingest-link's Google Sheets export) — one function, so the two
 * paths can never quietly disagree about how a sheet becomes text for the
 * SAME extractor (chunkForIngest / runCycle) everything else reads
 * through. Robert, 20 Aug 2026: "It would support Word, Excel or text."
 *
 * PURE in the Article 17 sense that matters here: no fetch, no file I/O of
 * its own. It takes an already-loaded `ExcelJS.Workbook` (the caller did
 * the fetch or the file read) and returns a string.
 *
 * Row cap exists for the same reason `chunkForIngest`'s own budget exists
 * — an honest, bounded read rather than an unbounded one that could stall
 * a request on a very large sheet. Unlike chunkForIngest's cap, this one
 * doesn't need its own "truncated" signal surfaced to the buyer: the
 * caller's route already caps total returned text with MAX_TEXT_CHARS,
 * and ingest.ts's own ingestSummary already tells the buyer honestly when
 * the READ text exceeded ITS budget — duplicating that disclosure here for
 * a cap that in practice this one rarely reaches (500 rows) would be noise
 * without adding a fact the buyer needs.
 */

import type ExcelJS from "exceljs";

const MAX_ROWS_PER_SHEET = 500;

export function flattenWorkbookToText(wb: ExcelJS.Workbook): string {
  const parts: string[] = [];
  wb.eachSheet((sheet) => {
    const rows: string[] = [];
    let n = 0;
    sheet.eachRow((row) => {
      if (n >= MAX_ROWS_PER_SHEET) return;
      n++;
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      const line = values.map(cellToText).join(" | ").trim();
      if (line) rows.push(line);
    });
    if (rows.length) parts.push(`# ${sheet.name}\n${rows.join("\n")}`);
  });
  return parts.join("\n\n");
}

/** ExcelJS cell values are sometimes a primitive, sometimes a rich-text or
 *  formula-result object; this is the one place that knows how to read
 *  text out of either shape rather than each caller reinventing it. */
function cellToText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const obj = v as { text?: unknown; result?: unknown; richText?: Array<{ text?: unknown }> };
    if (typeof obj.text === "string") return obj.text;
    if (Array.isArray(obj.richText)) return obj.richText.map((r) => (typeof r.text === "string" ? r.text : "")).join("");
    if (obj.result !== undefined && obj.result !== null) return String(obj.result);
    return "";
  }
  return String(v);
}
