import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { VendorSchema } from "../data/schema";

const vendorsDir = resolve(process.cwd(), "data", "vendors");

const files = readdirSync(vendorsDir)
  .filter((f) => f.endsWith(".json"))
  .sort();

if (files.length === 0) {
  console.error(`No vendor JSON files found in ${vendorsDir}`);
  process.exit(1);
}

let failed = 0;

for (const file of files) {
  const fullPath = join(vendorsDir, file);
  const raw = readFileSync(fullPath, "utf8");

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    failed++;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`✗ ${file}: invalid JSON — ${message}`);
    continue;
  }

  const result = VendorSchema.safeParse(data);
  if (!result.success) {
    failed++;
    console.error(`✗ ${file}: ${result.error.issues.length} issue(s)`);
    for (const issue of result.error.issues) {
      const fieldPath = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      console.error(`  - ${fieldPath}: ${issue.message}`);
    }
  }
}

if (failed > 0) {
  console.error(
    `\n${failed} of ${files.length} vendor file(s) failed validation`,
  );
  process.exit(1);
}

console.log(`✓ ${files.length} vendor records validated`);
