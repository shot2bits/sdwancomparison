/**
 * Word/Excel attachment and Google Docs/Sheets link ingestion (20 Aug
 * 2026): Robert, "I note you can add an attachment to the AI window,
 * does this work to translate whatever is attached? What happens if
 * say.. someone attached a recipe for apple pie!" -- followed by the
 * explicit request: "It would support Word, Excel or text. Or should be
 * able to read web links (eg. to Google docs)." His scoping choice, via
 * AskUserQuestion, was Google Docs/Sheets links only, not any public URL.
 *
 * Three things this proves, each load-bearing for a different reason:
 *
 *   A. parseGoogleDocLink (workspace/links.ts) is pure and exhaustively
 *      tested here directly -- the SSRF-safety argument in that module's
 *      own doc comment ("the only thing that decides what gets fetched")
 *      is only true if this function actually rejects everything it
 *      claims to reject.
 *
 *   B. /api/workspace/ingest-file is exercised as a REAL route: a real
 *      .docx built with the `docx` package, a real .xlsx built with
 *      `exceljs`, and a real PDF built with `pdf-lib` are POSTed through
 *      the actual exported POST handler as real multipart form data,
 *      proving mammoth/exceljs/pdf-parse extraction,
 *      the size cap, and the unsupported-type rejection all work against
 *      the real parser libraries -- not a hand-rolled stand-in that
 *      could silently drift from what production actually runs.
 *
 *   C. /api/workspace/ingest-link is exercised as a real route too, but
 *      necessarily input-validation-only: this sandbox's network policy
 *      cannot reach docs.google.com (confirmed: `curl` to it times out
 *      here), so a live fetch can't be proven from this environment. What
 *      CAN be proven, and is: non-Google input is rejected before any
 *      fetch is attempted, and a real Google link that the route cannot
 *      reach fails CLEANLY with an honest 502 rather than throwing --
 *      i.e. the route's own error handling around fetch() is real code
 *      under test, even though the happy path (a reachable, shared
 *      Google file) is not provable here.
 *
 * Neither route touches KV or any persisted project, so this file does
 * NOT use fake-kv-harness -- there is nothing to fake. Static imports of
 * the route modules are safe for the same reason.
 */

import { parseGoogleDocLink } from "../src/lib/workspace/links";
import { POST as ingestFileRoute } from "../src/app/api/workspace/ingest-file/route";
import { POST as ingestLinkRoute } from "../src/app/api/workspace/ingest-link/route";
import { readFileSync } from "node:fs";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function expect(cond: boolean, msg: string, detail?: unknown) {
  if (cond) {
    pass++;
    console.log(`PASS  ${msg}${detail !== undefined ? "  ->  " + JSON.stringify(detail) : ""}`);
  } else {
    fail++;
    failures.push(msg);
    console.log(`FAIL  ${msg}${detail !== undefined ? "  ->  " + JSON.stringify(detail) : ""}`);
  }
}

function partA() {
  console.log("=== Part A: parseGoogleDocLink (pure) ===\n");

  const doc1 = parseGoogleDocLink("Here's our estate: https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit?usp=sharing");
  expect(doc1?.kind === "doc", "[A] a doc link with /edit?usp=sharing is recognised as kind: doc", doc1);
  expect(doc1?.id === "1AbCdEfGhIjKlMnOp", "[A] the doc id is extracted correctly", doc1?.id);
  expect(doc1?.exportUrl === "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/export?format=txt", "[A] the doc export URL is the plain-text export endpoint", doc1?.exportUrl);

  const doc2 = parseGoogleDocLink("https://docs.google.com/document/d/xyz789");
  expect(doc2?.id === "xyz789", "[A] a bare doc link (no /edit) is still recognised", doc2?.id);

  const sheet1 = parseGoogleDocLink("our site list is here https://docs.google.com/spreadsheets/d/1Sheet_ID-here/edit#gid=0");
  expect(sheet1?.kind === "sheet", "[A] a sheets link is recognised as kind: sheet", sheet1);
  expect(sheet1?.id === "1Sheet_ID-here", "[A] the sheet id is extracted correctly (including underscore/hyphen)", sheet1?.id);
  expect(sheet1?.exportUrl === "https://docs.google.com/spreadsheets/d/1Sheet_ID-here/export?format=xlsx", "[A] the sheet export URL requests the xlsx export (keeps every sheet, not just one CSV tab)", sheet1?.exportUrl);

  expect(parseGoogleDocLink("just a normal sentence about our sites and users") === null, "[A] ordinary text with no link returns null");
  expect(parseGoogleDocLink("check out https://example.com/document/d/abc123") === null, "[A] a non-Google host is rejected even if the path looks similar");
  expect(parseGoogleDocLink("https://docs.google.com/forms/d/abc123/viewform") === null, "[A] a Google Forms link is rejected -- neither doc nor sheet");
  expect(parseGoogleDocLink("https://drive.google.com/drive/folders/abc123") === null, "[A] a Drive folder link is rejected");
  expect(parseGoogleDocLink("docs.google.com/document/d/noproto123") === null, "[A] a link missing the http(s):// scheme is rejected -- deliberately narrow, not a guess");
  expect(parseGoogleDocLink("") === null, "[A] empty text returns null, not a crash");

  const withOtherText = parseGoogleDocLink("30 UK sites, 4000 users. Full estate list: https://docs.google.com/spreadsheets/d/midtext123/edit and more notes after");
  expect(withOtherText?.kind === "sheet" && withOtherText.id === "midtext123", "[A] a link embedded mid-sentence, with real text before and after, is still found");

  console.log(`\nPart A: ${pass}/${pass + fail} passed so far.\n`);
}

