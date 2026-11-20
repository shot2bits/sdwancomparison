/** Explicit, atomic initial production migration. Never reads project records. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
export async function productionStatements(){
 const all=[];
 for(const phase of [1,2,3]){
  const text=await readFile(new URL('../db/migrations/production/20261115_core_phase'+phase+'.sql',import.meta.url),'utf8');
  all.push(...(phase===1?text.split(/(?=^(?:CREATE|REVOKE) )/m).filter(s=>/^(CREATE|REVOKE) /.test(s)):text.split('-- next').filter(s=>s.trim())));
 }
 return all;
}
export async function migrateProduction(){
 assert.equal(process.env.NETIFY_PRODUCTION_MIGRATION_APPROVED,'1','Explicit initial production migration approval required');
 const {url}=JSON.parse(await readFile('/private/tmp/netify-production-connection.json','utf8'));const u=new URL(url);
 assert.equal(u.hostname,'ep-ancient-sky-zasmqmzt-pooler.c-2.eu-west-2.aws.neon.tech');const sql=neon(url);
 assert.equal((await sql.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name='netify_core_phase1'",[])).length,0,'Refuse to overwrite an existing core schema');
 const runtimePassword=randomBytes(32).toString('hex'),purgePassword=randomBytes(32).toString('hex');
 const statements=await productionStatements();
 statements.push(`ALTER ROLE netify_core_live_runtime LOGIN PASSWORD '${runtimePassword}'`,`ALTER ROLE netify_core_live_purge_worker LOGIN PASSWORD '${purgePassword}'`);
 await sql.transaction(statements.map(s=>sql.query(s,[])));
 const roleUrl=(role,password)=>{const a=new URL(url);a.username=role;a.password=password;return a.href;};
 const env={NETIFY_CORE_RUNTIME_DATABASE_URL:roleUrl('netify_core_live_runtime',runtimePassword),NETIFY_CORE_PURGE_DATABASE_URL:roleUrl('netify_core_live_purge_worker',purgePassword),NETIFY_CORE_IDENTITY_KEY:randomBytes(32).toString('hex'),NETIFY_CORE_BRANCH_ID:'br-old-fire-za44gtx1',NETIFY_CORE_ENABLED:'1',NETIFY_CORE_LIVE:'0',NETIFY_CORE_PHASE23:'1',NETIFY_CORE_LEGACY_MCP:'1',NETIFY_CORE_MAIL_MODE:'capture',NETIFY_CORE_WEB_BASEPATH:'/sase'};
 await writeFile('/private/tmp/netify-production-core-env.json',JSON.stringify(env),{mode:0o600});
 const evidence={branch:'br-old-fire-za44gtx1',atomic_migration:true,production_record_reads:0,tables:await sql.query("SELECT table_name FROM information_schema.tables WHERE table_schema='netify_core_phase1' ORDER BY table_name",[]),roles:await sql.query("SELECT rolname,rolsuper,rolcreaterole,rolcreatedb,rolcanlogin FROM pg_roles WHERE rolname LIKE 'netify_core_live_%' ORDER BY rolname",[])};
 assert.equal(evidence.tables.length,12);assert(evidence.roles.every(r=>!r.rolsuper&&!r.rolcreaterole&&!r.rolcreatedb));
 await writeFile('/private/tmp/netify-production-migration-evidence.json',JSON.stringify(evidence,null,2),{mode:0o600});console.log(JSON.stringify(evidence));
}
if(process.argv[1]?.endsWith('/apply-production-core.mjs'))await migrateProduction();
