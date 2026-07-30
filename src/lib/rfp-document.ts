/**
 * RFP document assembly: turns a ProjectDetails draft into the full,
 * procurement-ready document — cover, buyer profile, sections with evidence
 * and weighting, evidence checklist, scoring matrix, submission instructions
 * and the citations/assumptions appendix. Pure functions, shared by the
 * server-rendered preview page and the gated markdown download.
 */

import type { ProjectDetails, RfpSection } from "@/lib/rfp-types";
import { BANK_VERSION, SASE_EXTENDED_BANK } from "@/lib/rfp-question-bank";
import { SECTORS, REGIONS, COMPLIANCE_OPTIONS, labelFor, labelsFor } from "@/lib/notice-options";

/* Buyer-English casing, once at the source (Harry, 24 July 2026: the
   generated document read "Sector: retail ecommerce" and "Regions:
   europe, uk ireland", lowercase in a formal document a supplier
   receives). notice-options is the one label catalogue; these helpers
   speak through it and fall back gracefully for any key it has never
   heard of. Guarded by scripts/validate-labels.ts so it cannot regress. */
export function sectorLabel(key: string): string {
  const l = labelFor(SECTORS, key);
  return l === key ? key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : l;
}
export function regionLabelList(keys: string[]): string {
  return labelsFor(REGIONS, keys).map((l, i) => (l === keys[i] ? l.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : l)).join(", ");
}
export function complianceLabelList(keys: string[]): string {
  return keys.map((k) => { const l = labelFor(COMPLIANCE_OPTIONS, k); return l === k ? k.replace(/_/g, " ").toUpperCase() : l; }).join(", ");
}

export type SectionStats = {
  category: string;
  questionCount: number;
  mandatoryCount: number;
  /** Questions with priority "required" (weighting emphasis). Distinct from
   *  mandatory, which is a pass/fail gate; Harry's QA F3 showed the table
   *  reading "Mandatory 0" beside inline "required" labels with nothing
   *  explaining that these are two different things. */
  requiredCount: number;
  totalWeight: number;
  weightShare: number; // 0..1 of the whole RFP
};

const SCOPE_LABELS: Record<string, string> = {
  not_stated: "Not stated by the buyer",
  full_sase: "Full SASE (no vendor-approach preference)",
  single_vendor_sase: "SASE, unified single vendor",
  best_of_breed: "SASE, best-of-breed",
  sse_only: "SSE (security service edge)",
  sdwan_only: "SD-WAN",
};

const MODEL_LABELS: Record<string, string> = {
  any: "No preference",
  managed: "Fully managed",
  co_managed: "Co-managed",
  diy: "Self-managed",
};

export function includedSections(p: ProjectDetails): RfpSection[] {
  // The document carries the ACTIVE question set: the same rule as the
  // builder's count chip (included sections, questions not marked optional).
  // The synthesised bank seeds every RFP with an invisible priority-optional
  // pool for the browser UI; exporting it made the downloaded document say
  // 40 questions while the builder said 12 (Harry's retest, 15 July 2026).
  return p.rfp_sections
    .map((s) => ({ ...s, questions: s.questions.filter((q) => q.priority !== "optional") }))
    .filter((s) => s.included && s.questions.length > 0);
}

/**
 * An information item: buyer/engine-authored content that travels WITH the
 * document but asks nothing of suppliers (scope statements, exclusions with
 * reasons, the against-interest record, provenance). Distinct by source from
 * the invisible priority-optional bank pool above: custom + optional is
 * authored content; bank/methodology + optional is browser stock and stays
 * out of documents. Information items are never counted, weighted or scored
 * (includedSections, sectionStats and rfp-evaluation all exclude optional).
 */
export function isInformationItem(q: { priority: string; source: string }): boolean {
  return q.priority === "optional" && q.source === "custom";
}

/** The RENDERED document: the active question set plus information items.
 *  Used by preview and downloads; counters and scoring keep includedSections. */
