/** Private operator tool. Credentials are read from environment, never printed. */
import {writeFileSync} from 'node:fs';
import {isAbsolute} from 'node:path';
const url=process.env.NETIFY_ISOLATED_KV_REST_API_URL;
const token=process.env.NETIFY_ISOLATED_KV_REST_API_TOKEN;
if(!url||!token||!url.startsWith('https://')||url===process.env.KV_REST_API_URL)throw Error('Dedicated preview Redis credentials are required');
const output=process.argv[2];
if(!output||!isAbsolute(output))throw Error('Usage: node scripts/preview-mail-inbox.mjs /absolute/private-output.json');
async function kv(command){const response=await fetch(url,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(command)});const data=await response.json();if(!response.ok||data.error)throw Error('Preview inbox read failed');return data.result;}
let cursor='0';const records=[];
do {const page=await kv(['SCAN',cursor,'MATCH','preview:mail:capture_*','COUNT',100]);cursor=String(page[0]);for(const key of page[1]){const raw=await kv(['GET',key]);if(raw)records.push(JSON.parse(raw));}}while(cursor!=='0');
writeFileSync(output,JSON.stringify(records.sort((a,b)=>b.captured_at-a.captured_at),null,2),{mode:0o600,flag:'wx'});
console.log(`Saved ${records.length} private test captures to the requested new file. No email was sent.`);
