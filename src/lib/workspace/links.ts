/**
 * Google Docs / Sheets link recognition (Robert, 20 Aug 2026: "It would
 * support Word, Excel or text. Or should be able to read web links (eg. to
 * Google docs)."), scoped by his own follow-up choice to Google Docs and
 * Sheets only — not "any public URL".
 *
 * That scoping is not just a product choice, it is what keeps this feature
 * SSRF-safe by construction: the two API routes that use this module
 * (ingest-link, and nothing else) never fetch a URL a buyer handed them
 * directly. They fetch ONLY `exportUrl`, a fixed `docs.google.com` export
 * endpoint this module itself builds from an id this module itself
 * extracted with a closed character class (`[a-zA-Z0-9_-]+`) — so there is
 * no path by which a buyer's pasted text can make the server fetch an
 * internal address, a redirect chain, or any host other than Google's own
 * export endpoint. Widening this to "any public URL" later would need a
 * real SSRF review (private-range blocking, redirect pinning); this module
 * deliberately does not attempt that.
 *
 * PURE: no fetch, no React, like every other projection in workspace/*
 * (Article 17). The route that calls this does the I/O; this module only
 * recognises a link and computes where to read it from.
 */

export type GoogleDocLink = {
  kind: "doc" | "sheet";
  id: string;
  /** The canonical viewer URL for the id — for display, never fetched. */
  url: string;
  /** The one URL the server is allowed to fetch for this link. */
  exportUrl: string;
};

const DOC_RE = /https?:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/;
const SHEET_RE = /https?:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/;

/**
 * Scans arbitrary text (a typed chat line, a pasted block) for the first
 * Google Docs or Sheets link and returns what's needed to read it. Returns
 * null for anything else — including a bare `docs.google.com` mention with
 * no id, a Drive folder link, a Forms link, or any non-Google URL. No
 * partial credit: a link this can't confidently id-extract is not one this
 * module will hand a fetch target for.
 */
export function parseGoogleDocLink(text: string): GoogleDocLink | null {
  const raw = String(text ?? "");
  const doc = raw.match(DOC_RE);
  if (doc?.[1]) {
    const id = doc[1];
    return {
      kind: "doc",
      id,
      url: `https://docs.google.com/document/d/${id}/`,
      exportUrl: `https://docs.google.com/document/d/${id}/export?format=txt`,
    };
  }
  const sheet = raw.match(SHEET_RE);
  if (sheet?.[1]) {
    const id = sheet[1];
    return {
      kind: "sheet",
      id,
      url: `https://docs.google.com/spreadsheets/d/${id}/`,
      exportUrl: `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`,
    };
  }
  return null;
}