export function documentSections(p: ProjectDetails): RfpSection[] {
  return p.rfp_sections
    .map((s) => ({ ...s, questions: s.questions.filter((q) => q.priority !== "optional" || isInformationItem(q)) }))
    .filter((s) => s.included && s.questions.length > 0);
}

export function sectionStats(p: ProjectDetails): SectionStats[] {
  const sections = includedSections(p);
  const grand = sections.reduce((n, s) => n + s.questions.reduce((m, q) => m + q.weight, 0), 0) || 1;
  return sections.map((s) => {
    const totalWeight = s.questions.reduce((m, q) => m + q.weight, 0);
    return {
      category: s.category,
      questionCount: s.questions.length,
      mandatoryCount: s.questions.filter((q) => q.mandatory).length,
      requiredCount: s.questions.filter((q) => q.priority === "required").length,
      totalWeight,
      weightShare: totalWeight / grand,
    };
  });
}

/** Aggregated, de-duplicated evidence checklist across every included question. */
export function evidenceChecklist(p: ProjectDetails): { item: string; questionIds: string[] }[] {
  const map = new Map<string, string[]>();
  for (const s of includedSections(p)) {
    for (const q of s.questions) {
      for (const raw of q.evidence_requested.split(";")) {
        const item = raw.trim();
        if (!item) continue;
        const key = item.toLowerCase();
        const existing = map.get(key);
        if (existing) existing.push(q.id);
        else map.set(key, [q.id]);
      }
    }
  }
  const pretty = new Map<string, string>();
  for (const s of includedSections(p)) {
    for (const q of s.questions) {
      for (const raw of q.evidence_requested.split(";")) {
        const item = raw.trim();
        if (item && !pretty.has(item.toLowerCase())) pretty.set(item.toLowerCase(), item);
      }
    }
  }
  return [...map.entries()]
    .map(([key, ids]) => ({ item: pretty.get(key) ?? key, questionIds: ids }))
    .sort((a, b) => b.questionIds.length - a.questionIds.length);
}

export function scopeLabel(p: ProjectDetails): string {
  return SCOPE_LABELS[p.buyer.product_scope] ?? p.buyer.product_scope;
}

export function modelLabel(p: ProjectDetails): string {
  return MODEL_LABELS[p.buyer.operating_model] ?? p.buyer.operating_model;
}

/**
 * A synthesised buyer-profile sentence for the background section, so the
 * document always reflects the stated sector, estate and obligations even
 * when the buyer wrote no free-text notes (Harry's testing feedback,
 * 03/07/2026: "the generated RFP doesn't mention my sector").
 */
export function buyerProfileSentence(p: ProjectDetails): string {
  const b = p.buyer;
  const bits: string[] = [];
  const sector = b.sector ? sectorLabel(b.sector) : "";
  bits.push(sector ? `The buyer is a ${sector} organisation` : "The buyer is an organisation");
  if (b.site_count != null) bits.push(`operating ${b.site_count} site${b.site_count === 1 ? "" : "s"}`);
  if (b.regions.length) bits.push(`across ${regionLabelList(b.regions)}`);
  let s = bits.join(" ") + ".";
  s += ` The requirement covers ${scopeLabel(p)}, delivered as ${modelLabel(p).toLowerCase()}.`;
  if (b.compliance.length) s += ` Responses must address the buyer's stated obligations: ${complianceLabelList(b.compliance)}.`;
  if (sector) s += ` Vendors should tailor answers, references and evidence to the ${sector} sector.`;
  return s;
}

