/**
 * Fold approved wiki edits into the vendor records, before the build.
 *
 * Approval writes to a KV overlay rather than to a file, because a serverless
 * function cannot commit to git. This script is the other half: it runs ahead
 * of the validate chain, folds any approved values into data/vendors/*.json,
 * and leaves the result for the normal build to consume.
 *
 * Three properties matter and are deliberate:
 *   * Pages stay static. Nothing queries a database at request time, so a KV
 *     outage cannot take down the pages an engine is trying to cite.
 *   * The record stays a file, so git remains the audit trail. Every approved
 *     edit shows up in a diff with the source and the approver on it.
 *   * The overlay is NOT cleared here. A build can be rerun, and a failed
 *     deploy must not silently lose an approved correction. It is cleared only
 *     once the edit is committed back to the repository.
 *
 * No KV configured, or nothing approved, is a normal no-op: the build proceeds
 * untouched. This must never be the reason a deploy fails.
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "data", "vendors");
const URL_ENV = process.env.KV_REST_API_URL;
const TOKEN_ENV = process.env.KV_REST_API_TOKEN;

type OverlayEntry = {
  value: string;
  source_url: string | null;
  quote: string | null;
  approved_at: string;
  approved_by: string;
};
type Overlay = Record<string, Record<string, OverlayEntry>>;

async function readOverlay(): Promise<Overlay | null> {
  if (!URL_ENV || !TOKEN_ENV) return null;
  try {
    const res = await fetch(URL_ENV, {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN_ENV}`, "content-type": "application/json" },
      body: JSON.stringify(["GET", "vendoredit:overlay"]),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: string | null };
    return data.result ? (JSON.parse(data.result) as Overlay) : null;
  } catch {
    return null;
  }
}

/** Set a value at "group.key" or "field", coercing to the record's own type. */
function setField(rec: Record<string, unknown>, field: string, raw: string): boolean {
  const parts = field.split(".");
  if (parts.length === 2) {
    const group = rec[parts[0]] as Record<string, unknown> | undefined;
    if (!group || !(parts[1] in group)) return false;
    group[parts[1]] = raw;
    return true;
  }
  if (!(field in rec)) return false;
  const current = rec[field];
  if (typeof current === "number") {
    const n = Number(String(raw).replace(/[^\d.]/g, ""));
    if (!Number.isFinite(n)) return false;
    rec[field] = field === "pop_count" ? Math.round(n) : n;
    return true;
  }
  if (Array.isArray(current)) {
    rec[field] = raw.split("\n").map((s) => s.trim()).filter(Boolean);
    return true;
  }
  rec[field] = raw;
  return true;
}

async function main() {
  const overlay = await readOverlay();
  if (!overlay || Object.keys(overlay).length === 0) {
    console.log("apply-vendor-overrides: nothing approved to apply.");
    return;
  }

  let files = 0;
  let applied = 0;
  const skipped: string[] = [];

  for (const [slug, fields] of Object.entries(overlay)) {
    const path = join(DIR, `${slug}.json`);
    let rec: Record<string, unknown>;
    try {
      rec = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    } catch {
      skipped.push(`${slug}: no such record`);
      continue;
    }
    let touched = false;
    for (const [field, entry] of Object.entries(fields)) {
      if (!setField(rec, field, entry.value)) {
        skipped.push(`${slug}.${field}: field not present on the record`);
        continue;
      }
      // Provenance rides with the value, so an approved edit is as traceable
      // as anything the research pass produced.
      const facts = (rec.sourced_facts ??= {}) as Record<string, unknown>;
      facts[field] = {
        value: entry.value,
        evidence: [],
        confidence: "medium",
        quote: entry.quote ?? "",
        claimed_by: "vendor",
        note: `Supplied through the supplier record wiki and approved by ${entry.approved_by} on ${entry.approved_at.slice(0, 10)}.${entry.source_url ? ` Source: ${entry.source_url}` : ""}`,
      };
      applied += 1;
      touched = true;
    }
    if (touched) {
      writeFileSync(path, `${JSON.stringify(rec, null, 2)}\n`);
      files += 1;
    }
  }

  console.log(`apply-vendor-overrides: applied ${applied} approved edits across ${files} records.`);
  for (const s of skipped) console.log(`  skipped ${s}`);
  console.log("  overlay retained: it is cleared when the edits are committed back to the repository.");
}

main().catch((e) => {
  // Never fail a deploy over this. A missed overlay is applied next build.
  console.log(`apply-vendor-overrides: skipped (${e instanceof Error ? e.message : String(e)}).`);
});
