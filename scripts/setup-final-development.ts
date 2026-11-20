import {readFile} from 'node:fs/promises';
import {neon} from '@neondatabase/serverless';
if(process.env.VERCEL_ENV==='production'||process.env.NETIFY_CORE_BRANCH_ID!=='br-aged-union-zar77mut')throw Error('isolated_development_branch_required');
const url=new URL(process.env.NETIFY_CORE_DATABASE_URL??'');if(url.hostname!=='ep-old-union-zaxn5pyr-pooler.c-2.eu-west-2.aws.neon.tech')throw Error('isolated_development_host_required');
const sql=neon(url.toString()),migration=await readFile('db/migrations/20261116_final_platform.sql','utf8');
await sql.transaction(migration.split(/;\s*(?:\n|$)/).map(s=>s.trim()).filter(Boolean).map(s=>sql.query(s,[])));
console.log(JSON.stringify({branch:'netify-core-phase1-20261114',production:false,tables:await sql.query("SELECT tablename FROM pg_tables WHERE schemaname='netify_core_phase1' AND tablename IN ('platform_records','platform_events','owner_notifications','owner_access_log') ORDER BY tablename",[])}));
