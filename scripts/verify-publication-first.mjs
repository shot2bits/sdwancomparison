import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const checks = [
 'npx tsc --noEmit --incremental false',
 'npm run lint',
 'npm run test:marketplace-foundation',
 'npm run test:provider-comparison-ui',
 'npm run test:shortlist-geo',
 'npm run test:shortlist-market-views',
 'npm run test:live-shortlist',
 'npm run test:rfp-neon-integration',
 'npx tsx scripts/test-publication-first-project.ts',
 'npx tsx scripts/test-short-project-publication.ts',
 'npx tsx scripts/test-public-matching-boundary.ts',
 ...pkg.scripts.validate.split(' && ').filter((s) => !s.includes('apply-vendor-overrides')).map((s) => `npx ${s}`),
];
mkdirSync('/tmp/netify-regression', { recursive: true });
const results = [];
for (const [index, command] of checks.entries()) {
 const start = Date.now();
 const result = spawnSync(command, { shell: true, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
 const log = `/tmp/netify-regression/${String(index).padStart(2,'0')}.log`;
 writeFileSync(log, `${result.stdout ?? ''}${result.stderr ?? ''}`);
 results.push({ command, passed: result.status === 0, seconds: Math.round((Date.now()-start)/1000), log });
 console.log(`${result.status === 0 ? 'PASS' : 'FAIL'} ${command} (${log})`);
}
writeFileSync('/tmp/netify-regression/results.json', JSON.stringify(results, null, 2));
process.exitCode = results.every((r) => r.passed) ? 0 : 1;
