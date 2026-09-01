import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const source = process.env.PROVIDER_DATASET_SOURCE;
if (!source) throw new Error("Set PROVIDER_DATASET_SOURCE to the private VendorMegaDataset ZIP.");

const temp = mkdtempSync(join(tmpdir(), "provider-archive-test-"));
try {
  const manifestPath = join(temp, "manifest.json");
  const archiveRoot = join(temp, "private");
  const args = [
    "scripts/archive-provider-dataset.mjs",
    `--source=${source}`,
    `--archive-root=${archiveRoot}`,
    `--manifest=${manifestPath}`,
    "--ingested-at=2026-09-01T00:00:00.000Z",
  ];
  execFileSync(process.execPath, args, { stdio: "pipe" });
  const first = readFileSync(manifestPath, "utf8");
  execFileSync(process.execPath, args, { stdio: "pipe" });
  const second = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(second);
  assert.equal(first, second, "rerunning the archive must produce the same manifest");
  assert.equal(manifest.inventory.substantive_profile_count, 30);
  assert.equal(manifest.inventory.excluded_metadata_count, 30);
  assert.equal(manifest.documents.length, 30);
  assert.equal(new Set(manifest.documents.map((row) => row.source_document_id)).size, 30);
  assert.equal(manifest.documents.every((row) => !row.archive_entry.includes("__MACOSX")), true);
  console.log("PASS  provider archive is private, repeatable, complete and metadata-free");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
