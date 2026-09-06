import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { newCircuitLine } from "@/lib/circuit-schema";
export const runtime = "nodejs";
const columns = [
  "name",
  "country",
  "address",
  "kind",
  "remote",
  "quantity",
  "bandwidth",
  "data",
  "resilience",
  "operation",
  "router",
  "contact_name",
  "contact_email",
  "contact_phone",
  "term",
];
export function GET() {
  return new Response(columns.join(",") + "\r\n", {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="netify-circuit-sites.csv"',
    },
  });
}
export async function POST(req: Request) {
  try {
    if (Number(req.headers.get("content-length") ?? 0) > 2200000)
      throw Error("File too large. Maximum 2 MB.");
    const form = await req.formData(),
      f = form.get("file");
    if (!(f instanceof File) || f.size > 2000000 || !f.size)
      throw Error("Select a CSV or Excel file up to 2 MB.");
    const buf = Buffer.from(await f.arrayBuffer()),
      wb = new ExcelJS.Workbook();
    if (f.name.toLowerCase().endsWith(".csv")) await wb.csv.read(Readable.from(buf));
    else if (f.name.toLowerCase().endsWith(".xlsx")) {
      // Inspect central-directory uncompressed sizes before ExcelJS inflates any ZIP data.
      let inflated = 0,
        entries = 0;
      for (let i = 0; i + 46 < buf.length; i++) {
        if (buf.readUInt32LE(i) === 0x02014b50) {
          inflated += buf.readUInt32LE(i + 24);
          entries++;
        }
      }
      if (!entries || inflated > 15000000)
        throw Error("Workbook expands beyond the 15 MB limit. Export a CSV instead.");
      await wb.xlsx.load(buf as never);
    } else throw Error("Use .csv or .xlsx.");
    if (wb.worksheets.length !== 1)
      throw Error("Use one worksheet per import to avoid missed rows.");
    const sheet = wb.worksheets[0];
    if (!sheet || sheet.rowCount > 501 || sheet.columnCount > 30)
      throw Error("Maximum 500 locations and 30 columns.");
    const heads = columns.map((c) => ({
      key: c,
      index: (sheet.getRow(1).values as unknown[]).findIndex(
        (v) => String(v).trim().toLowerCase() === c,
      ),
    }));
    if (heads.some((h) => ["name", "country", "kind"].includes(h.key) && h.index < 1))
      throw Error("Use the template headers: name, country and kind are required.");
    const lines = [];
    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      if (!row.hasValues) continue;
      const line: Record<string, unknown> = { ...newCircuitLine() };
      for (const h of heads) {
        if (h.index < 1) continue;
        const cell = row.getCell(h.index);
        if (cell.type === ExcelJS.ValueType.Formula)
          throw Error("Replace formulas with values before importing.");
        const value = cell.text.trim();
        if (!value) continue;
        if (h.key === "remote") {
          if (!["true", "false", "yes", "no"].includes(value.toLowerCase()))
            throw Error(`Row ${r}: remote must be yes/no.`);
          line[h.key] = ["true", "yes"].includes(value.toLowerCase());
        } else if (h.key === "quantity") {
          if (!/^\d+$/.test(value) || +value < 1 || +value > 100000)
            throw Error(`Row ${r}: invalid quantity.`);
          line[h.key] = +value;
        } else line[h.key] = value;
      }
      lines.push(line);
    }
    if (!lines.length) throw Error("No location rows found.");
    return Response.json({ lines }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Import failed." },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }
}
