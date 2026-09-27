import type { LivingProcurementDocument } from "./workspace/procurement-document";
import type { BriefFields } from "./buying-workspace-project";
import { REGION_LABELS, SECTOR_LABELS } from "./shortlist-core";

export const PRIVATE_DRAFT_NOTICE = "PRIVATE WORKING DRAFT — not published or sent to suppliers. Incomplete answers and open decisions remain for review. This is not a supplier proposal or a validated final RFP.";
export function privateDraftMarkdown(doc: LivingProcurementDocument): string {
  const lines = [`# ${doc.title}`, "", PRIVATE_DRAFT_NOTICE, "", doc.summary, "", "## Requirements"];
  for (const clause of doc.clauses) {
    lines.push(`### ${clause.id}`, clause.statement);
    if (clause.evidence.length) lines.push(`Evidence requested: ${clause.evidence.join("; ")}`);
    if (clause.reason) lines.push(`Reason: ${clause.reason}`);
    lines.push("");
  }
  for (const group of doc.responseGroups) {
    lines.push(`## ${group.title}`);
    for (const q of group.questions) {
      lines.push(`- ${q.text}`);
      if (q.evidenceRequested.length) lines.push(`  Evidence requested: ${q.evidenceRequested.join("; ")}`);
    }
    lines.push("");
  }
  lines.push("## Open decisions", ...doc.openDecisions.map(d => `- ${d.question}${d.conflictReason ? ` — ${d.conflictReason}` : ""}`));
  if (!doc.openDecisions.length) lines.push("Review all requirements with your team before issuing this draft.");
  return lines.join("\n");
}
export function briefDraftMarkdown(fields: BriefFields): string {
  return [`# Private project brief`, "", PRIVATE_DRAFT_NOTICE, "", `Solution: ${fields.scope.toUpperCase()}`, `Sector: ${SECTOR_LABELS[fields.sector as keyof typeof SECTOR_LABELS] ?? fields.sector}`, `Sites: ${fields.sites}`, `Regions: ${fields.regions.map(r => REGION_LABELS[r as keyof typeof REGION_LABELS] ?? r).join(", ")}`, `Timescale: ${fields.timescale}`, `Operating model: ${fields.operatingModel === "any" ? "Not decided" : fields.operatingModel}`, "", "## Requirements", fields.outcome].join("\n");
}
export function printableDraftHtml(title: string, markdown: string): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]!));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)} — private draft</title><style>body{font:12pt/1.5 system-ui,sans-serif;max-width:800px;margin:32px auto;padding:0 20px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}@media print{body{margin:0}button{display:none}}</style></head><body><p>Private working draft. Use your browser’s Print command to save as PDF.</p><pre>${esc(markdown)}</pre></body></html>`;
}
