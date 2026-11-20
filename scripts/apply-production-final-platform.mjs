/** Approved final-platform schema extension (additive tables only). No existing project data is read. */
import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {neon} from '@neondatabase/serverless';
assert.equal(process.env.NETIFY_PRODUCTION_MIGRATION_APPROVED,'1');const {url}=JSON.parse(await readFile(process.env.NETIFY_PRODUCTION_CONNECTION_FILE||'/private/tmp/netify-production-connection.json','utf8'));assert.equal(new URL(url).hostname,'ep-ancient-sky-zasmqmzt-pooler.c-2.eu-west-2.aws.neon.tech');
const sql=neon(url),statements=(await readFile('db/migrations/production/20261116_final_platform.sql','utf8')).split(/;\s*\n/).map(s=>s.replace(/^\s*--.*$/gm,'').trim()).filter(Boolean);
await sql.transaction(statements.map(s=>sql.query(s,[])));
const T=['platform_records','platform_events','owner_notifications','owner_access_log'],expected={platform_records:['SELECT','INSERT','UPDATE'],owner_notifications:['SELECT','INSERT','UPDATE'],platform_events:['SELECT','INSERT'],owner_access_log:['SELECT','INSERT']},permissions={};
for(const t of T){permissions[t]={};for(const p of ['SELECT','INSERT','UPDATE','DELETE'])permissions[t][p]=(await sql.query("SELECT has_table_privilege('netify_core_live_runtime',$1,$2) AS ok",['netify_core_phase1.'+t,p]))[0].ok;
 for(const p of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal(permissions[t][p],expected[t].includes(p),`${t} ${p}`);
 permissions[t].purger_delete=(await sql.query("SELECT has_table_privilege('netify_core_live_purger',$1,'DELETE') AS ok",['netify_core_phase1.'+t]))[0].ok;assert(permissions[t].purger_delete);
 permissions[t].public_select=(await sql.query("SELECT has_table_privilege('public',$1,'SELECT') AS ok",['netify_core_phase1.'+t]))[0].ok;assert(!permissions[t].public_select);}
permissions.platform_events.update_excluded=(await sql.query("SELECT has_column_privilege('netify_core_live_runtime','netify_core_phase1.platform_events','excluded','UPDATE') AS ok",[]))[0].ok;assert(permissions.platform_events.update_excluded);
const result={result:'PASS',applied_at:new Date().toISOString(),atomic_migration:true,statements:statements.length,permissions,tables:await sql.query("SELECT table_name FROM information_schema.tables WHERE table_schema='netify_core_phase1' ORDER BY table_name",[]),production_record_reads:0};
await writeFile(process.env.NETIFY_PRODUCTION_EVIDENCE_FILE||'/private/tmp/netify-production-final-platform-evidence.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
