import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const EXPECTED_PROFILE_COUNT = 30;
const MANIFEST_VERSION = "provider-source-manifest/1.0.0";
const DEFAULT_ARCHIVE_ROOT = ".private/provider-source";
const DEFAULT_MANIFEST_PATH = "docs/provider-source-manifest.json";

function argument(name, fallback = undefined) {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function stableDocumentId(filename) {
  const stem = filename.replace(/\.docx$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `provider-source:${stem}`;
}

function existingIngestedAt(manifestPath, archiveSha) {
  if (!existsSync(manifestPath)) return undefined;
  try {
    const current = JSON.parse(readFileSync(manifestPath, "utf8"));
    return current.archive?.sha256 === archiveSha ? current.ingested_at : undefined;
  } catch {
    return undefined;
  }
}

const sourceArg = argument("source");
if (!sourceArg) {
  throw new Error("Usage: npm run provider:archive -- --source=/private/path/VendorMegaDataset.zip [--reviewer=name]");
}

const sourcePath = resolve(sourceArg);
const sourceBytes = readFileSync(sourcePath);
const archiveSha = sha256(sourceBytes);
const archiveRoot = resolve(argument("archive-root", DEFAULT_ARCHIVE_ROOT));
const manifestPath = resolve(argument("manifest", DEFAULT_MANIFEST_PATH));
const reviewer = argument("reviewer", "Robert Sturt / Netify");
const suppliedIngestedAt = argument("ingested-at");
const ingestedAt = suppliedIngestedAt ?? existingIngestedAt(manifestPath, archiveSha) ?? new Date().toISOString();

const entries = execFileSync("unzip", ["-Z1", sourcePath], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);
const profileEntries = entries.filter((entry) => {
  const name = basename(entry);
  return entry.toLowerCase().endsWith(".docx") && !entry.includes("__MACOSX/") && !name.startsWith("._");
});

if (profileEntries.length !== EXPECTED_PROFILE_COUNT) {
  throw new Error(`Expected ${EXPECTED_PROFILE_COUNT} substantive DOCX profiles; found ${profileEntries.length}.`);
}
if (new Set(profileEntries.map((entry) => basename(entry).toLowerCase())).size !== profileEntries.length) {
  throw new Error("Duplicate substantive profile filenames detected.");
}
if (profileEntries.some((entry) => entry.startsWith("/") || entry.split("/").includes(".."))) {
  throw new Error("Unsafe archive path detected.");
}

const version = `sha256-${archiveSha.slice(0, 16)}`;
const versionRoot = join(archiveRoot, version);
const extractedRoot = join(versionRoot, "profiles");
mkdirSync(extractedRoot, { recursive: true });
copyFileSync(sourcePath, join(versionRoot, "source.zip"));
chmodSync(join(versionRoot, "source.zip"), 0o600);

const documents = profileEntries.map((entry) => {
  const filename = basename(entry);
  const bytes = execFileSync("unzip", ["-p", sourcePath, entry], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
  if (bytes.subarray(0, 2).toString("binary") !== "PK") throw new Error(`${filename} is not a valid DOCX ZIP container.`);
  writeFileSync(join(extractedRoot, filename), bytes, { mode: 0o600 });
  return {
    source_document_id: stableDocumentId(filename),
    supplied_filename: filename,
    archive_entry: entry,
    sha256: sha256(bytes),
    bytes: bytes.length,
    source_version: version,
  };
}).sort((a, b) => a.supplied_filename.localeCompare(b.supplied_filename));

const excludedEntries = entries.filter((entry) => entry.includes("__MACOSX/") || basename(entry).startsWith("._"));
const manifest = {
  manifest_version: MANIFEST_VERSION,
  source_version: version,
  ingested_at: ingestedAt,
  reviewer,
  archive: {
    supplied_filename: basename(sourcePath),
    sha256: archiveSha,
    bytes: sourceBytes.length,
    private_relative_path: `${DEFAULT_ARCHIVE_ROOT}/${version}/source.zip`,
  },
  inventory: {
    substantive_profile_count: documents.length,
    excluded_metadata_count: excludedEntries.length,
    total_archive_entries: entries.length,
  },
  documents,
};

mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Archived ${documents.length} profiles as ${version}; excluded ${excludedEntries.length} metadata entries.`);
