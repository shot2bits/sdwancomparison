/**
 * Live Sourcing Workspace: read a Word (.docx), Excel (.xlsx) or PDF attachment
 * into plain text. Robert, 20 Aug 2026: "It would support Word, Excel or
 * text." The plain-text/markdown/CSV path (ProjectDesk.tsx's readFile)
 * never needed a server round trip — a browser can read those directly.
 * These two formats are ZIP containers with real parsers behind them
 * (mammoth, exceljs), so extraction happens here, server-side, and the
 * client sends the raw file and gets plain text back.
 *
 * This route does exactly one thing: buyer file bytes -> plain text.
 * Everything downstream of that text (chunking, extraction, the source
 * ledger, receipts) is unchanged — the client feeds the returned text
 * through the SAME `ingestText` every paste and drop already runs
 * through, just with `via: "file"` instead of `"paste"`/`"drop"`.
 *
 * SECURITY NOTE (xlsx, 20 Aug 2026): the `xlsx` (SheetJS) npm package has
 * two open HIGH-severity advisories — Prototype Pollution
 * (GHSA-4r6h-8v6p-xvw6) and a parser ReDoS (GHSA-5pgg-2g8v-p4x9) — with no
 * fix published to the npm registry (SheetJS moved post-0.18.5 releases to
 * their own CDN, which this sandbox's network policy cannot reach, and
 * which a production install should not depend on either). Since this
 * route's entire purpose is parsing untrusted, anonymous, buyer-uploaded
 * spreadsheets, that combination was unacceptable here. `exceljs` is used
 * instead — actively maintained, no equivalent advisory against the
 * version installed, and read-only use here besides.
 */

import { corsHeaders, preflight } from "@/lib/cors";
import { flattenWorkbookToText } from "@/lib/workspace/office-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8_000_000;
const MAX_TEXT_CHARS = 200_000;

function pdfFailureMessage(error: unknown): string {
  const detail = error instanceof Error ? `${error.name} ${error.message}`.toLowerCase() : String(error).toLowerCase();
  if (detail.includes("password") || detail.includes("encrypted")) {
    return "That PDF is password-protected. Remove the password or paste the relevant text instead.";
  }
  return "That PDF is corrupt or is not a valid PDF. Try exporting it again, or paste the relevant text instead.";
}

function cleanPdfText(text: string): string {
  // pdf-parse appends its own page separators even when a page contains no
  // selectable text. They are parser metadata, not buyer-authored content.
  return text.replace(/^\s*-- \d+ of \d+ --\s*$/gm, "").trim();
}

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Send the file as multipart form data." }, { status: 400, headers: cors });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file received." }, { status: 400, headers: cors });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "That file is too large to read here (8MB limit) — paste the part that matters instead." }, { status: 413, headers: cors });
  }

  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".docx")) {
    try {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer: buf });
      const text = value.slice(0, MAX_TEXT_CHARS);
      if (!text.trim()) {
        return Response.json({ error: "That document looks empty." }, { status: 422, headers: cors });
      }
      return Response.json({ text }, { headers: cors });
    } catch {
      return Response.json({ error: "Could not read that Word document — it may be corrupt or password-protected." }, { status: 422, headers: cors });
    }
  }

  if (name.endsWith(".xlsx")) {
    try {
      const { default: ExcelJS } = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      // exceljs bundles its own older @types/node whose Buffer type is
      // structurally incompatible with the root project's; runtime shape is identical.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await wb.xlsx.load(buf as any);
      const text = flattenWorkbookToText(wb).slice(0, MAX_TEXT_CHARS);
      if (!text.trim()) {
        return Response.json({ error: "That spreadsheet looks empty." }, { status: 422, headers: cors });
      }
      return Response.json({ text }, { headers: cors });
    } catch {
      return Response.json({ error: "Could not read that spreadsheet — it may be corrupt or password-protected." }, { status: 422, headers: cors });
    }
  }

  if (name.endsWith(".pdf")) {
    if (buf.length < 5 || buf.subarray(0, 5).toString("ascii") !== "%PDF-") {
      return Response.json({ error: "That file has a .pdf name but is not a valid PDF. Try exporting it again." }, { status: 422, headers: cors });
    }
    let parser: { getText: () => Promise<{ text: string }>; destroy: () => Promise<void> } | null = null;
    try {
      const { PDFParse } = await import("pdf-parse");
      parser = new PDFParse({ data: buf });
      const result = await parser.getText();
      const text = cleanPdfText(result.text).slice(0, MAX_TEXT_CHARS);
      if (!text.trim()) return Response.json({ error: "That PDF contains no selectable text. It appears to be scanned; use a searchable PDF or paste the relevant text instead." }, { status: 422, headers: cors });
      return Response.json({ text }, { headers: cors });
    } catch (error) {
      // Keep the real parser exception in server logs so a deployment-only
      // packaging failure cannot be hidden behind a generic buyer message.
      console.error("[workspace/ingest-file] PDF extraction failed", {
        fileName: file.name,
        fileSize: file.size,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      });
      return Response.json({ error: pdfFailureMessage(error) }, { status: 422, headers: cors });
    } finally {
      if (parser) await parser.destroy().catch(() => undefined);
    }
  }

  return Response.json({ error: "Netify reads Word (.docx), PDF, Excel (.xlsx) or plain text here." }, { status: 415, headers: cors });
}
