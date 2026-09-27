"use client";
import { useState } from "react";
import { printableDraftHtml } from "@/lib/private-draft";
import { track } from "@/lib/analytics";

export default function PrivateDraftDownload({ title, markdown, enabled }: { title: string; markdown: string; enabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function downloadWord() {
    if (busy || !enabled) return;
    setBusy(true); setError("");
    try {
      const { renderRfpDocxBlob } = await import("@/lib/rfp-export-docx");
      const blob = await renderRfpDocxBlob(markdown, `${title} — private draft`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "netify-private-draft.docx";
      document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      track("private_draft_download", { format: "docx" });
    } catch { setError("The draft could not be downloaded. Your work is still here. Try again or use Print / save as PDF."); }
    finally { setBusy(false); }
  }
  function printDraft() {
    setError("");
    const win = window.open("", "_blank");
    if (!win) { setError("Allow a new tab to open, then try Print / save as PDF again."); return; }
    win.opener = null;
    win.document.open(); win.document.write(printableDraftHtml(title, markdown)); win.document.close();
    win.focus(); win.print();
    track("private_draft_download", { format: "print" });
  }
  return <details className="nf-private-draft" aria-label="Private draft downloads"><summary>Save for internal review</summary><div className="nf-private-draft-content">
    <strong>Keep a private copy</strong>
    <p>Download your working draft for internal review. No account or publication required. Nothing is sent to suppliers.</p>
    <div><button type="button" disabled={!enabled || busy} onClick={downloadWord}>{busy ? "Preparing Word draft…" : "Download private Word draft"}</button><button type="button" disabled={!enabled || busy} onClick={printDraft}>Print / save as PDF</button></div>
    {!enabled && <small>Add your first requirement to create a draft.</small>}
    {error && <p role="alert">{error}</p>}
  </div></details>;
}