function makeMultipartRequest(url: string, file: File): Request {
  const form = new FormData();
  form.append("file", file);
  return new Request(url, { method: "POST", body: form });
}

async function partB() {
  console.log("=== Part B: /api/workspace/ingest-file (real route, real parsers) ===\n");

  const projectDeskSource = readFileSync(new URL("../src/components/ProjectDesk.tsx", import.meta.url), "utf8");
  const guidedBuildSource = readFileSync(new URL("../src/components/procurement/GuidedBuild.tsx", import.meta.url), "utf8");
  expect(projectDeskSource.includes("Word, PDF, Excel or plain-text document"), "[B] the attachment control visibly names PDF support");
  expect(guidedBuildSource.includes("Import Word, PDF, text or spreadsheet"), "[B] the section import action names every supported file family");

  // --- a real .docx, built with the `docx` package (same one the docx
  // skill uses), containing text this test can assert on verbatim.
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const docxDoc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun("Our estate: 30 UK manufacturing sites, 4000 users.")] }),
          new Paragraph({ children: [new TextRun("Going live within 6 months.")] }),
        ],
      },
    ],
  });
  const docxBuf = await Packer.toBuffer(docxDoc);
  const docxFile = new File([new Uint8Array(docxBuf)], "requirement.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  const docxRes = await ingestFileRoute(makeMultipartRequest("https://example.test/api/workspace/ingest-file", docxFile));
  const docxBody = (await docxRes.json()) as { text?: string; error?: string };
  expect(docxRes.status === 200, "[B] a real .docx upload returns 200", docxRes.status);
  expect(typeof docxBody.text === "string" && docxBody.text.includes("30 UK manufacturing sites"), "[B] the extracted text contains the document's real content", docxBody.text?.slice(0, 80));
  expect(typeof docxBody.text === "string" && docxBody.text.includes("4000 users"), "[B] the extracted text preserves the second fact in the same paragraph");
  expect(typeof docxBody.text === "string" && docxBody.text.includes("Going live within 6 months"), "[B] the extracted text carries the second paragraph too, not just the first");

  // --- a real .xlsx, built with exceljs, across TWO sheets -- proving
  // flattenWorkbookToText walks every sheet, not just the first (a real
  // buyer's estate spreadsheet is rarely a single tab).
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const sitesSheet = wb.addWorksheet("Sites");
  sitesSheet.addRow(["Site", "Users", "Region"]);
  sitesSheet.addRow(["Manchester DC", 250, "North West"]);
  sitesSheet.addRow(["Leeds Branch", 40, "Yorkshire"]);
  const notesSheet = wb.addWorksheet("Notes");
  notesSheet.addRow(["Existing MPLS contract expires March 2027"]);
  const xlsxBuf = await wb.xlsx.writeBuffer();
  const xlsxFile = new File([new Uint8Array(xlsxBuf as ArrayBuffer)], "estate.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const xlsxRes = await ingestFileRoute(makeMultipartRequest("https://example.test/api/workspace/ingest-file", xlsxFile));
  const xlsxBody = (await xlsxRes.json()) as { text?: string; error?: string };
  expect(xlsxRes.status === 200, "[B] a real .xlsx upload returns 200", xlsxRes.status);
  expect(typeof xlsxBody.text === "string" && xlsxBody.text.includes("Manchester DC"), "[B] the extracted text contains a cell value from the first sheet", xlsxBody.text?.slice(0, 120));
  expect(typeof xlsxBody.text === "string" && xlsxBody.text.includes("Leeds Branch") && xlsxBody.text.includes("250"), "[B] both data rows of the first sheet are present, numbers included");
  expect(typeof xlsxBody.text === "string" && xlsxBody.text.includes("Existing MPLS contract"), "[B] the SECOND sheet's content is present too -- multi-sheet workbooks are not silently truncated to sheet one");

  // --- a real text PDF. Scanned/image-only PDFs are deliberately rejected
  // because silently pretending OCR happened would make the RFP check unsafe.
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.create();
  const pdfPage = pdfDoc.addPage([595, 842]);
  const pdfFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  pdfPage.drawText("SASE RFP for 30 UK healthcare sites", { x: 50, y: 760, size: 14, font: pdfFont });
  pdfPage.drawText("Suppliers must provide evidence of managed service SLAs.", { x: 50, y: 730, size: 11, font: pdfFont });
  const pdfBytes = await pdfDoc.save();
  const pdfArrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
  const pdfFile = new File([pdfArrayBuffer], "existing-rfp.pdf", { type: "application/pdf" });
  const pdfRes = await ingestFileRoute(makeMultipartRequest("https://example.test/api/workspace/ingest-file", pdfFile));
  const pdfBody = (await pdfRes.json()) as { text?: string; error?: string };
  expect(pdfRes.status === 200, "[B] a real text PDF upload returns 200", pdfRes.status);
  expect(typeof pdfBody.text === "string" && pdfBody.text.includes("30 UK healthcare sites"), "[B] PDF extraction preserves the buyer context", pdfBody.text?.slice(0, 120));
  expect(typeof pdfBody.text === "string" && pdfBody.text.includes("managed service SLAs"), "[B] PDF extraction preserves supplier requirements");

  // --- rejections
  const oversized = new File([new Uint8Array(8_000_001)], "huge.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const oversizedRes = await ingestFileRoute(makeMultipartRequest("https://example.test/api/workspace/ingest-file", oversized));
  expect(oversizedRes.status === 413, "[B] a file over the 8MB cap is rejected with 413 before any parsing is attempted", oversizedRes.status);

  const unsupported = new File([new TextEncoder().encode("not a supported procurement source")], "slides.pptx", { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
  const unsupportedRes = await ingestFileRoute(makeMultipartRequest("https://example.test/api/workspace/ingest-file", unsupported));
  expect(unsupportedRes.status === 415, "[B] an unsupported extension (.pptx) is rejected with 415, not silently misread as text", unsupportedRes.status);

  const corruptPdf = new File([new Uint8Array([1, 2, 3, 4, 5])], "broken.pdf", { type: "application/pdf" });
  const corruptPdfRes = await ingestFileRoute(makeMultipartRequest("https://example.test/api/workspace/ingest-file", corruptPdf));
  const corruptPdfBody = (await corruptPdfRes.json()) as { error?: string };
  expect(corruptPdfRes.status === 422, "[B] a corrupt PDF fails cleanly with 422", corruptPdfRes.status);
  expect(corruptPdfBody.error === "That file has a .pdf name but is not a valid PDF. Try exporting it again.", "[B] a false .pdf extension is identified precisely", corruptPdfBody.error);

  const scannedPdfDoc = await PDFDocument.create();
  scannedPdfDoc.addPage([595, 842]);
  const scannedPdfBytes = await scannedPdfDoc.save();
  const scannedPdfArrayBuffer = scannedPdfBytes.buffer.slice(scannedPdfBytes.byteOffset, scannedPdfBytes.byteOffset + scannedPdfBytes.byteLength) as ArrayBuffer;
  const scannedPdf = new File([scannedPdfArrayBuffer], "scan.pdf", { type: "application/pdf" });
  const scannedPdfRes = await ingestFileRoute(makeMultipartRequest("https://example.test/api/workspace/ingest-file", scannedPdf));
  const scannedPdfBody = (await scannedPdfRes.json()) as { error?: string };
  expect(scannedPdfRes.status === 422, "[B] an image-only/textless PDF fails cleanly with 422", scannedPdfRes.status);
  expect(typeof scannedPdfBody.error === "string" && scannedPdfBody.error.includes("no selectable text") && scannedPdfBody.error.includes("scanned"), "[B] a scanned PDF gets a specific and actionable message", scannedPdfBody.error);

  const corrupt = new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], "broken.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const corruptRes = await ingestFileRoute(makeMultipartRequest("https://example.test/api/workspace/ingest-file", corrupt));
  const corruptBody = (await corruptRes.json()) as { error?: string };
  expect(corruptRes.status === 422, "[B] a corrupt .xlsx fails cleanly with 422, never a crash or a 500", corruptRes.status);
  expect(typeof corruptBody.error === "string" && corruptBody.error.length > 0, "[B] the corrupt-file failure carries an honest, readable error message", corruptBody.error);

  const noFileForm = new FormData();
  const noFileRes = await ingestFileRoute(new Request("https://example.test/api/workspace/ingest-file", { method: "POST", body: noFileForm }));
  expect(noFileRes.status === 400, "[B] a request with no file field is rejected with 400", noFileRes.status);

  console.log(`\nPart B: ${pass}/${pass + fail} passed so far.\n`);
}

async function partC() {
  console.log("=== Part C: /api/workspace/ingest-link (real route, validation-only -- see file header) ===\n");

  const badJsonRes = await ingestLinkRoute(new Request("https://example.test/api/workspace/ingest-link", { method: "POST", body: "not json", headers: { "content-type": "application/json" } }));
  expect(badJsonRes.status === 400, "[C] malformed JSON body is rejected with 400, not a crash", badJsonRes.status);

  const noLinkRes = await ingestLinkRoute(
    new Request("https://example.test/api/workspace/ingest-link", { method: "POST", body: JSON.stringify({ text: "30 sites, 4000 users, no link here" }), headers: { "content-type": "application/json" } }),
  );
  const noLinkBody = (await noLinkRes.json()) as { error?: string };
  expect(noLinkRes.status === 400, "[C] text with no Google Docs/Sheets link is rejected with 400 before any fetch is attempted", noLinkRes.status);
  expect(typeof noLinkBody.error === "string" && /Google Docs or Sheets/.test(noLinkBody.error), "[C] the rejection names what IS accepted, not just what failed", noLinkBody.error);

  const nonGoogleUrlRes = await ingestLinkRoute(
    new Request("https://example.test/api/workspace/ingest-link", { method: "POST", body: JSON.stringify({ text: "https://example.com/spreadsheets/d/fake123" }), headers: { "content-type": "application/json" } }),
  );
  expect(nonGoogleUrlRes.status === 400, "[C] a non-Google URL that merely resembles the path shape is still rejected -- proves the host check, not just a path regex", nonGoogleUrlRes.status);

  // A real Google link this sandbox cannot reach: proves the route's own
  // fetch-failure handling is real, exercised code, even though the
  // happy path can't be proven network-isolated. A thrown/unhandled
  // exception here would fail this assertion (status would be undefined
  // or the call would reject) -- so "returns 502 cleanly" is a genuine
  // check, not a tautology.
  const unreachableDocRes = await ingestLinkRoute(
    new Request("https://example.test/api/workspace/ingest-link", {
      method: "POST",
      body: JSON.stringify({ text: "https://docs.google.com/document/d/unreachable_in_sandbox_test/edit" }),
      headers: { "content-type": "application/json" },
    }),
  );
  const unreachableBody = (await unreachableDocRes.json()) as { error?: string };
  expect(unreachableDocRes.status === 502, "[C] a well-formed Google Docs link the route cannot reach fails cleanly with 502, not a crash", unreachableDocRes.status);
  expect(typeof unreachableBody.error === "string" && unreachableBody.error.length > 0, "[C] the unreachable-link failure carries an honest, readable error message", unreachableBody.error);

  console.log(`\nPart C: ${pass}/${pass + fail} passed so far.\n`);
}

(async () => {
  partA();
  await partB();
  await partC();

  console.log(`\n${pass} passed, ${fail} failed.`);
  if (fail > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(` - ${f}`);
    process.exit(1);
  } else {
    console.log("\nALL PASS");
  }
})();
