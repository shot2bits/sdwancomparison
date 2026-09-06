import {spawnSync} from 'node:child_process';
// All build processes must inherit one timestamp. next.config is evaluated
// more than once; reading a fresh clock there can cause hydration mismatches.
const timestamp=process.env.NETIFY_BUILD_TIME||new Date().toISOString();
if(Number.isNaN(Date.parse(timestamp))) throw new Error('Invalid NETIFY_BUILD_TIME');
const env={...process.env,NETIFY_BUILD_TIME:timestamp};
function run(command,args){const result=spawnSync(command,args,{env,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
if(!process.argv.includes('--skip-validation'))run('npm',['run','validate']);
run(process.execPath,['node_modules/next/dist/bin/next','build','--webpack']);
