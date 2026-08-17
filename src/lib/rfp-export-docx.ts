/**
 * 2030 blueprint, Checkpoint E (17 Aug 2026): a REAL native Word (.docx)
 * export -- an actual OOXML binary built with the `docx` package, not the
 * pre-existing "styled HTML that Word happens to open" (buildRfpHtml's own
 * doc comment names that limitation honestly). No parallel document
 * representation: this renders the SAME markdown `buildRfpMarkdown()`
 * already produces (the canonical export pipeline every other surface --
 * the .doc-as-HTML download, the print-to-PDF view -- already shares), so
 * a change to the document's actual content only ever needs to happen in
 * ONE place (rfp-document.ts), never here.
 *
 * The converter below is intentionally a SUBSET of Markdown -- exactly the
 * constructs buildRfpMarkdown() actually emits (#, ##, tables, `- `
 * bullets, `- [ ] ` checklist items, `n. ` numbered items with an indented
 * `   - ` sub-bullet, `> ` blockquotes, **bold** inline, blank-line
 * paragraph breaks) -- not a general-purpose Markdown engine. A construct
 * outside that set renders as a plain paragraph rather than being
 * silently dropped, so nothing in a real document ever disappears even if
 * this parser does not recognise it specially.
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";

/** Splits a line on `**bold**` markers into plain/bold TextRuns. Handles
 *  any number of bold spans per line; unmatched trailing `**` is treated
 *  as literal text rather than throwing, since a real document should
 *  never fail to export over a formatting nit. */
function inlineRuns(text: string, opts: { italics?: boolean } = {}): TextRun[] {
  const parts = text.split("**");
  if (parts.length === 1) return [new TextRun({ text, italics: opts.italics })];
  return parts.map((chunk, i) => new TextRun({ text: chunk, bold: i % 2 === 1, italics: opts.italics }));
}

function isTableRule(line: string): boolean {
  return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(line.trim());
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

function buildTable(rows: string[][]): Table {
  const colCount = Math.max(...rows.map((r) => r.length));
  const colWidthDxa = Math.floor(9000 / colCount);
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: Array(colCount).fill(colWidthDxa),
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
      left: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
      right: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" },
    },
    rows: rows.map(
      (cells, ri) =>
        new TableRow({
          children: Array.from({ length: colCount }, (_, ci) => cells[ci] ?? "").map(
            (cell) =>
              new TableCell({
                width: { size: colWidthDxa, type: WidthType.DXA },
                children: [new Paragraph({ children: inlineRuns(cell), heading: ri === 0 ? undefined : undefined })],
              }),
          ),
        }),
    ),
  });
}

/** Markdown (the subset above) -> an array of docx block elements
 *  (Paragraph | Table), in document order. Exported separately from
 *  `renderRfpDocx` so scripts/validate-export-parity.ts can assert
 *  structural properties (heading count, table presence, no dropped
 *  lines) without round-tripping an actual .docx binary. */
export function markdownToDocxBlocks(markdown: string): (Paragraph | Table)[] {
  const lines = markdown.split("\n");
  const blocks: (Paragraph | Table)[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;

    if (line.trim() === "") { i++; continue; }

    if (line.startsWith("# ")) { blocks.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: inlineRuns(line.slice(2)) })); i++; continue; }
    if (line.startsWith("## ")) { blocks.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240 }, children: inlineRuns(line.slice(3)) })); i++; continue; }
    if (line.startsWith("### ")) { blocks.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: inlineRuns(line.slice(4)) })); i++; continue; }

    // Table: a header row immediately followed by a `| --- |` rule.
    if (line.trim().startsWith("|") && i + 1 < lines.length && isTableRule(lines[i + 1]!)) {
      const rows: string[][] = [splitTableRow(line)];
      i += 2;
      while (i < lines.length && lines[i]!.trim().startsWith("|")) { rows.push(splitTableRow(lines[i]!)); i++; }
      blocks.push(buildTable(rows));
      continue;
    }

    if (line.startsWith("> ")) { blocks.push(new Paragraph({ children: inlineRuns(line.slice(2), { italics: true }) })); i++; continue; }

    if (line.startsWith("- [ ] ")) { blocks.push(new Paragraph({ children: [new TextRun({ text: "☐ " }), ...inlineRuns(line.slice(6))] })); i++; continue; }
    if (line.startsWith("- ")) { blocks.push(new Paragraph({ bullet: { level: 0 }, children: inlineRuns(line.slice(2)) })); i++; continue; }
    if (line.startsWith("   - ")) { blocks.push(new Paragraph({ bullet: { level: 1 }, children: inlineRuns(line.slice(5)) })); i++; continue; }

    const numbered = line.match(/^(\d+)\.\s(.*)$/);
    if (numbered) { blocks.push(new Paragraph({ spacing: { before: 120 }, children: inlineRuns(`${numbered[1]}. ${numbered[2]}`) })); i++; continue; }

    blocks.push(new Paragraph({ children: inlineRuns(line) }));
    i++;
  }
  return blocks;
}

/** Renders the given markdown (from buildRfpMarkdown -- the single
 *  canonical export text) into a real .docx binary. `title` sets the
 *  OOXML core-properties document title (what Word shows in File > Info),
 *  independent of the rendered H1. */
export async function renderRfpDocx(markdown: string, title: string): Promise<Buffer> {
  const doc = new Document({
    title,
    creator: "Netify",
    description: "Generated by the Netify Living Procurement OS",
    sections: [{ properties: {}, children: markdownToDocxBlocks(markdown) }],
  });
  return Packer.toBuffer(doc);
}
