/** Builds the production final-platform migration from the development one, using the production role names. */
import {readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
let s=await readFile('db/migrations/20261116_final_platform.sql','utf8');
s=s.replace('-- Development first. Production application requires separate owner approval.','-- Production copy of db/migrations/20261116_final_platform.sql. Built by scripts/build-production-final-platform-migration.mjs.\n-- Owner approval for production application recorded 2026-11-19.');
s=s.replaceAll('netify_core_purge_worker','netify_core_live_purge_worker').replaceAll('netify_core_runtime','netify_core_live_runtime').replaceAll('netify_core_purger','netify_core_live_purger');
// Same pattern as the earlier production migrations: the purger role can read and delete rows in every core table.
s=s.trimEnd()+'\nGRANT SELECT,DELETE ON netify_core_phase1.platform_records,netify_core_phase1.platform_events,netify_core_phase1.owner_notifications,netify_core_phase1.owner_access_log TO netify_core_live_purger;\n';
assert(!/netify_core_(runtime|purger|purge_worker)\b/.test(s));assert(!s.includes('disposable_fixture'));
await writeFile('db/migrations/production/20261116_final_platform.sql',s);
