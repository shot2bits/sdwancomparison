/**
 * Live Sourcing Workspace: read a Google Docs / Sheets link into plain
 * text. Robert, 20 Aug 2026: "Or should be able to read web links (eg. to
 * Google docs)." — scoped by his own follow-up choice to Google Docs and
 * Sheets only, not any public URL.
 *
 * SSRF SAFETY: the request body is treated only as text to search for a
 * link — never as a URL this route fetches directly. `parseGoogleDocLink`
 * (workspace/links.ts) is the ONLY thing that decides what gets fetched,
 * and it can only ever produce a `docs.google.com` export URL built from
 * an id it extracted with a closed character class. A client cannot pass
 * an arbitrary `exportUrl` here — there is no such field. Widening this
 * later to arbitrary URLs would need its own SSRF review; this route does
 * not attempt that.
 *
 * A link that is not publicly viewable makes Google serve an HTML sign-in
 * page at the export URL instead of the file — that is detected by
 * content-type and reported honestly, rather than "ingesting" a login
 * page's markup as if it were the buyer's content.
 */

import { corsHeaders, preflight } from "@/lib/cors";
import { parseGoogleDocLink } from "@/lib/workspace/links";
import { flattenWorkbookToText } from "@/lib/workspace/office-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8_000_000;
const MAX_TEXT_CHARS = 200_000;
const FETCH_TIMEOUT_MS = 10_000;

export async function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Send { text } with a Google Docs or Sheets link." }, { status: 400, headers: cors });
  }
  const raw =
    body && typeof body === "object" && "text" in body
      ? String((body as { text?: unknown }).text ?? "")
      : body && typeof body === "object" && "url" in body
        ? String((body as { url?: unknown }).url ?? "")
        : "";

  const link = parseGoogleDocLink(raw);
  if (!link) {
    return Response.json(
      { error: "That doesn't look like a Google Docs or Sheets link (docs.google.com/document/... or /spreadsheets/...)." },
      { status: 400, headers: cors },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const shareError =
    link.kind === "doc"
      ? "Netify can't open that document — share it as “Anyone with the link can view” and try again."
      : "Netify can't open that spreadsheet — share it as “Anyone with the link can view” and try again.";

  let res: Response;
  try {
    res = await fetch(link.exportUrl, { redirect: "follow", signal: controller.signal });
  } catch {
    return Response.json({ error: "Could not reach that document — check the link and try again." }, { status: 502, headers: cors });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const message = res.status === 401 || res.status === 403 ? shareError : "Could not read that document (Google returned an error).";
    return Response.json({ error: message }, { status: 502, headers: cors });
  }

  const contentType = res.headers.get("content-type") ?? "";
  // Google serves a login/HTML interstitial at the export URL, not an
  // error status, when the document isn't link-shared. Content-type is
  // the only reliable signal that happened instead of a real export.
  if (contentType.includes("text/html")) {
    return Response.json({ error: shareError }, { status: 502, headers: cors });
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    return Response.json({ error: "That file is too large to read here (8MB limit)." }, { status: 413, headers: cors });
  }

  if (link.kind === "doc") {
    const text = buf.toString("utf8").slice(0, MAX_TEXT_CHARS);
    if (!text.trim()) {
      return Response.json({ error: "That document looks empty." }, { status: 422, headers: cors });
    }
    return Response.json({ text, kind: "doc" }, { headers: cors });
  }

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
    return Response.json({ text, kind: "sheet" }, { headers: cors });
  } catch {
    return Response.json({ error: "Could not read that spreadsheet's contents." }, { status: 422, headers: cors });
  }
}
