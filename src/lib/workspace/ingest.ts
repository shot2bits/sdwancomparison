/**
 * The Threshold, stage one (Robert's "make it so", 25 Jul 2026): reading a
 * PASTE through the same engine a sentence takes. This module is the pure
 * part: cutting a long text into cycle-sized pieces without breaking
 * sentences, and saying honestly when material was left unread.
 *
 * The law of the paste: it runs the SAME rail, model, validation and
 * receipts machinery as typing, one chunk per cycle, so provenance,
 * negation windows, magnitude guards and the receipt rule all hold
 * unchanged. Nothing about ingestion invents a second extraction path.
 */

export type IngestPlan = {
  chunks: string[];
  /** True when the text exceeded the read budget; the caller must SAY so. */
  truncated: boolean;
  totalChars: number;
  readChars: number;
};

const DEFAULTS = { chunkMax: 3500, maxChunks: 3 };

/** Cut on paragraph boundaries first, sentences second, hard characters
 *  last, never mid-word where avoidable. Pure and deterministic. */
export function chunkForIngest(
  raw: string,
  opts: Partial<typeof DEFAULTS> = {},
): IngestPlan {
  const { chunkMax, maxChunks } = { ...DEFAULTS, ...opts };
  const text = String(raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return { chunks: [], truncated: false, totalChars: 0, readChars: 0 };

  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const pieces: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= chunkMax) { pieces.push(p); continue; }
    // A paragraph longer than a chunk: split on sentence ends.
    let rest = p;
    while (rest.length > chunkMax) {
      const window = rest.slice(0, chunkMax);
      const cut = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "), window.lastIndexOf("\n"));
      const at = cut > chunkMax * 0.4 ? cut + 1 : chunkMax;
      pieces.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    if (rest) pieces.push(rest);
  }

  // Pack pieces into chunks up to the cap.
  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (!current) { current = piece; continue; }
    if (current.length + 2 + piece.length <= chunkMax) {
      current = `${current}\n\n${piece}`;
    } else {
      chunks.push(current);
      current = piece;
    }
  }
  if (current) chunks.push(current);

  const kept = chunks.slice(0, maxChunks);
  const readChars = kept.reduce((n, c) => n + c.length, 0);
  return {
    chunks: kept,
    truncated: chunks.length > maxChunks,
    totalChars: text.length,
    readChars,
  };
}

/** The honest read summary line, shared by the desk and the MCP tool. */
export function ingestSummary(landed: number, kept: number, plan: IngestPlan): string {
  const parts = [
    `${landed} statement${landed === 1 ? "" : "s"} landed with provenance`,
    kept > 0 ? `${kept} line${kept === 1 ? "" : "s"} kept verbatim in Notes, unplaced` : "nothing needed the Notes",
  ];
  if (plan.truncated) {
    parts.push(`read the first ${plan.readChars.toLocaleString("en-GB")} of ${plan.totalChars.toLocaleString("en-GB")} characters; paste the rest in a second pass`);
  }
  return `Read your paste: ${parts.join(" · ")}.`;
}