/** The full RFP as markdown — used by the gated download. */
export function buildRfpMarkdown(p: ProjectDetails): string {
  const sections = documentSections(p);
  const stats = sectionStats(p);
  const evidence = evidenceChecklist(p);
  const generated = new Date().toISOString().slice(0, 10);
  const L: string[] = [];

  // Cover
  L.push(`# ${p.title}`, "");
  L.push(`Request for Proposal · Generated ${generated} via the Netify RFP Builder`, "");
  L.push(`| Field | Value |`, `| --- | --- |`);
  L.push(`| Scope | ${scopeLabel(p)} |`);
  L.push(`| Delivery model | ${modelLabel(p)} |`);
  if (p.buyer.sector) L.push(`| Sector | ${sectorLabel(p.buyer.sector)} |`);
  if (p.buyer.site_count != null) L.push(`| Sites | ${p.buyer.site_count} |`);
  if (p.buyer.regions.length) L.push(`| Regions | ${regionLabelList(p.buyer.regions)} |`);
  if (p.buyer.compliance.length) L.push(`| Compliance | ${complianceLabelList(p.buyer.compliance)} |`);
  L.push(`| Methodology | Netify SASE Methodology v${p.methodology_version} |`);
  L.push(`| Question bank | Netify question bank v${BANK_VERSION} / ${SASE_EXTENDED_BANK.question_bank_version} |`, "");

  // Background: always present — the synthesised buyer profile keeps the
  // sector/estate context in the document even without free-text notes.
  L.push(`## Project background`, "", buyerProfileSentence(p), "");
  if (p.buyer.notes.trim()) {
    L.push(p.buyer.notes.trim(), "");
  }

  // Sections. Information items (custom + optional: scope statements,
  // exclusions, the against-interest record, provenance) render first,
  // unnumbered and without scoring furniture; they ask nothing of suppliers.
  for (const s of sections) {
    L.push(`## ${s.category}`, "");
    const info = s.questions.filter((q) => isInformationItem(q));
    const ask = s.questions.filter((q) => !isInformationItem(q));
    for (const q of info) {
      L.push(`> For information (no response required): ${q.text}`);
      if (q.rationale) L.push(`> Why this is recorded: ${q.rationale}`);
      L.push("");
    }
    ask.forEach((q, i) => {
      L.push(`${i + 1}. ${q.mandatory ? "**[MANDATORY]** " : ""}${q.text}`);
      if (q.evidence_requested) L.push(`   - Evidence required: ${q.evidence_requested}`);
      if (q.rationale) L.push(`   - Why this matters: ${q.rationale}`);
      L.push(`   - Weighting: ${q.weight}/5${q.priority === "required" ? " (required)" : ""}`);
      L.push("");
    });
  }

  // Evidence checklist
  if (evidence.length) {
    L.push(`## Evidence checklist`, "", `Vendors should return the following artefacts with their response:`, "");
    for (const e of evidence) L.push(`- [ ] ${e.item} (${e.questionIds.length} ${e.questionIds.length === 1 ? "question" : "questions"})`);
    L.push("");
  }

  // Scoring
  L.push(`## Scoring approach`, "");
  L.push(`Responses are scored per question (1–5) multiplied by the question weighting. Questions marked required carry the highest weighting but are still scored. Mandatory questions are a separate, stricter class: pass/fail gates, marked [MANDATORY] inline, where a fail excludes the response regardless of score. A section can therefore show required questions while containing no mandatory gates. Section weighting below reflects the sum of question weights.`, "");
  L.push(`| Section | Questions | Required | Mandatory (pass/fail) | Weight share |`, `| --- | --- | --- | --- | --- |`);
  for (const st of stats) L.push(`| ${st.category} | ${st.questionCount} | ${st.requiredCount} | ${st.mandatoryCount} | ${(st.weightShare * 100).toFixed(0)}% |`);
  L.push("");

  // Submission
  L.push(`## Submission instructions`, "");
  L.push(`- Respond through the Netify marketplace response link provided with this RFP (structured answers per question, evidence uploads, private pricing).`);
  L.push(`- Answer every question; mark any exception explicitly rather than omitting it.`);
  L.push(`- Pricing submitted through the marketplace stays private to the buyer.`);
  if (p.nda.required) L.push(`- An NDA must be accepted before the full requirement detail and response form unlock.`);
  L.push("");

  // Appendix
  L.push(`## Appendix: provenance and review`, "");
  L.push(`- Question sources: Netify question bank v${BANK_VERSION} and the extended SASE canonical bank (${SASE_EXTENDED_BANK.question_bank_version}), plus buyer-specific questions generated from the context above. Question rationale lines carry per-question provenance.`);
  L.push(`- Buyer inputs: scope, sector, estate profile, compliance and notes as recorded in the project background.`);
  L.push(`- Canonical methodology: https://netify.co.uk/methodology/ · Question bank: https://netify.co.uk/sase/rfp-builder/questions/`);
  L.push(`- **Human review required.** This document was assembled with AI assistance. Review every question, weighting and mandatory flag against your actual requirement before issuing it.`);
  L.push("");

  return L.join("\n");
}

