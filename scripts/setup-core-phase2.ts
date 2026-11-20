import {readFile,writeFile,chmod} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {coreDatabase,CORE_BRANCH} from '../src/lib/core-phase1';
const sql=coreDatabase(),migration=await readFile('db/migrations/20261114_core_phase2.sql','utf8');
try{
 for(const statement of migration.split('\n-- next\n'))if(statement.trim())await sql.query(statement,[]);
 const runtimePassword=randomBytes(32).toString('hex'),purgePassword=randomBytes(32).toString('hex');
 await sql.query(`ALTER ROLE netify_core_runtime LOGIN PASSWORD '${runtimePassword}'`,[]);
 await sql.query(`ALTER ROLE netify_core_purge_worker LOGIN PASSWORD '${purgePassword}'`,[]);
 const base=new URL(process.env.NETIFY_CORE_DATABASE_URL!);const runtime=new URL(base);runtime.username='netify_core_runtime';runtime.password=runtimePassword;const purge=new URL(base);purge.username='netify_core_purge_worker';purge.password=purgePassword;
 let old='';try{old=await readFile('.env.phase23.local','utf8');}catch{}
 const key=old.match(/^NETIFY_CORE_IDENTITY_KEY=(.+)$/m)?.[1]??randomBytes(32).toString('hex');
 const config=['NETIFY_CORE_ENABLED=1','NETIFY_CORE_BRANCH_ID='+CORE_BRANCH,'NETIFY_CORE_PHASE23=1','NETIFY_CORE_DATABASE_URL='+base.toString(),'NETIFY_CORE_RUNTIME_DATABASE_URL='+runtime.toString(),'NETIFY_CORE_PURGE_DATABASE_URL='+purge.toString(),'NETIFY_CORE_IDENTITY_KEY='+key,'NETIFY_CORE_MAIL_MODE=capture','CONTEXT_PREVIEW_PORT=3023'].join('\n')+'\n';
 await writeFile('.env.phase23.local',config,{mode:0o600});await chmod('.env.phase23.local',0o600);
 console.log(JSON.stringify({result:'PASS',branch:CORE_BRANCH,migration:'20261114_core_phase2.sql',roles:['netify_core_runtime','netify_core_purger','netify_core_purge_worker'],mail_mode:'capture',tables:await sql.query("SELECT table_name FROM information_schema.tables WHERE table_schema='netify_core_phase1' ORDER BY table_name",[])}));
}catch(e:any){console.error(JSON.stringify({result:'FAIL',code:e.code??'setup_failed',message:String(e.message).split('\n')[0].replace(/postgres(?:ql)?:\/\/\S+/g,'[private connection]')}));process.exitCode=1;}
