#!/usr/bin/env node
// One-way importer: Netify research + pricing workbooks (.xlsx) -> data/research/workbook-research.json
// Usage: node scripts/import-research-workbooks.mjs --research=/path/A.xlsx --pricing=/path/B.xlsx [--out=data/research/workbook-research.json]
// The workbooks themselves are never committed (they hold test contacts and
// internal notes); only the filtered public dataset is.
import ExcelJS from "exceljs";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { buildResearchDataset, text } from "./lib/research-import.mjs";

const arg = (name, fallback) => process.argv.slice(2).find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const HEADER_ROW = 8;

// Streaming reader: the full-model reader trips over the workbooks' Excel
// tables, and only cell values are needed here.
// Sheet names are only known once workbook.xml has been read, which can come
// after the sheets in the archive, so rows are collected per sheet id first.
async function readWorkbook(path, sheets) {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(path, { sharedStrings: "cache", worksheets: "emit", hyperlinks: "ignore", styles: "cache", entries: "emit" });
  const byId = new Map();
  for await (const ws of reader) {
    let headers = null;
    const rows = [];
    for await (const row of ws) {
      const values = row.values;
      if (row.number === HEADER_ROW) { headers = values.map((v) => text(v)); continue; }
      if (row.number < HEADER_ROW || !headers) continue;
      const obj = {};
      let any = false;
      values.forEach((v, col) => {
        const val = v && typeof v === "object" && "formula" in v ? v.result : v;
        if (val !== null && val !== undefined && val !== "" && headers[col]) { obj[headers[col]] = val; any = true; }
      });
      if (any) rows.push(obj);
    }
    byId.set(String(ws.id), rows);
  }
  const out = {};
  for (const sheet of reader.model?.sheets ?? []) if (sheets.includes(sheet.name)) out[sheet.name] = byId.get(String(sheet.id)) ?? [];
  for (const name of sheets) if (!out[name]) throw new Error(`Sheet "${name}" missing in ${path}`);
  return out;
}

const research = arg("research");
const pricing = arg("pricing");
const outPath = arg("out", "data/research/workbook-research.json");
if (!research || !pricing) throw new Error("Usage: node scripts/import-research-workbooks.mjs --research=A.xlsx --pricing=B.xlsx [--out=...]");

const a = await readWorkbook(research, ["Providers", "Findings", "Product scopes", "Site delivery", "Cases", "Sources"]);
const b = await readWorkbook(pricing, ["Offers", "Price lines", "Price rules", "Sources"]);
const dataset = buildResearchDataset({ a, b }, { generatedAt: new Date().toISOString().slice(0, 10) });
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(dataset, null, 1) + "\n");
// Small roles map for code that must not pull the full dataset into a bundle.
writeFileSync(`${dirname(outPath)}/provider-roles.json`, JSON.stringify({ dataset_version: dataset.dataset_version, roles: Object.fromEntries(dataset.providers.map((p) => [p.slug, p.roles])) }, null, 1) + "\n");
console.log(dataset.dataset_version, JSON.stringify(dataset.counts));