/**
 * The full RFP as a self-contained HTML document. Two consumers:
 *  - the Word download (.doc): Word opens styled HTML natively, so the buyer
 *    gets a formatted document with zero new dependencies;
 *  - the print view: the same HTML plus an auto-open print dialogue, which is
 *    the browser-native "save as PDF" path.
 * Content mirrors buildRfpMarkdown exactly; only the container differs.
 */
export function buildRfpHtml(p: ProjectDetails, opts?: { watermark?: string; autoPrint?: boolean }): string {
  const sections = documentSections(p);
  const stats = sectionStats(p);
  const evidence = evidenceChecklist(p);
  const generated = new Date().toISOString().slice(0, 10);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const coverRows: [string, string][] = [
    ["Scope", scopeLabel(p)],
    ["Delivery model", modelLabel(p)],
  ];
  if (p.buyer.sector) coverRows.push(["Sector", sectorLabel(p.buyer.sector)]);
  if (p.buyer.site_count != null) coverRows.push(["Sites", String(p.buyer.site_count)]);
  if (p.buyer.regions.length) coverRows.push(["Regions", regionLabelList(p.buyer.regions)]);
  if (p.buyer.compliance.length) coverRows.push(["Compliance", complianceLabelList(p.buyer.compliance)]);
  coverRows.push(["Methodology", `Netify SASE Methodology v${p.methodology_version}`]);
  coverRows.push(["Question bank", `Netify question bank v${BANK_VERSION} / ${SASE_EXTENDED_BANK.question_bank_version}`]);

  const B: string[] = [];
  if (opts?.watermark) B.push(`<p class="watermark">${esc(opts.watermark)}</p>`);
  B.push(`<h1>${esc(p.title)}</h1>`);
  B.push(`<p class="meta">Request for Proposal · Generated ${generated} via the Netify RFP Builder (netify.co.uk/sase/rfp-builder/)</p>`);
  B.push(`<table>${coverRows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>`);

  B.push(`<h2>Project background</h2><p>${esc(buyerProfileSentence(p))}</p>`);
  if (p.buyer.notes.trim()) B.push(`<p>${esc(p.buyer.notes.trim())}</p>`);

  for (const s of sections) {
    B.push(`<h2>${esc(s.category)}</h2>`);
    const info = s.questions.filter((q) => isInformationItem(q));
    const ask = s.questions.filter((q) => !isInformationItem(q));
    for (const q of info) {
      B.push(`<blockquote><p><em>For information (no response required):</em> ${esc(q.text)}</p>${q.rationale ? `<p><em>Why this is recorded:</em> ${esc(q.rationale)}</p>` : ""}</blockquote>`);
    }
    if (ask.length) {
      B.push(`<ol>`);
      for (const q of ask) {
        B.push(`<li><p>${q.mandatory ? `<strong>[MANDATORY]</strong> ` : ""}${esc(q.text)}</p><ul>`);
        if (q.evidence_requested) B.push(`<li>Evidence required: ${esc(q.evidence_requested)}</li>`);
        if (q.rationale) B.push(`<li>Why this matters: ${esc(q.rationale)}</li>`);
        B.push(`<li>Weighting: ${q.weight}/5${q.priority === "required" ? " (required)" : ""}</li></ul></li>`);
      }
      B.push(`</ol>`);
    }
  }

  if (evidence.length) {
    B.push(`<h2>Evidence checklist</h2><p>Vendors should return the following artefacts with their response:</p><ul>`);
    for (const e of evidence) B.push(`<li>☐ ${esc(e.item)} (${e.questionIds.length} ${e.questionIds.length === 1 ? "question" : "questions"})</li>`);
    B.push(`</ul>`);
  }

  B.push(`<h2>Scoring approach</h2><p>Responses are scored per question (1–5) multiplied by the question weighting. Questions marked required carry the highest weighting but are still scored. Mandatory questions are a separate, stricter class: pass/fail gates, marked [MANDATORY] inline, where a fail excludes the response regardless of score. A section can therefore show required questions while containing no mandatory gates. Section weighting below reflects the sum of question weights.</p>`);
  B.push(`<table><tr><th>Section</th><th>Questions</th><th>Required</th><th>Mandatory (pass/fail)</th><th>Weight share</th></tr>${stats.map((st) => `<tr><td>${esc(st.category)}</td><td>${st.questionCount}</td><td>${st.requiredCount}</td><td>${st.mandatoryCount}</td><td>${(st.weightShare * 100).toFixed(0)}%</td></tr>`).join("")}</table>`);

  B.push(`<h2>Submission instructions</h2><ul>`);
  B.push(`<li>Respond through the Netify marketplace response link provided with this RFP (structured answers per question, evidence uploads, private pricing).</li>`);
  B.push(`<li>Answer every question; mark any exception explicitly rather than omitting it.</li>`);
  B.push(`<li>Pricing submitted through the marketplace stays private to the buyer.</li>`);
  if (p.nda.required) B.push(`<li>An NDA must be accepted before the full requirement detail and response form unlock.</li>`);
  B.push(`</ul>`);

  B.push(`<h2>Appendix: provenance and review</h2><ul>`);
  B.push(`<li>Question sources: Netify question bank v${BANK_VERSION} and the extended SASE canonical bank (${SASE_EXTENDED_BANK.question_bank_version}), plus buyer-specific questions generated from the context above.</li>`);
  B.push(`<li>Buyer inputs: scope, sector, estate profile, compliance and notes as recorded in the project background.</li>`);
  B.push(`<li>Canonical methodology: https://netify.co.uk/methodology/ · Question bank: https://netify.co.uk/sase/rfp-builder/questions/</li>`);
  B.push(`<li><strong>Human review required.</strong> This document was assembled with AI assistance. Review every question, weighting and mandatory flag against your actual requirement before issuing it.</li>`);
  B.push(`</ul>`);

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${esc(p.title)}</title><style>
  body{font-family:Calibri,Arial,sans-serif;color:#1a1a1a;max-width:800px;margin:2em auto;padding:0 1.5em;line-height:1.5}
  h1{font-size:22pt;margin-bottom:4pt}h2{font-size:14pt;margin-top:18pt;border-bottom:1px solid #d4af37;padding-bottom:3pt}
  .meta{color:#555;font-size:10pt}.watermark{color:#b00;font-weight:bold;letter-spacing:2px;font-size:10pt}
  table{border-collapse:collapse;margin:10pt 0;width:100%}th,td{border:1px solid #ccc;padding:5pt 8pt;text-align:left;font-size:10.5pt}th{background:#f5f1e6}
  ol>li{margin-bottom:8pt}ul{font-size:10.5pt}p{font-size:11pt}
  @media print{body{margin:0.5em auto}}
  </style></head><body>${B.join("")}${opts?.autoPrint ? `<script>window.print()</script>` : ""}</body></html>`;
}
